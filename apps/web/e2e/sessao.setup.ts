import { test as setup } from '@playwright/test'
import { SESSAO } from '../playwright.config.ts'
import { entrarPelaApi } from './entrar.ts'

// Entra uma vez com o usuário de exemplo do Atendimento e guarda o cookie da sessão para os testes das telas.
setup('entrar com o usuário de exemplo', async ({ page }) => {
  await entrarPelaApi(page)
  await page.context().storageState({ path: SESSAO })
})
