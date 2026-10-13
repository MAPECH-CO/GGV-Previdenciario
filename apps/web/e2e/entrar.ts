import type { APIRequestContext, Page } from '@playwright/test'

// Usuários e senha de exemplo do banco local (apps/api/src/banco/exemplo.ts). Nenhum é real.
export const SENHA_DE_EXEMPLO = 'exemplo-ggv-2026'
export const ATENDIMENTO = 'atendimento@exemplo.ggv'
/** As telas do Jurídico (preparar, analisar, entrevistar, cadastrar o lead, definir o benefício) pedem o perfil (GGVP-135). */
export const ADVOGADA = 'advogada@exemplo.ggv'

/** Entra pela API, sem passar pela tela: para os testes que começam já logados. */
export async function entrarPelaApi(page: Page, email = ATENDIMENTO) {
  await entrarComo(page.request, email)
}

/** O mesmo login, para quem só chama a API (sem página): o contexto guarda o cookie da sessão. */
export async function entrarComo(request: APIRequestContext, email = ATENDIMENTO) {
  const r = await request.post('/api/sessao', { data: { email, senha: SENHA_DE_EXEMPLO } })
  if (!r.ok()) throw new Error(`login de exemplo falhou: ${r.status()}`)
}
