// GGVP-51 CA2 no servidor: sem benefício citado na entrevista, a sugestão traz o benefício, os casos da casa e o porquê.
// A IA é de mentira (o `fetch` falso); o acervo é o do banco embutido, com um caso inventado.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, pessoa, resultadoInss } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import type { Ficha, Gravacao } from '../../../web/src/dados/tipos.ts'
import { criarSugestaoDoBeneficio } from './sugestao-do-beneficio.ts'

let banco: Banco
let fechar: () => Promise<void>
let pedidos: string[] = []
const SAIDA = { sugerido: 'incapacidade-temporaria', alternativa: null, porque: 'Parou de trabalhar pela coluna, com laudo, como um caso da casa indeferido por falta do laudo.' }

/** A IA de mentira: registra o que vai no pedido da sugestão e responde a saída de sempre. */
async function fetch(_url: unknown, init?: RequestInit) {
  const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
  if (corpo.messages[0].content.includes('Você sugere o benefício')) pedidos.push(corpo.messages[1].content)
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(SAIDA) } }] }))
}

// Inventadas: a advogada pergunta, a cliente conta; ninguém diz o nome de um benefício.
const FALAS = [
  { aos: 10, quem: 'Paula', papel: 'advogada', texto: 'Conte o que aconteceu com o seu trabalho.' },
  { aos: 20, quem: 'Joana', papel: 'cliente', texto: 'Parei de trabalhar na limpeza por causa da coluna; tenho o laudo do ortopedista.' },
  { aos: 30, quem: 'Paula', papel: 'advogada', texto: 'Desde quando a senhora está parada?' },
]

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  pedidos = []
})
afterEach(() => fechar())

describe('GGVP-51 · definir o benefício com apoio do acervo, no servidor', () => {
  it('GGVP-51 CA2 · sem benefício citado, a IA propõe um benefício, com os casos da casa que usou e o porquê; a pessoa decide depois', async () => {
    // Outro caso da casa, indeferido pela coluna: entra no acervo pelo motivo.
    const [outra] = await banco.insert(pessoa).values({ nome: 'Rita Souza' }).returning()
    const [doAcervo] = await banco.insert(caso).values({ pessoaId: outra.id, beneficio: 'auxilio_incapacidade_temporaria', fase: 'administrativa' }).returning()
    await banco.insert(resultadoInss).values({ casoId: doAcervo.id, resultado: 'indeferido', dataDecisao: '2026-09-01', motivoEscrito: 'A perícia não viu incapacidade da coluna; faltou o laudo do ortopedista.' })
    const [joana] = await banco.insert(pessoa).values({ nome: 'Joana Ribeiro' }).returning()

    const ia = criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch, agora: () => new Date('2026-10-08T15:00:00Z') })
    const sugestoes = criarSugestaoDoBeneficio({ banco, ia })
    const ficha = { id: joana.id, nome: 'Joana Ribeiro', nascimento: '1970-04-12' } as Ficha
    const gravacao = { id: 'gravacao-joana-1', trechos: FALAS, extraidas: [] } as unknown as Gravacao
    const d = await sugestoes.definicao(ficha, gravacao, '2026-10-08')

    expect([d.citado, d.aviso]).toEqual([null, null])
    expect(d.sugestao).toMatchObject({ sugerido: 'incapacidade-temporaria', porque: SAIDA.porque, alerta: null })
    expect(d.sugestao!.alternativa).toBeUndefined()
    expect(d.sugestao!.fontes).toEqual([expect.objectContaining({ tipo: 'acervo', referencia: `caso:${doAcervo.id}`, trecho: expect.stringContaining('laudo do ortopedista') })])
    // O pedido leva o caso da casa, sem o nome da cliente dele, e diz que o benefício está a definir.
    expect(pedidos).toHaveLength(1)
    for (const trecho of ['Benefício de interesse: a definir.', 'Trechos do acervo da casa (outros casos):', 'faltou o laudo do ortopedista']) expect(pedidos[0]).toContain(trecho)
    expect(pedidos[0]).not.toContain('Rita Souza')
    // A sugestão fica guardada e volta igual, sem nova chamada: confirmar ou trocar é a advogada, na definição do benefício.
    expect((await sugestoes.definicao(ficha, gravacao, '2026-10-08', { soLer: true })).sugestao).toEqual(d.sugestao)
    expect(pedidos).toHaveLength(1)
  })
})
