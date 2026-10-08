import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { eventoAuditoria, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const ver = async (apelido: string, url = '/api/roteiros') => app.inject({ method: 'GET', url, cookies: await cookieDe(apelido) })
const salvar = async (apelido: string, itens: object[]) =>
  app.inject({ method: 'POST', url: '/api/roteiros/loas-deficiente/versoes', cookies: await cookieDe(apelido), payload: { itens } })

const ITENS = [
  { id: 'natureza', tipo: 'obrigatorio', texto: 'Natureza do impedimento', pergunta: 'Qual é a natureza do impedimento do paciente?' },
  { id: 'gastos', tipo: 'complementar', texto: 'Provas de gastos' },
]

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z') })
  for (const [apelido, nome, perfil] of [
    ['helena', 'Helena', 'senior'],
    ['gabi', 'Gabi', 'advogada'],
    ['ana', 'Ana', 'atendimento'],
    ['julia', 'Julia', 'financeiro'],
  ] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
})
afterEach(() => fechar())

describe('GGVP-132 · o roteiro de laudos no servidor (GGVP-93)', () => {
  it('CA1 · a lista traz a régua do escritório, com a versão 1 e os benefícios de cada roteiro', async () => {
    const r = await ver('gabi')
    expect(r.statusCode).toBe(200)
    const loas = r.json().find((x: { id: string }) => x.id === 'loas-deficiente')
    expect([loas.nome, loas.beneficios, loas.laudo, loas.versoes.length]).toEqual(['BPC/LOAS Deficiente', ['loas-deficiente'], true, 1])
    expect((await ver('gabi', '/api/roteiros/nao-existe')).statusCode).toBe(404)
  })

  it('CA2 · a sênior salva a versão 2 com autor e data; a 1 fica, e o histórico registra sem o conteúdo', async () => {
    const r = await salvar('helena', ITENS)
    expect(r.statusCode).toBe(201)
    const versoes = r.json().versoes
    expect(versoes.map((v: { versao: number; autor: string }) => [v.versao, v.autor])).toEqual([
      [1, 'Escritório (roteiro de laudos, 26/09)'],
      [2, 'Helena'],
    ])
    expect(versoes[1].itens).toEqual(ITENS)
    expect((await salvar('helena', ITENS)).json().versoes.at(-1).versao).toBe(3)
    const [evento] = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'roteiro_versao_salva')
    expect([evento.alvo, evento.detalhe]).toEqual(['roteiro:loas-deficiente', expect.objectContaining({ versao: 2 })])
  })

  it('CA2 · só a sênior edita: a advogada e o Atendimento recebem 403; o Financeiro nem vê o roteiro', async () => {
    for (const quem of ['gabi', 'ana']) {
      const r = await salvar(quem, ITENS)
      expect([r.statusCode, r.json().erro]).toEqual([403, MSG_SEM_PERMISSAO])
    }
    expect((await ver('julia')).statusCode).toBe(403)
    expect((await ver('gabi', '/api/roteiros/loas-deficiente')).json().versoes).toHaveLength(1)
  })

  it('o servidor confere de novo: sem obrigatório ou com tipo fora da lista, não salva', async () => {
    const semObrigatorio = await salvar('helena', [ITENS[1]])
    expect([semObrigatorio.statusCode, semObrigatorio.json().erro]).toEqual([400, 'O roteiro precisa de pelo menos um item obrigatório.'])
    expect((await salvar('helena', [{ ...ITENS[0], tipo: 'outro' }])).statusCode).toBe(400)
  })
})
