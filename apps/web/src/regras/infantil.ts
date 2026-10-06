// BPC/LOAS de menor de 16 anos (GGVP-50): o roteiro infantil e os relatórios por condição, da resposta do Lucas de 01/10.
// Menor de 16 anos é cálculo em código, pela data de nascimento (G19), nunca resposta de modelo.
import { idadeEm } from './datas.ts'

export type CondicaoDaCrianca = 'saude-mental' | 'neurologica'

export const CONDICOES_DA_CRIANCA: Record<CondicaoDaCrianca, string> = {
  'saude-mental': 'Saúde mental (o relatório do CAPS)',
  neurologica: 'Paralisia cerebral, má formação ou parecido (o relatório da neurologia)',
}

export type Terapia = 'fono' | 'to' | 'psicologia'

export const TERAPIAS: Record<Terapia, string> = { fono: 'Fonoaudiologia', to: 'Terapia ocupacional', psicologia: 'Psicologia' }

export type DadosDaCrianca = { condicoes: CondicaoDaCrianca[]; terapias: Terapia[] }

/** O roteiro que a análise usa no LOAS Deficiente de menor de 16 anos (CA1). */
export const ROTEIRO_INFANTIL = 'loas-infantil'

/** Menor de 16 anos no dia, pela data de nascimento (aaaa-mm-dd); sem data, não é (vale o roteiro do adulto). */
export function menorDe16(nascimento: string | undefined, hoje: string): boolean {
  return nascimento !== undefined && idadeEm(nascimento, hoje) < 16
}

const RELATORIO_DA_TERAPIA: Record<Terapia, string> = { fono: 'relatorio-fono', to: 'relatorio-to', psicologia: 'relatorio-psicologia' }

/**
 * Os relatórios que o caso da criança pede (CA2): o escolar vale para todas; o do CAPS só na saúde mental; o da neurologia
 * na paralisia cerebral, na má formação e parecidos; fono, terapia ocupacional e psicologia conforme a terapia que ela faz.
 */
export function relatoriosDaCrianca(d: DadosDaCrianca): string[] {
  return [
    'relatorio-escolar',
    ...(d.condicoes.includes('saude-mental') ? ['relatorio-caps'] : []),
    ...(d.condicoes.includes('neurologica') ? ['relatorio-neurologia'] : []),
    ...(['fono', 'to', 'psicologia'] as const).filter((t) => d.terapias.includes(t)).map((t) => RELATORIO_DA_TERAPIA[t]),
  ]
}
