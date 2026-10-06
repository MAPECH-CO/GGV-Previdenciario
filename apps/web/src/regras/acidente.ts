// Auxílio-Acidente: os documentos que provam o acidente, por circunstância (GGVP-47, resposta do Lucas de 01/10 que
// fecha a Q19). A tabela é configuração do escritório (dados/checklist.ts); aqui, o que se aplica ao caso, a válvula da CAT
// e do PPP e o bloqueio da categoria. Trava é código com teste, nunca resposta de modelo.
import { dataParaIso, normalizarData } from '../campos.ts'
import { erroData } from './formularios.ts'

export type Circunstancia = 'trabalho' | 'trajeto' | 'ocupacional' | 'transito' | 'domestico'

export const CIRCUNSTANCIAS: Record<Circunstancia, string> = {
  trabalho: 'Acidente de trabalho',
  trajeto: 'Acidente de trajeto',
  ocupacional: 'Doença ocupacional',
  transito: 'Acidente de trânsito',
  domestico: 'Acidente doméstico',
}

export type Categoria = 'empregado' | 'domestico' | 'avulso' | 'especial' | 'individual' | 'facultativo'

export const CATEGORIAS: Record<Categoria, string> = {
  empregado: 'Empregado',
  domestico: 'Empregado doméstico',
  avulso: 'Trabalhador avulso',
  especial: 'Segurado especial',
  individual: 'Contribuinte individual',
  facultativo: 'Facultativo',
}

export type Exigencia = 'obrigatorio' | 'desejavel' | 'condicional'

export const EXIGENCIAS: Record<Exigencia, string> = { obrigatorio: 'obrigatório', desejavel: 'desejável', condicional: 'condicional' }

/** Os documentos com válvula: se o empregador recusa, vira pendência e não trava (art. 22, § 2º, da Lei 8.213; NTEP). */
export type ComValvula = 'cat' | 'ppp'

/** A tabela do escritório: para cada circunstância, os documentos e a exigência de cada um. */
export type TabelaDoAcidente = Record<Circunstancia, { tipo: string; exigencia: Exigencia }[]>

export type DadosDoAcidente = {
  circunstancia: Circunstancia
  categoria: Categoria
  /** aaaa-mm-dd */
  acidenteEm: string
  /** Puxa o prontuário (condicional). */
  internacao: boolean
  recusados: ComValvula[]
}

/** Um complementar do caso: "aplica" falso, ele aparece e não conta; "recusado", o empregador recusou e não trava. */
export type Complementar = { tipo: string; exigencia: Exigencia; aplica: boolean; recusado: boolean }

/** B94 (acidentário: trabalho, trajeto e doença ocupacional) ou B36 (previdenciário: trânsito e doméstico). */
export function especie(c: Circunstancia): string {
  return c === 'transito' || c === 'domestico' ? 'B36 · auxílio-acidente previdenciário' : 'B94 · auxílio-acidente acidentário'
}

/** Só com vínculo a CAT e o PPP entram (CA2): empregado, empregado doméstico e avulso. */
const COM_VINCULO: Categoria[] = ['empregado', 'domestico', 'avulso']

/** LC 150/2015, em vigor em 02/06/2015: o empregado doméstico só tem direito a partir dela. */
const LC_150 = '2015-06-02'

/** Por que a categoria trava o caso; sem trava, null. */
export function bloqueioDoAcidente(d: DadosDoAcidente): string | null {
  if (d.categoria === 'individual' || d.categoria === 'facultativo') {
    return `${CATEGORIAS[d.categoria]} não tem direito ao auxílio-acidente: o caso trava na categoria.`
  }
  if (d.categoria === 'domestico' && d.acidenteEm < LC_150) {
    return 'Empregado doméstico só tem direito ao auxílio-acidente a partir de 02/06/2015 (LC 150/2015): o acidente é anterior.'
  }
  return null
}

/** Os complementares do caso pela tabela do escritório: o que se aplica e o que o empregador recusou. */
export function complementares(tabela: TabelaDoAcidente, d: DadosDoAcidente): Complementar[] {
  return tabela[d.circunstancia]
    .filter((c) => (c.tipo === 'cat' || c.tipo === 'ppp' ? COM_VINCULO.includes(d.categoria) : true))
    .map((c) => ({
      tipo: c.tipo,
      exigencia: c.exigencia,
      aplica: c.exigencia !== 'condicional' || d.internacao,
      recusado: (c.tipo === 'cat' || c.tipo === 'ppp') && d.recusados.includes(c.tipo),
    }))
}

/** O que a tela edita: a data em dd/mm/aaaa e as listas ainda sem escolha. */
export type ValoresDoAcidente = {
  circunstancia: Circunstancia | ''
  categoria: Categoria | ''
  acidenteEm: string
  internacao: boolean
  recusados: ComValvula[]
}

/** Por que "Salvar a circunstância" não habilita; pronto, null. O servidor confere de novo. */
export function motivoParaNaoSalvar(v: ValoresDoAcidente, hoje: string): string | null {
  if (!v.circunstancia) return 'Escolha a circunstância do acidente.'
  if (!v.categoria) return 'Escolha a categoria do segurado.'
  if (!v.acidenteEm.trim() || erroData(v.acidenteEm, hoje)) return 'Data do acidente em dd/mm/aaaa, que não seja futura.'
  return null
}

/** Os valores da tela no formato do servidor; null enquanto falta algo. */
export function paraDados(v: ValoresDoAcidente, hoje: string): DadosDoAcidente | null {
  if (motivoParaNaoSalvar(v, hoje)) return null
  return {
    circunstancia: v.circunstancia as Circunstancia,
    categoria: v.categoria as Categoria,
    acidenteEm: dataParaIso(normalizarData(v.acidenteEm))!,
    internacao: v.internacao,
    recusados: v.recusados,
  }
}

/** G18 no Auxílio-Acidente: na lesão não consolidada, o caso muda de porta em vez de morrer (resposta do Lucas, 01/10). */
export const SUGESTAO_DE_TROCA = 'Sugestão: trocar para Auxílio por Incapacidade Temporária; o caso muda de porta.'
