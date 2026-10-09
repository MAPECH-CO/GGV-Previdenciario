import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-78 · as Centrais da Sênior (Figma 59:609) e do Financeiro (59:863), o painel Financeiro (1930:4) e a tela inicial do
// Sócio (o painel de resultado, GGVP-75), com os usuários de exemplo do banco. Cada teste chega por clique.

test('a Sênior cai na Central dela: a busca, o chat, as abas do setor e os atalhos de hoje no topo', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Início da Sênior' })).toBeAttached()
  await expect(page.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'O que estourou o limite?' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Minhas tarefas/ })).toBeVisible()
  await page.getByRole('tab', { name: /^Tarefas do setor/ }).click()
  const topo = page.getByRole('navigation', { name: 'Principal' })
  await expect(topo.getByRole('link', { name: /Roteiros de laudos/ })).toBeVisible()
  await expect(topo.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)

  await page.goto('/financeiro')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sem permissão')
})

test('o Financeiro cai na Central dele e abre o painel Financeiro pelo topo: os cartões, os gráficos e os lançamentos', async ({ page }) => {
  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Início do Financeiro' })).toBeAttached()
  await expect(page.getByRole('button', { name: 'Prestações recebidas' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Financeiro' }).click()
  await expect(page).toHaveURL('/financeiro')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Financeiro')
  await expect(page.getByRole('list', { name: 'Indicadores do mês' })).toContainText('Recebido no mês')
  await expect(page.getByRole('region', { name: /^Receita por mês/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Por origem · últimos 12 meses' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Prestações de contas pendentes' })).toBeVisible()
  // A Vera Lúcia do banco de exemplo foi deferida: a linha dela está lá, em qualquer passo da prestação.
  const tabela = page.getByRole('table', { name: 'Lançamentos' })
  await expect(tabela).toContainText('Vera Lúcia (exemplo)')
  await page.getByLabel('Status').selectOption('recebido')
  await page.getByRole('button', { name: 'Limpar' }).click()
  await expect(tabela).toContainText('Vera Lúcia (exemplo)')
})

test('o Sócio cai no painel de resultado, com a busca e o chat, e vê só os totais no painel Financeiro', async ({ page }) => {
  await entrarPelaApi(page, 'socio@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Resultados do escritório')
  await expect(page.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Êxito por benefício' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Indicadores do escritório' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Financeiro' }).click()
  await expect(page.getByRole('list', { name: 'Indicadores do mês' })).toContainText('A receber')
  await expect(page.getByRole('table', { name: 'Lançamentos' })).toHaveCount(0)
  await expect(page.getByText('Os lançamentos de cada cliente ficam com o Financeiro; aqui, os totais do escritório.')).toBeVisible()
})
