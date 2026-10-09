// As regras das listas de Clientes e Processos (GGVP-78): o servidor usa para montar, a tela para mostrar.
import type { DesfechoDaLista, SituacaoDoCliente } from '@ggv/contratos'

const EXITO = ['deferido', 'procedente_total', 'procedente_parcial']
const EXTINTO = ['extinto_sem_merito', 'desistencia']

/** O desfecho do caso, como o Raio-X lê; sem ele, o do acervo conferido por pessoa (a leitura não conferida não conta). */
export function desfechoDaLista(doCaso: string | null, doAcervoConferido: string | null): DesfechoDaLista {
  const d = doCaso ?? doAcervoConferido
  if (!d) return 'em_andamento'
  if (EXITO.includes(d)) return 'exito'
  if (d === 'acordo') return 'acordo'
  if (EXTINTO.includes(d)) return 'extinto'
  return 'perdido'
}

/**
 * "Situação / êxito" do cliente: com caso aberto, Administrativo (ainda no INSS) ou Em andamento; com todos decididos,
 * Êxito se ganhou algum, senão Perdido.
 */
export function situacaoDoCliente(lead: boolean, casos: { fase: string; desfecho: DesfechoDaLista }[]): SituacaoDoCliente {
  if (lead) return 'lead'
  const abertos = casos.filter((c) => c.desfecho === 'em_andamento' && c.fase !== 'encerrado')
  if (abertos.length > 0) return abertos.every((c) => c.fase === 'administrativa') ? 'administrativo' : 'em_andamento'
  if (casos.length === 0) return 'em_andamento'
  return casos.some((c) => c.desfecho === 'exito' || c.desfecho === 'acordo') ? 'exito' : 'perdido'
}

/** "52998224725" → "***.982.247-**": a lista mostra só o meio, como no Figma. */
export function mascararCpf(cpf: string | null | undefined): string | null {
  return cpf && cpf.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : null
}

const DIA = 86_400_000

/** "hoje", "ontem", "3 dias", "2 semanas", "1 mês", "2 anos": quanto faz, pelos dias do calendário (aaaa-mm-dd). */
export function haQuanto(iso: string, hoje: string): string {
  const dias = Math.round((Date.parse(hoje) - Date.parse(iso.slice(0, 10))) / DIA)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 7) return `${dias} dias`
  if (dias < 30) return Math.floor(dias / 7) === 1 ? '1 semana' : `${Math.floor(dias / 7)} semanas`
  if (dias < 365) return Math.floor(dias / 30) === 1 ? '1 mês' : `${Math.floor(dias / 30)} meses`
  return Math.floor(dias / 365) === 1 ? '1 ano' : `${Math.floor(dias / 365)} anos`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-02-10" → "fev/26", a coluna "Ajuizado". */
export const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`
