// Imprimir e baixar o kit pelo navegador (GGVP-136, CA5). O navegador abre o PDF e chama a janela de impressão do Windows;
// quem imprime é ele, não o portal.

let quadroAtual: HTMLIFrameElement | null = null

/**
 * Chama a janela de impressão do navegador para o PDF: ele entra num quadro escondido e a impressão sai dele. O quadro é
 * invisível, mas tem tamanho (1 x 100 px), por precaução: há navegador que não carrega o leitor de PDF num quadro sem tamanho.
 * Se a janela de impressão não abrir, o link "Abrir o PDF" da tela serve: o PDF abre numa aba e o Ctrl+P imprime.
 */
export function imprimirPdf(url: string) {
  quadroAtual?.remove()
  const quadro = document.createElement('iframe')
  quadro.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:100px;opacity:0;border:0;pointer-events:none'
  quadro.setAttribute('aria-hidden', 'true')
  quadro.tabIndex = -1
  quadro.src = url
  quadro.onload = () => {
    quadro.contentWindow?.focus()
    quadro.contentWindow?.print()
  }
  document.body.appendChild(quadro)
  quadroAtual = quadro
}

/** Baixa o arquivo, como se a pessoa clicasse no link. */
export function baixarArquivo(url: string, nome: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
}
