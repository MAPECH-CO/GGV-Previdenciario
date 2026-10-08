import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, etapa, pessoa, prazo, publicacao, tarefa } from '../banco/esquema.ts'
import { REGRA_PRAZO_JUDICIAL } from '../fluxo/prazo-judicial.ts'
import { encaminhar } from './encaminhar.ts'

let banco: Banco
let fechar: () => Promise<void>
let pub: typeof publicacao.$inferSelect
const AGORA = new Date('2026-10-05T15:00:00Z')

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
  ;[pub] = await banco
    .insert(publicacao)
    .values({ fonte: 'aasp', numeroCnj: '00012349620264036301', casoId: c.id, disponibilizadaEm: '2026-10-05', texto: 'Intime-se.', hash: 'h1' })
    .returning()
})
afterEach(() => fechar())

const abertas = async () =>
  (await banco.select().from(tarefa).where(isNull(tarefa.concluidaEm))).map((t) => [t.passo, t.titulo, t.perfilDono, t.prazo])
const vai = (classe: 'andamento' | 'exigencia' | 'merito', dias: number | null) => banco.transaction((tx) => encaminhar(tx, pub, classe, dias, AGORA))

describe('GGVP-37 · encaminhar pelo tipo de ato', () => {
  it('CA1, CA4 · exigência abre "Analisar exigência do juiz" para a advogada, com o prazo contado, e o caso entra no D3a', async () => {
    const contado = await vai('exigencia', 15)
    expect(contado).toMatchObject({ inicio: '2026-10-07', fim: '2026-10-27', versao: REGRA_PRAZO_JUDICIAL.versao })
    expect(await abertas()).toEqual([['D3a.02', 'Analisar exigência do juiz', 'advogada', '2026-10-27']])
    const [e] = await banco.select().from(etapa)
    const [p] = await banco.select().from(prazo)
    expect([e.diagrama, p.origem, p.regraVersao, p.publicacaoId]).toEqual(['D3a', 'publicacao_exigencia', 1, pub.id])
  })

  it('CA2, CA5 · mérito abre "Confirmar desfecho" com o prazo do recurso', async () => {
    await vai('merito', 15)
    expect(await abertas()).toEqual([['D4.02', 'Confirmar desfecho', 'advogada', '2026-10-27']])
  })

  it('CA3 · só andamento fica registrado, sem tarefa e sem prazo', async () => {
    expect(await vai('andamento', null)).toBeNull()
    expect([await abertas(), await banco.select().from(prazo)]).toEqual([[], []])
  })

  it('CA7 · reclassificar cancela a tarefa do encaminhamento anterior e refaz', async () => {
    await vai('exigencia', 15)
    await vai('merito', 5)
    expect(await abertas()).toEqual([['D4.02', 'Confirmar desfecho', 'advogada', '2026-10-13']])
    const canceladas = await banco.select().from(tarefa).where(and(eq(tarefa.situacao, 'cancelada')))
    expect(canceladas.map((t) => t.titulo)).toEqual(['Analisar exigência do juiz'])
    await vai('andamento', null)
    expect(await abertas()).toEqual([])
  })
})
