import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-65 · Kit de documentos por benefício. Cada teste abre um navegador novo, então começa da semente: a Cleide fechou a
// Aposentadoria PCD e o contrato está para preparar.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('GGVP-65 CA1, CA4 e CA5 · da Central ao kit das aposentadorias, pelo Contrato Completo 2026', async ({ page }) => {
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Cleide Exemplo · Preparar contrato' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('kit Aposentadorias · Contrato Completo 2026')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Preparar contrato')
  const kit = page.getByRole('list', { name: 'Documentos do kit' })
  await expect(kit.getByRole('listitem')).toHaveText([
    '✓Contrato de honorários',
    '✓Procuração',
    '✓Declaração de hipossuficiência',
    '✓Declaração de residência',
    '✓Termo INSS · aposentadorias, CTC, recursos',
    '✓Código Penal',
  ])
  await expect(page.getByText('Aposentadorias · modelo Contrato Completo 2026 · pasta MODELOS ZAPSIGN · PREV')).toBeVisible()
  await expect(page.getByText('Assinam: o cliente.')).toBeVisible()
})

test('tema escuro e fonte grande no preparar contrato', async ({ page }) => {
  await page.goto('/contrato/cleide-exemplo-1/preparar?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Preparar contrato')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Kit do benefício' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
