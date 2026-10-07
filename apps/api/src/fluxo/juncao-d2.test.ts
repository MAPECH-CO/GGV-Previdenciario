import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, pericia, pessoa, requerimentoInss, tarefa, usuario } from '../banco/esquema.ts'
import { avancarJuncaoD2 } from './juncao-d2.ts'

let banco: Banco
let fechar: () => Promise<void>
let casoId: string
let usuarioId: string

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const [p] = await banco.insert(pessoa).values({ nome: 'Ana' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  const [u] = await banco.insert(usuario).values({ email: 'j@exemplo.ggv', nome: 'J', senhaHash: 'x', perfis: ['juridico_adm'] }).returning()
  casoId = c.id
  usuarioId = u.id
})
afterEach(() => fechar())

async function protocolar() {
  const [d] = await banco
    .insert(documento)
    .values({ casoId, tipo: 'comprovante_protocolo', chaveArmazenamento: `c/${casoId}`, nomeOriginal: 'c.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'portal' })
    .returning()
  await banco.insert(requerimentoInss).values({ casoId, numero: '123', der: '2026-10-05', comprovanteDocumentoId: d.id, revisadoAntesDeEnviar: true, registradoPor: usuarioId })
}

async function decidir(tipos: ('medica' | 'social')[]) {
  const [e] = await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', concluidaEm: new Date() }).returning()
  for (const tipo of tipos) await banco.insert(pericia).values({ casoId, tipo, chamadaPorEtapaId: e.id })
}

const naVigilia = async () => (await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.04')))).length

describe('junção do D2: protocolo feito e perícia resolvida (ou sem perícia)', () => {
  it('só protocolo, sem decisão de perícia: não fecha', async () => {
    await protocolar()
    expect((await avancarJuncaoD2(banco, casoId)).fechou).toBe(false)
    expect(await naVigilia()).toBe(0)
  })

  it('GGVP-31 CA2 · sem perícia: fecha quando o protocolo chega', async () => {
    await decidir([])
    expect((await avancarJuncaoD2(banco, casoId)).fechou).toBe(false)
    await protocolar()
    expect(await avancarJuncaoD2(banco, casoId)).toEqual({ protocolo: true, pericia: 'sem_pericia', fechou: true })
    expect(await naVigilia()).toBe(1)
  })

  it('GGVP-31 CA7 · com perícia: só fecha com o resultado de todas, favorável ou não', async () => {
    await protocolar()
    await decidir(['medica', 'social'])
    expect((await avancarJuncaoD2(banco, casoId)).pericia).toBe('pendente')
    await banco.update(pericia).set({ resultado: 'favoravel' }).where(eq(pericia.tipo, 'medica'))
    expect((await avancarJuncaoD2(banco, casoId)).fechou).toBe(false)
    await banco.update(pericia).set({ resultado: 'desfavoravel' }).where(eq(pericia.tipo, 'social'))
    expect((await avancarJuncaoD2(banco, casoId)).fechou).toBe(true)
  })

  it('chamar de novo não abre outra vigília', async () => {
    await protocolar()
    await decidir([])
    await avancarJuncaoD2(banco, casoId)
    await avancarJuncaoD2(banco, casoId)
    expect(await naVigilia()).toBe(1)
  })

  it('GGVP-35 CA1 · ao fechar, abre uma vez só "Trazer a resposta do INSS" para o Jurídico', async () => {
    await protocolar()
    await decidir([])
    await avancarJuncaoD2(banco, casoId)
    await avancarJuncaoD2(banco, casoId)
    const t = await banco.select().from(tarefa).where(eq(tarefa.casoId, casoId))
    expect(t.map((x) => [x.passo, x.titulo, x.perfilDono])).toEqual([['D2.04', 'Trazer a resposta do INSS', 'advogada']])
  })
})
