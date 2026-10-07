import { PERFIS } from '@ggv/contratos'
import bcrypt from 'bcryptjs'
import { count, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from './conexao.ts'
import { configuracao, usuario } from './esquema.ts'
import { SENHA_DE_EXEMPLO, usuariosDeExemplo } from './exemplo.ts'
import { prepararHomologacao } from './homologacao.ts'

const HOMOLOGACAO = { AMBIENTE: 'homologacao' }
let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  // A homologação já tem o usuário de quem cuida dela (o do Mateus, criado com `usuario:criar`).
  await banco.insert(usuario).values({ email: 'quem-cuida@exemplo.ggv', nome: 'Quem cuida (exemplo)', senhaHash: 'x', perfis: ['socio'] })
})
afterEach(() => fechar())

const usuarios = async () => (await banco.select({ total: count() }).from(usuario))[0].total
const limites = async () => Object.fromEntries((await banco.select().from(configuracao)).map((c) => [c.chave, c.valor]))

describe('homologação com usuários e dados de teste (GGVP-126)', () => {
  it('CA5 · fora da homologação, recusa e não grava nada', async () => {
    for (const ambiente of [{}, { AMBIENTE: 'producao' }])
      await expect(prepararHomologacao(banco, ambiente)).rejects.toThrow('Recusado: os dados de teste só entram com AMBIENTE=homologacao')
    expect([await usuarios(), await limites()]).toEqual([1, {}])
  })

  it('CA1, CA3 · a semente dos testes roda mesmo com outro usuário no banco; cada usuário de exemplo tem senha provisória própria, e a pública não vale', async () => {
    const credenciais = await prepararHomologacao(banco, HOMOLOGACAO)
    expect(credenciais.map((c) => c.email)).toEqual(usuariosDeExemplo.map((u) => u.email))
    expect(PERFIS.filter((p) => !credenciais.some((c) => c.perfis.includes(p)))).toEqual([])
    expect(new Set(credenciais.map((c) => c.senha)).size).toBe(credenciais.length)
    for (const c of credenciais) {
      const [u] = await banco.select().from(usuario).where(eq(usuario.email, c.email))
      expect([u.trocarSenha, await bcrypt.compare(c.senha, u.senhaHash), await bcrypt.compare(SENHA_DE_EXEMPLO, u.senhaHash)], c.email).toEqual([true, true, false])
    }
  })

  it('CA2 · grava os limites de cobrança do Lucas: 2 tentativas, 3 dias entre elas', async () => {
    await prepararHomologacao(banco, HOMOLOGACAO)
    const l = await limites()
    expect([l['cobranca.limite'], l['cobranca.intervalo_dias']]).toEqual([2, 3])
  })

  it('CA2 · o que o escritório já tinha configurado fica, mesmo com a semente gravando a configuração de exemplo', async () => {
    await banco.insert(configuracao).values({ chave: 'cobranca.limite', valor: 4 })
    await prepararHomologacao(banco, HOMOLOGACAO)
    const l = await limites()
    expect([l['cobranca.limite'], l['cobranca.intervalo_dias']]).toEqual([4, 3])
  })

  it('CA4 · rodar de novo não duplica nada e não troca a senha já entregue', async () => {
    await prepararHomologacao(banco, HOMOLOGACAO)
    const antes = { usuarios: await usuarios(), limites: await limites(), hashes: await banco.select({ email: usuario.email, senhaHash: usuario.senhaHash }).from(usuario) }
    expect(await prepararHomologacao(banco, HOMOLOGACAO)).toEqual([])
    expect({ usuarios: await usuarios(), limites: await limites(), hashes: await banco.select({ email: usuario.email, senhaHash: usuario.senhaHash }).from(usuario) }).toEqual(antes)
  })
})
