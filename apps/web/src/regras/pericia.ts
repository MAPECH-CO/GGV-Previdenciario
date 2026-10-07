// Perícia (épico GGVP-10): regras puras, sem React. Prazo e número são código com teste (G19); o servidor de exemplo e,
// depois, o de verdade usam as mesmas. Os nomes seguem os do servidor do Mateus (tabela `pericia`, perfil `juridico_adm`).
import { somarDias } from './agenda.ts'
import { dataCurta } from './datas.ts'

export type TipoDePericia = 'medica' | 'social'
export type Instancia = 'inss' | 'juizo'
/** Quem pediu a perícia: D2 (decisão da advogada no D2.03 ou exigência do INSS), D3 (despacho da sênior) ou D3a (juiz). */
export type OrigemDaPericia = 'd2-necessidade' | 'd2-exigencia' | 'd3-despacho' | 'd3a-juiz'

export const NOMES_DO_TIPO: Record<TipoDePericia, string> = { medica: 'perícia médica', social: 'avaliação social' }
export const NOMES_DA_INSTANCIA: Record<Instancia, string> = { inss: 'INSS', juizo: 'Juízo' }

/** De onde a perícia veio: o rótulo do que veio preenchido (CA3), o passo de origem e como o caso mostra "Em perícia" (CA1). */
export const ORIGENS: Record<OrigemDaPericia, { rotulo: string; passo: string; caso: string }> = {
  'd2-necessidade': { rotulo: 'D2 · necessidade inicial', passo: 'D2.03', caso: 'pedido ao INSS (D2)' },
  'd2-exigencia': { rotulo: 'D2 · exigência do INSS', passo: 'D2.05', caso: 'exigência do INSS (D2)' },
  'd3-despacho': { rotulo: 'D3 · despacho da sênior', passo: 'D3.03', caso: 'despacho da sênior (D3)' },
  'd3a-juiz': { rotulo: 'D3a · pedido do juiz', passo: 'D3a.01', caso: 'pedido do juiz (D3a)' },
}

/** O D2 espera o INSS liberar o agendamento (D2.E1) antes de a tarefa aparecer; D3 e D3a já nascem liberados (CA2). */
export const esperaOInss = (origem: OrigemDaPericia) => origem.startsWith('d2')

/** Tentativa de marcar: uma por dia (Lucas, 02/10: "tem que ser diário"). */
export const DIAS_ENTRE_TENTATIVAS = 1
/** Os documentos da perícia ficam prontos até 10 dias antes dela (Lucas, 02/10, GGVP-56). */
export const DIAS_ANTES_DOCUMENTOS = 10
/** A preparação do cliente acontece até 3 dias antes da perícia (Lucas, 02/10, GGVP-56). */
export const DIAS_ANTES_PREPARO = 3

/** Os prazos que a data da perícia define: documentos, preparação, lembrete e o dia seguinte. */
export function prazosDaPericia(data: string) {
  return {
    documentosAte: somarDias(data, -DIAS_ANTES_DOCUMENTOS),
    preparoAte: somarDias(data, -DIAS_ANTES_PREPARO),
    vespera: somarDias(data, -1),
    diaSeguinte: somarDias(data, 1),
  }
}

/** O dia da próxima tentativa de marcar: o da liberação, ou o dia seguinte à última tentativa sem sucesso. */
export function proximaTentativa(tentativas: { dia: string }[], liberadaNoDia: string): string {
  const ultima = tentativas.map((t) => t.dia).sort().at(-1)
  return ultima ? somarDias(ultima, DIAS_ENTRE_TENTATIVAS) : liberadaNoDia
}

/** O prazo como a Central lê: "hoje", "amanhã", "atrasada desde 05/10" ou "até 12/10". */
export function prazoFalado(dia: string, hoje: string): { texto: string; urgente: boolean } {
  if (dia === hoje) return { texto: 'hoje', urgente: true }
  if (dia < hoje) return { texto: `atrasada desde ${dataCurta(dia, hoje)}`, urgente: true }
  if (dia === somarDias(hoje, 1)) return { texto: 'amanhã', urgente: false }
  return { texto: `até ${dataCurta(dia, hoje)}`, urgente: false }
}

/** "Em perícia" ligado ao diagrama de origem (CA1); com a data, ela entra junto ("na ficha", GGVP-53 CA2). */
export function etapaEmPericia(p: { origem: OrigemDaPericia; tipo: TipoDePericia; marcacao?: { data: string; hora: string } }, hoje: string): string {
  const quando = p.marcacao ? ` em ${dataCurta(p.marcacao.data, hoje)}, ${p.marcacao.hora}` : ''
  return `Em perícia · ${ORIGENS[p.origem].caso} · ${NOMES_DO_TIPO[p.tipo]}${quando}`
}

/**
 * Limite de remarcações da perícia (G15). O cartão diz "a definir" (GGVP-53 CA9, GGVP-66 CA3): fica 2, como o da agenda
 * (Pedro, 05/10) e o padrão do servidor do Mateus. Parâmetro; levar ao Lucas.
 */
export const LIMITE_DE_REMARCACOES_DA_PERICIA = 2

/** Passou do limite: a perícia sai do Jurídico administrativo e sobe para a advogada responsável, nunca para a sênior (CA9). */
export const passouDoLimite = (p: { remarcacoes: number; autorizadas?: number }) =>
  p.remarcacoes > LIMITE_DE_REMARCACOES_DA_PERICIA + (p.autorizadas ?? 0)

export type SituacaoDaPericia = 'aguardando-inss' | 'marcar' | 'aguardando-comprovante' | 'agendada' | 'na-advogada'

/** Onde a perícia está, para o cartão "Perícias" e para a tela do passo. */
export function situacaoDaPericia(p: {
  liberadaEm?: string
  esperaComprovante?: unknown
  marcacao?: unknown
  remarcacoes?: number
  autorizadas?: number
}): SituacaoDaPericia {
  if (p.marcacao) return 'agendada'
  if (!p.liberadaEm) return 'aguardando-inss'
  if (passouDoLimite({ remarcacoes: p.remarcacoes ?? 0, autorizadas: p.autorizadas })) return 'na-advogada'
  return p.esperaComprovante ? 'aguardando-comprovante' : 'marcar'
}

export const NOMES_DA_SITUACAO: Record<SituacaoDaPericia, string> = {
  'aguardando-inss': 'Esperando o INSS',
  marcar: 'Para marcar',
  'aguardando-comprovante': 'Esperando o comprovante',
  agendada: 'Agendada',
  'na-advogada': 'Com a advogada',
}

export const MINIMO_DO_QUE_ACONTECEU = 5

/** A tentativa sem sucesso pede o dia e o que aconteceu (CA1). O dia não é futuro. Sem problema, null. */
export function motivoParaNaoRegistrarTentativa(t: { dia: string | null; oQueAconteceu: string }, hoje: string): string | null {
  if (!t.dia) return 'Informe o dia da tentativa (dd/mm/aaaa).'
  if (t.dia > hoje) return 'O dia da tentativa não pode ser no futuro.'
  if (t.oQueAconteceu.trim().length < MINIMO_DO_QUE_ACONTECEU) return 'Diga o que aconteceu na tentativa.'
  return null
}

/** O que o sistema leu do comprovante do INSS (CA2). O perito não vem no comprovante. */
export type LidoDoComprovante = { data: string; hora: string; local: string; modalidade: string; tipo: TipoDePericia }

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * "Registrar a perícia" só habilita com as decisões respondidas e o comprovante anexado (CA3, CA4). A leitura conferida
 * não pode ter data passada. Sem problema, null.
 */
export function motivoParaNaoRegistrarMarcacao(
  m: { comprovante?: string; lido?: { data: string | null; hora: string; local: string }; pedeDocumentoNovo?: boolean },
  hoje: string,
): string | null {
  if (!m.comprovante) return 'Anexe o comprovante do INSS (PDF).'
  if (!m.lido) return 'Espere a leitura do comprovante.'
  if (!m.lido.data || m.lido.data < hoje) return 'Confira a data da perícia: ela não pode ser passada.'
  if (!HORA.test(m.lido.hora)) return 'Confira a hora da perícia.'
  if (m.lido.local.trim().length < 3) return 'Confira o local da perícia.'
  if (m.pedeDocumentoNovo === undefined) return 'Responda se a perícia pede documento novo.'
  return null
}

/** O que levar, pelo tipo da perícia: vai no lembrete da véspera (CA7) e na orientação (GGVP-61, CA7). */
export const O_QUE_LEVAR: Record<TipoDePericia, string> = {
  medica: 'documento com foto, carteira de trabalho, laudos, exames, receitas e atestados',
  social: 'documento com foto de quem mora na casa, o CadÚnico e os comprovantes de renda e de despesas',
}

/** O lembrete da véspera (CA7): data, hora, local e o que levar, em linguagem simples. Vai pelo Chatwoot, revisado (Q5). */
export function mensagemDoLembrete(d: { nome: string; tipo: TipoDePericia; data: string; hora: string; local: string }, diaFalado: string): string {
  const primeiro = d.nome.split(' ')[0]
  const onde = d.tipo === 'social' ? `A visita da assistente social é na sua casa (${d.local}).` : `O local é ${d.local}.`
  return (
    `Olá, ${primeiro}! Aqui é do escritório GGV. Lembrete: a sua ${NOMES_DO_TIPO[d.tipo]} é amanhã, ${diaFalado}, às ${d.hora}. ${onde} ` +
    `Leve ${O_QUE_LEVAR[d.tipo]}. Chegue com antecedência. Qualquer dúvida, é só responder esta mensagem.`
  )
}

/** A falta de um item da perícia é registrada com justificativa (GGVP-56, CA5). */
export const MINIMO_DA_FALTA = 5

/**
 * "Concluir" só habilita com cada item anexado ou com a falta justificada, e com as conferências marcadas (GGVP-56, CA5).
 * Sem problema, null.
 */
export function motivoParaNaoConcluirDocumentos(d: { faltando: number; conferidas: string[]; exigidas: string[] }): string | null {
  if (d.faltando > 0) return d.faltando === 1 ? 'Falta 1 item: anexe ou registre a falta com justificativa.' : `Faltam ${d.faltando} itens: anexe ou registre a falta com justificativa.`
  if (!d.exigidas.every((c) => d.conferidas.includes(c))) return 'Marque as conferências.'
  return null
}

/** A cobrança da perícia é diária e vai até 10 dias antes dela (Lucas, 02/10): hoje ainda não cobrou e não passou do limite. */
export function cobrarHoje(cobrancas: { dia: string }[], hoje: string, documentosAte?: string): boolean {
  return !cobrancas.some((c) => c.dia === hoje) && !passouDoLimiteDosDocumentos(hoje, documentosAte)
}

/** Passou dos 10 dias antes da perícia com documento faltando: sobe para a advogada responsável (G15, por ser perícia). */
export const passouDoLimiteDosDocumentos = (hoje: string, documentosAte?: string) => documentosAte !== undefined && hoje > documentosAte
