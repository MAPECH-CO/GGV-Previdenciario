// Auditoria LOCAL: não carrega .env, não chama serviços e não imprime texto nem nomes de arquivos.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export function contarIndicios(texto: string) {
  const semVariaveis = texto.replace(/\{\{[^{}]*\}\}/gu, 'VARIAVEL')
  const contar = (re: RegExp) => [...semVariaveis.matchAll(re)].length
  return {
    variaveis: [...texto.matchAll(/\{\{[^{}]+\}\}/gu)].length,
    cpf: contar(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}(?!\d)/gu),
    rg: contar(/\bRG\s*[:.º°-]?\s*\d[\d. -]{4,15}[0-9Xx]/giu),
    cep: contar(/(?<!\d)\d{5}-\d{3}(?!\d)|\bCEP\s*[:.-]?\s*\d{8}(?!\d)/giu),
    telefone: contar(/(?<!\d)(?:\+55\s*)?\(?\d{2}\)?[ .-]*\d{4,5}[ .-]*\d{4}(?!\d)/gu),
    nomesEmQualificacao: contar(/(?:OUTORGANTE|CONTRATANTE|DECLARANTE|Outorgante|Contratante|Declarante|Eu)\s*[:,]\s*(?!VARIAVEL)(?:[\p{Lu}][\p{L}']+\s+){1,6}[\p{Lu}][\p{L}']+/gu),
  }
}

export async function auditarPasta(pasta: string) {
  const arquivos = (await readdir(pasta)).filter(n => n.toLowerCase().endsWith('.docx')).sort()
  let falhas = 0
  for (const [i, nome] of arquivos.entries()) {
    try {
      const zip = new PizZip(await readFile(join(pasta, nome)))
      const doc = new Docxtemplater(zip, { delimiters: { start: '{{', end: '}}' }, errorLogging: false })
      const textos = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(n))
        .map(n => doc.getFullText(n)).join('\n')
      const c = contarIndicios(textos)
      if (!c.variaveis || c.cpf || c.rg || c.cep || c.telefone || c.nomesEmQualificacao) falhas++
      console.log(JSON.stringify({ modelo: i + 1, ...c }))
    } catch {
      falhas++
      console.log(JSON.stringify({ modelo: i + 1, falhasDeLeitura: 1 }))
    }
  }
  console.log(JSON.stringify({ modelos: arquivos.length, modelosComIndiciosOuFalhas: falhas }))
  return arquivos.length === 9 && falhas === 0
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/auditar-modelos.ts')) {
  try { process.exitCode = process.argv[2] && await auditarPasta(process.argv[2]) ? 0 : 1 }
  catch { console.log(JSON.stringify({ falhasDeAcesso: 1 })); process.exitCode = 1 }
}
