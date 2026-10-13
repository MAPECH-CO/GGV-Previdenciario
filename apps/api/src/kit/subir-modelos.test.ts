import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { docxDeTeste } from './docx-de-teste.ts'
import { idDoArquivo, subirModelos } from './subir-modelos.ts'

// GGVP-136 · o script de homologação que sobe os modelos da pasta local pela rota da Configuração. O teste usa um portal de
// mentira (`fetch` falso) e arquivos .docx inventados numa pasta temporária.

const IDS = ['contrato-completo-loas', 'contrato-completo-loas-representado', 'modelo-6', 'modelo-10']
const SENHA = 'senha-so-do-teste'
let pasta: string

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'modelos-'))
})
afterEach(() => rmSync(pasta, { recursive: true, force: true }))

const guardar = (nome: string) => writeFileSync(join(pasta, nome), docxDeTeste(['{{NOME COMPLETO}}']))

/** O portal de mentira: o login devolve um cookie; a lista diz quem é a Sênior; o envio aceita ou recusa por modelo. */
function portal({ podeSubir = true, recusa = {} as Record<string, string>, entra = true } = {}) {
  const pedidos: { metodo: string; caminho: string; cookie?: string; corpo?: unknown }[] = []
  const buscar = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = new URL(String(url)).pathname
    const cookie = (init?.headers as Record<string, string> | undefined)?.cookie
    pedidos.push({ metodo: init?.method ?? 'GET', caminho, cookie, corpo: init?.body })
    if (caminho === '/api/sessao') return entra ? new Response('{}', { status: 200, headers: { 'set-cookie': 'ggv_sessao=abc123; Path=/; HttpOnly' } }) : new Response('{}', { status: 401 })
    if (caminho === '/api/configuracao/modelos') return Response.json({ modelos: IDS.map((id) => ({ id, nome: id, versao: null })), podeSubir })
    const id = caminho.split('/').at(-1)!
    return recusa[id] ? Response.json({ erro: recusa[id] }, { status: 400 }) : Response.json({ ok: true, versao: 1 }, { status: 201 })
  })
  return { buscar: buscar as unknown as typeof fetch, pedidos }
}

describe('GGVP-136 · subir os modelos da pasta', () => {
  it('o nome do arquivo diz o modelo: o do contrato é o id inteiro, o dos modelos numerados começa por "modelo-N-"', () => {
    expect(idDoArquivo('contrato-completo-loas.docx', IDS)).toBe('contrato-completo-loas')
    expect(idDoArquivo('Contrato-Completo-LOAS-Representado.DOCX', IDS)).toBe('contrato-completo-loas-representado')
    expect(idDoArquivo('modelo-6-curatela.docx', IDS)).toBe('modelo-6')
    expect(idDoArquivo('modelo-10-seguros.docx', IDS)).toBe('modelo-10')
    expect(idDoArquivo('modelo-1-qualquer.docx', IDS)).toBeUndefined()
    expect(idDoArquivo('contrato-completo-loas-outro.docx', IDS)).toBeUndefined()
  })

  it('entra como a Sênior, sobe cada .docx para o modelo dele com o cookie da sessão e conta o que subiu; o resto da pasta é ignorado', async () => {
    for (const nome of ['contrato-completo-loas.docx', 'modelo-6-curatela.docx', 'modelo-10-seguros.docx', 'anotacoes.docx', 'leia-me.txt']) guardar(nome)
    const { buscar, pedidos } = portal()
    const linhas: string[] = []
    const r = await subirModelos({ pasta, url: 'https://portal.exemplo/', email: 'senior@exemplo.ggv', senha: SENHA, buscar, escrever: (l) => linhas.push(l) })

    expect(r).toEqual({ subiram: 3, recusados: 0 })
    expect(pedidos.map((p) => `${p.metodo} ${p.caminho}`)).toEqual([
      'POST /api/sessao',
      'GET /api/configuracao/modelos',
      'PUT /api/configuracao/modelos/contrato-completo-loas',
      'PUT /api/configuracao/modelos/modelo-10',
      'PUT /api/configuracao/modelos/modelo-6',
    ])
    expect(JSON.parse(String(pedidos[0].corpo))).toEqual({ email: 'senior@exemplo.ggv', senha: SENHA })
    expect(pedidos.slice(1).every((p) => p.cookie === 'ggv_sessao=abc123')).toBe(true)
    const enviado = (pedidos[2].corpo as FormData).get('arquivo') as File
    expect(enviado.name).toBe('modelo.docx') // o nome do arquivo da pasta não viaja
    // Os arquivos vão em ordem de nome; o que não bate com nenhum modelo é pulado, sem citar o nome do arquivo.
    expect(linhas).toEqual([
      'sem modelo para um arquivo da pasta (nome não bate com nenhum dos 4 modelos): pulado',
      'contrato-completo-loas: versão 1 no ar',
      'modelo-10: versão 1 no ar',
      'modelo-6: versão 1 no ar',
      '3 subiram, 0 recusados. Sem arquivo nesta rodada: contrato-completo-loas-representado.',
    ])
  })

  it('o que o portal recusa aparece com a mensagem dele, sem parar os outros, e conta como recusado', async () => {
    guardar('contrato-completo-loas.docx')
    guardar('modelo-6-curatela.docx')
    const { buscar } = portal({ recusa: { 'modelo-6': 'O arquivo não tem nenhuma {{VARIÁVEL}}: confira se é o modelo, e não um documento já preenchido.' } })
    const linhas: string[] = []
    const r = await subirModelos({ pasta, url: 'https://portal.exemplo', email: 'senior@exemplo.ggv', senha: SENHA, buscar, escrever: (l) => linhas.push(l) })
    expect(r).toEqual({ subiram: 1, recusados: 1 })
    expect(linhas).toContain('modelo-6: o portal recusou (400): O arquivo não tem nenhuma {{VARIÁVEL}}: confira se é o modelo, e não um documento já preenchido.')
  })

  it('não entra: para antes de subir qualquer coisa e não repete a senha na mensagem', async () => {
    guardar('contrato-completo-loas.docx')
    const { buscar, pedidos } = portal({ entra: false })
    const erro = await subirModelos({ pasta, url: 'https://portal.exemplo', email: 'senior@exemplo.ggv', senha: SENHA, buscar }).catch((e: Error) => e)
    expect((erro as Error).message).toBe('Não entrou: o portal respondeu 401. Confira o endereço, o e-mail e a senha.')
    expect((erro as Error).message).not.toContain(SENHA)
    expect(pedidos).toHaveLength(1)
  })

  it('quem entra e não é da Sênior não sobe nada', async () => {
    guardar('contrato-completo-loas.docx')
    const { buscar, pedidos } = portal({ podeSubir: false })
    await expect(subirModelos({ pasta, url: 'https://portal.exemplo', email: 'lider@exemplo.ggv', senha: SENHA, buscar })).rejects.toThrow('Este usuário não é da Sênior: só ela sobe modelos.')
    expect(pedidos.some((p) => p.metodo === 'PUT')).toBe(false)
  })
})
