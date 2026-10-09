// Clientes e Processos (GGVP-78, Figma 1927:605 e 1927:888): as duas bases do topo, para quem vê o caso. A busca é a do
// balcão (nome, CPF, telefone) mais o número do processo; o termo vem no corpo do POST, para o CPF não ir no endereço.
// Sem valores e sem conteúdo médico: do perito sai o nome; do desfecho, o resultado. O CPF sai mascarado.
// ponytail: lê todos os casos e filtra aqui; passar o filtro e a página para o SQL quando o escritório passar de milhares.
import { desc, eq, isNotNull, max, min } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { formatarCnj, formatarNb, somenteDigitos } from '@ggv/campos'
import { FiltrosDeClientes, FiltrosDeProcessos, ListaDeClientes, ListaDeProcessos, POR_PAGINA, ROTULO_BENEFICIO, type Beneficio, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { atendimento, caso, identificadorCaso, juizo, pericia, perito, pessoa, peticao, peticaoVersao, processoAcervo, protocoloJudicial } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { criarFichario, NO_CATALOGO } from './recepcao.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import { desfechoDaLista, mascararCpf, situacaoDoCliente } from '../../../web/src/regras/bases.ts'
import { bateNaBusca, MINIMO_DIGITOS } from '../../../web/src/regras/busca.ts'

export const MSG_FILTRO_INVALIDO = 'Filtro inválido.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const opcoes = (valores: (string | null)[]) => [...new Set(valores.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
/** A página pedida além da última vira a última: o filtro novo nunca cai numa página vazia sem botão de voltar. */
function paginar<T>(linhas: T[], pedida: number, tudo: boolean) {
  if (tudo) return { linhas, pagina: 1, paginas: 1 }
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA))
  const pagina = Math.min(pedida, paginas)
  return { linhas: linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), pagina, paginas }
}
/**
 * Um catálogo só, o das telas (o da ficha e da página do processo): o caso traz o benefício do servidor, o lead o do
 * interesse. "Não sei ainda" fica sem benefício.
 */
const rotuloDoBeneficio = (id: string | null | undefined) =>
  !id || id === 'nao-sei' ? null : nomeBeneficio(NO_CATALOGO[id] ?? id) || (ROTULO_BENEFICIO[id as Beneficio] ?? id)

export function registrarRotasBases(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const historico = registrarHistorico(banco, agora)
  const { fichas } = criarFichario(banco, agora)
  const entrada = (pedido: FastifyRequest) => (pedido.method === 'GET' ? pedido.query : pedido.body)

  /** Uma linha por caso, com o que a busca precisa (CPF, telefone, números) e a lista não manda. */
  async function linhasDosCasos() {
    const casos = await banco
      .select({ id: caso.id, clienteId: caso.pessoaId, beneficio: caso.beneficio, fase: caso.fase, desfecho: caso.desfecho, criadoEm: caso.criadoEm, autor: pessoa.nome, cpf: pessoa.cpf, telefone: pessoa.telefone })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    const numeros = await banco.select({ casoId: identificadorCaso.casoId, tipo: identificadorCaso.tipo, valor: identificadorCaso.valor }).from(identificadorCaso)
    const acervo = await banco
      .select({ casoId: processoAcervo.casoId, cnj: processoAcervo.numeroCnj, desfecho: processoAcervo.desfecho, conferidoPor: processoAcervo.desfechoConferidoPor, foro: juizo.nome, perito: perito.nome })
      .from(processoAcervo)
      .leftJoin(juizo, eq(processoAcervo.juizoId, juizo.id))
      .leftJoin(perito, eq(processoAcervo.peritoId, perito.id))
      .where(isNotNull(processoAcervo.casoId))
    // O perito da perícia mais nova; a social leva "(social)", como no Figma.
    const pericias = await banco.select({ casoId: pericia.casoId, tipo: pericia.tipo, perito: perito.nome }).from(pericia).innerJoin(perito, eq(pericia.peritoId, perito.id)).orderBy(desc(pericia.criadoEm))
    const ajuizados = await banco
      .select({ casoId: peticao.casoId, em: min(protocoloJudicial.protocoladoEm) })
      .from(protocoloJudicial)
      .innerJoin(peticaoVersao, eq(protocoloJudicial.peticaoVersaoId, peticaoVersao.id))
      .innerJoin(peticao, eq(peticaoVersao.peticaoId, peticao.id))
      .where(eq(peticao.tipo, 'inicial'))
      .groupBy(peticao.casoId)

    return casos.map((c) => {
      const doCaso = numeros.filter((n) => n.casoId === c.id)
      const a = acervo.find((x) => x.casoId === c.id)
      const p = pericias.find((x) => x.casoId === c.id)
      const cnj = doCaso.find((n) => n.tipo === 'cnj')?.valor ?? a?.cnj
      const nb = doCaso.find((n) => n.tipo === 'nb')?.valor
      const protocolo = doCaso.find((n) => n.tipo === 'protocolo_inss')?.valor
      const ajuizado = ajuizados.find((x) => x.casoId === c.id)?.em
      return {
        id: c.id,
        numero: cnj ? formatarCnj(cnj) : nb ? formatarNb(nb) : (protocolo ?? null),
        clienteId: c.clienteId,
        autor: c.autor,
        beneficio: rotuloDoBeneficio(c.beneficio),
        fase: c.fase,
        foro: a?.foro ?? null,
        // ponytail: o banco ainda não guarda o juiz do juízo; a coluna e o filtro esperam a importação gravar.
        juiz: null as string | null,
        perito: a?.perito ?? (p ? `${p.perito}${p.tipo === 'social' ? ' (social)' : ''}` : null),
        desfecho: desfechoDaLista(c.desfecho, a?.conferidoPor ? a.desfecho : null),
        ajuizadoEm: ajuizado ? hojeEmBrasilia(new Date(ajuizado)) : null,
        // Só para a busca, a ordem e a contagem; o contrato tira antes de responder.
        cpf: c.cpf,
        telefone: c.telefone ?? '',
        numeros: [cnj, nb, protocolo, ...doCaso.map((n) => n.valor)].filter((n): n is string => !!n),
        criadoEm: c.criadoEm.toISOString(),
        doAcervo: !!a,
      }
    })
  }
  type LinhaDoCaso = Awaited<ReturnType<typeof linhasDosCasos>>[number]

  /** Nome, CPF ou telefone pela regra do balcão; só dígitos também acham o número do processo (CNJ, NB, protocolo). */
  function bate(l: Pick<LinhaDoCaso, 'autor' | 'cpf' | 'telefone' | 'numeros'>, termo: string) {
    if (bateNaBusca({ nome: l.autor, cpf: l.cpf ?? undefined, telefone: l.telefone }, termo)) return true
    const digitos = /\p{L}/u.test(termo) ? '' : somenteDigitos(termo)
    return digitos.length >= MINIMO_DIGITOS && l.numeros.some((n) => n.includes(digitos))
  }

  async function exportou(pedido: FastifyRequest, lista: string, linhas: number) {
    // Quem tirou a base inteira, e quantas linhas; nunca o termo da busca (pode ser um CPF).
    await historico(pedido.usuario!.id, 'lista_exportada', pedido, lista, { linhas, perfil: pedido.perfilAtivo })
  }

  async function processos(pedido: FastifyRequest, resposta: FastifyReply) {
    const e = FiltrosDeProcessos.safeParse(entrada(pedido))
    if (!e.success) return negar(resposta, 400, MSG_FILTRO_INVALIDO)
    const f = e.data
    const todas = await linhasDosCasos()
    const filtradas = todas
      .filter(
        (l) =>
          (!f.busca || bate(l, f.busca)) &&
          (!f.cliente || l.clienteId === f.cliente) &&
          (!f.beneficio || l.beneficio === f.beneficio) &&
          (!f.foro || l.foro === f.foro) &&
          (!f.juiz || l.juiz === f.juiz) &&
          (!f.perito || l.perito === f.perito) &&
          (!f.exito || l.desfecho === f.exito) &&
          (!f.fase || l.fase === f.fase),
      )
      .sort((a, b) =>
        f.ordem === 'autor'
          ? a.autor.localeCompare(b.autor, 'pt-BR')
          : (b.ajuizadoEm ?? '').localeCompare(a.ajuizadoEm ?? '') || b.criadoEm.localeCompare(a.criadoEm),
      )
    const p = paginar(filtradas, f.pagina, !!f.tudo)
    if (f.tudo) await exportou(pedido, 'processos', filtradas.length)
    return ListaDeProcessos.parse({
      processos: p.linhas,
      total: filtradas.length,
      doAcervo: filtradas.filter((l) => l.doAcervo).length,
      pagina: p.pagina,
      paginas: p.paginas,
      opcoes: {
        beneficios: opcoes(todas.map((l) => l.beneficio)),
        foros: opcoes(todas.map((l) => l.foro)),
        juizes: opcoes(todas.map((l) => l.juiz)),
        peritos: opcoes(todas.map((l) => l.perito)),
      },
    })
  }

  async function clientes(pedido: FastifyRequest, resposta: FastifyReply) {
    const e = FiltrosDeClientes.safeParse(entrada(pedido))
    if (!e.success) return negar(resposta, 400, MSG_FILTRO_INVALIDO)
    const f = e.data
    const casos = (await linhasDosCasos()).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    // As conversas registradas no servidor (D5) também são contato.
    const conversas = await banco.select({ pessoaId: atendimento.pessoaId, em: max(atendimento.inicio) }).from(atendimento).groupBy(atendimento.pessoaId)
    const todas = (await fichas()).map((ficha) => {
      const dele = casos.filter((c) => c.clienteId === ficha.id)
      const lead = ficha.situacao === 'lead'
      const conversa = conversas.find((c) => c.pessoaId === ficha.id)?.em
      const contatos = [...ficha.contatos.map((c) => c.data), ...(conversa ? [hojeEmBrasilia(new Date(conversa))] : [])].sort()
      return {
        id: ficha.id,
        nome: ficha.nome,
        cpf: mascararCpf(ficha.cpf),
        beneficio: dele[0]?.beneficio ?? rotuloDoBeneficio(ficha.beneficioInteresse),
        cidade: ficha.cidadeUf ? ficha.cidadeUf.replace(/\s*\/\s*/, ' · ') : null,
        processos: dele.length,
        situacao: situacaoDoCliente(lead, dele),
        ultimoContato: contatos.at(-1) ?? null,
        // Só para o filtro e a busca; o contrato tira antes de responder.
        lead,
        arquivado: ficha.fechamento?.situacao === 'arquivado',
        cpfInteiro: ficha.cpf,
        telefone: ficha.telefone,
      }
    })
    const filtradas = todas
      .filter(
        (c) =>
          (!f.busca || bateNaBusca({ nome: c.nome, cpf: c.cpfInteiro, telefone: c.telefone }, f.busca)) &&
          (!f.beneficio || c.beneficio === f.beneficio) &&
          (!f.cidade || c.cidade === f.cidade) &&
          (!f.exito || c.situacao === f.exito) &&
          (f.situacao === 'todos' || (!c.arquivado && (f.situacao === 'ativos' || (f.situacao === 'leads') === c.lead))),
      )
      .sort((a, b) => (f.ordem === 'contato' && (b.ultimoContato ?? '').localeCompare(a.ultimoContato ?? '')) || a.nome.localeCompare(b.nome, 'pt-BR'))
    const p = paginar(filtradas, f.pagina, !!f.tudo)
    if (f.tudo) await exportou(pedido, 'clientes', filtradas.length)
    return ListaDeClientes.parse({
      clientes: p.linhas,
      total: filtradas.length,
      leads: filtradas.filter((c) => c.lead).length,
      pagina: p.pagina,
      paginas: p.paginas,
      opcoes: { beneficios: opcoes(todas.map((c) => c.beneficio)), cidades: opcoes(todas.map((c) => c.cidade)) },
    })
  }

  app.get('/api/clientes', ver, clientes)
  app.post('/api/clientes/busca', ver, clientes)
  app.get('/api/processos', ver, processos)
  app.post('/api/processos/busca', ver, processos)
}
