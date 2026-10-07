// A agenda e a marcação da entrevista (GGVP-123). Regra numérica é código com teste, nunca resposta de modelo.
import type { MembroDaEquipe } from '../dados/catalogos.ts'
import type { EstadoDoCompromisso, EventoDaAgenda, TipoDeEntrevista } from '../dados/tipos.ts'

/** Os horários de entrevista do Figma (73:502). */
export const HORARIOS = ['09:00', '10:30', '14:00', '16:00']

export const DURACOES = [30, 45, 60, 90]

/** Quantas remarcações a entrevista aceita antes de subir para a advogada sênior (G15, Pedro em 05/10). */
export const LIMITE_DE_REMARCACOES = 2

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** "2026-10-06" → "terça, 06/10". */
export function diaFalado(iso: string): string {
  return `${DIAS[diaDaSemana(iso)]}, ${iso.slice(8)}/${iso.slice(5, 7)}`
}
const doisDigitos = (n: number) => String(n).padStart(2, '0')

function paraData(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

const paraIso = (d: Date) => `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`

export function somarDias(iso: string, dias: number): string {
  const d = paraData(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraIso(d)
}

/** 0 é domingo. */
export const diaDaSemana = (iso: string) => paraData(iso).getUTCDay()

/** "2026-09-30" → "qua 30" (os botões de data do Figma). */
export function diaCurto(iso: string): string {
  return `${DIAS[diaDaSemana(iso)].slice(0, 3)} ${iso.slice(8)}`
}

/** Os próximos dias úteis depois de hoje, como no Figma (73:485). */
export function proximosDiasUteis(hoje: string, quantos = 5): string[] {
  const dias: string[] = []
  for (let d = somarDias(hoje, 1); dias.length < quantos; d = somarDias(d, 1)) {
    if (diaDaSemana(d) !== 0 && diaDaSemana(d) !== 6) dias.push(d)
  }
  return dias
}

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))

type Intervalo = { data: string; hora: string; duracao: number }

/** Dois compromissos no mesmo dia que se cruzam, pela duração. */
export function cruzam(a: Intervalo, b: Intervalo): boolean {
  if (a.data !== b.data) return false
  const inicioA = minutos(a.hora)
  const inicioB = minutos(b.hora)
  return inicioA < inicioB + b.duracao && inicioB < inicioA + a.duracao
}

/** Quem já está no horário: o portal avisa e deixa confirmar, porque são duas salas (CA3). */
export function horarioOcupado(eventos: EventoDaAgenda[], novo: Intervalo): EventoDaAgenda[] {
  // A perícia é do cliente, na agência ou no juízo: não ocupa a sala do escritório (épico GGVP-10).
  return eventos.filter((e) => e.estado !== 'faltou' && e.categoria !== 'pericias' && cruzam(e, novo))
}

/** Cheio quando todos os horários do dia já têm compromisso. */
export function diaCheio(eventos: EventoDaAgenda[], data: string): boolean {
  return HORARIOS.every((hora) => horarioOcupado(eventos, { data, hora, duracao: 1 }).length > 0)
}

/** Passou do dia sem ninguém marcar: "confirmar se aconteceu" (CA8). */
export function estadoDoEvento(estado: EstadoDoCompromisso | undefined, data: string, hoje: string): EventoDaAgenda['estado'] {
  if (estado === 'realizado' || estado === 'faltou') return estado
  return data < hoje ? 'confirmar' : 'agendado'
}

/** De segunda a domingo, na semana da data. */
export function semanaDe(iso: string): string[] {
  const segunda = somarDias(iso, -((diaDaSemana(iso) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i))
}

/** As semanas (de segunda a domingo) que cobrem o mês da data. */
export function gradeDoMes(iso: string): string[][] {
  const primeiro = `${iso.slice(0, 8)}01`
  const semanas: string[][] = []
  for (let semana = semanaDe(primeiro); semana[0].slice(0, 7) <= iso.slice(0, 7); semana = semanaDe(somarDias(semana[0], 7))) {
    semanas.push(semana)
  }
  return semanas
}

/** "Com quem": só gente do escritório, nunca captador; a advogada primeiro (CA2). */
export function equipeDaEntrevista(equipe: MembroDaEquipe[]): MembroDaEquipe[] {
  return equipe.filter((m) => m.papel === 'advogada')
}

export const podeRemarcar = (remarcacoes: number) => remarcacoes < LIMITE_DE_REMARCACOES

/** "10:30" → "10h30"; "09:00" → "9h". */
export function horaFalada(hora: string): string {
  const h = Number(hora.slice(0, 2))
  return hora.endsWith(':00') ? `${h}h` : `${h}h${hora.slice(3)}`
}

export const COMO: Record<TipoDeEntrevista, string> = {
  video: 'por vídeo',
  presencial: 'aqui no escritório',
  telefone: 'por telefone: nós ligamos para você',
}

/** A mensagem do convite (CA4). A ficha de atendimento é em papel até o tablet chegar (Pedro, 05/10). */
export function mensagemDoConvite(c: {
  nome: string
  tipo: TipoDeEntrevista
  data: string
  hora: string
  link?: string
  pedirFicha: boolean
  levar: boolean
  gravar: boolean
}): string {
  return [
    `Olá, ${c.nome.split(' ')[0]}! Sua conversa com o escritório GGV está marcada para ${diaFalado(c.data)}, às ${horaFalada(c.hora)}, ${COMO[c.tipo]}.`,
    c.tipo === 'video' && c.link ? `Link: ${c.link}.` : '',
    c.pedirFicha ? 'Antes da conversa, preencha a ficha de atendimento em papel, no balcão do escritório ou com quem te atendeu.' : '',
    c.levar ? 'Traga RG, CPF e os laudos.' : '',
    c.gravar ? 'Avisamos que a conversa é gravada.' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

const COMO_NA_AGENDA: Record<TipoDeEntrevista, string> = { video: 'vídeo (Meet)', presencial: 'presencial', telefone: 'telefone' }

/** A linha de detalhe do evento na agenda (Figma 1941:401): "gravada · vídeo (Meet) · Dra. Paula". */
export function detalheDoEvento(e: Pick<EventoDaAgenda, 'gravar' | 'tipo' | 'responsavel' | 'fichaId'>): string {
  return [e.gravar && e.tipo ? 'gravada' : '', e.tipo ? COMO_NA_AGENDA[e.tipo] : '', e.responsavel ?? '', e.fichaId ? '' : 'interno']
    .filter(Boolean)
    .join(' · ')
}

/** "2026-10-06" → "ter 06/10/2026". */
export function dataLonga(iso: string): string {
  return `${diaCurto(iso)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}
