// O PDF do kit (GGVP-136, CA5). O conversor é plugável: com GOTENBERG_URL, o servidor manda o .docx preenchido ao Gotenberg
// (o LibreOffice atrás de uma API, que roda no Coolify) e devolve o PDF; sem a variável, o portal entrega o .docx para baixar
// e imprimir. Aqui só a chamada: subir o Gotenberg é da infraestrutura.
import { TIPO_DO_DOCX } from '@ggv/contratos'

export type ConversorDePdf = (docx: Buffer) => Promise<Buffer>

/** O LibreOffice leva alguns segundos num documento de 20 páginas; passado disso, o servidor desiste e o Word serve. */
const ESPERA_MAXIMA_EM_MS = 60_000

export function conversorGotenberg(url: string, buscar: typeof fetch = fetch): ConversorDePdf {
  const endereco = `${url.replace(/\/+$/, '')}/forms/libreoffice/convert`
  return async (docx) => {
    const corpo = new FormData()
    corpo.append('files', new Blob([new Uint8Array(docx)], { type: TIPO_DO_DOCX }), 'kit.docx')
    const r = await buscar(endereco, { method: 'POST', body: corpo, signal: AbortSignal.timeout(ESPERA_MAXIMA_EM_MS) })
    if (!r.ok) throw new Error(`O Gotenberg respondeu ${r.status}.`)
    return Buffer.from(await r.arrayBuffer())
  }
}

/** O conversor do ambiente: o Gotenberg de `GOTENBERG_URL`, ou nenhum. */
export const abrirConversor = (ambiente: Record<string, string | undefined> = process.env): ConversorDePdf | undefined =>
  ambiente.GOTENBERG_URL ? conversorGotenberg(ambiente.GOTENBERG_URL) : undefined
