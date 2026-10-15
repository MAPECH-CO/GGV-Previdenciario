// O papel do scanner entra pelo Drive (GGVP-158 P4.3, ADR-017; decisão do Mateus, 13/10). A cada minuto, junto com a
// rodada do Drive, o portal lê a lista de mudanças do Drive compartilhado e traz o arquivo novo que apareceu na pasta de um
// cliente: ele entra na ficha como chegado pelo scanner, aponta para o Drive (sem cópia no portal) e vai à leitura da IA.
// O n8n não muda. Não roda com o Drive só leitura: a homologação, que olha o Drive real, não traz documento de cliente.
import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { normalizarCpf } from '@ggv/campos'
import type { Banco } from '../banco/conexao.ts'
import { configuracao, documento, pessoa, tarefaRecepcao } from '../banco/esquema.ts'
import type { Drive, ItemMudado, PastasDoDrive } from '../drive.ts'
import { TIPOS_DE_ANEXO } from '../rotas/formulario.ts'
import { UUID, criarFichario } from '../rotas/recepcao.ts'
import { TIPOS_DE_DOCUMENTO } from '../../../web/src/dados/catalogos.ts'
import type { Arquivo, Ficha, LoteDigitalizado, TarefaEncaminhada } from '../../../web/src/dados/tipos.ts'
import { localDoTipo, nomeSemSobrescrever } from '../../../web/src/regras/arquivos.ts'
import { semAcento } from '../../../web/src/regras/busca.ts'
import { ehMedico } from '../../../web/src/regras/leitura.ts'
import { pastasDoCliente } from '../../../web/src/regras/pasta.ts'
import { pastaDoTitulo } from './arquivar.ts'
import type { Conteudo, Leitor } from './leitura.ts'

/** Onde fica a marca da lista de mudanças do Drive, na `configuracao`. */
export const MARCA_DO_SCANNER = 'drive:mudancas'
/**
 * GGVP-158 I12: o arquivo novo numa pasta sem ficha única fica guardado aqui e volta a cada rodada, até a pasta ser ligada
 * (ADR-017: "o arquivo não entra até alguém ligar a pasta pela ficha"). A marca anda; o arquivo não some com ela.
 */
export const DE_FORA_DO_SCANNER = 'drive:de-fora'
const SCANNER = 'Automação do scanner'
const LAUDOS = ['laudo', 'relatorio-medico', 'prontuario']
const documentos = (n: number) => (n === 1 ? '1 documento' : `${n} documentos`)

/** O tipo pelo começo do nome ("Laudo médico - Rita Exemplo - 2026-10-13.pdf", o padrão do n8n); fora do catálogo, "outro". */
export function tipoPeloNome(nome: string): string {
  const inicio = semAcento(nome.split(' - ')[0])
  return TIPOS_DE_DOCUMENTO.find((t) => t.id === inicio || semAcento(t.nome) === inicio)?.id ?? 'outro'
}

type Opcoes = { banco: Banco; drive: Drive; pastas: PastasDoDrive; leitor: Leitor; agora?: () => Date }
type Chegou = { item: ItemMudado; conteudo: Conteudo }

/**
 * Uma rodada do scanner. A primeira só guarda a marca. Com falha ao baixar, a marca não anda, e a rodada seguinte tenta
 * de novo; o que já entrou não repete (`drive_arquivo_id`). Devolve só contagens, sem dado do cliente.
 */
export async function olharOScanner({ banco, drive, pastas, leitor, agora = () => new Date() }: Opcoes) {
  const { hoje, evento, fichas, guardar, lerArquivosNovos, avisarLaudoNovo } = criarFichario(banco, agora)
  const [guardada] = await banco.select().from(configuracao).where(eq(configuracao.chave, MARCA_DO_SCANNER))
  const { itens, marca } = await drive.mudancas((guardada?.valor as string | undefined) ?? null, pastas.clientes)
  const guardarMarca = () =>
    banco.insert(configuracao).values({ chave: MARCA_DO_SCANNER, valor: marca }).onConflictDoUpdate({ target: configuracao.chave, set: { valor: marca, atualizadoEm: agora() } })
  const conta = { entraram: 0, ficaramDeFora: 0, falhas: 0 }
  if (!guardada) {
    await guardarMarca()
    return conta
  }

  const [guardadosDeFora] = await banco.select().from(configuracao).where(eq(configuracao.chave, DE_FORA_DO_SCANNER))
  const deFora: ItemMudado[] = []
  // Fica fora: pasta, lixeira, outro tipo de arquivo, o que o portal mandou e o que está em "A REVISAR". O que ficou de fora
  // nas rodadas anteriores volta junto, depois das mudanças novas.
  const vistos = new Set<string>()
  const candidatos = [...itens, ...((guardadosDeFora?.valor as ItemMudado[] | undefined) ?? [])].filter((i) => !i.fora && !i.doPortal && TIPOS_DE_ANEXO.includes(i.mime) && i.pais.length > 0 && !i.pais.includes(pastas.revisar) && !vistos.has(i.id) && vistos.add(i.id))
  const conhecidos = new Set(
    candidatos.length === 0
      ? []
      : (await banco.select({ id: documento.driveArquivoId }).from(documento).where(inArray(documento.driveArquivoId, candidatos.map((i) => i.id)))).map((d) => d.id),
  )

  // A ficha de cada pasta: a ligada; senão, a do título, se ele leva a uma ficha só e os CPFs não brigam (a regra do balcão).
  const donoDaPasta = new Map<string, string | null>()
  let todas: Ficha[] | null = null
  async function dono(pastaId: string): Promise<string | null> {
    if (donoDaPasta.has(pastaId)) return donoDaPasta.get(pastaId)!
    const [ligada] = await banco.select({ id: pessoa.id }).from(pessoa).where(eq(pessoa.drivePastaId, pastaId))
    let id = ligada?.id ?? null
    if (!id) {
      const onde = await drive.onde(pastaId)
      const pasta = pastaDoTitulo({ id: pastaId, nome: onde.nome })
      todas ??= await fichas()
      const donos = onde.pais.includes(pastas.clientes)
        ? todas.filter((f) => (!pasta.cpf || !f.cpf || pasta.cpf === normalizarCpf(f.cpf)) && pastasDoCliente([pasta], { nome: f.nome, cpf: f.cpf }).length > 0)
        : []
      if (donos.length === 1) {
        id = donos[0].id
        await banco.update(pessoa).set({ drivePastaId: pastaId }).where(eq(pessoa.id, id))
      }
    }
    donoDaPasta.set(pastaId, id)
    return id
  }

  const porFicha = new Map<string, Chegou[]>()
  for (const item of candidatos.filter((i) => !conhecidos.has(i.id))) {
    try {
      const fichaId = await dono(item.pais[0])
      if (!fichaId) {
        conta.ficaramDeFora++
        deFora.push(item)
        continue
      }
      const conteudo = { bytes: await drive.baixar(item.id), mime: item.mime }
      porFicha.set(fichaId, [...(porFicha.get(fichaId) ?? []), { item, conteudo }])
    } catch {
      conta.falhas++
    }
  }

  for (const [fichaId, chegaram] of porFicha) {
    const [ficha] = await fichas([fichaId])
    if (!ficha) continue
    // Com um caso só, o documento vai a ele; com mais de um, a Documentação escolhe na conferência.
    const caso = ficha.processos.length === 1 ? ficha.processos[0] : undefined
    const novos: { arquivo: Arquivo; conteudo: Conteudo }[] = []
    for (const { item, conteudo } of chegaram) {
      const hash = createHash('sha256').update(conteudo.bytes).digest('hex')
      const tipo = tipoPeloNome(item.nome)
      const local = localDoTipo(tipo, caso?.id)
      const nome = nomeSemSobrescrever(item.nome, ficha.arquivos.filter((a) => a.local === local).map((a) => a.nome))
      const arquivo: Arquivo = { nome, tipo, local, data: hoje(), origem: 'scanner', repetido: ficha.arquivos.some((a) => a.hash === hash), aguardaLeitura: true, hash }
      ficha.arquivos.push(arquivo)
      await banco.insert(documento).values({
        pessoaId: ficha.id,
        casoId: caso && UUID.test(caso.id) ? caso.id : null,
        tipo,
        origem: 'scanner',
        sensivel: ehMedico(tipo),
        chaveArmazenamento: `drive:${item.id}`,
        nomeOriginal: item.nome,
        mime: item.mime,
        tamanho: conteudo.bytes.length,
        hashSha256: hash,
        driveArquivoId: item.id,
        drivePendente: false,
      })
      novos.push({ arquivo, conteudo })
      conta.entraram++
    }
    ficha.pastaId ??= chegaram[0].item.pais[0]
    ficha.historico.push(evento(`Chegou pelo scanner: ${documentos(novos.length)} na pasta do Drive`, SCANNER))
    if (novos.some(({ arquivo }) => LAUDOS.includes(arquivo.tipo))) await avisarLaudoNovo(ficha, caso, hoje(), 'Chegou laudo novo pelo scanner; enviado ao Jurídico para análise', SCANNER)
    // O lote da tarefa "Receber documento" aberta, para o registro do recebimento (GGVP-17 CA5). ponytail: sem contar as
    // páginas do PDF (0); contar quando a tela mostrar o número.
    const [aberta] = await banco
      .select()
      .from(tarefaRecepcao)
      .where(and(eq(tarefaRecepcao.pessoaId, ficha.id), isNull(tarefaRecepcao.concluidaEm), sql`${tarefaRecepcao.dados}->>'acao' = 'Receber documento'`))
    if (aberta) {
      const lote: LoteDigitalizado = {
        loteId: `drive-${marca}`,
        status: 'arquivado',
        motivo: 'chegou na pasta do cliente no Drive',
        fichaId: ficha.id,
        conferirPapel: false,
        arquivos: novos.map(({ arquivo }) => ({ nome: arquivo.nome, tipo: arquivo.tipo, paginas: 0 })),
      }
      await banco.update(tarefaRecepcao).set({ dados: { ...(aberta.dados as TarefaEncaminhada), lote } }).where(eq(tarefaRecepcao.id, aberta.id))
    }
    await guardar(ficha)
    await lerArquivosNovos(ficha, leitor, null, new Map(novos.map(({ arquivo, conteudo }) => [arquivo.nome, conteudo])))
  }
  if (conta.falhas === 0) await guardarMarca()
  await banco
    .insert(configuracao)
    .values({ chave: DE_FORA_DO_SCANNER, valor: deFora })
    .onConflictDoUpdate({ target: configuracao.chave, set: { valor: deFora, atualizadoEm: agora() } })
  return conta
}
