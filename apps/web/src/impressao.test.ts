import { afterEach, describe, expect, it, vi } from 'vitest'
import { baixarArquivo, imprimirPdf } from './impressao.ts'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('GGVP-136 CA5 · imprimir e baixar o kit pelo navegador', () => {
  it('o PDF entra num quadro escondido e, quando carrega, chama a janela de impressão', () => {
    imprimirPdf('blob:kit-1')
    const quadro = document.querySelector('iframe')!
    expect(quadro.getAttribute('src')).toBe('blob:kit-1')
    expect([quadro.style.opacity, quadro.getAttribute('aria-hidden')]).toEqual(['0', 'true'])
    vi.spyOn(quadro.contentWindow!, 'focus').mockImplementation(() => {}) // o jsdom não implementa
    const imprimiu = vi.spyOn(quadro.contentWindow!, 'print').mockImplementation(() => {})
    quadro.dispatchEvent(new Event('load'))
    expect(imprimiu).toHaveBeenCalledTimes(1)
  })

  it('imprimir de novo troca o quadro: nunca ficam dois', () => {
    imprimirPdf('blob:kit-1')
    imprimirPdf('blob:kit-2')
    expect([...document.querySelectorAll('iframe')].map((q) => q.getAttribute('src'))).toEqual(['blob:kit-2'])
  })

  it('baixar clica num link com o nome do arquivo e não deixa o link na página', () => {
    const clicados: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicados.push(`${this.getAttribute('href')} | ${this.download}`)
    })
    baixarArquivo('blob:kit-1', 'Kit do contrato - versão 1.docx')
    expect(clicados).toEqual(['blob:kit-1 | Kit do contrato - versão 1.docx'])
    expect(document.querySelector('a')).toBeNull()
  })
})
