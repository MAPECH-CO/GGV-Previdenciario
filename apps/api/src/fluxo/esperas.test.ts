import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, pessoa, tarefa, tentativa } from '../banco/esquema.ts'
import { RESULTADO_VENCIDA, vencerEsperas } from './esperas.ts'

let banco: Banco
let fechar: () => Promise<void>
let casoId: string
const dia = (d: number) => new Date(Date.UTC(2026, 9, d, 15))
const laco = async (valores: Partial<typeof tarefa.$inferInsert>) =>
  (await banco.insert(tarefa).values({ casoId, titulo: 'Cobrar o cliente', perfilDono: 'documentacao', limiteTentativas: 2, prazo: '2026-10-05', ...valores }).returning())[0]
const ler = async (id: string) => (await banco.select().from(tarefa).where(eq(tarefa.id, id)))[0]

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
})
afterEach(() => fechar())

describe('GGVP-105 CA8 · a espera vencida conta a tentativa e, no limite, sobe (G15)', () => {
  it('prazo vencido sem contato: conta a tentativa e ganha o prazo do próximo lembrete; no limite, sobe para a Sênior uma vez só', async () => {
    const t = await laco({ passo: 'D2.05' })
    expect(await vencerEsperas(banco, dia(7))).toBe(1)
    const depois = await ler(t.id)
    expect([depois.tentativas, depois.escaladaEm, depois.prazo! > '2026-10-07']).toEqual([1, null, true])
    expect(await banco.select({ canal: tentativa.canal, resultado: tentativa.resultado }).from(tentativa)).toEqual([{ canal: 'sistema', resultado: RESULTADO_VENCIDA }])
    expect(await vencerEsperas(banco, dia(7))).toBe(0) // no mesmo dia, nada de novo

    expect(await vencerEsperas(banco, dia(28))).toBe(1)
    expect(await ler(t.id)).toMatchObject({ tentativas: 2, escaladaPara: 'senior', concluidaEm: null })
    const subiu = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.perfilDono, 'senior')))
    expect(subiu.map((x) => [x.passo, x.titulo])).toEqual([['D2.05', 'Laço sem retorno: Cobrar o cliente']])
    expect(await vencerEsperas(banco, dia(30))).toBe(0) // já subiu: não sobe de novo
  })

  it('na perícia, sobe para a advogada; tarefa sem laço, concluída ou no prazo não muda', async () => {
    const remarcar = await laco({ passo: 'DP.04', titulo: 'Remarcar a perícia', limiteTentativas: 1 })
    const semLaco = await laco({ limiteTentativas: null })
    const feita = await laco({ concluidaEm: dia(4), situacao: 'concluida' })
    const noPrazo = await laco({ prazo: '2026-10-09' })
    expect(await vencerEsperas(banco, dia(7))).toBe(1)
    expect((await ler(remarcar.id)).escaladaPara).toBe('advogada')
    expect((await banco.select().from(tarefa).where(eq(tarefa.perfilDono, 'advogada'))).map((x) => x.titulo)).toEqual(['Laço sem retorno: Remarcar a perícia'])
    for (const t of [semLaco, feita, noPrazo]) expect((await ler(t.id)).tentativas).toBe(0)
  })
})
