import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { configuracao, eventoAuditoria, rodadaVigilia } from '../banco/esquema.ts'
import { fontesAtivas, type Fonte } from './fontes.ts'
import { MSG_PRESA, MSG_SEM_FONTE, batida, horariosDaVigilia, marcarPresas, planejarDia, rodar, semFonteHoje } from './rodadas.ts'
import type { Alarme, Suporte } from '../suporte.ts'

let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

const fonteQue = (nome: string, buscar: Fonte['buscar']): Fonte => ({ nome, buscar })
const vazia = fonteQue('aasp', async () => [])
const umaPublicacao = fonteQue('aasp', async () => [{ fonte: 'aasp', numeroCnj: null, disponibilizadaEm: '2026-10-05', texto: 'Intimação.', partes: null }])
const rodadas = () => banco.select().from(rodadaVigilia).orderBy(rodadaVigilia.previstaPara)
const as = (iso: string) => () => new Date(iso)

describe('GGVP-30 · rodadas da vigília', () => {
  it('planeja 3 rodadas por fonte no dia, nos horários do escritório, sem duplicar', async () => {
    await planejarDia(banco, [vazia, fonteQue('djen', async () => [])], new Date('2026-10-05T10:00:00Z'))
    await planejarDia(banco, [vazia], new Date('2026-10-05T12:00:00Z'))
    expect((await rodadas()).map((r) => [r.fonte, r.previstaPara.toISOString()])).toEqual([
      ['aasp', '2026-10-05T11:00:00.000Z'],
      ['djen', '2026-10-05T11:00:00.000Z'],
      ['aasp', '2026-10-05T16:00:00.000Z'],
      ['djen', '2026-10-05T16:00:00.000Z'],
      ['aasp', '2026-10-05T21:00:00.000Z'],
      ['djen', '2026-10-05T21:00:00.000Z'],
    ])
    await banco.insert(configuracao).values({ chave: 'vigilia.horarios', valor: ['07:30', '12:00', '17:30'] })
    expect(await horariosDaVigilia(banco)).toEqual(['07:30', '12:00', '17:30'])
  })

  it('CA7, CA2 · a rodada registra início, fim, fonte, quantidade e status (OK com zero também)', async () => {
    await batida(banco, [umaPublicacao], as('2026-10-05T11:05:00Z'))
    const [r] = await rodadas()
    expect([r.fonte, r.situacao, r.capturadas, r.inicio !== null, r.fim !== null]).toEqual(['aasp', 'ok', 1, true, true])
    await batida(banco, [vazia], as('2026-10-05T16:02:00Z'))
    expect((await rodadas())[1]).toMatchObject({ situacao: 'ok', capturadas: 0 })
  })

  it('CA8 · erro e credencial inválida viram falha com o erro; credencial vai também ao suporte', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    const [r] = await rodadas()
    const semCredencial = fonteQue('aasp', async () => {
      throw new Error('credencial inválida (401)')
    })
    expect(await rodar(banco, r.id, semCredencial, as('2026-10-05T11:00:00Z'))).toEqual({ situacao: 'falhou', erro: 'credencial inválida (401)' })
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'alarme_suporte'))).length).toBe(1)
  })

  it('CA8, CA10 (grupo 4) · a chave da AASP recusada vira falha de credencial, sem a chave no erro nem no alarme ao suporte', async () => {
    const chave = 'chave-secreta-de-teste-0123456789'
    const recusa = { buscar: (async () => new Response('{}', { status: 401 })) as typeof fetch, esperar: async () => {} }
    const [aasp] = fontesAtivas({ FONTES_PUBLICACAO: 'aasp', AASP_CHAVES: chave }, recusa)
    await batida(banco, [aasp], as('2026-10-05T11:05:00Z'))
    const [r] = await rodadas()
    expect([r.fonte, r.situacao, r.erro]).toEqual(['aasp', 'falhou', 'credencial: a AASP recusou a chave 1 de 1 (HTTP 401)'])
    const alarmes = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'alarme_suporte'))
    expect(alarmes).toHaveLength(1)
    expect(JSON.stringify(alarmes)).not.toContain(chave)
  })

  it('CA8 · tempo esgotado também é falha', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    const [r] = await rodadas()
    const lenta = fonteQue('aasp', () => new Promise((resolver) => setTimeout(() => resolver([]), 500)))
    const resultado = await rodar(banco, r.id, lenta, as('2026-10-05T11:00:00Z'), 20)
    expect(resultado).toMatchObject({ situacao: 'falhou' })
    expect((await rodadas())[0].erro).toContain('tempo esgotado')
  })

  it('CA9 · a rodada que não rodou até 30 minutos depois do horário vira "não rodou"', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    await batida(banco, [], as('2026-10-05T11:31:00Z'))
    expect((await rodadas()).map((r) => r.situacao)).toEqual(['nao_rodou', 'prevista', 'prevista'])
  })
})

describe('GGVP-158 P5.10 · o alarme da vigília chega ao suporte', () => {
  const avisos: Alarme[] = []
  const suporte: Suporte = async (a) => {
    avisos.push(a)
    return { canal: 'enviado', jira: 'enviado' }
  }
  beforeEach(() => {
    avisos.length = 0
  })
  const alarmes = () => banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'alarme_suporte'))

  it('falha de qualquer tipo (tempo esgotado) vai ao canal e ao Jira, uma vez, com a fonte, o horário e o motivo', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    const [r] = await rodadas()
    const lenta = fonteQue('aasp', () => new Promise((resolver) => setTimeout(() => resolver([]), 500)))
    await rodar(banco, r.id, lenta, as('2026-10-05T11:00:00Z'), 20, suporte)
    expect(avisos).toEqual([{ titulo: 'Vigília das publicações: AASP', texto: 'a rodada das 08:00 não trouxe as publicações. Motivo: tempo esgotado: a fonte não respondeu em 0.02 s' }])
    const [a] = await alarmes()
    expect([a.alvo, a.detalhe]).toEqual([`rodada:${r.id}`, expect.objectContaining({ fonte: 'aasp', canal: 'enviado', jira: 'enviado' })])
  })

  it('a rodada presa em "rodando" além do tempo vira falha, com alarme; a que ainda está no tempo, não', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    const [r, outra] = await rodadas()
    await banco.update(rodadaVigilia).set({ situacao: 'rodando', inicio: new Date('2026-10-05T11:00:00Z') }).where(eq(rodadaVigilia.id, r.id))
    await banco.update(rodadaVigilia).set({ situacao: 'rodando', inicio: new Date('2026-10-05T11:09:00Z') }).where(eq(rodadaVigilia.id, outra.id))
    await marcarPresas(banco, new Date('2026-10-05T11:10:00Z'), suporte)
    const depois = new Map((await rodadas()).map((x) => [x.id, [x.situacao, x.erro]]))
    expect([depois.get(r.id), depois.get(outra.id)]).toEqual([['falhou', MSG_PRESA], ['rodando', null]])
    expect((await alarmes()).map((a) => a.alvo)).toEqual([`rodada:${r.id}`])
  })

  it('sem fonte ligada: um alarme por dia, nunca um dia mudo; a Central da Sênior sabe dele', async () => {
    await batida(banco, [], as('2026-10-05T11:00:00Z'), suporte)
    await batida(banco, [], as('2026-10-05T11:01:00Z'), suporte)
    expect(avisos.map((a) => a.texto)).toEqual([`não trouxe as publicações. Motivo: ${MSG_SEM_FONTE}`])
    expect(await semFonteHoje(banco, new Date('2026-10-05T15:00:00Z'))).toBe((await alarmes())[0].id)
    await batida(banco, [], as('2026-10-06T11:00:00Z'), suporte)
    expect(avisos).toHaveLength(2)
  })

  it('a rodada que não rodou também vai ao suporte', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    await batida(banco, [vazia], as('2026-10-05T11:31:00Z'), suporte)
    expect(avisos.map((a) => a.texto)).toEqual(['a rodada das 08:00 não trouxe as publicações. Motivo: a rodada não foi executada no horário previsto'])
  })
})
