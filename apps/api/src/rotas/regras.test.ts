import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const calcular = async (apelido: string, regra: string, payload: object) =>
  app.inject({ method: 'POST', url: `/api/regras/${regra}`, cookies: await cookieDe(apelido), payload })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  // 06/10/2026 ao meio-dia em Brasília: a data de referência do cálculo.
  app = criarServidor({ banco, agora: () => new Date('2026-10-06T15:00:00Z') })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['ana', 'atendimento']] as const) {
    await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
})

afterEach(async () => {
  await app.close()
  await fechar()
})

describe('POST /api/regras/:regra (GGVP-25)', () => {
  it('CA6 · devolve o resultado com as entradas usadas, a regra, o fundamento, a versão e o dia de referência', async () => {
    const r = await calcular('gabi', 'loas_24_meses', { inicio: '10/03/2024', persiste: true })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      regra: 'loas_24_meses',
      versao: 1,
      hoje: '2026-10-06',
      entradas: { inicio: '2024-03-10', persiste: true },
      atende: true,
      resumo: '30 meses: alcança os 24 meses',
    })
  })

  it('CA4 · sem o dado, "não calculável"; data em formato errado é recusada; regra que não existe, 404', async () => {
    expect((await calcular('gabi', 'dii_carencia_qualidade', {})).json()).toMatchObject({ atende: null, resumo: expect.stringMatching(/^Não calculável: falta /) })
    expect((await calcular('gabi', 'dii_carencia_qualidade', { dii: '2026-08-15' })).json().erro).toBe('Informe a data de início da incapacidade (DII) (dd/mm/aaaa)')
    expect((await calcular('gabi', 'sem_regra', {})).statusCode).toBe(404)
  })

  it('só quem confere a documentação médica calcula', async () => {
    expect((await calcular('ana', 'loas_24_meses', {})).statusCode).toBe(403)
  })
})
