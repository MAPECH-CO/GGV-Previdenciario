import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// Desfecho e financeiro (GGVP-11). Usuários e casos de exemplo do banco local; nenhum é real.

test('GGVP-22 · a advogada aprova o resumo e passa ao Atendimento; o Atendimento tenta, explica e o caso fecha', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Paulo Mendes (exemplo) · Aprovar o resumo para o cliente' }).click()
  await page.getByLabel('O que dizer ao cliente').fill('O juiz entendeu que a incapacidade não ficou provada no período pedido. O escritório não vai recorrer.')
  await page.getByLabel('O Atendimento, no padrão').check()
  await page.getByRole('button', { name: 'Aprovar o resumo' }).click()
  await expect(page.getByRole('status')).toHaveText('Resumo aprovado. O Atendimento vai explicar ao cliente.')

  await context.clearCookies()
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Paulo Mendes (exemplo) · Explicar resultado' }).click()
  await expect(page.getByText(/Aprovado pelo Jurídico: Gabi \(exemplo\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Sem contato, tentar de novo' }).click()
  await expect(page.getByRole('status')).toHaveText('Tentativa registrada. A tarefa continua aberta.')
  await page.getByLabel('Canal').selectOption('whatsapp')
  await page.getByLabel('O que foi explicado').fill('Expliquei a sentença e que o escritório não vai recorrer.')
  await page.getByRole('button', { name: 'Expliquei ao cliente' }).click()
  await expect(page.getByRole('status')).toHaveText('Explicação registrada. Caso encerrado.')
  await expect(page.getByText('Perdemos: estudo registrado')).toBeVisible()
  await expect(page.getByLabel('Contatos')).toContainText('sem contato')
})
