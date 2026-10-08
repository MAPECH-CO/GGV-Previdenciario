// O PDF do pacote do protocolo (GGVP-67 CA6; GGVP-71 CA8, CA11): a petição aprovada, com a assinatura padrão e o
// identificador da versão no rodapé e nos metadados, e a imagem que vira PDF de uma página. O tribunal só aceita PDF.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/**
 * Um arquivo do pacote, na ordem (GGVP-71 CA8): o documento guardado, o de origem (o citado, mesmo quando a imagem virou
 * PDF), o nome, o hash do conteúdo e o papel no pacote.
 */
export type ArquivoDoPacote = { documentoId: string; origemId: string; nome: string; hash: string; papel: 'peticao' | 'carta' | 'citado' }

const A4: [number, number] = [595.28, 841.89]
const MARGEM = { esquerda: 85, direita: 57, topo: 85, base: 70 }
const TAMANHO = 12
const ENTRELINHA = 18

/** A fonte padrão (WinAnsi) não tem todo caractere: o que ela não escreve vira "?" (o PDF é conferido antes do protocolo). */
function soOQueAFonteEscreve(texto: string, fonte: PDFFont) {
  const cabe = new Map<string, boolean>()
  return [...texto.replaceAll('\r', '').replaceAll('\t', '    ')]
    .map((c) => {
      if (c === '\n') return c
      if (!cabe.has(c))
        try {
          fonte.encodeText(c)
          cabe.set(c, true)
        } catch {
          cabe.set(c, false)
        }
      return cabe.get(c) ? c : '?'
    })
    .join('')
}

/** Quebra cada parágrafo em linhas que cabem na largura; palavra maior que a linha é cortada. */
function quebrar(texto: string, fonte: PDFFont, largura: number) {
  const mede = (s: string) => fonte.widthOfTextAtSize(s, TAMANHO)
  const linhas: string[] = []
  for (const paragrafo of texto.split('\n')) {
    let linha = ''
    for (const palavra of paragrafo.split(' ')) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra
      if (mede(tentativa) <= largura) {
        linha = tentativa
        continue
      }
      if (linha) linhas.push(linha)
      linha = palavra
      while (mede(linha) > largura) {
        let corte = linha.length - 1
        while (corte > 1 && mede(linha.slice(0, corte)) > largura) corte--
        linhas.push(linha.slice(0, corte))
        linha = linha.slice(corte)
      }
    }
    linhas.push(linha)
  }
  return linhas
}

/** A petição em PDF: A4, Times 12, o texto aprovado, a assinatura padrão no fim e o identificador da versão. */
export async function pdfDaPeticao(texto: string, assinatura: string, identificador: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Petição inicial')
  pdf.setSubject(identificador)
  const fonte = await pdf.embedFont(StandardFonts.TimesRoman)
  const linhas = quebrar(soOQueAFonteEscreve(`${texto}\n\n${assinatura}`, fonte), fonte, A4[0] - MARGEM.esquerda - MARGEM.direita)
  const novaPagina = (): PDFPage => {
    const p = pdf.addPage(A4)
    p.drawText(`Identificador da versão aprovada: ${identificador}`, { x: MARGEM.esquerda, y: 30, size: 7, font: fonte, color: rgb(0.4, 0.4, 0.4) })
    return p
  }
  let pagina = novaPagina()
  let y = A4[1] - MARGEM.topo
  for (const linha of linhas) {
    if (y < MARGEM.base) {
      pagina = novaPagina()
      y = A4[1] - MARGEM.topo
    }
    if (linha) pagina.drawText(linha, { x: MARGEM.esquerda, y, size: TAMANHO, font: fonte })
    y -= ENTRELINHA
  }
  return pdf.save()
}

/** A imagem (JPG ou PNG) num PDF de uma página A4, centralizada, sem aumentar além do tamanho original. */
export async function pdfDaImagem(conteudo: Uint8Array, mime: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const imagem = mime === 'image/png' ? await pdf.embedPng(conteudo) : await pdf.embedJpg(conteudo)
  const escala = Math.min((A4[0] - 40) / imagem.width, (A4[1] - 40) / imagem.height, 1)
  const { width, height } = imagem.scale(escala)
  pdf.addPage(A4).drawImage(imagem, { x: (A4[0] - width) / 2, y: (A4[1] - height) / 2, width, height })
  return pdf.save()
}
