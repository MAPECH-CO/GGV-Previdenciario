// EXEMPLO. Servidor de exemplo da perícia (épico GGVP-10), sobre o mesmo banco de servidor.ts. A perícia nasce por
// `iniciarPericia`, com a forma da decisão D2.03 do servidor do Mateus (GGVP-31), do despacho da sênior (D3) e do pedido
// do juiz (D3a): ponta para ligar na junção com o INSS. A semente faz o papel dessas decisões para os clientes de exemplo.
// Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da design.md (change ggvp-10). IA, Meu INSS,
// GERID e Chatwoot são simulados.
import { hojeIso } from '../regras/datas.ts'
import {
  DIAS_ANTES_DOCUMENTOS,
  DIAS_ANTES_PREPARO,
  NOMES_DA_INSTANCIA,
  NOMES_DO_TIPO,
  ORIGENS,
  esperaOInss,
  etapaEmPericia,
  prazoFalado,
  proximaTentativa,
  situacaoDaPericia,
  type Instancia,
  type OrigemDaPericia,
  type SituacaoDaPericia,
  type TipoDePericia,
} from '../regras/pericia.ts'
import { nomeBeneficio } from './catalogos.ts'
import { agora, esperar, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

/** Um passo da perícia: quem fez, quando e o passo do BPMN. O que o sistema faz sozinho grava "Sistema" (GGVP-49, CA4). */
export type EventoDaPericia = { quando: string; quem: string; oQue: string; passo: string }

/** O que a GGVP-31 (D2.03), o despacho da sênior (D3) e o pedido do juiz (D3a) mandam para abrir a perícia. */
export type PedidoDePericia = {
  origem: OrigemDaPericia
  tipo: TipoDePericia
  instancia: Instancia
  /** Quem decidiu: a advogada, a sênior ou o juízo. */
  pedidaPor: string
  /** O que a perícia pede, quando se sabe (GGVP-49, CA3). */
  oQuePede?: string
}

export type Pericia = {
  id: string
  processoId: string
  fichaId: string
  tipo: TipoDePericia
  instancia: Instancia
  origem: OrigemDaPericia
  pedidaPor: string
  /** Data e hora ISO da decisão de origem. */
  pedidaEm: string
  /** Data e hora ISO em que o sistema abriu a tarefa (DP.01). */
  abertaEm: string
  oQuePede?: string
  /** D2: quando o INSS liberou o agendamento (D2.E1). D3 e D3a nascem liberados. */
  liberadaEm?: string
  tentativas: { dia: string; oQueAconteceu: string; quem: string; quando: string }[]
  remarcacoes: number
  historico: EventoDaPericia[]
}

/** Quem faz sozinho. */
export const SISTEMA = 'Sistema'

/** A perícia na tela: com a ficha, o processo e onde ela está. */
export type PericiaNaTela = {
  pericia: Pericia
  ficha: Ficha
  processo: Processo
  beneficio: string
  situacao: SituacaoDaPericia
  /** "Em perícia · pedido ao INSS (D2) · perícia médica" (CA1). */
  etapa: string
  /** O dia da próxima tentativa de marcar (tentativa diária). */
  proximaTentativa?: string
}

function fichaDoProcesso(banco: Banco, processoId: string): { ficha: Ficha; processo: Processo } | null {
  for (const ficha of banco.fichas) {
    const processo = ficha.processos.find((p) => p.id === processoId)
    if (processo) return { ficha, processo }
  }
  return null
}

/** Abre a perícia e o primeiro passo dela: o sistema abre a tarefa para o Jurídico administrativo (DP.01). */
function criar(banco: Banco, processoId: string, pedido: PedidoDePericia, quando: Date, liberadaEm?: Date): Pericia {
  const achado = fichaDoProcesso(banco, processoId)
  if (!achado) throw new Error('Processo não encontrado')
  const origem = ORIGENS[pedido.origem]
  const iso = quando.toISOString()
  const pericias = (banco.pericias ??= [])
  const liberada = esperaOInss(pedido.origem) ? liberadaEm?.toISOString() : iso
  const pericia: Pericia = {
    id: `pericia-${processoId}-${pericias.filter((p) => p.processoId === processoId).length + 1}`,
    processoId,
    fichaId: achado.ficha.id,
    tipo: pedido.tipo,
    instancia: pedido.instancia,
    origem: pedido.origem,
    pedidaPor: pedido.pedidaPor,
    pedidaEm: iso,
    abertaEm: iso,
    oQuePede: pedido.oQuePede,
    liberadaEm: liberada,
    tentativas: [],
    remarcacoes: 0,
    historico: [
      { quando: iso, quem: pedido.pedidaPor, oQue: `Pediu a ${NOMES_DO_TIPO[pedido.tipo]} (${origem.rotulo})`, passo: origem.passo },
      {
        quando: iso,
        quem: SISTEMA,
        oQue: `Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de ${pedido.pedidaPor} (${origem.rotulo})`,
        passo: 'DP.01',
      },
    ],
  }
  if (esperaOInss(pedido.origem)) {
    pericia.historico.push(
      liberada
        ? { quando: liberada, quem: SISTEMA, oQue: 'O INSS liberou o agendamento; a tarefa entrou na Central do Jurídico administrativo', passo: 'D2.E1' }
        : { quando: iso, quem: SISTEMA, oQue: 'Esperando o INSS liberar o agendamento', passo: 'D2.E1' },
    )
  }
  pericias.push(pericia)
  return pericia
}

/** Hoje (ou n dias antes), à hora dada, no fuso local. */
function em(dias: number, horas: number, minutos = 0): Date {
  const hoje = agora()
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, horas, minutos)
}

const DRA_PAULA = 'Dra. Paula (exemplo)'

/**
 * A semente, pelo mesmo caminho do `iniciarPericia`: a Maria (perícia médica pedida pela advogada no D2.03 ontem; o INSS
 * liberou o agendamento hoje cedo) e o Pedro (avaliação social pedida na exigência do INSS, liberada há dois dias).
 */
function semear(banco: Banco): Pericia[] {
  banco.pericias = []
  criar(banco, 'maria-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: DRA_PAULA }, em(-1, 16, 10), em(0, 8))
  criar(
    banco,
    'pedro-exemplo-1',
    {
      origem: 'd2-exigencia',
      tipo: 'social',
      instancia: 'inss',
      pedidaPor: DRA_PAULA,
      oQuePede: 'avaliação social pedida pelo INSS na exigência: visita à casa e composição do grupo familiar',
    },
    em(-3, 11),
    em(-2, 9),
  )
  return banco.pericias
}

/** O banco com as perícias da semente já gravadas. */
function lerComPericias(): Banco {
  const banco = ler()
  if (!banco.pericias) {
    semear(banco)
    gravar(banco)
  }
  return banco
}

/** A perícia em andamento do processo (a mais nova). */
const periciaDo = (banco: Banco, processoId: string) => banco.pericias?.filter((p) => p.processoId === processoId).at(-1)

function naTela(banco: Banco, pericia: Pericia): PericiaNaTela {
  const { ficha, processo } = fichaDoProcesso(banco, pericia.processoId)!
  const hoje = hojeIso(agora())
  const situacao = situacaoDaPericia(pericia)
  return {
    pericia,
    ficha,
    processo,
    beneficio: nomeBeneficio(processo.beneficio),
    situacao,
    etapa: etapaEmPericia(pericia, hoje),
    ...(situacao === 'marcar' && { proximaTentativa: proximaTentativa(pericia.tentativas, hojeIso(new Date(pericia.liberadaEm!))) }),
  }
}

/** Chamado pela GGVP-31 (D2.03), pelo despacho da sênior (D3) e pelo pedido do juiz (D3a). Ponta para ligar na junção. */
export async function iniciarPericia(processoId: string, pedido: PedidoDePericia): Promise<Pericia> {
  await esperar()
  const banco = lerComPericias()
  const pericia = criar(banco, processoId, pedido, agora())
  gravar(banco)
  return pericia
}

/** A vigília do INSS viu o agendamento liberado (D2.E1): a tarefa entra na Central do Jurídico administrativo (CA2). */
export async function liberarAgendamento(processoId: string): Promise<Pericia> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  if (!pericia) throw new Error('Este caso não tem perícia')
  if (!pericia.liberadaEm) {
    pericia.liberadaEm = agora().toISOString()
    pericia.historico.push({ quando: pericia.liberadaEm, quem: SISTEMA, oQue: 'O INSS liberou o agendamento; a tarefa entrou na Central do Jurídico administrativo', passo: 'D2.E1' })
    gravar(banco)
  }
  return pericia
}

/** GET /api/processos/:id/pericia */
export async function obterPericia(processoId: string): Promise<PericiaNaTela | null> {
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  return pericia ? naTela(banco, pericia) : null
}

/** A etapa do caso em perícia, para a ficha do cliente (CA1). Sem perícia, nada. */
export function etapaDaPericia(processoId: string): string | null {
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  return pericia ? etapaEmPericia(pericia, hojeIso(agora())) : null
}

/**
 * "O que acontece agora", com o contexto que a IA já sabe do caso (pedido do Lucas no cartão da GGVP-49, 02/10). IA
 * simulada: o texto sai do dado da perícia. Sem nome de gênero: o primeiro nome do cliente.
 */
export function oQueAconteceAgora(t: PericiaNaTela): string {
  const { pericia, ficha } = t
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const depois =
    `Se a perícia pedir documento novo, a Documentação reúne até ${DIAS_ANTES_DOCUMENTOS} dias antes; até ${DIAS_ANTES_PREPARO} dias antes, ` +
    `o Jurídico administrativo liga para ${primeiro} com a orientação, e na véspera ${primeiro} recebe o lembrete.`
  if (t.situacao === 'aguardando-inss') {
    return (
      `O pedido está registrado. Assim que o INSS liberar o agendamento (D2.E1), a tarefa «Marcar a perícia» entra na Central do ` +
      `Jurídico administrativo, que marca a ${tipo} de ${primeiro} pelo Meu INSS (senha no cofre, G9). ${depois}`
    )
  }
  const como =
    pericia.instancia === 'inss'
      ? `pelo Meu INSS (senha no cofre, G9), tentando todo dia até conseguir, e sobe o comprovante: o sistema lê data, hora, local e tipo`
      : `com o juízo, e registra a data e o local que vierem do processo`
  return `O Jurídico administrativo marca a ${tipo} de ${primeiro} ${como}. ${depois}`
}

/** O detalhe da linha da tarefa, como no Figma (2051:173). */
function detalheDaTarefa(t: PericiaNaTela): string {
  const { pericia } = t
  const onde = pericia.instancia === 'inss' ? 'no Meu INSS (senha no cofre); subir o comprovante' : `no ${NOMES_DA_INSTANCIA[pericia.instancia].toLowerCase()}`
  const deOnde = esperaOInss(pericia.origem) ? 'o INSS já liberou o agendamento' : ORIGENS[pericia.origem].rotulo
  return [t.beneficio, NOMES_DO_TIPO[pericia.tipo], deOnde, onde].join(' · ')
}

/** Para onde "Ver a perícia" leva: a tela do passo em que a perícia está. */
export function hrefDoPasso(t: PericiaNaTela): string {
  const base = `/casos/${t.processo.id}/pericia`
  if (t.situacao === 'aguardando-inss') return `${base}/aberta`
  if (t.situacao === 'marcar' || t.situacao === 'aguardando-comprovante') return `${base}/marcar`
  return base
}

/** Uma linha do chat da Central (Figma 2107:892): o cliente, a ação, o porquê curto e o prazo. */
export type ItemDoChat = { cliente: string; acao: string; sub: string; href: string }

/** "Quais perícias eu tenho para marcar?" (Figma 2107:892): as tarefas de marcar e remarcar, com o porquê curto. */
export function periciasParaMarcar(): ItemDoChat[] {
  return tarefasDoJuridicoAdm()
    .filter((t) => t.codigo === 'DP.02')
    .map((t) => {
      const p = lerComPericias().pericias!.find((x) => `pericia-marcar-${x.id}` === t.id)!
      const porque =
        p.remarcacoes > 0
          ? `o cliente faltou · ${p.remarcacoes}ª remarcação (limite G15)`
          : esperaOInss(p.origem)
            ? 'o INSS já liberou o agendamento'
            : ORIGENS[p.origem].rotulo
      return { cliente: t.cliente!.nome, acao: t.acao, sub: `${porque} · ${t.prazo}`, href: t.href! }
    })
}

/** As tarefas da perícia na Central do Jurídico administrativo (CA2): "<nome> · Marcar perícia", liberadas. */
export function tarefasDoJuridicoAdm(): Tarefa[] {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  return (banco.pericias ?? [])
    .map((p) => naTela(banco, p))
    .filter((t) => t.situacao === 'marcar')
    .map((t) => {
      const prazo = prazoFalado(t.proximaTentativa!, hoje)
      return {
        id: `pericia-marcar-${t.pericia.id}`,
        codigo: 'DP.02',
        cliente: { id: t.ficha.id, nome: t.ficha.nome },
        acao: t.pericia.remarcacoes > 0 ? 'Remarcar perícia' : 'Marcar perícia',
        detalhe: detalheDaTarefa(t),
        prazo: prazo.texto,
        urgente: prazo.urgente,
        href: `/casos/${t.processo.id}/pericia/marcar`,
        processoId: t.processo.id,
      }
    })
}
