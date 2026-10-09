import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-78 · Clientes e Processos pelo topo (Figma 1927:605 e 1927:888), com os dados de exemplo do banco: cada teste
// chega por clique, sem digitar o endereço da lista.

test('o líder do Atendimento chega a Clientes pelo topo, acha o cliente, abre os processos dele e volta à ficha', async ({ page }) => {
  await entrarPelaApi(page, 'lider@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Clientes' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clientes')

  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('Renato Dias')
  const clientes = page.getByRole('table', { name: 'Clientes' })
  await expect(clientes.getByRole('row')).toHaveCount(2)
  await expect(clientes.getByRole('row').nth(1)).toContainText('Êxito')

  await clientes.getByRole('link', { name: '1 processo de Renato Dias (exemplo)' }).click()
  await expect(page).toHaveURL(/\/processos\?cliente=[0-9a-f-]{36}$/)
  const processos = page.getByRole('table', { name: 'Processos' })
  await expect(processos.getByRole('row')).toHaveCount(2)
  await expect(processos.getByRole('row').nth(1)).toContainText('LOAS Deficiente')

  await processos.getByRole('link', { name: 'Renato Dias (exemplo)' }).click()
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
})

test('a advogada acha o processo pelo número em Processos e abre a página dele', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Processos' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Processos')

  await page.getByRole('searchbox', { name: 'Autor, nº do processo ou CPF' }).fill('0005678-75.2026')
  const processos = page.getByRole('table', { name: 'Processos' })
  await expect(processos.getByRole('row')).toHaveCount(2)
  await processos.getByRole('link', { name: '0005678-75.2026.4.03.6301' }).click()
  await expect(page).toHaveURL(/\/casos\/[0-9a-f-]{36}$/)
  await expect(page).toHaveTitle('Rosa Amaral (exemplo) · Processo · GGV Previdenciário')
})

test('o Atendimento só tem a Agenda no topo; o Financeiro, que não vê o caso, não abre a lista', async ({ page }) => {
  await page.goto('/')
  const topo = page.getByRole('navigation', { name: 'Principal' })
  await expect(topo.getByRole('link', { name: 'Agenda' })).toBeVisible()
  await expect(topo.getByRole('link', { name: 'Clientes' })).toHaveCount(0)

  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  await page.goto('/clientes')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sem permissão')
})
