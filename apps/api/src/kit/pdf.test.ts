import { describe, expect, it, vi } from 'vitest'
import { abrirConversor, conversorGotenberg } from './pdf.ts'

describe('GGVP-136 CA5 · o conversor de PDF', () => {
  it('manda o .docx ao Gotenberg (LibreOffice) e devolve o PDF', async () => {
    const docx = Buffer.from('conteudo do docx')
    const buscar = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(Buffer.from('%PDF-1.7 pronto'), { status: 200 }))
    const pdf = await conversorGotenberg('http://gotenberg:3000/', buscar)(docx)
    expect(pdf.toString()).toBe('%PDF-1.7 pronto')
    const [url, init] = buscar.mock.calls[0]
    expect([String(url), init!.method]).toEqual(['http://gotenberg:3000/forms/libreoffice/convert', 'POST'])
    const enviado = (init!.body as FormData).get('files') as File
    expect(enviado.name).toBe('kit.docx')
    expect(Buffer.from(await enviado.arrayBuffer())).toEqual(docx)
  })

  it('o Gotenberg que não responde bem vira erro: quem chama oferece o Word', async () => {
    const buscar = vi.fn(async () => new Response('falhou', { status: 503 }))
    await expect(conversorGotenberg('http://gotenberg:3000', buscar)(Buffer.from('x'))).rejects.toThrow('O Gotenberg respondeu 503.')
  })

  it('só há conversor com GOTENBERG_URL', () => {
    expect(abrirConversor({})).toBeUndefined()
    expect(abrirConversor({ GOTENBERG_URL: '' })).toBeUndefined()
    expect(abrirConversor({ GOTENBERG_URL: 'http://gotenberg:3000' })).toBeTypeOf('function')
  })
})
