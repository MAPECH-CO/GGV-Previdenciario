import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { rodadaVigilia, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import type { Fonte } from '../vigilia/fontes.ts'
import { batida } from '../vigilia/rodadas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let agora = new Date('2026-10-05T11:05:00Z') // segunda, 08:05 em Brasília
let falhar = true
const publicacoes = [
  { fonte: 'aasp', numeroCnj: null, disponibilizadaEm: '2026-10-05', texto: 'Intimação.', partes: null },
  { fonte: 'aasp', numeroCnj: null, disponibilizadaEm: '2026-10-05', texto: ' INTIMAÇÃO. ', partes: null },
]
const fonte: Fonte = {
  nome: 'aasp',
  async buscar() {
    if (falhar) throw new Error('API fora do ar (503)')
    return publicacoes
  },
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', url: string) => app.inject({ method: metodo, url, cookies: await cookieDe(apelido) })
const relogio = () => agora

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  agora = new Date('2026-10-05T11:05:00Z')
  falhar = true
  app = criarServidor({ banco, agora: relogio, fontes: [fonte] })
  for (const [apelido, perfil] of [['helena', 'senior'], ['gabi', 'advogada'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(() => fechar())

describe('GGVP-30 · alarme e reprocessamento', () => {
  it('CA1, CA3, CA11 · a rodada que falhou vira "Reprocessar vigília" no topo da Sênior, com horário, fonte e erro', async () => {
    await batida(banco, [fonte], relogio)
    const [l] = (await chamar('helena', 'GET', '/api/tarefas')).json()
    expect([l.titulo, l.contexto, l.cliente, l.urgente, l.tela]).toEqual(['Reprocessar vigília', 'Vigília das publicações', null, true, '/vigilia'])
    expect(l.detalhe).toBe('a rodada falhou · 08:00 · AASP · API fora do ar (503)')
    expect((await chamar('gabi', 'GET', '/api/tarefas')).json()).toEqual([])
  })

  it('CA9 · a rodada que não rodou também alarma', async () => {
    agora = new Date('2026-10-05T10:00:00Z') // 07:00: planeja o dia, nada roda ainda
    await batida(banco, [fonte], relogio)
    agora = new Date('2026-10-05T12:00:00Z') // 09:00: a das 08:00 passou da tolerância sem rodar
    await batida(banco, [], relogio)
    const [l] = (await chamar('helena', 'GET', '/api/tarefas')).json()
    expect(l.detalhe).toContain('a rodada não rodou · 08:00')
  })

  it('CA5, CA6 · reprocessar captura sem duplicar, registra quem e quando, e o alarme some', async () => {
    await batida(banco, [fonte], relogio)
    const [r] = await banco.select().from(rodadaVigilia).orderBy(rodadaVigilia.previstaPara)
    expect((await chamar('gabi', 'POST', `/api/vigilia/rodadas/${r.id}/reprocessar`)).statusCode).toBe(403)
    expect((await chamar('helena', 'GET', '/api/vigilia')).json().situacaoDoDia).toBe('incompleta')
    falhar = false
    expect((await chamar('helena', 'POST', `/api/vigilia/rodadas/${r.id}/reprocessar`)).json()).toEqual({ situacao: 'ok', capturadas: 1 })
    const painel = (await chamar('helena', 'GET', '/api/vigilia')).json()
    expect([painel.rodadas[0].situacao, painel.rodadas[0].reprocessadaPor, painel.falhas]).toEqual(['ok', 'helena', 0])
    expect(painel.descartes.map((d: { motivo: string }) => d.motivo)).toEqual(['repetida: mesma data, mesmo processo e mesmo teor'])
    expect((await chamar('helena', 'GET', '/api/tarefas')).json().map((t: { titulo: string }) => t.titulo)).toEqual(['Casar publicação'])
    expect((await chamar('helena', 'POST', `/api/vigilia/rodadas/${r.id}/reprocessar`)).statusCode).toBe(409)
  })
})

describe('GGVP-30 · painel da vigília', () => {
  it('CA4, CA7 · as rodadas do dia com a contagem; a advogada vê, sem a fila nem o reprocessar; o Atendimento não abre', async () => {
    await batida(banco, [fonte], relogio)
    const p = (await chamar('helena', 'GET', '/api/vigilia')).json()
    expect([p.dia, p.previstas, p.concluidas, p.falhas, p.rodadas.map((r: { situacao: string }) => r.situacao)]).toEqual([
      '2026-10-05', 3, 0, 1, ['falhou', 'prevista', 'prevista'],
    ])
    const a = (await chamar('gabi', 'GET', '/api/vigilia')).json()
    expect([a.podeReprocessar, a.podeCasar, a.fila]).toEqual([false, false, []])
    expect((await chamar('ana', 'GET', '/api/vigilia')).statusCode).toBe(403)
  })

  it('CA2, CA12 · três rodadas OK sem nada em dia útil: "dia sem publicação"; com publicação, OK', async () => {
    const vazia: Fonte = { nome: 'aasp', buscar: async () => [] }
    for (const hora of ['11:05', '16:05', '21:05']) await batida(banco, [vazia], () => new Date(`2026-10-05T${hora}:00Z`))
    agora = new Date('2026-10-05T22:00:00Z')
    const p = (await chamar('helena', 'GET', '/api/vigilia')).json()
    expect([p.situacaoDoDia, p.concluidas, p.rodadas.map((r: { capturadas: number }) => r.capturadas)]).toEqual(['sem_publicacao', 3, [0, 0, 0]])
  })
})
