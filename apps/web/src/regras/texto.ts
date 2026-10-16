/**
 * Tira do texto que vem do dado o código interno do projeto, que não diz nada a quem usa o portal: "(G12)", "(GGVP-102)"
 * e o passo no começo ("D1.09 · Atender e entrevistar" → "Atender e entrevistar").
 */
export function semCodigo(texto: string): string {
  return texto
    .replace(/\s*\((?:G\d{1,2}|GGVP-\d+)\)/g, '')
    .replace(/^(?:D\d[a-z]?|DP)\.\d{2}\s*·\s*/, '')
}
