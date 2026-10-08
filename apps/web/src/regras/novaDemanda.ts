// Nova demanda de quem já é cliente (GGVP-124): o caso novo nasce na mesma ficha, sem cadastro repetido.
import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Demanda, Ficha, TipoDeDemanda } from '../dados/tipos.ts'
import { localDoTipo, tipoSugerido } from './arquivos.ts'

export const TAMANHO_DO_PEDIDO = 500

export type EstadoDaDemanda = { tipo: TipoDeDemanda | null; pretende: string; beneficio: string }

/** A nova demanda ainda sem o "Fechou com o escritório?" (D1.14). */
export const demandaAberta = (ficha: Pick<Ficha, 'demandas'>) => ficha.demandas?.find((d) => d.situacao === 'aberta')

/** A entrevista da demanda: a última marcada do dia em que ela foi aberta em diante, que não foi remarcada (CA2). */
export const entrevistaDaDemanda = (ficha: Pick<Ficha, 'agendamentos'>, demanda: Pick<Demanda, 'data'>) =>
  ficha.agendamentos
    .filter((a) => a.oQue === 'Entrevista' && a.data >= demanda.data && a.estado !== 'remarcado')
    .sort((a, b) => b.data.localeCompare(a.data))[0]

/** Por que "Abrir a nova demanda" não habilita. Recurso e defesa seguem no mesmo processo (CA8). */
export function motivoParadoDaDemanda(e: EstadoDaDemanda, ficha: Pick<Ficha, 'situacao' | 'demandas'>): string | null {
  if (ficha.situacao !== 'cliente') return 'Nova demanda é para quem já é cliente.'
  if (demandaAberta(ficha)) return 'Já há uma nova demanda aberta: siga com ela.'
  if (!e.tipo) return 'Responda o que a pessoa veio fazer.'
  if (e.tipo === 'recurso-ou-defesa') return 'Recurso e defesa seguem no mesmo processo: não abre processo novo.'
  if (!e.pretende.trim()) return 'Escreva o que a pessoa quer.'
  if (e.pretende.trim().length > TAMANHO_DO_PEDIDO) return `O que a pessoa quer: até ${TAMANHO_DO_PEDIDO} caracteres.`
  if (!e.beneficio) return 'Escolha o benefício de interesse.'
  return null
}

/** A advogada abriu e a entrevista ainda não foi marcada: o Atendimento liga para o cliente (CA9). */
export const precisaLigar = (ficha: Pick<Ficha, 'demandas' | 'agendamentos'>) => {
  const d = demandaAberta(ficha)
  return d?.abertaPor === 'advogada' && !entrevistaDaDemanda(ficha, d)
}

/** Os documentos pessoais que já estão na pasta do cliente: as miniaturas da ficha e o que entrou em Documentos pessoais. */
export function pessoaisNaPasta(ficha: Pick<Ficha, 'documentos' | 'arquivos'>): string[] {
  const tipos = [...ficha.documentos.map((d) => tipoSugerido(d.nome)), ...ficha.arquivos.filter((a) => a.local === 'pessoais').map((a) => a.tipo)]
  return [...new Set(tipos.filter((t) => localDoTipo(t, 'processo-novo') === 'pessoais'))]
}

/** O checklist do processo novo não pede de novo o documento pessoal que já está na pasta (CA5). */
export function documentosAPedir(tipos: string[], ficha: Pick<Ficha, 'documentos' | 'arquivos'>): string[] {
  const naPasta = new Set(pessoaisNaPasta(ficha))
  return tipos.filter((t) => !naPasta.has(t))
}

/** A subpasta do processo novo na pasta do cliente no Drive: o benefício e o ano, como "AUXÍLIO ACIDENTÁRIO 2026" (CA7). */
export const nomeDaSubpasta = (beneficio: string, hoje: string) => `${nomeBeneficio(beneficio).toLocaleUpperCase('pt-BR')} ${hoje.slice(0, 4)}`

/** A mensagem de boas-vindas vai só no primeiro processo da ficha: quem já era cliente não recebe de novo (CA10). */
export const mandaBoasVindas = (ficha: Pick<Ficha, 'processos'>, processoId: string) => ficha.processos[0]?.id === processoId
