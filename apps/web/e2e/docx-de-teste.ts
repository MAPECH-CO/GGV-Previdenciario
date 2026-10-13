// Só para teste (GGVP-136): um .docx pequeno, criado na hora, com texto inventado (zip sem compressão, só com o módulo `node:zlib`),
// e a leitura do texto de um .docx qualquer: o que o teste confere do kit baixado. Nenhum modelo do escritório entra no repositório.
import { inflateRawSync } from 'node:zlib'

export const TIPO_DO_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
const RELACOES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (dados: Buffer) => {
  let c = 0xffffffff
  for (const b of dados) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Um zip sem compressão: o cabeçalho de cada arquivo, os dados e, no fim, o diretório central. */
function zipar(arquivos: [nome: string, texto: string][]): Buffer {
  const locais: Buffer[] = []
  const centrais: Buffer[] = []
  let deslocamento = 0
  for (const [nome, texto] of arquivos) {
    const nomeEmBytes = Buffer.from(nome)
    const dados = Buffer.from(texto)
    const crc = crc32(dados)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versão para extrair
    local.writeUInt16LE(0x0800, 6) // nome em UTF-8
    local.writeUInt16LE(0x21, 12) // data: 01/01/1980
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(dados.length, 18)
    local.writeUInt32LE(dados.length, 22)
    local.writeUInt16LE(nomeEmBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4) // versão que criou
    central.writeUInt16LE(20, 6) // versão para extrair
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(dados.length, 20)
    central.writeUInt32LE(dados.length, 24)
    central.writeUInt16LE(nomeEmBytes.length, 28)
    central.writeUInt32LE(deslocamento, 42)
    locais.push(local, nomeEmBytes, dados)
    centrais.push(central, nomeEmBytes)
    deslocamento += local.length + nomeEmBytes.length + dados.length
  }
  const diretorio = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(arquivos.length, 8)
  fim.writeUInt16LE(arquivos.length, 10)
  fim.writeUInt32LE(diretorio.length, 12)
  fim.writeUInt32LE(deslocamento, 16)
  return Buffer.concat([...locais, diretorio, fim])
}

const escapar = (t: string) => t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Cada item é um parágrafo; "|" parte o parágrafo em pedaços de texto, como o Word faz no meio de uma variável. */
export function docxDeTeste(paragrafos: string[]): Buffer {
  const corpo = paragrafos
    .map((p) => `<w:p>${p.split('|').map((t) => `<w:r><w:t xml:space="preserve">${escapar(t)}</w:t></w:r>`).join('')}</w:p>`)
    .join('')
  return zipar([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', RELACOES],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${corpo}</w:body></w:document>`],
  ])
}

/** O conteúdo de um arquivo do zip (sem compressão ou deflate), lido pelo diretório central. */
function arquivoDoZip(zip: Buffer, nome: string): string {
  let p = zip.readUInt32LE(zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) + 16) // onde começa o diretório central
  while (zip.readUInt32LE(p) === 0x02014b50) {
    const tamanhoDoNome = zip.readUInt16LE(p + 28)
    if (zip.toString('utf8', p + 46, p + 46 + tamanhoDoNome) === nome) {
      const comprimido = zip.readUInt32LE(p + 20)
      const local = zip.readUInt32LE(p + 42)
      const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
      const dados = zip.subarray(inicio, inicio + comprimido)
      return (zip.readUInt16LE(p + 10) === 8 ? inflateRawSync(dados) : dados).toString('utf8')
    }
    p += 46 + tamanhoDoNome + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32)
  }
  throw new Error(`o .docx não tem ${nome}`)
}

/** O texto do .docx, um parágrafo por linha. */
export function textoDoDocx(docx: Buffer): string {
  const xml = arquivoDoZip(docx, 'word/document.xml')
  return [...xml.matchAll(/<w:p[ >](.*?)<\/w:p>/g)]
    .map((p) => [...p[1].matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((t) => t[1].replaceAll('&amp;', '&')).join(''))
    .join('\n')
}
