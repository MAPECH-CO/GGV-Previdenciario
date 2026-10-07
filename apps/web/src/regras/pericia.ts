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

export type SituacaoDaPericia = 'aguardando-inss' | 'marcar' | 'aguardando-comprovante' | 'agendada'

/** Onde a perícia está, para o cartão "Perícias" e para a tela do passo. */
export function situacaoDaPericia(p: { liberadaEm?: string; esperaComprovante?: unknown; marcacao?: unknown }): SituacaoDaPericia {
  if (p.marcacao) return 'agendada'
  if (!p.liberadaEm) return 'aguardando-inss'
  return p.esperaComprovante ? 'aguardando-comprovante' : 'marcar'
}

export const NOMES_DA_SITUACAO: Record<SituacaoDaPericia, string> = {
  'aguardando-inss': 'Esperando o INSS',
  marcar: 'Para marcar',
  'aguardando-comprovante': 'Esperando o comprovante',
  agendada: 'Agendada',
}
