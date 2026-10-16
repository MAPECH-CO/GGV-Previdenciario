import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, pessoa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_RESUMO_DA_TAREFA } from './resumo-da-tarefa.ts'

const SENHA = 'senha-do-portal-1'
const RESUMO = 'O cliente não respondeu às duas cobranças. Decida se vale uma nova tentativa ou se o caso para.'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let enviados: string[]

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const resumir = async (apelido: string, payload: object) => app.inject({ method: 'POST', url: '/api/tarefas/resumo', cookies: await cookieDe(apelido), payload })
const comIa = (texto: string) => {
  enviados = []
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    enviados.push(String(init?.body))
    return new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }))
  }
  app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste' }, fetch }) })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['helena', 'senior'], ['julia', 'financeiro']] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Antônio Exemplo', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
})
afterEach(async () => {
  await app.close()
  await fechar()
})

const TAREFA = { acao: 'Decidir cobrança', detalhe: '2 tentativas sem resposta · passou do limite', prazo: 'hoje', urgente: true }

describe('o balão da tarefa (Pedro, 16/10): a IA explica a tarefa', () => {
  it('a IA recebe a tarefa com o benefício e a fase do caso; a mesma tarefa de novo não chama a IA outra vez', async () => {
    comIa(RESUMO)
    const r = (await resumir('helena', { ...TAREFA, casoId })).json()
    expect([r.sugestao.texto, r.motivo]).toEqual([RESUMO, null])
    expect(enviados[0]).toContain('Tarefa: Decidir cobrança')
    expect(enviados[0]).toContain('Prazo: hoje (urgente)')
    expect(enviados[0]).toContain('Benefício: BPC/LOAS Idoso')
    expect(enviados[0]).toContain('Antônio Exemplo')
    await resumir('helena', { ...TAREFA, casoId })
    expect(enviados).toHaveLength(1)
  })

  it('quem não vê o caso (o Financeiro) recebe o resumo só com o que a linha mostra', async () => {
    comIa(RESUMO)
    expect((await resumir('julia', { ...TAREFA, casoId })).json().sugestao.texto).toBe(RESUMO)
    expect(enviados[0]).toContain('Tarefa: Decidir cobrança')
    expect(enviados[0]).not.toContain('Antônio Exemplo')
    expect(enviados[0]).not.toContain('LOAS')
  })

  it('sem a IA ou com código de doença na saída, não há resumo e a tela diz que a IA não resumiu', async () => {
    expect((await resumir('helena', TAREFA)).json()).toEqual({ sugestao: null, motivo: MSG_SEM_RESUMO_DA_TAREFA })
    comIa('O laudo fala em M54.5, então decida a cobrança.')
    expect((await resumir('helena', { ...TAREFA, casoId })).json()).toEqual({ sugestao: null, motivo: MSG_SEM_RESUMO_DA_TAREFA })
  })

  it('tarefa sem ação é recusada', async () => {
    expect((await resumir('helena', { acao: ' ' })).statusCode).toBe(400)
  })
})
