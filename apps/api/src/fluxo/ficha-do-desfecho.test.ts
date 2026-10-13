import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, pessoa, processoAcervo, publicacao } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { desfechosSemFicha, fichaDoDesfecho } from './ficha-do-desfecho.ts'

let banco: Banco
let fechar: () => Promise<void>
let acervoId: string
let agora = new Date('2026-10-08T15:00:00Z')
const AMBIENTE = { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
const FICHA = {
  materia: 'BPC/LOAS da pessoa com deficiência',
  vara: 'JEF de São Paulo',
  tese: 'Impedimento de longo prazo com renda acima de 1/4',
  resumo: 'Joana Ribeiro, CPF 123.456.789-09, teve o benefício concedido pelo juiz.',
  licao: 'O laudo social que mostrou os gastos da casa decidiu o caso de Joana.',
}

/** A IA falsa, como a OpenAI: responde `textos` em ordem e conta os pedidos. */
function iaFalsa(...textos: string[]) {
  const pedidos: string[] = []
  const fetch = async (_url: unknown, init?: RequestInit) => {
    pedidos.push(String(init?.body ?? ''))
    return new Response(JSON.stringify({ choices: [{ message: { content: textos[Math.min(pedidos.length - 1, textos.length - 1)] } }] }))
  }
  return { ia: criarIa({ banco, ambiente: AMBIENTE, fetch, agora: () => agora }), pedidos }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  agora = new Date('2026-10-08T15:00:00Z')
  const [p] = await banco.insert(pessoa).values({ nome: 'Joana Ribeiro' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'encerrado', desfecho: 'procedente_total' }).returning()
  await banco.insert(publicacao).values({ fonte: 'aasp', casoId: c.id, disponibilizadaEm: '2026-09-30', texto: 'Julgo procedente o pedido de BPC.', classe: 'merito', hash: 'h1' })
  ;[{ id: acervoId }] = await banco.insert(processoAcervo).values({ casoId: c.id, beneficio: 'bpc_loas_deficiente', desfecho: 'procedente_total', fonte: 'portal' }).returning()
  // O acervo importado não tem caso: fica sem ficha, fora da IA.
  await banco.insert(processoAcervo).values({ numeroCnj: '00000011220204036301', desfecho: 'improcedente', fonte: 'lote' })
})
afterEach(() => fechar())

const ficha = async () => (await banco.select().from(processoAcervo).where(eq(processoAcervo.id, acervoId)))[0]

describe('GGVP-41 · a ficha do desfecho no acervo, pela IA', () => {
  it('CA1, CA4, CA10 · a IA lê a decisão e escreve a ficha; nome e CPF do cliente saem antes de gravar', async () => {
    expect(await desfechosSemFicha(banco)).toEqual([acervoId])
    const { ia, pedidos } = iaFalsa(JSON.stringify(FICHA))
    await fichaDoDesfecho(banco, ia, acervoId, { soPreparar: true })
    expect(pedidos[0]).toContain('Julgo procedente o pedido de BPC.')
    const f = await ficha()
    expect([f.materia, f.vara, f.tese]).toEqual([FICHA.materia, FICHA.vara, FICHA.tese])
    expect(f.resumo).toBe('[cliente], CPF [CPF], teve o benefício concedido pelo juiz.')
    expect(f.licao).toBe('O laudo social que mostrou os gastos da casa decidiu o caso de [cliente].')
    const [chamada] = await banco.select().from(chamadaIa)
    expect([chamada.finalidade, chamada.versaoInstrucao]).toEqual(['ficha_do_desfecho', 1])
    // CA9: com a ficha, o desfecho sai da lista e a IA não é chamada de novo.
    expect(await desfechosSemFicha(banco)).toEqual([])
    await fichaDoDesfecho(banco, ia, acervoId, { soPreparar: true })
    expect(pedidos).toHaveLength(1)
  })

  it('CA11 · a IA falhou: sem ficha, nada trava; no mesmo dia a rodada não chama de novo, no dia seguinte chama', async () => {
    const { ia, pedidos } = iaFalsa('Não sei dizer.', JSON.stringify(FICHA))
    await fichaDoDesfecho(banco, ia, acervoId, { soPreparar: true })
    expect([(await ficha()).materia, await desfechosSemFicha(banco)]).toEqual([null, [acervoId]])
    await fichaDoDesfecho(banco, ia, acervoId, { soPreparar: true })
    expect(pedidos).toHaveLength(1)
    agora = new Date('2026-10-09T16:00:00Z')
    await fichaDoDesfecho(banco, ia, acervoId, { soPreparar: true })
    expect([pedidos.length, (await ficha()).tese]).toEqual([2, FICHA.tese])
  })

  it('CA4 · sem chave da IA, a ficha espera e nada trava; a rodada do servidor escreve a ficha quando há chave', async () => {
    expect(await fichaDoDesfecho(banco, criarIa({ banco, ambiente: { IA_PERMITE_DADO_DE_SAUDE: 'sim' } }), acervoId)).toBeNull()
    expect((await ficha()).materia).toBeNull()
    const { ia } = iaFalsa(JSON.stringify(FICHA))
    const app = criarServidor({ banco, ia, agora: () => agora })
    await app.prepararSugestoes()
    expect((await ficha()).materia).toBe(FICHA.materia)
  })
})
