// A cobrança dos documentos pendentes do caso da Recepção no servidor (GGVP-101; GGVP-125, bloco 5c). A conferência
// incompleta do checklist abre a cobrança (recepcao-checklist.ts); o que falta é sempre o checklist de agora, e a cobrança
// fecha sozinha quando nada mais falta (CA9). Duas tentativas, três dias; no limite, só a Sênior decide, com justificativa
// (G15, CA3, CA8). As regras são as das telas (regras/cobranca.ts).
import { and, asc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AdiamentoDaCobranca, DecisaoDaCobranca, TentativaDaCobranca, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { cobrancaDocumento } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { criarChecklist } from './recepcao-checklist.ts'
import { criarFichario } from './recepcao.ts'
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { somarDias } from '../../../web/src/regras/agenda.ts'
import { juntar, type ChecklistDoCaso, type ChecklistNaCopia } from '../../../web/src/regras/checklist.ts'
import {
  CANAIS,
  OPCOES_DA_SENIOR,
  RESULTADOS,
  TENTATIVAS_DE_COBRANCA,
  cobrancaDoCaso,
  motivoParaNaoAdiar,
  motivoParaNaoDecidir,
  naSenior,
  type Cobranca,
  type CobrancaDoCaso,
} from '../../../web/src/regras/cobranca.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export const MSG_COBRANCA_NAO_ENCONTRADA = 'Cobrança não encontrada.'
const CHEGOU_TUDO = 'Chegou tudo o que faltava: a cobrança fechou e os lembretes foram cancelados'

export function criarCobranca(banco: Banco, agora: () => Date) {
  const { evento, guardar } = criarFichario(banco, agora)

  /** Fecha a cobrança aberta quando o checklist de agora não tem mais nada faltando (CA9). Uma vez só, mesmo com duas sessões. */
  async function fecharSeChegouTudo(id: string, c: Cobranca, faltam: string[], ficha: Ficha): Promise<Cobranca> {
    if (c.encerrada || faltam.length > 0) return c
    const fechada: Cobranca = { ...c, encerrada: { quando: agora().toISOString(), porque: 'recebeu-tudo' } }
    const [mudou] = await banco
      .update(cobrancaDocumento)
      .set({ dados: fechada, atualizadoEm: agora() })
      .where(and(eq(cobrancaDocumento.id, id), sql`${cobrancaDocumento.dados}->'encerrada' is null`))
      .returning({ id: cobrancaDocumento.id })
    if (mudou) {
      ficha.historico.push(evento(CHEGOU_TUDO, 'Sistema'))
      await guardar(ficha)
    }
    return fechada
  }

  /** As cobranças para a cópia das telas (GET /api/recepcao), já fechadas quando chegou tudo. */
  async function daCopia(fichas: Ficha[], checklists: ChecklistNaCopia[]): Promise<Cobranca[]> {
    const linhas = await banco.select().from(cobrancaDocumento).orderBy(asc(cobrancaDocumento.atualizadoEm))
    const cobrancas: Cobranca[] = []
    for (const l of linhas) {
      const c = l.dados as Cobranca
      const checklist = checklists.find((x) => x.processoId === c.processoId)
      const ficha = fichas.find((f) => f.id === c.fichaId)
      cobrancas.push(checklist && ficha ? await fecharSeChegouTudo(l.id, c, checklist.checklist.faltam, ficha) : c)
    }
    return cobrancas
  }

  return { fecharSeChegouTudo, daCopia }
}

type Recusa = { status: number; erro: string }

export function registrarRotasRecepcaoCobranca(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { doCaso } = criarChecklist(banco, agora)
  const { fecharSeChegouTudo } = criarCobranca(banco, agora)
  const { hoje, evento, nomeDe, guardar, fichas } = criarFichario(banco, agora)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  const daSenior = { preHandler: exigir(banco, 'cobranca.decidir', agora) }

  const naTela = (c: Cobranca, achado: ChecklistDoCaso) => cobrancaDoCaso(c, { ...achado, faltam: achado.checklist.faltam }, hoje())

  /** A cobrança do caso: a aberta; sem aberta, a última, como na tela. Antes, fecha se chegou tudo. */
  async function acharCobranca(casoId: string) {
    const achado = await doCaso(casoId)
    if (!achado) return null
    const linhas = await banco.select().from(cobrancaDocumento).where(eq(cobrancaDocumento.casoId, casoId)).orderBy(asc(cobrancaDocumento.atualizadoEm))
    const linha = linhas.find((l) => !(l.dados as Cobranca).encerrada) ?? linhas.at(-1)
    if (!linha) return null
    const c = await fecharSeChegouTudo(linha.id, linha.dados as Cobranca, achado.checklist.faltam, achado.ficha)
    return { achado, id: linha.id, atual: naTela(c, achado) }
  }

  /** Muda a cobrança com a linha travada: duas sessões não registram a mesma tentativa duas vezes. */
  async function mudar(id: string, achado: ChecklistDoCaso, mudanca: (atual: CobrancaDoCaso) => Cobranca | Recusa): Promise<Cobranca | Recusa> {
    return banco.transaction(async (tx) => {
      const [l] = await tx.select().from(cobrancaDocumento).where(eq(cobrancaDocumento.id, id)).for('update')
      const atual = naTela(l.dados as Cobranca, achado)
      if (atual.situacao === 'encerrada') return { status: 409, erro: 'A cobrança está fechada.' }
      const nova = mudanca(atual)
      if ('erro' in nova) return nova
      await tx.update(cobrancaDocumento).set({ dados: nova, atualizadoEm: agora() }).where(eq(cobrancaDocumento.id, id))
      return nova
    })
  }

  /** A resposta das rotas que mudam: a cobrança como a tela mostra, com a ficha e as cobranças do caso para a cópia. */
  async function responder(c: Cobranca, achado: ChecklistDoCaso) {
    await guardar(achado.ficha)
    const [ficha] = await fichas([achado.ficha.id])
    const doCasoAgora = await banco.select({ dados: cobrancaDocumento.dados }).from(cobrancaDocumento).where(eq(cobrancaDocumento.casoId, c.processoId))
    return { ...naTela(c, { ...achado, ficha }), cobrancas: doCasoAgora.map((x) => x.dados as Cobranca) }
  }

  app.get<{ Params: { id: string } }>('/api/processos/:id/cobranca', ver, async (pedido, resposta) => {
    const achou = await acharCobranca(pedido.params.id)
    return achou ? achou.atual : negar(resposta, 404, MSG_COBRANCA_NAO_ENCONTRADA)
  })

  // CA3, CA6: data, canal e resultado; a segunda sem resposta sobe para a Sênior. O envio pelo Chatwoot já fica nos contatos
  // pelo correio do servidor.
  app.post<{ Params: { id: string } }>('/api/processos/:id/cobranca/tentativas', editar, async (pedido, resposta) => {
    const entrada = TentativaDaCobranca.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Canal ou resultado inválido.')
    const achou = await acharCobranca(pedido.params.id)
    if (!achou) return negar(resposta, 404, MSG_COBRANCA_NAO_ENCONTRADA)
    const quem = await nomeDe(pedido)
    const dia = hoje()
    const { canal, resultado } = entrada.data
    const r = await mudar(achou.id, achou.achado, (atual) =>
      atual.motivoParado ? { status: 409, erro: atual.motivoParado } : { ...atual.cobranca, tentativas: [...atual.cobranca.tentativas, { dia, canal, resultado, quem }] },
    )
    if ('erro' in r) return negar(resposta, r.status, r.erro)
    const { ficha } = achou.achado
    ficha.historico.push(evento(`Cobrança: ${r.tentativas.length}ª tentativa por ${CANAIS[canal]} (${RESULTADOS[resultado]}); falta: ${juntar(achou.atual.faltam)}`, quem))
    if (naSenior(r, dia)) ficha.historico.push(evento(`A cobrança passou do limite de ${TENTATIVAS_DE_COBRANCA} tentativas: foi para a advogada sênior decidir (G15)`, quem))
    return responder(r, achou.achado)
  })

  // CA10: a nova data é obrigatória, depois de hoje e antes do prazo externo; o contador não volta a zero.
  app.post<{ Params: { id: string } }>('/api/processos/:id/cobranca/adiamento', editar, async (pedido, resposta) => {
    const entrada = AdiamentoDaCobranca.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Informe a nova data (dd/mm/aaaa).')
    const achou = await acharCobranca(pedido.params.id)
    if (!achou) return negar(resposta, 404, MSG_COBRANCA_NAO_ENCONTRADA)
    const dia = hoje()
    const { para } = entrada.data
    const r = await mudar(achou.id, achou.achado, (atual) => {
      if (atual.situacao === 'na-senior') return { status: 409, erro: 'Passou do limite: a sênior decide.' }
      const motivo = motivoParaNaoAdiar(para, dia, atual.cobranca.prazo)
      return motivo ? { status: 400, erro: motivo } : { ...atual.cobranca, adiadaPara: para! }
    })
    if ('erro' in r) return negar(resposta, r.status, r.erro)
    const feitas = r.tentativas.length
    const contagem = feitas === 1 ? '1 tentativa' : `${feitas} tentativas`
    achou.achado.ficha.historico.push(evento(`Adiou a cobrança para ${dataCurta(para!, dia)}; a contagem continua em ${contagem}`, await nomeDe(pedido)))
    return responder(r, achou.achado)
  })

  // CA8, G15: só a Sênior, só no limite, sempre com justificativa; a decisão volta para o Atendimento.
  app.post<{ Params: { id: string } }>('/api/processos/:id/cobranca/decisao', daSenior, async (pedido, resposta) => {
    const entrada = DecisaoDaCobranca.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Decisão inválida.')
    const achou = await acharCobranca(pedido.params.id)
    if (!achou) return negar(resposta, 404, MSG_COBRANCA_NAO_ENCONTRADA)
    const quem = await nomeDe(pedido)
    const dia = hoje()
    const { opcao, prazo } = entrada.data
    const justificativa = entrada.data.justificativa.trim()
    const r = await mudar(achou.id, achou.achado, (atual) => {
      if (atual.situacao !== 'na-senior') return { status: 409, erro: 'A cobrança ainda não chegou ao limite.' }
      const motivo = motivoParaNaoDecidir({ opcao, justificativa, prazo: prazo ?? null }, dia)
      if (motivo) return { status: 400, erro: motivo }
      const c = atual.cobranca
      const decidida: Cobranca = { ...c, decisoes: [...c.decisoes, { opcao, justificativa, prazo, quando: agora().toISOString(), quem }] }
      if (opcao === 'nova-tentativa') return { ...decidida, adiadaPara: prazo }
      // Pedir a visita é falar com o cliente: a próxima tentativa é já, no dia seguinte à última.
      if (opcao === 'visita') return { ...decidida, adiadaPara: [dia, somarDias(c.tentativas.at(-1)!.dia, 1)].sort().at(-1) }
      return { ...decidida, encerrada: { quando: agora().toISOString(), porque: 'suspensa' } }
    })
    if ('erro' in r) return negar(resposta, r.status, r.erro)
    const ate = opcao === 'nova-tentativa' && prazo ? ` até ${dataCurta(prazo, dia)}` : ''
    achou.achado.ficha.historico.push(
      evento(`Decidiu a cobrança: ${OPCOES_DA_SENIOR[opcao].toLowerCase()}${ate}. Justificativa: ${justificativa}. A decisão voltou para o Atendimento`, quem),
    )
    return responder(r, achou.achado)
  })
}
