import { expect, test } from '@playwright/test'
import { ADVOGADA, ATENDIMENTO, entrarPelaApi, trocarDeUsuario } from './entrar.ts'

// GGVP-163 R5 · a base histórica por benefício, com a API de verdade. O banco dos testes não tem o schema `conhecimento`:
// a página abre para o Jurídico e diz que não há base; o Atendimento não abre, nem pela tela nem pela API.
test('a advogada abre a base histórica do benefício; sem a base carregada, a página diz; o Atendimento não abre', async ({ page }) => {
  await entrarPelaApi(page, ADVOGADA)
  await page.goto('/estudos')
  await page.getByRole('link', { name: /Base histórica por benefício/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Base histórica' })).toBeVisible()
  await page.getByRole('link', { name: 'BPC/LOAS Deficiente' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Base histórica · BPC/LOAS Deficiente' })).toBeVisible()
  await expect(page.getByText('Sem base histórica carregada: nada a mostrar ainda.')).toBeVisible()
  expect((await page.request.get('/api/base-historica/bpc_loas_deficiente')).status()).toBe(200)

  await trocarDeUsuario(page, ATENDIMENTO)
  await page.goto('/beneficios/bpc_loas_deficiente')
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible()
  expect((await page.request.get('/api/base-historica/bpc_loas_deficiente')).status()).toBe(403)
})
