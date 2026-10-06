import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-42 · Aposentadoria PCD: linha do tempo da deficiência. A Cleide da semente: os vínculos do CNIS partidos em com e
// sem deficiência, o período sem prova da época, o agravamento que muda o grau e o enquadramento calculado por código.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1, CA3 e CA4 · a linha do tempo da Cleide: com e sem deficiência, sem prova da época e o enquadramento', async ({ page }) => {
  await page.goto('/casos/cleide-exemplo-1/deficiencia')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Linha do tempo da deficiência')
  const metalurgica = page.getByRole('list', { name: 'Períodos em Exemplo Metalúrgica Ltda' }).getByRole('listitem')
  await expect(metalurgica.nth(0)).toContainText('sem deficiência')
  await expect(metalurgica.nth(1)).toContainText('com deficiência · leve')
  await expect(metalurgica.nth(2)).toContainText('sem prova da época')
  await expect(page.getByText('indicador PCD no CNIS').first()).toBeVisible()
  await expect(page.getByText('grau moderada · 16 anos, 3 meses e 10 dias convertidos · mínimo de 24 anos · calculado por código (G19)')).toBeVisible()
})

test('CA2 · um agravamento novo muda o grau a partir da data e recalcula o enquadramento', async ({ page }) => {
  await page.goto('/casos/cleide-exemplo-1/deficiencia')
  await page.getByRole('button', { name: '+ Agravamento' }).click()
  await page.getByRole('textbox', { name: 'Data do agravamento' }).nth(1).fill('01/01/2023')
  await page.getByRole('combobox', { name: 'Novo grau' }).nth(1).selectOption('grave')
  await page.getByRole('button', { name: 'Salvar os dados da deficiência' }).click()
  await expect(page.getByRole('status')).toHaveText('Dados da deficiência salvos: a linha do tempo e o enquadramento foram recalculados.')
  await expect(page.getByRole('list', { name: 'Períodos em Exemplo Serviços Ltda' }).getByRole('listitem').nth(1)).toContainText('01/01/2023 a 30/06/2026')
  await expect(page.getByRole('list', { name: 'Períodos em Exemplo Serviços Ltda' }).getByRole('listitem').nth(1)).toContainText('com deficiência · grave')
})

test('tema escuro e fonte grande na linha do tempo', async ({ page }) => {
  await page.goto('/casos/cleide-exemplo-1/deficiencia?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Linha do tempo da deficiência')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Dados da deficiência' }) })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
