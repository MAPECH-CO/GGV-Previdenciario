// A diferença entre duas versões da petição (GGVP-67 CA3, CA4), por parágrafo: o que ficou igual, o que entrou e o que
// saiu, pela maior subsequência comum de linhas. Sem dependência: são poucas linhas e a conta fica com teste.

export type Trecho = { tipo: 'igual' | 'incluido' | 'removido'; texto: string }

// ponytail: LCS O(n·m) por linha; uma petição tem centenas de parágrafos. Se um dia vierem dezenas de milhares, trocar por Myers.
export function diferenca(antes: string, depois: string): Trecho[] {
  const a = antes.split('\n')
  const b = depois.split('\n')
  // t[i][j]: tamanho da maior subsequência comum entre a[i..] e b[j..].
  const t = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
  const trechos: Trecho[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      trechos.push({ tipo: 'igual', texto: a[i] })
      i++
      j++
    } else if (t[i + 1][j] >= t[i][j + 1]) trechos.push({ tipo: 'removido', texto: a[i++] })
    else trechos.push({ tipo: 'incluido', texto: b[j++] })
  }
  while (i < a.length) trechos.push({ tipo: 'removido', texto: a[i++] })
  while (j < b.length) trechos.push({ tipo: 'incluido', texto: b[j++] })
  return trechos
}
