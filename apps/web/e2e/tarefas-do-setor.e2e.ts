import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-147 · Tarefas do setor: só o líder vê a aba (o líder do Atendimento e a Sênior, líder do Jurídico).

test('CA1 e CA3 · o líder do Atendimento vê "Tarefas do setor", com quem faz e o "Atribuir"; o Atendimento não vê a aba', async ({ page }) => {
  await entrarPelaApi(page, 'lider@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('tab', { name: /^Tarefas do setor \(\d+\)$/ }).click()
  await expect(page.getByRole('heading', { name: /Tarefas do setor · Atendimento/ })).toBeVisible()
  await expect(page.getByText(/Você é líder do Atendimento/)).toBeVisible()

  await entrarPelaApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Tarefas do setor/ })).toHaveCount(0)
})

test('CA1 · a Sênior vê as tarefas do setor do Jurídico', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('tab', { name: /^Tarefas do setor \(\d+\)$/ }).click()
  await expect(page.getByRole('heading', { name: /Tarefas do setor · Jurídico/ })).toBeVisible()
})
