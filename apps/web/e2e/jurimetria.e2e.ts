import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// Jurimetria (GGVP-15). Usuários e casos de exemplo do banco local; nenhum é real. Os outros testes podem decidir casos
// no mesmo banco, então as contas aqui conferem a forma, não o número exato.

test('GGVP-75 · o Sócio abre os resultados pelo topo: os indicadores com os casos, a extinção com a causa, os totais e o recorte', async ({ page }) => {
  await entrarPelaApi(page, 'socio@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Resultados' }).click()
  await expect(page.getByRole('heading', { name: 'Resultados do escritório' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Indicadores do escritório' })).toContainText(/Deferimento no INSS: \d+% · \d+ casos/)
  await expect(page.getByRole('list', { name: 'Extinções por causa' })).toContainText('Não cumpriu determinação do juízo (exemplo)')
  await expect(page.getByRole('list', { name: 'Valores do escritório' })).toContainText(/Honorários recebidos: R\$ [\d.]+,\d{2}/)

  await page.getByLabel('Recorte', { exact: true }).selectOption('beneficio')
  await page.getByRole('button', { name: 'Ver resultados' }).click()
  await expect(page.getByRole('list', { name: 'BPC/LOAS Deficiente' })).toContainText(/Deferimento no INSS: \d+% · \d+ casos/)
  await expect(page.getByRole('list', { name: 'Aposentadoria da Pessoa com Deficiência' })).toContainText(/Deferimento no INSS: amostra insuficiente · \d casos?/)
})

test('GGVP-75 · a Sênior vê o painel, sem os totais em dinheiro', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/gestao/resultados')
  await expect(page.getByRole('list', { name: 'Indicadores do escritório' })).toContainText('Deferimento no INSS')
  await expect(page.getByRole('list', { name: 'Raio-X Previdenciário' }).getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('list', { name: 'Valores do escritório' })).toHaveCount(0)
  await expect(page.getByText(/R\$/)).toHaveCount(0)
})
