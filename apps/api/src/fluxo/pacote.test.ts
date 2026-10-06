import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { pdfDaImagem, pdfDaPeticao } from './pacote.ts'

// PNG de 1×1 pixel, para a conversão de imagem.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

describe('PDF do pacote (GGVP-67 CA6, GGVP-71 CA8, CA11)', () => {
  it('a petição sai em PDF, com o identificador da versão nos metadados', async () => {
    const bytes = await pdfDaPeticao('Excelentíssimo Senhor Juiz Federal\nDos fatos: a autora pediu o benefício.', 'Glauco (exemplo)\nOAB/SP 000.000', 'abc123')
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    const pdf = await PDFDocument.load(bytes)
    expect([pdf.getPageCount(), pdf.getSubject()]).toEqual([1, 'abc123'])
  })

  it('texto longo quebra em linhas e páginas; caractere que a fonte não escreve não derruba', async () => {
    const paragrafo = 'Requer a concessão do benefício assistencial desde a data de entrada do requerimento. '.repeat(8)
    const bytes = await pdfDaPeticao(Array.from({ length: 30 }, () => paragrafo).join('\n') + '\nPrazo → 15 dias ≥ 5', 'Glauco', 'x')
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1)
  })

  it('a imagem vira um PDF de uma página', async () => {
    const pdf = await PDFDocument.load(await pdfDaImagem(PNG, 'image/png'))
    expect(pdf.getPageCount()).toBe(1)
  })
})
