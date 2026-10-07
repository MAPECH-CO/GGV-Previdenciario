import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-96 · Perfis e permissões, com a API de verdade e os usuários de exemplo.

test('CA10 · "Entrar como…" mostra só os perfis da pessoa e troca de Central', async ({ page }) => {
  await entrarPelaApi(page, 'lider@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('button', { name: 'Atendimento · líder' }).click()
  await expect(page.getByRole('menuitemradio')).toHaveText(['Atendimento · líder', 'Atendimento'])
  await page.getByRole('menuitemradio', { name: 'Atendimento', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Atendimento', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
})

test('CA10 · o servidor recusa trocar para um perfil que não é da pessoa', async ({ page }) => {
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  const r = await page.request.post('/api/sessao/perfil', { data: { perfil: 'senior' } })
  expect(r.status()).toBe(403)
  expect(await r.json()).toEqual({ erro: 'Esse perfil não é seu.' })
})

test('cada perfil cai na sua Central: a da Sênior ainda não foi construída', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Central · Sênior' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sênior' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL('/entrar')
})
