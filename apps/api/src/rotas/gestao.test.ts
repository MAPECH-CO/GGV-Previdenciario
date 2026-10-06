import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const tentativas = async (apelido: string) => app.inject({ method: 'GET', url: '/api/gestao/tentativas', cookies: await cookieDe(apelido) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['helena', 'senior'], ['gabi', 'advogada'], ['ana', 'atendimento'], ['julia', 'financeiro']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
  casoId = c.id
})

afterEach(async () => {
  await app.close()
  await fechar()
})

describe('tentativas bloqueadas (GGVP-109)', () => {
  it('CA1, CA9 · a ação fora do perfil, pela API, fica registrada com o caso e aparece para a gestão', async () => {
    const r = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/peticao/pedido`, cookies: await cookieDe('ana'), payload: {} })
    expect(r.statusCode).toBe(403)
    const lista = (await tentativas('helena')).json().tentativas
    expect(lista).toEqual([
      { quando: expect.any(String), quem: 'ana', perfil: 'atendimento', casoId, cliente: 'Vera Lúcia', portao: 'perfil', descricao: 'Ação fora do perfil (peticao.pedir)' },
    ])
  })

  it('CA9 · a recusa de portão aparece com o que a pessoa tentou, das mais recentes para as mais antigas', async () => {
    const antes = new Date('2026-10-05T12:00:00Z')
    await banco.insert(eventoAuditoria).values([
      { quem: ids.ana, acao: 'portao_bloqueado', alvo: `caso:${casoId}`, quando: antes, detalhe: { portao: 'G8', passo: 'D3b.03', perfil: 'atendimento' } },
      { quem: ids.gabi, acao: 'portao_bloqueado', alvo: `caso:${casoId}`, detalhe: { portao: 'G21', passo: 'D3a.04', perfil: 'advogada', faltam: 2 } },
      { quem: ids.gabi, acao: 'peticao_pedida', alvo: `caso:${casoId}`, detalhe: {} },
    ])
    const lista = (await tentativas('julia')).json().tentativas
    expect(lista.map((t: { quem: string; descricao: string }) => [t.quem, t.descricao])).toEqual([
      ['gabi', 'Manifestar no processo sem prova em todos os itens (G21)'],
      ['ana', 'Avisar o cliente antes do OK da advogada na prestação de contas (G8)'],
    ])
  })

  it('CA9 · só a gestão vê as tentativas', async () => {
    expect((await tentativas('gabi')).statusCode).toBe(403)
  })
})
