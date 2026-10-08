import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from './conexao.ts'
import { eventoAuditoria, usuario } from './esquema.ts'
import { criarUsuario, definirPerfis, destravarUsuario } from './usuarios.ts'

let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => ({ banco, fechar } = await abrirBancoEmbutido()))
afterEach(() => fechar())

describe('usuario:criar', () => {
  it('cria com senha provisória só como hash e troca obrigatória', async () => {
    const senha = await criarUsuario(banco, 'Dani@Exemplo.ggv', 'Dani', ['atendimento'])
    const [u] = await banco.select().from(usuario).where(eq(usuario.email, 'dani@exemplo.ggv'))
    expect(u.trocarSenha).toBe(true)
    expect(u.senhaHash).not.toContain(senha)
    expect(await bcrypt.compare(senha, u.senhaHash)).toBe(true)
  })

  it('recusa e-mail inválido', async () => {
    await expect(criarUsuario(banco, 'dani@', 'Dani', [])).rejects.toThrow('E-mail inválido')
  })
})

describe('usuario:destravar', () => {
  it('zera a trava na hora e registra quem destravou', async () => {
    await criarUsuario(banco, 'dani@exemplo.ggv', 'Dani', ['atendimento'])
    await banco.update(usuario).set({ tentativasErradas: 3, travadoAte: new Date('2099-01-01') })
    await destravarUsuario(banco, 'dani@exemplo.ggv', 'gestao@exemplo.ggv')
    const [u] = await banco.select().from(usuario)
    expect([u.tentativasErradas, u.travadoAte]).toEqual([0, null])
    const [e] = await banco.select().from(eventoAuditoria)
    expect([e.quem, e.acao, e.alvo]).toEqual(['gestao@exemplo.ggv', 'destravar', `usuario:${u.id}`])
  })
})

describe('usuario:perfis (GGVP-96)', () => {
  it('CA3 · só um Sócio atribui, e o antes e o depois vão para o histórico', async () => {
    await criarUsuario(banco, 'dani@exemplo.ggv', 'Dani', ['atendimento'])
    await criarUsuario(banco, 'lauro@exemplo.ggv', 'Lauro', ['socio'])
    await criarUsuario(banco, 'eva@exemplo.ggv', 'Eva', ['atendimento_lider'])

    await expect(definirPerfis(banco, 'dani@exemplo.ggv', ['senior'], 'eva@exemplo.ggv')).rejects.toThrow('Só um Sócio')
    await expect(definirPerfis(banco, 'dani@exemplo.ggv', ['admin'], 'lauro@exemplo.ggv')).rejects.toThrow('Perfil que não existe')

    await definirPerfis(banco, 'dani@exemplo.ggv', ['atendimento', 'documentacao'], 'lauro@exemplo.ggv')
    const [dani] = await banco.select().from(usuario).where(eq(usuario.email, 'dani@exemplo.ggv'))
    const [lauro] = await banco.select().from(usuario).where(eq(usuario.email, 'lauro@exemplo.ggv'))
    expect(dani.perfis).toEqual(['atendimento', 'documentacao'])
    const [e] = await banco.select().from(eventoAuditoria)
    expect([e.quem, e.acao, e.detalhe]).toEqual([lauro.id, 'perfis_alterados', { antes: ['atendimento'], depois: ['atendimento', 'documentacao'] }])
  })

  it('o banco recusa perfil fora da matriz mesmo se o código errar', async () => {
    await criarUsuario(banco, 'dani@exemplo.ggv', 'Dani', ['atendimento'])
    await expect(banco.update(usuario).set({ perfis: ['admin'] })).rejects.toThrow()
  })
})
