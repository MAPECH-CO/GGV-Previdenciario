import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { criarIa } from '../ia/ia.ts'
import type { Ficha, Gravacao } from '../../../web/src/dados/tipos.ts'
import { lerEntrevista } from './transcricao.ts'

// GGVP-158 A6 (G14): a IA só aponta na entrevista o que foi dito. O dado da ficha que não aparece na fala que ela cita fica
// de fora, pela mesma regra da conversa (rotas/conversa.ts, GGVP-158 P6.6). A IA é de mentira: nada sai daqui.
let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

const ficha = { id: 'f1', nome: 'Maria Exemplo', beneficioInteresse: 'loas-idoso', documentos: [] } as unknown as Ficha
const gravacao = () =>
  ({
    id: 'g1',
    titulo: 'Entrevista inicial',
    canal: 'presencial',
    extraidas: [],
    trechos: [
      { aos: 0, quem: 'Maria Exemplo', papel: 'cliente', texto: 'Meu telefone é o mesmo de sempre.' },
      { aos: 7, quem: 'Maria Exemplo', papel: 'cliente', texto: 'Sou casada e trabalho como costureira.' },
    ],
  }) as unknown as Gravacao

function iaQueLe(lida: object) {
  const fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(lida) } }] }))
  return criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch })
}

describe('GGVP-158 A6 · a leitura da entrevista confere a fala (G14)', () => {
  it('o telefone que não está na fala citada fica de fora; o que foi dito entra, com o trecho de onde veio', async () => {
    const ia = iaQueLe({
      resumo: 'A cliente é casada e costureira.',
      itens: [
        { tipo: 'telefone', valor: '(11) 98765-4321', i: 0 },
        { tipo: 'estadoCivil', valor: 'casada', i: 1 },
        { tipo: 'profissao', valor: 'costureira', i: 1 },
        { tipo: 'estadoCivil', valor: 'viúva', i: 1 },
      ],
    })
    const g = await lerEntrevista({ ia }, gravacao(), ficha, null)
    expect(g.extraidas.map((e) => [e.campo, e.valor, e.trecho])).toEqual([
      ['estadoCivil', 'casada', 'Sou casada e trabalho como costureira.'],
      ['profissao', 'costureira', 'Sou casada e trabalho como costureira.'],
    ])
  })
})
