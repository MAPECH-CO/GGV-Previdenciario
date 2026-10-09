// Só para teste: um .docx pequeno, criado na hora, com texto inventado. Nenhum modelo do escritório entra no repositório.
import PizZip from 'pizzip'

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
const RELACOES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

const escapar = (t: string) => t.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Cada item é um parágrafo; "|" parte o parágrafo em pedaços de texto, como o Word faz no meio de uma variável. */
export function docxDeTeste(paragrafos: string[]): Buffer {
  const corpo = paragrafos
    .map((p) => `<w:p>${p.split('|').map((t) => `<w:r><w:t xml:space="preserve">${escapar(t)}</w:t></w:r>`).join('')}</w:p>`)
    .join('')
  const zip = new PizZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELACOES)
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${corpo}</w:body></w:document>`)
  return zip.generate({ type: 'nodebuffer' })
}
