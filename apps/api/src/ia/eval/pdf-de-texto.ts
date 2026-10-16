// GGVP-158 (integrações e IA): o documento inventado do eval vira um PDF de uma página, só com texto, para a rodada de
// verdade mandar à IA o mesmo tipo de arquivo que o balcão manda. Sem dependência: o PDF mínimo, com a fonte Helvetica
// e os acentos em Latin-1 (WinAnsi).
const escapar = (linha: string) => linha.replace(/[\\()]/g, (c) => `\\${c}`)

export function pdfDeTexto(linhas: string[]): Uint8Array {
  const texto = linhas.map((l, i) => `${i === 0 ? '' : '0 -18 Td '}(${escapar(l)}) Tj`).join('\n')
  const fluxo = Buffer.from(`BT /F1 12 Tf 50 790 Td\n${texto}\nET`, 'latin1')
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  const partes: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')]
  const posicoes: number[] = []
  const tamanho = () => partes.reduce((n, p) => n + p.length, 0)
  objetos.forEach((o, i) => {
    posicoes.push(tamanho())
    partes.push(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1'))
  })
  posicoes.push(tamanho())
  partes.push(Buffer.from(`5 0 obj\n<< /Length ${fluxo.length} >>\nstream\n`, 'latin1'), fluxo, Buffer.from('\nendstream\nendobj\n', 'latin1'))
  const xref = tamanho()
  const linhasXref = posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
  partes.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${linhasXref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'))
  return new Uint8Array(Buffer.concat(partes))
}
