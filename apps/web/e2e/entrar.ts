import type { Page } from '@playwright/test'

// Usuários e senha de exemplo do banco local (apps/api/src/banco/exemplo.ts). Nenhum é real.
export const SENHA_DE_EXEMPLO = 'exemplo-ggv-2026'
export const ATENDIMENTO = 'atendimento@exemplo.ggv'

/** Entra pela API, sem passar pela tela: para os testes que começam já logados. */
export async function entrarPelaApi(page: Page, email = ATENDIMENTO) {
  const r = await page.request.post('/api/sessao', { data: { email, senha: SENHA_DE_EXEMPLO } })
  if (!r.ok()) throw new Error(`login de exemplo falhou: ${r.status()}`)
}
