// Estudos de caso (GGVP-19): a ordem da tela e o arquivo que a Sênior baixa, num lugar só.
import { ROTULO_BENEFICIO, type Beneficio, type EstudosDeCaso } from '@ggv/contratos'

export type Item = EstudosDeCaso['estudos'][number]
export const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const beneficioDe = (b: string | null) => (b ? (ROTULO_BENEFICIO[b as Beneficio] ?? b) : 'Sem benefício definido')
const CHANCES = [
  { chance: 'maior', rotulo: 'Tínhamos mais chance' },
  { chance: 'menor', rotulo: 'Tínhamos menos chance' },
] as const

/** Os estudos por benefício e, dentro dele, pela chance que o caso tinha (Lucas, 06/10). */
export function agrupar(estudos: Item[]) {
  const porBeneficio = new Map<string, Item[]>()
  for (const e of estudos) porBeneficio.set(beneficioDe(e.beneficio), [...(porBeneficio.get(beneficioDe(e.beneficio)) ?? []), e])
  return [...porBeneficio].map(([beneficio, lista]) => ({ beneficio, grupos: CHANCES.map((c) => ({ ...c, lista: lista.filter((e) => e.estudo.chance === c.chance) })) }))
}

/** O arquivo que a Sênior baixa e manda para a equipe estudar mais a fundo: texto simples, na mesma ordem da tela. */
export function textoDosEstudos(estudos: Item[], hoje = new Date()) {
  const linhas = [`Estudos de caso · GGV Previdenciário · ${dia(hoje.toISOString())}`, 'Feitos pela IA depois de cada processo perdido. Estratégia interna: não vão ao cliente.', '']
  for (const { beneficio, grupos } of agrupar(estudos)) {
    linhas.push(`== ${beneficio} ==`)
    for (const g of grupos.filter((x) => x.lista.length)) {
      linhas.push(`-- ${g.rotulo} --`)
      for (const { cliente, resultado, estudo: e } of g.lista)
        linhas.push(
          `Cliente: ${cliente} · ${resultado}`,
          `Matéria: ${e.materia}`,
          ...(e.vara ? [`Vara: ${e.vara}`] : []),
          ...(e.tese ? [`Tese: ${e.tese}`] : []),
          `Resumo: ${e.resumo}`,
          `Motivo: ${e.motivo}`,
          `Aprendizado: ${e.aprendizado}`,
          `Novo processo: ${e.novoProcesso ? `sim. O que refazer: ${e.oQueRefazer ?? '—'}` : 'não'}`,
          '',
        )
    }
  }
  return linhas.join('\n')
}
