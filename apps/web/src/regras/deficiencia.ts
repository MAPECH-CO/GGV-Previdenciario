// A linha do tempo da deficiência na Aposentadoria PCD (GGVP-42): cada vínculo do CNIS partido em "sem deficiência" e
// "com deficiência" por grau, as provas da época e o enquadramento. Regra numérica é código com teste, nunca da IA (G19).
import { dataParaIso, normalizarData } from '../campos.ts'
import { erroData } from './formularios.ts'

export type Grau = 'leve' | 'moderada' | 'grave'

export const GRAUS: Record<Grau, string> = { leve: 'leve', moderada: 'moderada', grave: 'grave' }

/** Do mais leve ao mais grave: o agravamento só sobe nessa ordem. */
const ORDEM: Grau[] = ['leve', 'moderada', 'grave']

export type Sexo = 'feminino' | 'masculino'

export const SEXOS: Record<Sexo, string> = { feminino: 'mulher', masculino: 'homem' }

export type DadosDaDeficiencia = {
  /** aaaa-mm-dd: o início da deficiência (CA1). */
  inicio: string
  /** O grau no início. */
  grau: Grau
  /** O grau muda a partir de cada data (CA2). */
  agravamentos: { data: string; grau: Grau }[]
  /** O mínimo da LC 142 muda com o sexo. */
  sexo: Sexo
}

/** Um vínculo do CNIS: aaaa-mm ou aaaa-mm-dd; sem fim, em aberto até a extração. */
export type VinculoDoCnis = { empresa: string; inicio: string; fim?: string; indicadorPcd?: boolean; insalubre?: boolean }

/** Um documento que prova a deficiência na época (CA3): laudo, atestado, ASO, contratação por cota... */
export type Prova = { tipo: string; /** aaaa-mm-dd */ data: string; descricao: string }

/** Os tipos que provam a deficiência na época de um vínculo (CA3). */
export const TIPOS_DE_PROVA = ['laudo', 'atestado', 'relatorio-medico', 'prontuario', 'exame', 'aso', 'contratacao-cota']

export type Periodo = {
  empresa: string
  /** aaaa-mm-dd, os dois inclusive. */
  inicio: string
  fim: string
  dias: number
  /** Sem grau: sem deficiência (CA1). */
  grau?: Grau
  indicadorPcd: boolean
  insalubre: boolean
  provas: Prova[]
  /** Com deficiência e sem documento da época (CA3). */
  semProva: boolean
}

const DIA = 86_400_000
const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA) + 1
const somar = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10)
const ultimoDia = (aaaaMm: string) => {
  const [a, m] = aaaaMm.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}
/** aaaa-mm vira o primeiro dia do mês; aaaa-mm-dd fica. */
const comecoDe = (data: string) => (data.length === 7 ? `${data}-01` : data)
/** aaaa-mm vira o último dia do mês; aaaa-mm-dd fica. */
const fimDe = (data: string) => (data.length === 7 ? ultimoDia(data) : data)

/** O grau numa data; antes do início, nenhum (CA1, CA2). */
export function grauEm(d: DadosDaDeficiencia, data: string): Grau | undefined {
  if (data < d.inicio) return undefined
  return [...d.agravamentos].sort((a, b) => a.data.localeCompare(b.data)).filter((g) => g.data <= data).at(-1)?.grau ?? d.grau
}

/**
 * Cada vínculo partido no início da deficiência e em cada agravamento (CA1, CA2), com as provas da época (CA3).
 * ponytail: vínculos concomitantes somam duas vezes; a semente não tem, e o CNIS tratado do cálculo (GGVP-57) resolve.
 */
export function periodos(vinculos: VinculoDoCnis[], d: DadosDaDeficiencia, provas: Prova[], ate: string): Periodo[] {
  const cortes = [d.inicio, ...d.agravamentos.map((g) => g.data)]
  return vinculos.flatMap((v) => {
    const inicio = comecoDe(v.inicio)
    const fim = v.fim ? fimDe(v.fim) : ate
    if (fim < inicio) return []
    const dentro = cortes.filter((c) => c > inicio && c <= fim).sort()
    const inicios = [inicio, ...new Set(dentro)]
    return inicios.map((de, i) => {
      const para = i + 1 < inicios.length ? somar(inicios[i + 1], -1) : fim
      const grau = grauEm(d, de)
      const daEpoca = grau ? provas.filter((p) => TIPOS_DE_PROVA.includes(p.tipo) && p.data >= de && p.data <= para) : []
      return {
        empresa: v.empresa,
        inicio: de,
        fim: para,
        dias: dias(de, para),
        ...(grau && { grau }),
        indicadorPcd: v.indicadorPcd === true,
        insalubre: v.insalubre === true,
        provas: daEpoca,
        semProva: grau !== undefined && daEpoca.length === 0,
      }
    })
  })
}

export type Faixa = Grau | 'sem'

/**
 * Os fatores de conversão da tabela do Decreto 3.048, art. 70-E (redação do Decreto 8.145/2013): FATORES[sexo][de][para].
 * O tempo de um grau (ou sem deficiência) vira tempo no grau preponderante.
 */
export const FATORES: Record<Sexo, Record<Faixa, Record<Faixa, number>>> = {
  feminino: {
    grave: { grave: 1, moderada: 1.2, leve: 1.4, sem: 1.5 },
    moderada: { grave: 0.83, moderada: 1, leve: 1.17, sem: 1.25 },
    leve: { grave: 0.71, moderada: 0.86, leve: 1, sem: 1.07 },
    sem: { grave: 0.67, moderada: 0.8, leve: 0.93, sem: 1 },
  },
  masculino: {
    grave: { grave: 1, moderada: 1.16, leve: 1.32, sem: 1.4 },
    moderada: { grave: 0.86, moderada: 1, leve: 1.14, sem: 1.21 },
    leve: { grave: 0.76, moderada: 0.88, leve: 1, sem: 1.06 },
    sem: { grave: 0.71, moderada: 0.83, leve: 0.94, sem: 1 },
  },
}

/** O tempo mínimo de contribuição da LC 142, art. 3º, em anos. */
export const MINIMO_LC_142: Record<Sexo, Record<Grau, number>> = {
  feminino: { grave: 20, moderada: 24, leve: 28 },
  masculino: { grave: 25, moderada: 29, leve: 33 },
}

/** Dias em anos, meses e dias: ano de 365 e mês de 30, como no tempo de contribuição. */
export function tempo(diasTotais: number): { anos: number; meses: number; dias: number } {
  const anos = Math.floor(diasTotais / 365)
  const resto = diasTotais - anos * 365
  return { anos, meses: Math.floor(resto / 30), dias: resto % 30 }
}

export type Enquadramento = {
  /** O grau com mais tempo, antes da conversão (art. 70-E, § 1º). */
  preponderante: Grau
  faixas: { faixa: Faixa; dias: number; fator: number; convertidos: number }[]
  /** O tempo total convertido para o grau preponderante, em dias. */
  convertido: number
  /** O mínimo da LC 142 para o sexo e o grau preponderante, em anos. */
  minimo: number
  /** Quanto falta para o mínimo, em dias; zero quando já tem. */
  falta: number
  /** O tempo com deficiência (qualquer grau), sem conversão, em dias. */
  comDeficiencia: number
  /** Quanto falta para os 15 anos como pessoa com deficiência, em dias; zero quando já tem. */
  faltaComDeficiencia: number
}

/** Pelo menos 15 anos de contribuição na condição de pessoa com deficiência para ter direito (resposta do Lucas, 07/10). */
export const MINIMO_COM_DEFICIENCIA = 15

/**
 * Os dias dos períodos, contando uma vez o dia em que dois vínculos correm juntos: atividade ao mesmo tempo não soma
 * tempo (decisão do Pedro em 08/10, igual à regra `periodos_pcd` do servidor). O grau é da pessoa na data, então os
 * períodos de uma mesma faixa se juntam sem conflito.
 */
function diasSemRepetir(ps: Periodo[]): number {
  let total = 0
  let ate = ''
  for (const p of [...ps].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const de = ate && p.inicio <= ate ? somar(ate, 1) : p.inicio
    if (de <= p.fim) total += dias(de, p.fim)
    if (p.fim > ate) ate = p.fim
  }
  return total
}

/** O enquadramento dos períodos PCD (CA4, G19); sem período com deficiência, nenhum. */
export function enquadramento(ps: Periodo[], sexo: Sexo): Enquadramento | undefined {
  const porFaixa = (f: Faixa) => diasSemRepetir(ps.filter((p) => (p.grau ?? 'sem') === f))
  const comDeficiencia = ORDEM.map((g) => ({ g, d: porFaixa(g) }))
  if (comDeficiencia.every((x) => x.d === 0)) return undefined
  // Empate: fica o grau mais grave, o de menor exigência.
  const preponderante = [...comDeficiencia].reverse().reduce((a, b) => (b.d > a.d ? b : a)).g
  const faixas = (['grave', 'moderada', 'leve', 'sem'] as Faixa[])
    .map((faixa) => {
      const d = porFaixa(faixa)
      const fator = FATORES[sexo][faixa][preponderante]
      return { faixa, dias: d, fator, convertidos: Math.round(d * fator) }
    })
    .filter((f) => f.dias > 0)
  const convertido = faixas.reduce((s, f) => s + f.convertidos, 0)
  const minimo = MINIMO_LC_142[sexo][preponderante]
  const dias = comDeficiencia.reduce((s, x) => s + x.d, 0)
  return {
    preponderante,
    faixas,
    convertido,
    minimo,
    falta: Math.max(0, minimo * 365 - convertido),
    comDeficiencia: dias,
    faltaComDeficiencia: Math.max(0, MINIMO_COM_DEFICIENCIA * 365 - dias),
  }
}

export type Cenario = { grau: Grau; enquadramento: Enquadramento }

/**
 * Na entrevista, o escritório calcula todos os cenários (leve, moderada e grave): trabalha com qualquer grau que tenha
 * chance de ser comprovado, e o grau efetivo é definido na perícia (resposta do Lucas, 07/10). Cada cenário trata todo o
 * período com deficiência como daquele grau.
 */
export function cenarios(ps: Periodo[], sexo: Sexo): Cenario[] {
  if (!ps.some((p) => p.grau)) return []
  return ORDEM.map((grau) => ({
    grau,
    enquadramento: enquadramento(
      ps.map((p) => (p.grau ? { ...p, grau } : p)),
      sexo,
    )!,
  }))
}

/** O que a tela digita. */
export type ValoresDaDeficiencia = { inicio: string; grau: Grau | ''; sexo: Sexo | ''; agravamentos: { data: string; grau: Grau | '' }[] }

/** Por que os dados da deficiência ainda não salvam; prontos, null. Datas pela biblioteca campos, nunca futuras. */
export function motivoParaNaoSalvar(v: ValoresDaDeficiencia, hoje: string): string | null {
  if (!v.inicio.trim() || erroData(v.inicio, hoje)) return 'Data de início em dd/mm/aaaa, que não seja futura.'
  if (!v.grau) return 'Escolha o grau no início.'
  if (!v.sexo) return 'Escolha o sexo para a contagem (LC 142).'
  const inicio = dataParaIso(normalizarData(v.inicio))!
  let anterior: Grau = v.grau
  let depoisDe = inicio
  for (const g of v.agravamentos) {
    const data = dataParaIso(normalizarData(g.data))
    if (!g.data.trim() || erroData(g.data, hoje) || !data) return 'Data do agravamento em dd/mm/aaaa, que não seja futura.'
    if (data <= depoisDe) return 'Cada agravamento vem depois do início e do agravamento anterior.'
    if (!g.grau || ORDEM.indexOf(g.grau) <= ORDEM.indexOf(anterior)) return 'O agravamento leva a um grau mais grave que o anterior.'
    anterior = g.grau
    depoisDe = data
  }
  return null
}

/** Os valores da tela no formato do servidor; null enquanto falta algo. */
export function paraDados(v: ValoresDaDeficiencia, hoje: string): DadosDaDeficiencia | null {
  if (motivoParaNaoSalvar(v, hoje)) return null
  return {
    inicio: dataParaIso(normalizarData(v.inicio))!,
    grau: v.grau as Grau,
    sexo: v.sexo as Sexo,
    agravamentos: v.agravamentos.map((g) => ({ data: dataParaIso(normalizarData(g.data))!, grau: g.grau as Grau })),
  }
}
