import { expect, test } from '@playwright/test'
import { ATENDIMENTO, SENHA_DE_EXEMPLO } from './entrar.ts'

// GGVP-117 · Entrar no portal com e-mail e senha. Cada teste usa o banco limpo da API de teste (usuários de exemplo).

async function preencher(page: import('@playwright/test').Page, email: string, senha: string) {
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test('CA1 e CA3 · sem sessão vai ao login; depois de entrar, volta para a tela pedida; Sair encerra', async ({ page }) => {
  // A Central da Sênior ainda não existe: a volta do login leva a ela, e ela avisa que não foi construída.
  await page.goto('/senior')
  await expect(page).toHaveURL(/\/entrar\?volta=%2Fsenior/)
  await preencher(page, ATENDIMENTO, SENHA_DE_EXEMPLO)
  await expect(page).toHaveURL('/senior')
  await expect(page.getByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL('/entrar')
  await page.goto('/')
  await expect(page).toHaveURL(/\/entrar/)
})

test('CA3 · sessão que caiu manda ao login avisando que expirou, e volta para a mesma tela', async ({ page, context }) => {
  await page.goto('/entrar')
  await preencher(page, ATENDIMENTO, SENHA_DE_EXEMPLO)
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  // A Central termina de carregar antes: uma chamada que voltasse 401 depois levaria ao login e cortaria o goto abaixo.
  await page.waitForLoadState('networkidle')
  await context.clearCookies() // a sessão some como se tivesse vencido
  await page.goto('/agenda')
  await expect(page.getByRole('status')).toContainText('Sua sessão expirou')
  await preencher(page, ATENDIMENTO, SENHA_DE_EXEMPLO)
  await expect(page).toHaveURL('/agenda')
})

test('CA2 · senha errada: mensagem única, sem dizer qual campo; a 5ª trava, até com a senha certa', async ({ page }) => {
  const TRAVA = 'trava@exemplo.ggv' // usuário só deste teste: a trava não atrapalha os outros
  await page.goto('/entrar')
  await preencher(page, 'ninguem@exemplo.ggv', 'qualquer')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
  for (let i = 1; i <= 4; i++) {
    await preencher(page, TRAVA, `errada-${i}`)
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.')
  }
  await preencher(page, TRAVA, 'errada-5')
  await expect(page.getByRole('alert')).toContainText('Conta travada por 15 minutos')
  await preencher(page, TRAVA, SENHA_DE_EXEMPLO)
  await expect(page.getByRole('alert')).toContainText('Conta travada')
})

test('CA4 · sem perfil vê o aviso e nenhuma tela de caso', async ({ page }) => {
  await page.goto('/entrar')
  await preencher(page, 'semperfil@exemplo.ggv', SENHA_DE_EXEMPLO)
  await expect(page.getByRole('heading', { name: 'Sem perfil, fale com a gestão.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toHaveCount(0)
})

test('CA1 · senha provisória obriga a trocar antes de entrar', async ({ page }) => {
  await page.goto('/entrar')
  await preencher(page, 'provisoria@exemplo.ggv', SENHA_DE_EXEMPLO)
  await expect(page.getByRole('heading', { name: 'Crie a sua senha' })).toBeVisible()
  await page.getByLabel('Nova senha', { exact: true }).fill('curta')
  await page.getByLabel('Repita a nova senha').fill('curta')
  await page.getByRole('button', { name: 'Salvar e continuar' }).click()
  await expect(page.getByRole('alert')).toContainText('pelo menos 8 caracteres')
  await page.getByLabel('Nova senha', { exact: true }).fill('minha-senha-nova')
  await page.getByLabel('Repita a nova senha').fill('minha-senha-nova')
  await page.getByRole('button', { name: 'Salvar e continuar' }).click()
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
})
