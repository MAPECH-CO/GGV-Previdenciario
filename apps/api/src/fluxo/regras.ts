// Regras numéricas do roteiro de laudos (GGVP-25, G19): código puro com teste, nunca a IA. `hoje` entra como dado, e o
// mesmo insumo dá sempre o mesmo resultado (CA8). Mudou a regra: suba a versão, e quem guardou o resultado guarda a antiga.
import { MESES_LOAS, mesesEntre, type EntradaDii, type EntradaIncapacidade, type EntradaLoas24, type EntradaPcd, type Regra, type ResultadoDaRegra } from '@ggv/contratos'
import { somarDias } from './prazo-inss.ts'

export const REGRAS_DO_ROTEIRO = {
  loas_24_meses: { versao: 1, fundamento: 'Impedimento de longo prazo: efeitos por 2 anos ou mais (Lei 8.742, art. 20, §10)' },
  incapacidade_15_dias: {
    versao: 1,
    fundamento:
      'Mais de 15 dias de afastamento; atestados da mesma doença somam quando o novo começa até 60 dias depois da volta ao trabalho (Lei 8.213, art. 59; Decreto 3.048, art. 75, §§ 4º e 5º)',
  },
  periodos_pcd: { versao: 1, fundamento: 'Tempo na condição de pessoa com deficiência: a parte de cada vínculo dentro do período da deficiência (LC 142/2013)' },
  dii_carencia_qualidade: {
    versao: 1,
    fundamento:
      'Carência de 12 contribuições, ou 6 depois de perder a qualidade, salvo isenção (Lei 8.213, arts. 25, I, 26, II e 27-A); qualidade por 12 meses, mais 12 com mais de 120 contribuições sem perda e mais 12 com desemprego comprovado, ou 6 meses do facultativo, até o dia 15 do 2º mês depois do fim da graça (Lei 8.213, art. 15; Decreto 3.048, art. 14)',
  },
} as const satisfies Record<Regra, { versao: number; fundamento: string }>

export const DIAS_INCAPACIDADE = 15
export const JANELA_DIAS = 60
export const CARENCIA = 12
export const GRACA_MESES = 12
export const GRACA_FACULTATIVO = 6
export const CONTRIBUICOES_PARA_PRORROGAR = 120

type Linha = { rotulo: string; valor: string }
const br = (iso: string) => iso.split('-').reverse().join('/')
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000)
/** Meses completos de `de` até `ate`. */
/** Mês como número (ano × 12 + mês - 1), para contar competências. */
const indiceDoMes = (ano: number, mes: number) => ano * 12 + mes - 1
const competencia = (c: string) => indiceDoMes(Number(c.slice(3)), Number(c.slice(0, 2)))
const mesDaData = (iso: string) => indiceDoMes(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)))
const dia15Do = (indice: number) => `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}-15`
const comoCompetencia = (indice: number) => `${String((indice % 12) + 1).padStart(2, '0')}/${Math.floor(indice / 12)}`

function resultado(regra: Regra, hoje: string, entradas: object, atende: boolean | null, resumo: string, detalhes: Linha[] = [], falta: string[] = []): ResultadoDaRegra {
  return { regra, ...REGRAS_DO_ROTEIRO[regra], hoje, entradas: { ...entradas }, falta, atende, resumo, detalhes }
}
/** CA4 (G19): sem um dado, nunca um palpite. */
const naoCalculavel = (regra: Regra, hoje: string, entradas: object, falta: string[]) =>
  resultado(regra, hoje, entradas, null, `Não calculável: falta ${falta.join(' e ')}`, [], falta)

/** CA1 · BPC/LOAS Deficiente: do início até a maior data entre a cessação prevista e hoje (se ainda persiste). */
export function loas24Meses(e: EntradaLoas24, hoje: string): ResultadoDaRegra {
  const R = 'loas_24_meses'
  const fim = e.permanente ? null : [e.fimPrevisto, e.persiste ? hoje : undefined].filter((d): d is string => Boolean(d)).sort().at(-1)
  const falta = [...(e.inicio ? [] : ['a data de início do impedimento']), ...(e.permanente || fim ? [] : ['o prognóstico (data prevista, permanente ou se ainda persiste)'])]
  if (falta.length || !e.inicio) return naoCalculavel(R, hoje, e, falta)
  if (!fim) return resultado(R, hoje, e, true, `Prognóstico permanente: alcança os ${MESES_LOAS} meses`, [{ rotulo: 'Início do impedimento', valor: br(e.inicio) }])
  const meses = Math.max(0, mesesEntre(e.inicio, fim))
  const ate = fim === hoje && e.persiste ? `${br(fim)} (hoje, ainda persiste)` : `${br(fim)} (cessação prevista)`
  return resultado(R, hoje, e, meses >= MESES_LOAS, `${meses} meses: ${meses >= MESES_LOAS ? 'alcança' : 'não alcança'} os ${MESES_LOAS} meses`, [
    { rotulo: 'Início do impedimento', valor: br(e.inicio) },
    { rotulo: 'Até', valor: ate },
    { rotulo: 'Duração', valor: `${meses} meses` },
  ])
}

/**
 * CA2 · Incapacidade temporária: só os atestados com a correlação marcada; o seguinte entra na mesma soma se começa até
 * 60 dias depois da volta ao trabalho (o dia seguinte ao fim do anterior). Dias sobrepostos contam uma vez.
 */
export function incapacidade15Dias(e: EntradaIncapacidade, hoje: string): ResultadoDaRegra {
  const R = 'incapacidade_15_dias'
  if (!e.atestados?.length) return naoCalculavel(R, hoje, e, ['os atestados'])
  const fora = e.atestados.filter((a) => !a.correlacionado)
  const contados = e.atestados.filter((a) => a.correlacionado).sort((a, b) => a.inicio.localeCompare(b.inicio))
  let atual = { dias: 0, fim: '', inicios: [] as string[] }
  let maior = atual
  for (const a of contados) {
    const fimDoAtestado = somarDias(a.inicio, a.dias - 1)
    if (atual.fim && diasEntre(somarDias(atual.fim, 1), a.inicio) > JANELA_DIAS) atual = { dias: 0, fim: '', inicios: [] }
    const novos = atual.fim && a.inicio <= atual.fim ? Math.max(0, diasEntre(atual.fim, fimDoAtestado)) : a.dias
    atual = { dias: atual.dias + novos, fim: fimDoAtestado > atual.fim ? fimDoAtestado : atual.fim, inicios: [...atual.inicios, a.inicio] }
    if (atual.dias > maior.dias) maior = atual
  }
  const passa = maior.dias > DIAS_INCAPACIDADE
  return resultado(R, hoje, e, passa, `${maior.dias} dias somados: ${passa ? 'passa' : 'não passa'} de ${DIAS_INCAPACIDADE} dias`, [
    { rotulo: 'Atestados somados', valor: maior.inicios.map(br).join(', ') || 'nenhum' },
    { rotulo: 'Fora da soma (sem correlação marcada)', valor: fora.map((a) => br(a.inicio)).join(', ') || 'nenhum' },
  ])
}

/** CA3 · Aposentadoria PCD: a parte de cada vínculo dentro do período da deficiência; vínculos concomitantes contam uma vez no total. */
export function periodosPcd(e: EntradaPcd, hoje: string): ResultadoDaRegra {
  const R = 'periodos_pcd'
  const falta = [...(e.inicioDeficiencia ? [] : ['a data de início da deficiência']), ...(e.vinculos?.length ? [] : ['os vínculos do CNIS'])]
  if (falta.length || !e.inicioDeficiencia || !e.vinculos) return naoCalculavel(R, hoje, e, falta)
  const inicioDef = e.inicioDeficiencia
  const fimDef = e.fimDeficiencia ?? hoje
  const periodos = e.vinculos
    .map((v) => ({ de: v.inicio > inicioDef ? v.inicio : inicioDef, ate: (v.fim ?? hoje) < fimDef ? (v.fim ?? hoje) : fimDef }))
    .filter((p) => p.de <= p.ate)
    .sort((a, b) => a.de.localeCompare(b.de))
  let total = 0
  let ultimo = ''
  for (const p of periodos) {
    const de = ultimo && p.de <= ultimo ? somarDias(ultimo, 1) : p.de
    if (de <= p.ate) total += diasEntre(de, p.ate) + 1
    if (p.ate > ultimo) ultimo = p.ate
  }
  return resultado(
    R,
    hoje,
    e,
    periodos.length > 0,
    periodos.length ? `${periodos.length} ${periodos.length === 1 ? 'período conta' : 'períodos contam'} como tempo na condição de PCD: ${total} dias` : 'Nenhum vínculo no período da deficiência',
    periodos.map((p, i) => ({ rotulo: `Período ${i + 1}`, valor: `${br(p.de)} a ${br(p.ate)}` })),
  )
}

/**
 * CA5 · DII × carência e qualidade de segurado, pelas competências do CNIS. Perda da qualidade entre duas contribuições:
 * a seguinte começa depois do mês seguinte ao fim da graça (lado seguro: o mês da perda conta como perdido).
 */
export function diiCarenciaQualidade(e: EntradaDii, hoje: string): ResultadoDaRegra {
  const R = 'dii_carencia_qualidade'
  const falta = [...(e.dii ? [] : ['a data de início da incapacidade (DII)']), ...(e.competencias?.length ? [] : ['as competências contribuídas (CNIS)'])]
  if (falta.length || !e.dii || !e.competencias) return naoCalculavel(R, hoje, e, falta)
  const mesDii = mesDaData(e.dii)
  const meses = [...new Set(e.competencias.map(competencia))].filter((m) => m <= mesDii).sort((a, b) => a - b)
  const graca = (contribuicoes: number, comDesemprego: boolean) =>
    e.facultativo ? GRACA_FACULTATIVO : GRACA_MESES + (contribuicoes > CONTRIBUICOES_PARA_PRORROGAR ? 12 : 0) + (comDesemprego && e.desempregado ? 12 : 0)
  let cadeia: number[] = []
  let perdeu = false
  for (const m of meses) {
    const anterior = cadeia.at(-1)
    if (anterior !== undefined && m > anterior + graca(cadeia.length, false) + 1) {
      perdeu = true
      cadeia = []
    }
    cadeia.push(m)
  }
  const exigida = e.isentaDeCarencia ? 0 : perdeu ? CARENCIA / 2 : CARENCIA
  const feitas = cadeia.filter((m) => m < mesDii).length
  const ultima = cadeia.at(-1)
  const ate = ultima === undefined ? null : ultima === mesDii ? e.dii : dia15Do(ultima + graca(cadeia.length, true) + 2)
  const qualidade = ate !== null && e.dii <= ate
  const carencia = feitas >= exigida
  return resultado(R, hoje, e, carencia && qualidade, `DII ${br(e.dii)}: ${carencia && qualidade ? 'compatível' : 'não compatível'} com a carência e a qualidade de segurado`, [
    { rotulo: 'Carência', valor: e.isentaDeCarencia ? 'isenta (marcada pela advogada)' : `${feitas} de ${exigida} contribuições antes da DII${perdeu ? ' (depois da nova filiação)' : ''}` },
    { rotulo: 'Perdeu a qualidade antes', valor: perdeu ? 'sim' : 'não' },
    { rotulo: 'Última contribuição até a DII', valor: ultima === undefined ? 'nenhuma' : comoCompetencia(ultima) },
    { rotulo: 'Qualidade de segurado até', valor: ultima === mesDii ? 'em atividade no mês da DII' : ate ? br(ate) : 'sem qualidade' },
  ])
}

export function calcular(regra: Regra, entrada: unknown, hoje: string): ResultadoDaRegra {
  if (regra === 'loas_24_meses') return loas24Meses(entrada as EntradaLoas24, hoje)
  if (regra === 'incapacidade_15_dias') return incapacidade15Dias(entrada as EntradaIncapacidade, hoje)
  if (regra === 'periodos_pcd') return periodosPcd(entrada as EntradaPcd, hoje)
  return diiCarenciaQualidade(entrada as EntradaDii, hoje)
}
