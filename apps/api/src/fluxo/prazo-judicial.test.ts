import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { feriado } from '../banco/esquema.ts'
import { REGRA_PRAZO_JUDICIAL, feriadosDoProcesso, prazoDepoisDaIndisponibilidade, prazoJudicial, tribunalDoCnj } from './prazo-judicial.ts'

const NADA = new Set<string>()

describe('GGVP-34 CA2 · prazo judicial (Lei 11.419, art. 4º; CPC, art. 219)', () => {
  it('disponibilizada na segunda: publicação na terça, início na quarta, 5 dias úteis até a terça seguinte', () => {
    // 05/10/2026 é segunda.
    expect(prazoJudicial('2026-10-05', 5, NADA)).toMatchObject({ publicacao: '2026-10-06', inicio: '2026-10-07', fim: '2026-10-13' })
  })

  it('disponibilizada na sexta: publicação na segunda, início na terça (fim de semana não conta)', () => {
    expect(prazoJudicial('2026-10-09', 1, NADA)).toMatchObject({ publicacao: '2026-10-12', inicio: '2026-10-13', fim: '2026-10-13' })
  })

  it('15 dias úteis atravessam dois fins de semana', () => {
    expect(prazoJudicial('2026-10-05', 15, NADA).fim).toBe('2026-10-27')
  })
})

describe('GGVP-34 CA7 · feriado, fim de semana e suspensão, pelo lado seguro', () => {
  it('véspera de feriado: disponibilizada na véspera, a publicação pula o feriado', () => {
    // Feriado na terça 13/10 (de teste): disponibilizada na segunda 12/10 → publicação na quarta 14, início na quinta 15.
    expect(prazoJudicial('2026-10-12', 1, new Set(['2026-10-13']))).toMatchObject({ publicacao: '2026-10-14', inicio: '2026-10-15', fim: '2026-10-15' })
  })

  it('disponibilizada no sábado conta como se fosse a sexta: publicação na segunda', () => {
    expect(prazoJudicial('2026-10-10', 1, NADA)).toMatchObject({ publicacao: '2026-10-12', inicio: '2026-10-13' })
  })

  it('suspensão do tribunal no meio do prazo empurra o fim', () => {
    const semSuspensao = prazoJudicial('2026-10-05', 5, NADA).fim
    const comSuspensao = prazoJudicial('2026-10-05', 5, new Set(['2026-10-08', '2026-10-09'])).fim
    expect([semSuspensao, comSuspensao]).toEqual(['2026-10-13', '2026-10-15'])
  })
})

describe('GGVP-34 CA6, CA8 · regra versionada e determinística', () => {
  it('o prazo traz a regra e a versão, e o mesmo insumo dá o mesmo resultado', () => {
    const a = prazoJudicial('2026-10-05', 15, new Set(['2026-10-12']))
    expect(a).toEqual(prazoJudicial('2026-10-05', 15, new Set(['2026-10-12'])))
    expect([a.versao, a.regra]).toEqual([REGRA_PRAZO_JUDICIAL.versao, REGRA_PRAZO_JUDICIAL.texto])
  })
})

describe('GGVP-34 CA9 · calendário do tribunal pelo número CNJ', () => {
  let banco: Banco
  let fechar: () => Promise<void>
  beforeEach(async () => {
    ;({ banco, fechar } = await abrirBancoEmbutido())
    await banco.insert(feriado).values([
      { data: '2026-11-02', descricao: 'Finados', tribunal: null },
      { data: '2026-10-08', descricao: 'Suspensão TRF3 (teste)', tribunal: '4.03' },
      { data: '2026-10-09', descricao: 'Suspensão TRF1 (teste)', tribunal: '4.01' },
    ])
  })
  afterEach(() => fechar())

  it('o tribunal sai do CNJ (J.TR)', () => {
    expect(tribunalDoCnj('00012349620264036301')).toBe('4.03')
    expect(tribunalDoCnj(null)).toBeNull()
  })

  it('entram os nacionais e os do tribunal do processo, não os de outro tribunal', async () => {
    expect([...(await feriadosDoProcesso(banco, '00012349620264036301'))].sort()).toEqual(['2026-10-08', '2026-11-02'])
    expect([...(await feriadosDoProcesso(banco, null))]).toEqual(['2026-11-02'])
  })
})

describe('GGVP-87 CA13 · sistema do tribunal fora do ar no último dia (Lei 11.419, art. 10, §2º)', () => {
  it('o prazo passa para o primeiro dia útil depois da volta', () => {
    // Voltou na terça 27/10: prazo na quarta 28/10.
    expect(prazoDepoisDaIndisponibilidade('2026-10-27', NADA)).toBe('2026-10-28')
    // Voltou na sexta 30/10: segunda 02/11 é feriado nacional (Finados) → terça 03/11.
    expect(prazoDepoisDaIndisponibilidade('2026-10-30', new Set(['2026-11-02']))).toBe('2026-11-03')
  })
})
