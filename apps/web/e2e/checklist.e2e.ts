import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-91 · Checklist de documentos obrigatórios do benefício: da leitura arquivada ao checklist calculado, a trava da
// liberação, o benefício sem lista e o tema. Cada teste começa da semente de exemplo.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1, CA3, CA5 e CA7 · da leitura arquivada ao checklist da Rita, incompleto, com a liberação bloqueada', async ({ page }) => {
  await page.goto('/clientes/rita-exemplo/conferir-documentos')
  await page.getByRole('radio', { name: 'Manter os dois' }).click()
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText(/Ainda falta: Documento pessoal \(CPF\), Comprovante de renda/)).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Rita Exemplo · Conferir checklist' }).click()
  await expect(page).toHaveURL('/casos/rita-exemplo-1/checklist')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Conferir checklist')
  const itens = page.getByRole('list', { name: 'Checklist · LOAS Deficiente' })
  await expect(itens.getByRole('listitem').filter({ hasText: 'Documento pessoal (RG)' })).toContainText('ok')
  await expect(itens.getByRole('listitem').filter({ hasText: 'Declaração de moradia' })).toContainText('entra porque o cliente mora em casa de outra pessoa')
  await expect(itens.getByRole('listitem').filter({ hasText: 'Ficha de grupo familiar' })).toContainText('falta')
  await expect(page.getByText(/Liberar ao Jurídico: bloqueado\. O checklist está incompleto/)).toBeVisible()

  await page.getByRole('button', { name: 'Gerar cobrança das pendências' }).click()
  await expect(page.getByRole('heading', { name: /✓ Conferido às/ })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Rita Exemplo · Conferir checklist' })).toHaveCount(0)
})

test('CA6 · benefício sem lista aprovada explica o bloqueio', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/checklist')
  await expect(page.getByText(/Auxílio Acidentário ainda não tem lista de documentos obrigatórios aprovada/).first()).toBeVisible()
  await expect(page.getByText(/Liberar ao Jurídico: bloqueado/)).toBeVisible()
})

test('tema escuro e fonte grande no checklist', async ({ page }) => {
  await page.goto('/casos/rita-exemplo-1/checklist?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Conferir checklist')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Checklist · LOAS Deficiente' }) })).toHaveCSS(
    'background-color',
    rgb(tokens.cores.superficie.escuro),
  )
})
