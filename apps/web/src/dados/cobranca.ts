// EXEMPLO. Servidor de exemplo da cobrança dos documentos pendentes (GGVP-101), sobre o mesmo banco de servidor.ts. A
// conferência incompleta do checklist abre a cobrança; o que falta é sempre o checklist de agora, então a pendência fecha
// sozinha quando o documento é arquivado (CA9). A semente traz a do Antônio, já no limite, para a sênior decidir. Ligar
// no servidor: trocar o corpo de cada função por fetch no endpoint da spec da ggvp-101 e mandar pelo Chatwoot (GGVP-102).
import { somarDias } from '../regras/agenda.ts'
import { juntar } from '../regras/checklist.ts'
import {
  CANAIS,
  OPCOES_DA_SENIOR,
  RESULTADOS,
  TENTATIVAS_DE_COBRANCA,
  ateQuando,
  mensagemDeCobranca,
  motivoParaNaoAdiar,
  motivoParaNaoCobrar,
  motivoParaNaoDecidir,
  naSenior,
  proximaTentativa,
  urgente,
  type CanalDaCobranca,
  type EstadoDaCobranca,
  type OpcaoDaSenior,
  type TentativaDeCobranca,
} from '../regras/cobranca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { checklistDoCaso } from './checklist.ts'
import { QUEM, QUEM_ADVOGADA, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

export type Cobranca = EstadoDaCobranca & {
  processoId: string
  fichaId: string
  /** Data e hora ISO da conferência do checklist que abriu a cobrança (CA1). */
  conferenciaEm?: string
  /** Fechada: chegou tudo (CA9) ou a sênior suspendeu o caso (CA8). */
  encerrada?: { quando: string; porque: 'recebeu-tudo' | 'suspensa' }
}

export type SituacaoDaCobranca = 'aberta' | 'na-senior' | 'encerrada'

export type CobrancaDoCaso = {
  cobranca: Cobranca
  situacao: SituacaoDaCobranca
  ficha: Ficha
  processo: Processo
  beneficio: string
  /** O que falta no checklist de agora (CA4, CA9). */
  faltam: string[]
  /** aaaa-mm-dd: o próximo lembrete (CA4). */
  proxima: string
  /** O número da próxima tentativa (CA6). */
  tentativa: number
  urgente: boolean
  /** A mensagem pronta para o Chatwoot (CA11). */
  mensagem: string
  /** Por que o Atendimento não pode cobrar agora; pode, null. */
  motivoParado: string | null
}

/** "Ligar" ou o envio pelo Chatwoot (CA6, CA11). */
export type RegistroDaTentativa = { canal: CanalDaCobranca; resultado: TentativaDeCobranca['resultado'] }

export type Decisao = { opcao: OpcaoDaSenior; justificativa: string; /** aaaa-mm-dd */ prazo?: string }

/** A cobrança do Antônio: a exigência do juiz vence em 2 dias, e as duas tentativas ficaram sem resposta. */
function semear(banco: Banco, cobrancas: Cobranca[]) {
  if (!banco.fichas.some((f) => f.id === 'antonio-exemplo')) return
  const hoje = hojeIso(agora())
  cobrancas.push({
    processoId: 'antonio-exemplo-1',
    fichaId: 'antonio-exemplo',
    abertaEm: somarDias(hoje, -5),
    prazo: { de: 'juiz', data: somarDias(hoje, 2) },
    tentativas: [
      { dia: somarDias(hoje, -5), canal: 'chatwoot', resultado: 'sem-resposta', quem: QUEM },
      { dia: somarDias(hoje, -2), canal: 'ligacao', resultado: 'sem-resposta', quem: QUEM },
    ],
    decisoes: [],
  })
}

/** As cobranças do banco: cada conferência incompleta abre a sua (CA1); sem nada faltando, fecha sozinha (CA9). */
function cobrancasDo(banco: Banco): Cobranca[] {
  if (!banco.cobrancas) {
    banco.cobrancas = []
    semear(banco, banco.cobrancas)
  }
  const cobrancas = banco.cobrancas
  for (const conferencia of banco.checklists ?? []) {
    const doCaso = cobrancas.filter((c) => c.processoId === conferencia.processoId)
    if (conferencia.faltam.length === 0 || doCaso.some((c) => !c.encerrada || c.conferenciaEm === conferencia.quando)) continue
    const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === conferencia.processoId))
    if (!ficha) continue
    cobrancas.push({ processoId: conferencia.processoId, fichaId: ficha.id, conferenciaEm: conferencia.quando, abertaEm: hojeIso(new Date(conferencia.quando)), tentativas: [], decisoes: [] })
    ficha.historico.push(evento(`Abriu a cobrança das pendências do checklist para o Atendimento: ${juntar(conferencia.faltam)}`))
  }
  for (const c of cobrancas) {
    if (c.encerrada) continue
    const caso = checklistDoCaso(banco, c.processoId)
    if (!caso || caso.checklist.faltam.length > 0) continue
    c.encerrada = { quando: agora().toISOString(), porque: 'recebeu-tudo' }
    caso.ficha.historico.push(evento('Chegou tudo o que faltava: a cobrança fechou e os lembretes foram cancelados'))
  }
  return cobrancas
}

function montar(banco: Banco, c: Cobranca): CobrancaDoCaso | null {
  const caso = checklistDoCaso(banco, c.processoId)
  if (!caso) return null
  const hoje = hojeIso(agora())
  const proxima = proximaTentativa(c)
  const situacao: SituacaoDaCobranca = c.encerrada ? 'encerrada' : naSenior(c, hoje) ? 'na-senior' : 'aberta'
  const { ficha, processo, beneficio, checklist } = caso
  return {
    cobranca: c,
    situacao,
    ficha,
    processo,
    beneficio,
    faltam: checklist.faltam,
    proxima,
    tentativa: c.tentativas.length + 1,
    urgente: situacao === 'aberta' && urgente(c, hoje),
    mensagem: mensagemDeCobranca({ nome: ficha.nome, beneficio, faltam: checklist.faltam, ate: ateQuando(hoje, c.prazo), hoje }),
    motivoParado: c.encerrada ? 'A cobrança está fechada.' : motivoParaNaoCobrar(c, hoje),
  }
}

/** A cobrança aberta do caso; sem aberta, a última. */
function daCobranca(banco: Banco, processoId: string): CobrancaDoCaso | null {
  const doCaso = cobrancasDo(banco).filter((c) => c.processoId === processoId)
  const c = doCaso.find((x) => !x.encerrada) ?? doCaso.at(-1)
  return c ? montar(banco, c) : null
}

function abertaOuErro(banco: Banco, processoId: string): CobrancaDoCaso {
  const atual = daCobranca(banco, processoId)
  if (!atual) throw new Error('Cobrança não encontrada')
  if (atual.situacao === 'encerrada') throw new Error('A cobrança está fechada')
  return atual
}

/** GET /api/processos/:id/cobranca */
export async function obterCobranca(processoId: string): Promise<CobrancaDoCaso | null> {
  const banco = ler()
  const atual = daCobranca(banco, processoId)
  gravar(banco)
  return atual
}

/** POST /api/processos/:id/cobranca/tentativas. Data, canal e resultado; a segunda sem resposta sobe para a sênior (CA3, CA6). */
export async function registrarTentativa(processoId: string, registro: RegistroDaTentativa): Promise<CobrancaDoCaso> {
  await esperar()
  if (!(registro.canal in CANAIS) || !(registro.resultado in RESULTADOS)) throw new Error('Canal ou resultado inválido')
  const banco = ler()
  const atual = abertaOuErro(banco, processoId)
  if (atual.motivoParado) throw new Error(atual.motivoParado)
  const { cobranca, ficha, faltam } = atual
  const hoje = hojeIso(agora())
  cobranca.tentativas.push({ dia: hoje, canal: registro.canal, resultado: registro.resultado, quem: QUEM })
  ficha.historico.push(
    evento(`Cobrança: ${cobranca.tentativas.length}ª tentativa por ${CANAIS[registro.canal]} (${RESULTADOS[registro.resultado]}); falta: ${juntar(faltam)}`),
  )
  if (registro.canal === 'chatwoot') ficha.contatos.push({ data: hoje, canal: 'Chatwoot', texto: 'Cobrança dos documentos pendentes.' })
  if (naSenior(cobranca, hoje)) ficha.historico.push(evento(`A cobrança passou do limite de ${TENTATIVAS_DE_COBRANCA} tentativas: foi para a advogada sênior decidir (G15)`))
  gravar(banco)
  return montar(banco, cobranca)!
}

/** POST /api/processos/:id/cobranca/adiamento. A nova data é obrigatória; o contador não volta a zero (CA10). */
export async function adiarCobranca(processoId: string, para: string | null): Promise<CobrancaDoCaso> {
  await esperar()
  const banco = ler()
  const atual = abertaOuErro(banco, processoId)
  if (atual.situacao === 'na-senior') throw new Error('Passou do limite: a sênior decide')
  const hoje = hojeIso(agora())
  const motivo = motivoParaNaoAdiar(para, hoje, atual.cobranca.prazo)
  if (motivo) throw new Error(motivo)
  atual.cobranca.adiadaPara = para!
  const feitas = atual.cobranca.tentativas.length
  atual.ficha.historico.push(evento(`Adiou a cobrança para ${dataCurta(para!, hoje)}; a contagem continua em ${feitas === 1 ? '1 tentativa' : `${feitas} tentativas`}`))
  gravar(banco)
  return montar(banco, atual.cobranca)!
}

/** POST /api/processos/:id/cobranca/decisao. Só a sênior, só no limite, sempre com justificativa; volta ao Atendimento (CA8). */
export async function decidirCobranca(processoId: string, decisao: Decisao): Promise<CobrancaDoCaso> {
  await esperar()
  const banco = ler()
  const atual = abertaOuErro(banco, processoId)
  if (atual.situacao !== 'na-senior') throw new Error('A cobrança ainda não chegou ao limite')
  const hoje = hojeIso(agora())
  const motivo = motivoParaNaoDecidir({ opcao: decisao.opcao, justificativa: decisao.justificativa ?? '', prazo: decisao.prazo ?? null }, hoje)
  if (motivo) throw new Error(motivo)
  if (!(decisao.opcao in OPCOES_DA_SENIOR)) throw new Error('Decisão inválida')
  const { cobranca, ficha } = atual
  const justificativa = decisao.justificativa.trim()
  cobranca.decisoes.push({ opcao: decisao.opcao, justificativa, prazo: decisao.prazo, quando: agora().toISOString(), quem: QUEM_ADVOGADA })
  if (decisao.opcao === 'nova-tentativa') cobranca.adiadaPara = decisao.prazo
  // Pedir a visita é falar com o cliente: a próxima tentativa é já, no dia seguinte à última.
  if (decisao.opcao === 'visita') cobranca.adiadaPara = [hoje, somarDias(cobranca.tentativas.at(-1)!.dia, 1)].sort().at(-1)
  if (decisao.opcao === 'suspender') cobranca.encerrada = { quando: agora().toISOString(), porque: 'suspensa' }
  const ate = decisao.opcao === 'nova-tentativa' && decisao.prazo ? ` até ${dataCurta(decisao.prazo, hoje)}` : ''
  ficha.historico.push(
    evento(`Decidiu a cobrança: ${OPCOES_DA_SENIOR[decisao.opcao].toLowerCase()}${ate}. Justificativa: ${justificativa}. A decisão voltou para o Atendimento`, QUEM_ADVOGADA),
  )
  gravar(banco)
  return montar(banco, cobranca)!
}

const resumo = (faltam: string[]) => (faltam.length <= 2 ? juntar(faltam) : `${faltam.slice(0, 2).join(', ')} e mais ${faltam.length - 2}`)

/** "Cobrar documento" na Central do Atendimento: aberta, ou na sênior, que continua à vista (CA1, CA5, CA7). */
export function tarefasDeCobrar(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = cobrancasDo(banco).flatMap((c) => {
    const atual = c.encerrada ? null : montar(banco, c)
    if (!atual) return []
    const decisao = c.decisoes.at(-1)
    const detalhe = [
      atual.beneficio,
      `${resumo(atual.faltam)} ${atual.faltam.length === 1 ? 'pendente' : 'pendentes'}`,
      atual.situacao === 'na-senior' ? 'na sênior: decidir (G15)' : `${atual.tentativa}ª tentativa`,
      decisao && atual.situacao === 'aberta' ? `decisão da sênior: ${OPCOES_DA_SENIOR[decisao.opcao].toLowerCase()}` : '',
      c.prazo ? `prazo do ${c.prazo.de} ${dataCurta(c.prazo.data, hoje)}` : '',
    ]
    return [
      {
        id: `cobrar-${c.processoId}`,
        codigo: 'D1.23',
        cliente: { id: atual.ficha.id, nome: atual.ficha.nome },
        acao: 'Cobrar documento',
        detalhe: detalhe.filter(Boolean).join(' · '),
        prazo: atual.situacao === 'na-senior' ? 'na sênior' : atual.proxima <= hoje ? 'vence hoje' : `lembrete ${dataCurta(atual.proxima, hoje)}`,
        urgente: atual.urgente,
        href: `/casos/${c.processoId}/cobranca`,
        processoId: c.processoId,
      },
    ]
  })
  gravar(banco)
  return tarefas
}

/** "Decidir cobrança" na Central da Advogada: a cobrança que passou do limite, com as tentativas (CA7). */
export function tarefasDeDecidirCobranca(): Tarefa[] {
  const banco = ler()
  const tarefas = cobrancasDo(banco).flatMap((c) => {
    const atual = c.encerrada ? null : montar(banco, c)
    if (atual?.situacao !== 'na-senior') return []
    const semResposta = c.tentativas.filter((t) => t.resultado === 'sem-resposta').length
    return [
      {
        id: `decidir-cobranca-${c.processoId}`,
        codigo: 'D1.23',
        cliente: { id: atual.ficha.id, nome: atual.ficha.nome },
        acao: 'Decidir cobrança',
        detalhe: `${atual.beneficio} · ${semResposta === 1 ? '1 tentativa' : `${semResposta} tentativas`} sem resposta · limite (G15)`,
        prazo: 'hoje',
        urgente: true,
        href: `/casos/${c.processoId}/cobranca/decidir`,
        processoId: c.processoId,
      },
    ]
  })
  gravar(banco)
  return tarefas
}
