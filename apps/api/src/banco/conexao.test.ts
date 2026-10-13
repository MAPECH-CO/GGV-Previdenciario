import { describe, expect, it } from 'vitest'
import { abrirBanco, MSG_PRODUCAO_SEM_BANCO } from './conexao.ts'
import { usuario } from './esquema.ts'

describe('GGVP-158 · produção não sobe sem banco', () => {
  it('em produção, sem DATABASE_URL, recusa antes de abrir o banco embutido', async () => {
    await expect(abrirBanco(undefined, true)).rejects.toThrow(MSG_PRODUCAO_SEM_BANCO)
  })

  it('fora de produção, sem DATABASE_URL, segue o banco embutido com os usuários de exemplo', async () => {
    const { banco, fechar } = await abrirBanco(undefined, false)
    try {
      expect((await banco.select().from(usuario)).length).toBeGreaterThan(0)
    } finally {
      await fechar()
    }
  })
})
