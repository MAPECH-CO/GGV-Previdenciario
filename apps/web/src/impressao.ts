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

/** Imprime só os campos da ficha conferida. O cofre e os controles da tela não entram no papel. */
export function imprimirFicha(campos: { rotulo: string; valor: string }[]) {
  quadroAtual?.remove()
  const quadro = document.createElement('iframe')
  quadro.title = 'Impressão da ficha de atendimento'
  quadro.style.cssText = 'position:fixed;width:1px;height:100px;opacity:0;border:0;pointer-events:none'
  quadro.setAttribute('aria-hidden', 'true')
  quadro.tabIndex = -1
  document.body.appendChild(quadro)
  quadroAtual = quadro
  const doc = quadro.contentDocument
  if (!doc || !quadro.contentWindow) { quadro.remove(); throw new Error('A janela de impressão não abriu.') }
  doc.title = 'Ficha de atendimento'
  const titulo = doc.createElement('h1')
  titulo.textContent = 'Ficha de atendimento'
  doc.body.append(titulo)
  for (const campo of campos) {
    const linha = doc.createElement('p')
    const rotulo = doc.createElement('strong')
    rotulo.textContent = campo.rotulo + ': '
    linha.append(rotulo, doc.createTextNode(campo.valor || '________________________'))
    doc.body.append(linha)
  }
  quadro.contentWindow.focus()
  quadro.contentWindow.print()
}
