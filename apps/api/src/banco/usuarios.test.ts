import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from './conexao.ts'
import { eventoAuditoria, usuario } from './esquema.ts'
import { criarUsuario, destravarUsuario } from './usuarios.ts'

let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => ({ banco, fechar } = await abrirBancoEmbutido()))
afterEach(() => fechar())

describe('usuario:criar', () => {
  it('cria com senha provisória só como hash e troca obrigatória', async () => {
    const senha = await criarUsuario(banco, 'Dani@Exemplo.ggv', 'Dani', 'atendimento')
    const [u] = await banco.select().from(usuario).where(eq(usuario.email, 'dani@exemplo.ggv'))
    expect(u.trocarSenha).toBe(true)
    expect(u.senhaHash).not.toContain(senha)
    expect(await bcrypt.compare(senha, u.senhaHash)).toBe(true)
  })

  it('recusa e-mail inválido', async () => {
    await expect(criarUsuario(banco, 'dani@', 'Dani', null)).rejects.toThrow('E-mail inválido')
  })
})

describe('usuario:destravar', () => {
  it('zera a trava na hora e registra quem destravou', async () => {
    await criarUsuario(banco, 'dani@exemplo.ggv', 'Dani', 'atendimento')
    await banco.update(usuario).set({ tentativasErradas: 3, travadoAte: new Date('2099-01-01') })
    await destravarUsuario(banco, 'dani@exemplo.ggv', 'gestao@exemplo.ggv')
    const [u] = await banco.select().from(usuario)
    expect([u.tentativasErradas, u.travadoAte]).toEqual([0, null])
    const [e] = await banco.select().from(eventoAuditoria)
    expect([e.quem, e.acao, e.alvo]).toEqual(['gestao@exemplo.ggv', 'destravar', `usuario:${u.id}`])
  })
})
