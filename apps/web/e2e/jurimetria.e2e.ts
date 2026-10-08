import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// Jurimetria (GGVP-15). Usuários e casos de exemplo do banco local; nenhum é real. Os outros testes podem decidir casos
// no mesmo banco, então as contas aqui conferem a forma, não o número exato.

test('GGVP-75 · o Sócio abre os resultados pelo topo: os indicadores com os casos, a extinção com a causa, os totais e o recorte', async ({ page }) => {
  await entrarPelaApi(page, 'socio@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Resultados' }).click()
  await expect(page.getByRole('heading', { name: 'Resultados do escritório' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Indicadores do escritório' })).toContainText(/Deferimento no INSS: \d+% em \d+ casos · base de \d{2}\/\d{2}\/\d{4}/)
  await expect(page.getByRole('list', { name: 'Extinções por causa' })).toContainText('Não cumpriu determinação do juízo (exemplo)')
  await expect(page.getByRole('list', { name: 'Valores do escritório' })).toContainText(/Honorários recebidos: R\$ [\d.]+,\d{2}/)

  await page.getByLabel('Recorte', { exact: true }).selectOption('beneficio')
  await page.getByRole('button', { name: 'Ver resultados' }).click()
  // G22 de 07/10: sem amostra mínima, o grupo com poucos casos também mostra a taxa, com os casos e a data da base.
  await expect(page.getByRole('list', { name: 'BPC/LOAS Deficiente' })).toContainText(/Deferimento no INSS: \d+% em \d+ casos · base de/)
  await expect(page.getByRole('list', { name: 'Aposentadoria da Pessoa com Deficiência' })).toContainText(/Deferimento no INSS: \d+% em \d casos? · base de/)
})

test('GGVP-75 · a Sênior vê o painel, sem os totais em dinheiro', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/gestao/resultados')
  await expect(page.getByRole('list', { name: 'Indicadores do escritório' })).toContainText('Deferimento no INSS')
  await expect(page.getByRole('list', { name: 'Raio-X Previdenciário' }).getByRole('listitem')).toHaveCount(6)
  await expect(page.getByRole('list', { name: 'Valores do escritório' })).toHaveCount(0)
  await expect(page.getByText(/R\$/)).toHaveCount(0)
})

test('GGVP-55 · a Sênior abre "Conferir desfechos do lote" pela Central, confere um e corrige outro; a Gestão mostra a base do acervo', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: /Conferir desfechos do lote/ }).click()
  await expect(page.getByRole('heading', { name: 'Conferir desfechos do lote' })).toBeVisible()
  const lista = page.getByRole('list', { name: 'Desfechos para conferir' })

  await lista.getByRole('listitem').filter({ hasText: '0001123-45.2018.4.03.6301' }).getByRole('button', { name: 'Confere' }).click()
  await expect(page.getByRole('status')).toHaveText('Desfecho conferido.')

  const outro = lista.getByRole('listitem').filter({ hasText: '0004512-33.2019.4.03.6301' })
  await outro.getByRole('button', { name: 'Corrigir' }).click()
  await outro.getByLabel('Desfecho correto').selectOption('extinto_sem_merito')
  await outro.getByRole('button', { name: 'Salvar a correção' }).click()
  await expect(page.getByRole('status')).toHaveText('Desfecho corrigido para Extinto sem mérito.')
  await expect(lista.getByRole('listitem')).toHaveCount(2)

  await page.goto('/gestao/resultados')
  await expect(page.getByText(/\d+ processos · \d+ conferidos, nas contas · \d+ aguardando conferência, fora das contas · base de 02\/10\/2026/)).toBeVisible()
})
