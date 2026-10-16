import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../../banco/conexao.ts'
import { chamadaIa } from '../../banco/esquema.ts'
import { criarIa } from '../ia.ts'
import { CASOS, type CasoDoEval } from './documentos.ts'
import { avaliarLeitura, notaEmTexto } from './leitura.ts'
import { pdfDeTexto } from './pdf-de-texto.ts'

// GGVP-158 (integrações e IA): o eval da leitura do balcão contra a IA de mentira. Mede o caminho inteiro do portal (a
// chamada, o contrato, as regras do código) com documentos inventados e a resposta certa; a rodada com a IA de verdade
// é o comando `pnpm --filter @ggv/api eval:leitura -- --de-verdade`, que o Mateus libera.

let banco: Banco
let fechar: () => Promise<void>
const AMBIENTE = { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }

/** A IA de mentira de cada documento: responde o `falso` do caso, como a OpenAI responderia. */
function falsa(caso: CasoDoEval): typeof fetch {
  return async () => {
    const f = caso.falso
    if (typeof f === 'object' && 'status' in f && typeof f.status === 'number') return new Response('{"error":"fora do ar"}', { status: f.status })
    const content = typeof f === 'string' ? f : JSON.stringify(f)
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

describe('GGVP-158 · eval da leitura do balcão (IA de mentira)', () => {
  it('todos os documentos inventados saem com a resposta certa, campo a campo', async () => {
    const nota = await avaliarLeitura(CASOS, (caso) => criarIa({ banco, ambiente: AMBIENTE, fetch: falsa(caso) }))
    expect(nota.casos.filter((c) => !c.certo), notaEmTexto(nota)).toEqual([])
    expect(nota.acerto).toBe(100)
  })

  it('a nota acusa o erro: a leitura que o código deixasse passar errada conta como erro, com o campo', async () => {
    const caso = CASOS.find((c) => c.id === 'rg-da-cliente')!
    const errado = { ...caso, esperado: { ...caso.esperado, cpf: '11144477735' } }
    const nota = await avaliarLeitura([errado], (c) => criarIa({ banco, ambiente: AMBIENTE, fetch: falsa(c) }))
    expect(nota.casos[0].erros).toEqual([{ campo: 'cpf', esperado: '11144477735', lido: '52998224725' }])
    expect(nota.acerto).toBeLessThan(100)
  })

  it('cada documento vai à IA como PDF, e o registro guarda só o tamanho e o hash, nunca o texto inventado', async () => {
    let corpo = ''
    const caso = CASOS.find((c) => c.id === 'laudo-medico')!
    await avaliarLeitura([caso], () =>
      criarIa({
        banco,
        ambiente: AMBIENTE,
        fetch: async (url, init) => {
          corpo = String(init?.body)
          return falsa(caso)(url, init)
        },
      }),
    )
    expect(corpo).toContain(Buffer.from(pdfDeTexto(caso.linhas)).toString('base64'))
    const [registro] = await banco.select().from(chamadaIa)
    expect(registro).toMatchObject({ finalidade: 'ler_documento_balcao', situacao: 'ok' })
    expect(JSON.stringify({ ...registro, saida: null })).not.toContain('Dor lombar')
  })

  it('o PDF do documento inventado é um PDF de uma página, com o texto e os acentos', () => {
    const pdf = Buffer.from(pdfDeTexto(['Declaração (teste) de união']))
    const texto = pdf.toString('latin1')
    expect(texto.startsWith('%PDF-1.4')).toBe(true)
    expect(texto).toContain('(Declaração \\(teste\\) de união) Tj')
    expect(texto.trimEnd().endsWith('%%EOF')).toBe(true)
    const xref = Number(/startxref\n(\d+)/.exec(texto)![1])
    expect(texto.slice(xref, xref + 4)).toBe('xref')
  })

  it('o comando da rodada de verdade, sem --de-verdade, sai sem chamar a IA', async () => {
    const rodar = fileURLToPath(new URL('./rodar.ts', import.meta.url))
    const r = await new Promise<{ codigo: number | null; erro: string }>((resolver) =>
      execFile(process.execPath, ['--experimental-strip-types', rodar], { env: { PATH: process.env.PATH } }, (e, _saida, erro) => resolver({ codigo: e ? (e.code as number) : 0, erro })),
    )
    expect(r.codigo).toBe(2)
    expect(r.erro).toContain('Só roda com --de-verdade')
  })
})
