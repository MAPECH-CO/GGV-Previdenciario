import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { configuracao } from '../banco/esquema.ts'
import { LIMITES_PADRAO, limitesDeCobranca } from './exigencia.ts'

let banco: Banco
let fechar: () => Promise<void>

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

describe('GGVP-39 CA5 e CA12 · limites de cobrança (G15)', () => {
  it('sem configuração do escritório, valem 2 tentativas com 3 dias entre elas: o portão nunca fica desligado', async () => {
    expect(LIMITES_PADRAO).toEqual({ limite: 2, intervaloDias: 3 })
    expect(await limitesDeCobranca(banco)).toEqual({ limite: 2, intervaloDias: 3 })
  })

  it('com configuração, vale a do escritório; o que faltar ou vier inválido cai no padrão', async () => {
    await banco.insert(configuracao).values([
      { chave: 'cobranca.limite', valor: 4 },
      { chave: 'cobranca.intervalo_dias', valor: 0 },
    ])
    expect(await limitesDeCobranca(banco)).toEqual({ limite: 4, intervaloDias: 3 })
  })
})
