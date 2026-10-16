// "O que eu tenho para fazer?" no chat (Pedro, 16/10): a resposta sai da lista que a pessoa vê na Central, com a conta
// feita por código. O chat lia só as tarefas do servidor e dizia "nada para hoje" com tarefa vencendo hoje na tela.
import type { BlocoDaResposta, TarefaDaTela, WidgetDoChat } from '@ggv/contratos'
import type { Tarefa } from '../dados/tipos.ts'
import { semAcento } from './chat.ts'

export type { TarefaDaTela }

/**
 * O prazo como a linha mostra ("hoje", "vence hoje", "15:30", "até 23/10", "vence 30/09") em data. Sem ano na tela: a data
 * que ficou mais de seis meses para trás é do ano que vem.
 */
export function quandoVence(prazo: string | undefined, hoje: string): string | null {
  if (!prazo) return null
  const p = semAcento(prazo)
  if (/\bhoje\b/.test(p) || /^\d{1,2}:\d{2}$/.test(p.trim())) return hoje
  const d = p.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (!d) return null
  const ano = Number(hoje.slice(0, 4))
  const dia = `${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`
  const diasAtras = (Date.parse(hoje) - Date.parse(`${ano}-${dia}`)) / 86_400_000
  return `${diasAtras > 180 ? ano + 1 : ano}-${dia}`
}

export const paraOChat = (t: Tarefa, hoje: string): TarefaDaTela => ({
  quem: t.cliente?.nome ?? t.contexto ?? '',
  acao: t.acao,
  detalhe: t.detalhe,
  prazo: quandoVence(t.prazo, hoje),
  urgente: Boolean(t.urgente),
  href: t.href ?? (t.cliente ? `/clientes/${t.cliente.id}` : null),
})

/** A pergunta é sobre as tarefas da própria pessoa: "o que tenho pra fazer hoje?", "está tudo em dia?", "qual a minha demanda?". */
export function perguntaDasTarefas(texto: string): boolean {
  const t = semAcento(texto)
  if (/\b(cri|abr)\w* (uma |a )?tarefa|\btarefa (para|pra|pro)\b/.test(t)) return false
  return (
    /\b(minhas?|meus?)\s+(tarefas?|pendencias?|demandas?|afazeres)\b/.test(t) ||
    /\b(tarefas?|demandas?|pendencias?)\b/.test(t) ||
    /\b(o que|oq|qq|que|qual|quais|alguma coisa|algo)\b.{0,30}\b(fazer|cumprir|resolver)\b/.test(t) ||
    /\b(falta|faltando)\b.{0,20}\b(pra|para) (mim|eu|a gente|nos)\b/.test(t) ||
    /\b(tudo|ta|esta|estou|to)\b.{0,12}\bem dia\b/.test(t)
  )
}

const ordem = (hoje: string) => (a: TarefaDaTela, b: TarefaDaTela) => {
  const peso = (t: TarefaDaTela) => (t.prazo && t.prazo < hoje ? 0 : t.prazo === hoje ? 1 : t.urgente ? 2 : 3)
  return peso(a) - peso(b) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999')
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function selo(t: TarefaDaTela, hoje: string) {
  if (t.prazo && t.prazo < hoje) return { texto: 'atrasada', tom: 'erro' as const }
  if (t.prazo === hoje) return { texto: 'hoje', tom: 'acento' as const }
  if (t.prazo) return { texto: `até ${ddmm(t.prazo)}`, tom: 'neutro' as const }
  if (t.urgente) return { texto: 'urgente', tom: 'alerta' as const }
  return undefined
}

/**
 * A pergunta cita alguém da lista ("a próxima tarefa da Maria Souza"): é sobre o cliente, e fica com o motor do chat, que
 * lê o caso dele. Conta o nome e o sobrenome, sem o "(exemplo)".
 */
export function citaAlguemDaLista(tarefas: TarefaDaTela[], texto: string): boolean {
  const t = semAcento(texto)
  return tarefas.some((x) => {
    const nome = semAcento(x.quem).replace(/\(exemplo\)/, '').trim().split(/\s+/)
    return nome.length >= 2 && t.includes(`${nome[0]} ${nome[1]}`)
  })
}

/** O resumo das tarefas: quantas, as atrasadas, as de hoje e por onde começar, e a lista com as mais urgentes primeiro. */
export function respostaDasTarefas(todas: TarefaDaTela[], hoje: string): { texto: string; blocos: BlocoDaResposta[] } {
  const tarefas = [...todas].sort(ordem(hoje))
  if (!tarefas.length) {
    const vazio = 'Sua lista está vazia: nenhuma tarefa aberta para você agora.'
    return { texto: vazio, blocos: [{ tipo: 'texto', texto: vazio }] }
  }
  const atrasadas = tarefas.filter((x) => x.prazo && x.prazo < hoje).length
  const deHoje = tarefas.filter((x) => x.prazo === hoje).length
  const primeira = tarefas[0]
  const abertura = `Você tem **${plural(tarefas.length, 'tarefa aberta', 'tarefas abertas')}**.`
  const situacao =
    atrasadas || deHoje
      ? [atrasadas && `**${plural(atrasadas, 'atrasada', 'atrasadas')}**`, deHoje && `**${deHoje === 1 ? '1 vence hoje' : `${deHoje} vencem hoje`}**`].filter(Boolean).join(' e ') +
        `. Comece por ${primeira.quem ? `${primeira.quem} · ` : ''}${primeira.acao}.`
      : 'Nenhuma atrasada nem vencendo hoje: está em dia.'
  const resumo = `${abertura} ${situacao}`
  const lista: WidgetDoChat = {
    tipo: 'lista',
    titulo: atrasadas || deHoje ? 'As mais urgentes primeiro' : 'Suas tarefas',
    itens: tarefas.slice(0, 8).map((x) => {
      const s = selo(x, hoje)
      return { titulo: x.quem ? `${x.quem} · ${x.acao}` : x.acao, ...(x.detalhe ? { sub: x.detalhe } : {}), ...(x.href ? { href: x.href } : {}), ...(s ? { selo: s } : {}) }
    }),
  }
  const resto = tarefas.length > 8 ? [{ tipo: 'texto' as const, texto: `E mais ${tarefas.length - 8} na sua lista, logo abaixo.` }] : []
  return { texto: resumo, blocos: [{ tipo: 'texto', texto: resumo }, { tipo: 'widget', widget: lista }, ...resto] }
}
