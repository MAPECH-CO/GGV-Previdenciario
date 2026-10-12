import { analisarData, validarData } from '@ggv/campos'
import { z } from 'zod'

// Memória do tempo comum, sem decisão de direito. Fundamentos e limites em docs/requisitos/calculo-cnis.md.
export const VERSAO_CALCULO_CNIS = 'rgps-comum-1'
const data = z.string().refine(validarData, 'Data inválida: use dd/mm/aaaa.')
const situacao = z.enum(['conferido', 'pendente', 'nao-conta'])
export const EntradaCalculoCnis = z.object({
  nascimento: data,
  referencia: data,
  vinculos: z.array(z.object({
    inicio: data,
    fim: data,
    tempo: situacao,
    carencia: situacao,
  })).min(1, 'Digite ao menos um vínculo.').max(100, 'Use até 100 períodos.'),
  // A avaliação é da competência consolidada, incluindo remunerações concomitantes.
  excecoes: z.array(z.object({
    competencia: z.string().refine(v => /^\d{2}\/\d{4}$/.test(v) && validarData('01/' + v), 'Competência inválida: use mm/aaaa.'),
    tempo: situacao,
    carencia: situacao,
  })).max(600, 'Use até 600 competências com exceção.'),
})
export type EntradaDoCnis = z.infer<typeof EntradaCalculoCnis>
export type SituacaoNoCnis = EntradaDoCnis['vinculos'][number]['tempo']
const DIA = 86_400_000
const CORTE = Date.UTC(2019, 10, 1) / DIA
const dia = (data: string) => analisarData(data)!.getTime() / DIA
const mes = (d: number) => new Date(d * DIA).toISOString().slice(0, 7)
const primeiro = (competencia: string) => Date.parse(competencia + '-01T00:00:00Z') / DIA
const proximo = (d: number) => {
  const data = new Date(d * DIA)
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 1) / DIA
}

export function calcularCnis(entrada: unknown, hoje: string) {
  const validada = EntradaCalculoCnis.safeParse(entrada)
  if (!validada.success) return { ok: false as const, erros: validada.error.issues.map(e => e.message) }
  const v = validada.data
  const nascimento = dia(v.nascimento), referencia = dia(v.referencia)
  const erros: string[] = []
  if (!validarData(hoje) || referencia > dia(hoje)) erros.push('A data de referência não pode ser futura.')
  if (nascimento >= referencia || referencia - nascimento > 130 * 366) erros.push('Confira o nascimento e a data de referência.')
  v.vinculos.forEach((p, i) => {
    if (dia(p.inicio) < nascimento || dia(p.inicio) > dia(p.fim) || dia(p.fim) > referencia)
      erros.push('Vínculo ' + (i + 1) + ': use início e fim entre o nascimento e a referência, nessa ordem.')
  })
  const excecoes = new Map<string, EntradaDoCnis['excecoes'][number]>()
  for (const e of v.excecoes) {
    const chave = e.competencia.slice(3) + '-' + e.competencia.slice(0, 2)
    if (excecoes.has(chave)) erros.push('Há competência repetida nas exceções.')
    if (!v.vinculos.some(p => mes(dia(p.inicio)) <= chave && mes(dia(p.fim)) >= chave)) erros.push('A competência com exceção precisa estar em algum vínculo.')
    excecoes.set(chave, e)
  }
  if (erros.length) return { ok: false as const, erros }

  const diasAntes = new Set<number>()
  const mesesDepois = new Set<string>()
  const carencia = new Set<string>()
  const pendentes = new Set<string>()
  const excluidas = new Set<string>()
  for (const p of v.vinculos) {
    const inicio = dia(p.inicio), fim = dia(p.fim)
    for (let d = primeiro(mes(inicio)); d <= fim; d = proximo(d)) {
      const chave = mes(d), excecao = excecoes.get(chave)
      // Exceção pode suspender ou excluir, mas nunca promover vínculo não conferido.
      const situacao = (campo: 'tempo' | 'carencia') =>
        p[campo] === 'conferido' ? (excecao?.[campo] ?? p[campo]) : p[campo]
      const tempo = situacao('tempo'), care = situacao('carencia')
      if (tempo === 'pendente' || care === 'pendente') pendentes.add(chave)
      if (tempo === 'nao-conta' || care === 'nao-conta') excluidas.add(chave)
      if (care === 'conferido') carencia.add(chave)
      if (tempo !== 'conferido') continue
      if (referencia >= Date.UTC(2019, 10, 13) / DIA && d >= CORTE) mesesDepois.add(chave)
      else for (let atual = Math.max(inicio, d); atual <= Math.min(fim, proximo(d) - 1); atual++) diasAntes.add(atual)
    }
  }
  // IN 128, art. 207, parágrafo único: ano de 365 dias composto de 12 meses; mês residual de 30 dias.
  // Mantém as parcelas na saída para a advogada conferir a convenção, sem decidir elegibilidade.
  const diasDeTempo = diasAntes.size
  const diasDaParcelaMensal = Math.floor(mesesDepois.size / 12) * 365 + (mesesDepois.size % 12) * 30
  const diasTotais = diasDeTempo + diasDaParcelaMensal
  const idadeDias = referencia - nascimento
  const pontos = (idadeDias + diasTotais) / 365
  return { ok: true as const, versao: VERSAO_CALCULO_CNIS, diasDeTempo, diasDaParcelaMensal, diasTotais, competenciasIntegrais: mesesDepois.size,
    carencia: carencia.size, idadeDias, pontos, parcial: pendentes.size > 0,
    competenciasPendentes: [...pendentes].sort(), competenciasExcluidas: [...excluidas].sort() }
}
