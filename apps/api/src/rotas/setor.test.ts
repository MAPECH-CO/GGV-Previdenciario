import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, tarefa, tarefaRecepcao, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_FORA_DO_SETOR } from './setor.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const ids: Record<string, string> = {}
let ajuste: string
let pericia: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const atribuir = (apelido: string, corpo: object) => chamar(apelido, 'POST', '/api/setor/atribuicoes', corpo)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  const equipe = [
    ['ana', ['atendimento']],
    ['bia', ['atendimento']],
    ['eva', ['atendimento_lider', 'atendimento']],
    ['fabio', ['documentacao']],
    ['gabi', ['advogada']],
    ['helena', ['senior']],
    ['igor', ['juridico_adm']],
  ] as const
  for (const [apelido, perfis] of equipe) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [...perfis], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'atendimento' }).returning()
  ;[{ id: ajuste }] = await banco.insert(tarefa).values({ casoId: c.id, passo: 'D1.ajuste', titulo: 'Ajustar o caso: falta a procuração', perfilDono: 'atendimento' }).returning()
  ;[{ id: pericia }] = await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.03', titulo: 'Decidir perícia', perfilDono: 'advogada' }).returning()
  await banco.insert(tarefaRecepcao).values({
    id: 'renovar-senha-maria',
    pessoaId: p.id,
    setor: 'Atendimento',
    dados: { id: 'renovar-senha-maria', codigo: 'D1.08', cliente: { id: p.id, nome: 'Maria Souza' }, acao: 'Renovar senha do gov.br', detalhe: 'antes da entrevista', setor: 'Atendimento' },
  })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-147 · tarefas do setor e quem faz', () => {
  it('CA1 · o líder do Atendimento vê as tarefas abertas do setor, de todas as áreas, sem responsável, e as pessoas do setor', async () => {
    const r = (await chamar('eva', 'GET', '/api/setor')).json()
    expect(r.setor).toBe('atendimento')
    expect(r.tarefas.map((t: { acao: string; responsavel: unknown }) => [t.acao, t.responsavel])).toEqual([
      ['Ajustar o caso: falta a procuração', null],
      ['Renovar senha do gov.br', null],
    ])
    expect(r.pessoas.map((p: { nome: string }) => p.nome).sort()).toEqual(['ana', 'bia', 'eva'])
  })

  it('CA1 · a Sênior, líder do Jurídico, vê as do Jurídico', async () => {
    const r = (await chamar('helena', 'GET', '/api/setor')).json()
    expect([r.setor, r.tarefas.map((t: { id: string }) => t.id)]).toEqual(['juridico', [pericia]])
    expect(r.pessoas.map((p: { nome: string }) => p.nome).sort()).toEqual(['gabi', 'helena', 'igor'])
  })

  it('CA2 · atribuir leva a tarefa à fila da pessoa, com o prazo, a prioridade e o recado; o histórico guarda quem, para quem e quando', async () => {
    const r = await atribuir('eva', { tarefaId: ajuste, responsavelId: ids.bia, prazo: '20/10/2026', prioridade: 'alta', recado: 'cliente prefere telefone' })
    expect(r.statusCode).toBe(201)
    const quadro = (await chamar('eva', 'GET', '/api/setor')).json()
    const linha = quadro.tarefas.find((t: { id: string }) => t.id === ajuste)
    expect([linha.responsavel, linha.prazo, linha.urgente, linha.recado, linha.atribuidaPor]).toEqual([{ id: ids.bia, nome: 'bia' }, 'até 20/10', true, 'cliente prefere telefone', 'eva'])
    expect(quadro.pessoas.find((p: { nome: string }) => p.nome === 'bia').carga).toBe(1)
    const bia = (await chamar('bia', 'GET', '/api/setor/minhas')).json()
    expect(bia.minhas.map((t: { id: string }) => t.id)).toEqual([ajuste])
    // Para a Ana, a tarefa saiu da fila: é da Bia.
    expect((await chamar('ana', 'GET', '/api/setor/minhas')).json()).toEqual({ minhas: [], deOutros: [ajuste] })
    const [evento] = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'tarefa_atribuida')
    expect([evento.quem, evento.alvo, (evento.detalhe as { para: string }).para]).toEqual([ids.eva, `tarefa:${ajuste}`, ids.bia])
  })

  it('CA2 · deixar sem responsável devolve a tarefa a todo o setor', async () => {
    await atribuir('eva', { tarefaId: ajuste, responsavelId: ids.bia })
    expect((await atribuir('eva', { tarefaId: ajuste, responsavelId: null })).statusCode).toBe(201)
    expect((await chamar('ana', 'GET', '/api/setor/minhas')).json().deOutros).toEqual([])
  })

  it('CA3 · quem não é líder não vê o quadro e não atribui (403 pelo perfil da sessão); o líder só atribui no setor dele', async () => {
    expect((await chamar('ana', 'GET', '/api/setor')).statusCode).toBe(403)
    const r = await atribuir('ana', { tarefaId: ajuste, responsavelId: ids.ana })
    expect([r.statusCode, r.json()]).toEqual([403, { erro: MSG_SEM_PERMISSAO }])
    const fora = await atribuir('eva', { tarefaId: ajuste, responsavelId: ids.gabi })
    expect([fora.statusCode, fora.json().erro]).toEqual([400, MSG_FORA_DO_SETOR])
    // A tarefa do Jurídico não é do setor do Atendimento.
    expect((await atribuir('eva', { tarefaId: pericia, responsavelId: ids.bia })).statusCode).toBe(404)
  })
})
