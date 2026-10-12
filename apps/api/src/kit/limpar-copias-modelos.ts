// Limpeza LOCAL em cópias novas: nunca imprime conteúdo nem substitui o original.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import PizZip from 'pizzip'
import { auditarPasta } from './auditar-modelos.ts'

const NUMEROS = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}(?!\d)|(?<!\d)\d{5}-\d{3}(?!\d)|(?<!\d)(?:\+55\s*)?\(?\d{2}\)?[ .-]*\d{4,5}[ .-]*\d{4}(?!\d)/gu
const decodificar = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const codificar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Localiza no texto contínuo e aplica aos runs correspondentes, preservando a estrutura do Word. */
export function limparNumerosDoXml(xml: string): string {
  let continuo = ''
  let fimAnterior = 0
  const partes = [...xml.matchAll(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/gu)].map(m => {
    if (xml.slice(fimAnterior, m.index).includes('</w:p>')) continuo += '\n'
    const texto = decodificar(m[2])
    const inicio = continuo.length
    continuo += texto
    fimAnterior = m.index + m[0].length
    return { m, texto, inicio }
  })
  const faixas = [...continuo.matchAll(NUMEROS)].map(m => ({ inicio: m.index, fim: m.index + m[0].length })).reverse()
  for (const faixa of faixas) for (const p of partes) {
    const de = Math.max(0, faixa.inicio - p.inicio)
    const ate = Math.min(p.texto.length, faixa.fim - p.inicio)
    if (de < ate) p.texto = p.texto.slice(0, de) + (faixa.inicio >= p.inicio ? '__________' : '') + p.texto.slice(ate)
  }
  for (const p of partes.reverse()) xml = xml.slice(0, p.m.index) + p.m[1] + codificar(p.texto) + p.m[3] + xml.slice(p.m.index + p.m[0].length)
  return xml
}

export async function limparCopias(origem: string, destino: string) {
  if (resolve(origem) === resolve(destino)) throw new Error('Destino precisa ser uma pasta nova.')
  await mkdir(destino) // falha se já existir; não sobrescreve nada.
  const arquivos = (await readdir(origem)).filter(n => n.toLowerCase().endsWith('.docx'))
  let quantidade = 0
  for (const nome of arquivos) {
    const zip = new PizZip(await readFile(join(origem, nome)))
    for (const n of Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(n))) {
      zip.file(n, limparNumerosDoXml(zip.file(n)!.asText()))
    }
    await writeFile(join(destino, nome), zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }), { flag: 'wx' })
    quantidade++
  }
  console.log(JSON.stringify({ copias: quantidade }))
  return auditarPasta(destino)
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/limpar-copias-modelos.ts')) {
  try { process.exitCode = process.argv[2] && process.argv[3] && await limparCopias(process.argv[2], process.argv[3]) ? 0 : 1 }
  catch { console.log(JSON.stringify({ falhasNaCopia: 1 })); process.exitCode = 1 }
}
