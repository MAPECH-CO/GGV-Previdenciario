// O texto formatado da IA no chat (12/10): um leitor pequeno do markdown que o chat usa, sem HTML. Devolve blocos que o
// TextoFormatado desenha com elementos do React; o que não for reconhecido fica como texto.

export type Trecho =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'negrito'; filhos: Trecho[] }
  | { tipo: 'italico'; filhos: Trecho[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'link'; href: string; filhos: Trecho[] }

export type BlocoDeTexto =
  | { tipo: 'paragrafo'; linhas: Trecho[][] }
  | { tipo: 'titulo'; nivel: 3 | 4; trechos: Trecho[] }
  | { tipo: 'lista'; ordenada: boolean; inicio?: number; itens: { trechos: Trecho[]; filhos: Trecho[][] }[] }
  | { tipo: 'tabela'; cabeca: Trecho[][]; linhas: Trecho[][][] }

/** Só tela do portal: começa com uma barra, sem "//" e sem barra invertida (o navegador lê "/\x.com" como outro site). */
const linkInterno = (href: string) => href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')

/** Na ordem de prioridade: código, link, negrito, itálico com * e itálico com _ (só fora de palavra). */
const MARCAS: { re: RegExp; montar: (m: RegExpExecArray) => Trecho[] }[] = [
  { re: /`([^`]+)`/, montar: (m) => [{ tipo: 'codigo', texto: m[1] }] },
  {
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    montar: (m) => (linkInterno(m[2]) ? [{ tipo: 'link', href: m[2], filhos: lerTrechos(m[1]) }] : lerTrechos(m[1])),
  },
  { re: /\*\*(?=\S)(.+?)(?<=\S)\*\*/, montar: (m) => [{ tipo: 'negrito', filhos: lerTrechos(m[1]) }] },
  { re: /\*(?=[^\s*])(.+?)(?<=[^\s*])\*/, montar: (m) => [{ tipo: 'italico', filhos: lerTrechos(m[1]) }] },
  { re: /(?<![\p{L}\p{N}])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}])/u, montar: (m) => [{ tipo: 'italico', filhos: lerTrechos(m[1]) }] },
]

/** Os trechos de uma linha, com os textos vizinhos juntados. */
export function lerTrechos(linha: string): Trecho[] {
  const saida: Trecho[] = []
  const texto = (s: string) => {
    if (!s) return
    const ultimo = saida.at(-1)
    if (ultimo?.tipo === 'texto') ultimo.texto += s
    else saida.push({ tipo: 'texto', texto: s })
  }
  let resto = linha
  while (resto) {
    let melhor: { m: RegExpExecArray; montar: (m: RegExpExecArray) => Trecho[] } | null = null
    for (const { re, montar } of MARCAS) {
      const m = re.exec(resto)
      if (m && (!melhor || m.index < melhor.m.index)) melhor = { m, montar }
    }
    if (!melhor) {
      texto(resto)
      break
    }
    texto(resto.slice(0, melhor.m.index))
    for (const t of melhor.montar(melhor.m)) {
      if (t.tipo === 'texto') texto(t.texto)
      else saida.push(t)
    }
    resto = resto.slice(melhor.m.index + melhor.m[0].length)
  }
  return saida
}

const TITULO = /^(#{1,6})\s+(.*)$/
const ITEM = /^(\s*)([-*]|\d+[.)])\s+(.*)$/
const SEPARADOR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const MAX_COLUNAS = 6

const celulas = (linha: string) =>
  linha
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())

/** Os blocos do texto inteiro. */
export function lerFormatacao(texto: string): BlocoDeTexto[] {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n')
  const blocos: BlocoDeTexto[] = []
  let paragrafo: Trecho[][] | null = null
  const fecharParagrafo = () => {
    if (paragrafo) blocos.push({ tipo: 'paragrafo', linhas: paragrafo })
    paragrafo = null
  }
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (!linha.trim()) {
      fecharParagrafo()
      continue
    }
    const titulo = TITULO.exec(linha.trim())
    if (titulo) {
      fecharParagrafo()
      blocos.push({ tipo: 'titulo', nivel: titulo[1].length >= 4 ? 4 : 3, trechos: lerTrechos(titulo[2].trim()) })
      continue
    }
    if (linha.trim().startsWith('|') && SEPARADOR.test(linhas[i + 1] ?? '')) {
      fecharParagrafo()
      const cabeca = celulas(linha).slice(0, MAX_COLUNAS)
      const corpo: string[][] = []
      i += 2
      while (i < linhas.length && linhas[i].trim().startsWith('|')) corpo.push(celulas(linhas[i++]))
      i--
      const ajustar = (c: string[]) => cabeca.map((_, j) => (c[j] ? lerTrechos(c[j]) : []))
      blocos.push({ tipo: 'tabela', cabeca: cabeca.map((c) => lerTrechos(c)), linhas: corpo.map(ajustar) })
      continue
    }
    const item = ITEM.exec(linha)
    if (item) {
      fecharParagrafo()
      const ordenada = /\d/.test(item[2])
      const anterior = blocos.at(-1)
      // Item seguido de linha em branco continua a mesma lista (o modelo escreve passos assim); a numerada guarda o
      // número do primeiro item, para a lista cortada por um widget seguir do 2 e não voltar ao 1.
      if (item[1].length >= 2 && anterior?.tipo === 'lista') anterior.itens.at(-1)!.filhos.push(lerTrechos(item[3]))
      else if (anterior?.tipo === 'lista' && anterior.ordenada === ordenada) anterior.itens.push({ trechos: lerTrechos(item[3]), filhos: [] })
      else blocos.push({ tipo: 'lista', ordenada, ...(ordenada ? { inicio: parseInt(item[2], 10) } : {}), itens: [{ trechos: lerTrechos(item[3]), filhos: [] }] })
      continue
    }
    paragrafo ??= []
    paragrafo.push(lerTrechos(linha.trim()))
  }
  fecharParagrafo()
  return blocos
}
