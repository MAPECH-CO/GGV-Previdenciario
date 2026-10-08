import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, etapa, pericia, pessoa, usuario } from '../banco/esquema.ts'
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
const fluxo = async (apelido = 'gabi', id = casoId) => app.inject({ method: 'GET', url: `/api/casos/${id}/fluxo`, cookies: await cookieDe(apelido) })
const em = (hora: number) => new Date(Date.UTC(2026, 9, 6, hora))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-07T15:00:00Z') })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['julia', 'financeiro']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-105 CA2, CA7 · o estado do fluxo do caso', () => {
  it('cada passo com o diagrama, a situação, a junção e por quem espera; as perícias com o passo que chamou', async () => {
    const [decisao] = await banco
      .insert(etapa)
      .values({ casoId, diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', iniciadaEm: em(10), concluidaEm: em(11), concluidaPor: ids.gabi })
      .returning()
    await banco.insert(etapa).values([
      { casoId, diagrama: 'D2', passo: 'D2.02', situacao: 'concluida', juncao: 'D2', iniciadaEm: em(12), concluidaEm: em(13) },
      { casoId, diagrama: 'D2', passo: 'D2.E1', situacao: 'aguardando_externo', juncao: 'D2', aguardando: 'INSS liberar o agendamento da perícia', iniciadaEm: em(14) },
    ])
    await banco.insert(pericia).values({ casoId, tipo: 'medica', chamadaPorEtapaId: decisao.id })

    const r = await fluxo()
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      casoId,
      fase: 'administrativa',
      passos: [
        { diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', juncao: null, aguardando: null, iniciadaEm: em(10).toISOString(), concluidaEm: em(11).toISOString() },
        { diagrama: 'D2', passo: 'D2.02', situacao: 'concluida', juncao: 'D2', aguardando: null, iniciadaEm: em(12).toISOString(), concluidaEm: em(13).toISOString() },
        { diagrama: 'D2', passo: 'D2.E1', situacao: 'aguardando_externo', juncao: 'D2', aguardando: 'INSS liberar o agendamento da perícia', iniciadaEm: em(14).toISOString(), concluidaEm: null },
      ],
      pericias: [{ tipo: 'medica', chamadaPor: 'D2 · D2.03', resultado: null }],
    })
  })

  it('CA10 · cada passo que abre, espera ou conclui vira evento do histórico, gravado pelo banco', async () => {
    const [e] = await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aberta', iniciadaEm: em(9) }).returning()
    await banco.update(etapa).set({ aguardando: 'INSS decidir' }).where(eq(etapa.id, e.id)) // sem mudar a situação: nada
    await banco.update(etapa).set({ situacao: 'concluida', concluidaEm: em(16), concluidaPor: ids.gabi }).where(eq(etapa.id, e.id))
    const linha = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/historico`, cookies: await cookieDe('gabi') })).json().eventos
    expect(linha).toEqual([
      { quando: em(9).toISOString(), quem: 'Sistema', origem: 'sistema', passo: 'D2.04', descricao: 'Passo aberto' },
      { quando: em(16).toISOString(), quem: 'gabi', origem: 'pessoa', passo: 'D2.04', descricao: 'Passo concluído' },
    ])
  })

  it('só quem vê o caso consulta; caso que não existe é 404', async () => {
    expect((await fluxo('julia')).statusCode).toBe(403)
    expect((await fluxo('gabi', '00000000-0000-4000-8000-000000000000')).statusCode).toBe(404)
    await banco.update(caso).set({ fase: 'judicial' }).where(eq(caso.id, casoId))
    expect((await fluxo()).json()).toMatchObject({ fase: 'judicial', passos: [], pericias: [] })
  })
})
