// Arquivar no Drive do escritório (GGVP-107; passos D1.18 e D3.07). Roda sozinho a cada minuto (principal.ts) e pega o
// que falta: o documento do caso vai para a pasta do cliente com o nome "Tipo - Nome do Cliente - AAAA-MM-DD"; o pacote
// do protocolo, para uma pasta dentro da do cliente. O Drive guarda arquivo; o motivo de indeferimento (D3.01) é dado e
// fica só no banco, de onde o acervo lê (decisão do Mateus em 08/10).
// Cada item leva a marca do portal: antes de criar, procura a marca, então reprocessar não duplica (CA3).
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import { normalizarCpf } from '@ggv/campos'
import { nomeTipo } from '../../../web/src/dados/catalogos.ts'
import type { PastaDrive } from '../../../web/src/dados/tipos.ts'
import { nomeSemSobrescrever } from '../../../web/src/regras/arquivos.ts'
import { pastasDoCliente } from '../../../web/src/regras/pasta.ts'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, documento, peticao, peticaoVersao, pessoa, tarefa } from '../banco/esquema.ts'
import type { Drive, ItemDoDrive, PastasDoDrive } from '../drive.ts'
import type { ArquivoDoPacote } from './pacote.ts'

export const PASSO_DO_DRIVE = 'D1.18'
export const TITULO_DA_FALHA = 'Arquivo não foi para o Drive (o portal tenta de novo sozinho)'

/** "AAAA-MM-DD" no horário de Brasília (sem horário de verão desde 2019). */
export const dataDeBrasilia = (quando: Date) => new Date(quando.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

/** O nome do tipo como as telas mostram ("laudo" → "Laudo médico"); tipo só do servidor: "carta_inss" → "Carta inss". */
export function nomeDoTipo(tipo: string) {
  const texto = tipo.replace(/[_-]+/g, ' ').trim()
  return nomeTipo(tipo.replaceAll('_', '-')) || texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "Tipo - Nome do Cliente - AAAA-MM-DD.ext": o padrão que o escritório usa à mão e o balcão segue. */
export const nomeNoDrive = (tipo: string, cliente: string, data: string, extensao: string) => `${tipo} - ${cliente} - ${data}.${extensao}`

const EXTENSOES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'text/plain': 'txt' }
const extensaoDe = (nomeOriginal: string, mime: string) => EXTENSOES[mime] ?? nomeOriginal.split('.').pop()?.toLowerCase() ?? 'bin'

/**
 * O título da pasta como a regra do balcão lê: o nome do cliente é o que vem antes do primeiro " X ", e o CPF vale
 * quando está no título. Formatos em "#5. CLIENTES": "Nome X Benefício - Código", "Nome X Benefício", "CPF X Nome", "Nome".
 */
export function pastaDoTitulo({ id, nome: titulo }: ItemDoDrive): PastaDrive {
  const [antes, depois = ''] = titulo.split(/ X (.*)/s)
  const semCodigo = (s: string) => s.replace(/ - (?=\S*\d)(?=\S*\p{L})[\p{L}\d]+$/u, '').trim()
  if (!/\p{L}/u.test(antes) && normalizarCpf(antes).length === 11) return { id, nome: semCodigo(depois), caminho: titulo, cpf: normalizarCpf(antes) }
  const cpf = titulo.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)?.[0]
  return { id, nome: semCodigo(antes), caminho: titulo, ...(cpf ? { cpf: normalizarCpf(cpf) } : {}) }
}

type Cliente = { id: string; nome: string; cpf: string | null; drivePastaId: string | null }

/** Uma rodada: documentos e pacotes que faltam. Devolve quantos foram e as falhas (sem dado do cliente). */
export async function sincronizarDrive(banco: Banco, drive: Drive, pastas: PastasDoDrive, armazenamento: Armazenamento, agora = () => new Date()) {
  const falhas = new Map<string, string>() // caso → o último erro
  const certos = new Set<string>()
  const erros: string[] = []
  let enviados = 0
  let clientes: PastaDrive[] | null = null // "#5. CLIENTES" é lida uma vez por rodada
  const pastaJa = new Map<string, string>()

  /** Cria só se a marca ainda não está no Drive (CA3). */
  const garantir = async (marca: string, criar: () => Promise<string>) => (await drive.achar(marca)) ?? (await criar())

  const deu = (casoId: string | null) => {
    enviados++
    if (casoId) certos.add(casoId)
  }
  const falhou = (casoId: string | null, e: unknown) => {
    const erro = e instanceof Error ? e.message : String(e)
    erros.push(erro)
    if (casoId) falhas.set(casoId, erro)
  }

  /** CA1: a pasta guardada; senão a regra do balcão; nenhuma, cria "<Nome> X A CLASSIFICAR"; mais de uma, "A REVISAR". */
  async function pastaDoCliente(p: Cliente) {
    const ja = p.drivePastaId ?? pastaJa.get(p.id)
    if (ja) return ja
    clientes ??= (await drive.pastas(pastas.clientes)).map(pastaDoTitulo)
    const achadas = pastasDoCliente(clientes, { nome: p.nome, cpf: p.cpf ?? undefined })
    // ponytail: cliente com uma pasta por benefício vai para "A REVISAR"; escolher pelo benefício quando o escritório disser como.
    if (achadas.length > 1) return pastas.revisar
    const marca = `pessoa:${p.id}`
    const id = achadas[0]?.id ?? (await garantir(marca, () => drive.criarPasta(`${p.nome} X A CLASSIFICAR`, pastas.clientes, marca)))
    await banco.update(pessoa).set({ drivePastaId: id }).where(eq(pessoa.id, p.id))
    pastaJa.set(p.id, id)
    return id
  }

  // CA1, CA2, CA7, CA8: todo documento do caso, venha de onde vier (balcão, card, chat), menos o PDF do pacote e o
  // dado de exemplo, que nunca vai para o Drive do escritório.
  const documentos = await banco
    .select({ d: documento, p: { id: pessoa.id, nome: pessoa.nome, cpf: pessoa.cpf, drivePastaId: pessoa.drivePastaId } })
    .from(documento)
    .leftJoin(caso, eq(documento.casoId, caso.id))
    .innerJoin(pessoa, eq(pessoa.id, sql`coalesce(${documento.pessoaId}, ${caso.pessoaId})`))
    .where(and(eq(documento.drivePendente, true), isNull(documento.excluidoEm), ne(documento.tipo, 'pacote_peticao'), ne(documento.origem, 'exemplo')))
    .orderBy(asc(documento.criadoEm))
  for (const { d, p } of documentos) {
    try {
      // Lê antes de achar a pasta: arquivo que não abre não cria pasta no Drive.
      const conteudo = await armazenamento.ler(d.chaveArmazenamento)
      const pasta = await pastaDoCliente(p)
      const marca = `documento:${d.id}`
      const id = await garantir(marca, async () =>
        drive.enviar({
          nome: nomeSemSobrescrever(nomeNoDrive(nomeDoTipo(d.tipo), p.nome, dataDeBrasilia(d.criadoEm), extensaoDe(d.nomeOriginal, d.mime)), await drive.nomes(pasta)),
          paiId: pasta,
          mime: d.mime,
          conteudo,
          marca,
        }),
      )
      await banco.update(documento).set({ driveArquivoId: id, drivePendente: false }).where(eq(documento.id, d.id))
      deu(d.casoId)
    } catch (e) {
      falhou(d.casoId, e)
    }
  }

  // CA6: o pacote da versão aprovada, numa pasta dentro da do cliente. A marca leva o momento do pacote: gerado de novo,
  // vai para outra pasta.
  const pacotes = await banco
    .select({ v: peticaoVersao, casoId: caso.id, p: { id: pessoa.id, nome: pessoa.nome, cpf: pessoa.cpf, drivePastaId: pessoa.drivePastaId } })
    .from(peticaoVersao)
    .innerJoin(peticao, eq(peticaoVersao.peticaoId, peticao.id))
    .innerJoin(caso, eq(peticao.casoId, caso.id))
    .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .where(and(isNotNull(peticaoVersao.pacoteGeradoEm), isNull(peticaoVersao.pacoteDriveId)))
  for (const { v, casoId, p } of pacotes) {
    try {
      const gerado = v.pacoteGeradoEm!
      const marca = `pacote:${v.id}:${gerado.getTime()}`
      const pasta = await pastaDoCliente(p)
      const doPacote = await garantir(marca, async () =>
        drive.criarPasta(nomeSemSobrescrever(`Pacote de protocolo - ${dataDeBrasilia(gerado)}`, await drive.nomes(pasta)), pasta, marca),
      )
      const usados: string[] = []
      for (const a of (v.pacote ?? []) as ArquivoDoPacote[]) {
        const nome = nomeSemSobrescrever(a.nome, usados)
        usados.push(nome)
        const [d] = await banco.select().from(documento).where(eq(documento.id, a.documentoId))
        await garantir(`${marca}:${a.documentoId}`, async () =>
          drive.enviar({ nome, paiId: doPacote, mime: d.mime, conteudo: await armazenamento.ler(d.chaveArmazenamento), marca: `${marca}:${a.documentoId}` }),
        )
      }
      // Só marca se o pacote não foi gerado de novo enquanto ia.
      await banco.update(peticaoVersao).set({ pacoteDriveId: doPacote }).where(and(eq(peticaoVersao.id, v.id), eq(peticaoVersao.pacoteGeradoEm, gerado)))
      deu(casoId)
    } catch (e) {
      falhou(casoId, e)
    }
  }

  // CA3: a falha vira uma tarefa da Documentação por caso; fecha sozinha quando a rodada manda tudo do caso.
  const daFalha = and(eq(tarefa.passo, PASSO_DO_DRIVE), eq(tarefa.titulo, TITULO_DA_FALHA), isNull(tarefa.concluidaEm))
  for (const casoId of falhas.keys()) {
    const [aberta] = await banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, casoId), daFalha)).limit(1)
    if (!aberta) await banco.insert(tarefa).values({ casoId, passo: PASSO_DO_DRIVE, titulo: TITULO_DA_FALHA, perfilDono: 'documentacao', criadoEm: agora() })
  }
  const resolvidos = [...certos].filter((c) => !falhas.has(c))
  if (resolvidos.length) await banco.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora() }).where(and(inArray(tarefa.casoId, resolvidos), daFalha))

  return { enviados, falhas: erros }
}
