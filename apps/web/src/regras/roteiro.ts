// O roteiro de conteúdo mínimo por benefício (GGVP-93): a régua do escritório que a IA aplica e a pessoa confere.
// Configurável e versionado: salvar cria a versão seguinte, nada é sobrescrito.

export type TipoDoItem = 'obrigatorio' | 'contradicao' | 'complementar'

export const TIPOS_DO_ITEM: Record<TipoDoItem, string> = {
  obrigatorio: 'Obrigatório',
  contradicao: 'Contradição que bloqueia',
  complementar: 'Complementar',
}

export type ItemDoRoteiro = {
  id: string
  tipo: TipoDoItem
  /** O texto do escritório: serve para reconhecer no documento, nunca para ditar ao médico (G20). */
  texto: string
  /** Como o item vira pergunta ao médico (GGVP-29). */
  pergunta?: string
}

export type VersaoDoRoteiro = {
  versao: number
  autor: string
  /** Data e hora ISO. */
  quando: string
  itens: ItemDoRoteiro[]
}

export type Roteiro = {
  id: string
  nome: string
  /** Ids do catálogo de benefícios: um roteiro pode valer para mais de um (CA3). */
  beneficios: string[]
  /** false: régua documental, sem laudo (aposentadorias comuns, LOAS Idoso). */
  laudo: boolean
  /** Da primeira à última; a última é a que vale (CA2). */
  versoes: VersaoDoRoteiro[]
}

export const TEXTO_MINIMO = 3
export const TEXTO_MAXIMO = 300

/** A versão em vigor: a última. */
export const emVigor = (roteiro: Roteiro): VersaoDoRoteiro => roteiro.versoes.at(-1)!

/** Uma versão pelo número, para o caso que foi analisado com ela (CA2). */
export const versao = (roteiro: Roteiro, numero: number): VersaoDoRoteiro | undefined => roteiro.versoes.find((v) => v.versao === numero)

/** O roteiro do benefício; fora de todos, undefined: "benefício sem roteiro" (CA3). */
export const roteiroDoBeneficio = (roteiros: Roteiro[], beneficio: string): Roteiro | undefined => roteiros.find((r) => r.beneficios.includes(beneficio))

/** Por que a edição não salva; pronta, null (CA2). */
export function motivoParaNaoSalvar(itens: ItemDoRoteiro[]): string | null {
  if (!itens.some((i) => i.tipo === 'obrigatorio')) return 'O roteiro precisa de pelo menos um item obrigatório.'
  if (itens.some((i) => !(i.tipo in TIPOS_DO_ITEM))) return 'Tipo de item inválido.'
  const curto = itens.find((i) => i.texto.trim().length < TEXTO_MINIMO)
  if (curto) return 'Escreva o texto de cada item.'
  if (itens.some((i) => i.texto.trim().length > TEXTO_MAXIMO || (i.pergunta?.trim().length ?? 0) > TEXTO_MAXIMO)) return `Cada texto vai até ${TEXTO_MAXIMO} letras.`
  return null
}

/** A versão seguinte, com autor e data; as anteriores ficam (CA2). */
export function novaVersao(roteiro: Roteiro, itens: ItemDoRoteiro[], autor: string, quando: string): Roteiro {
  const limpos = itens.map((i) => ({ ...i, texto: i.texto.trim(), ...(i.pergunta !== undefined && { pergunta: i.pergunta.trim() || undefined }) }))
  return { ...roteiro, versoes: [...roteiro.versoes, { versao: emVigor(roteiro).versao + 1, autor, quando, itens: limpos }] }
}

/** O que mudou de uma versão para a outra, para a lista de versões: "2 itens alterados, 1 novo". */
export function mudancas(antes: VersaoDoRoteiro, depois: VersaoDoRoteiro): string {
  const porId = new Map(antes.itens.map((i) => [i.id, i]))
  const novos = depois.itens.filter((i) => !porId.has(i.id)).length
  const alterados = depois.itens.filter((i) => {
    const a = porId.get(i.id)
    return a && (a.texto !== i.texto || a.tipo !== i.tipo || (a.pergunta ?? '') !== (i.pergunta ?? ''))
  }).length
  const tirados = antes.itens.filter((i) => !depois.itens.some((d) => d.id === i.id)).length
  const partes = [
    alterados && `${alterados} ${alterados === 1 ? 'item alterado' : 'itens alterados'}`,
    novos && `${novos} ${novos === 1 ? 'item novo' : 'itens novos'}`,
    tirados && `${tirados} ${tirados === 1 ? 'item tirado' : 'itens tirados'}`,
  ].filter(Boolean)
  return partes.length > 0 ? partes.join(', ') : 'sem mudança nos itens'
}
