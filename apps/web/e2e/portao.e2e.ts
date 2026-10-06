import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-33 · Portão: sem parecer, o caso não anda. O parecer Insuficiente da Rita trava a liberação e diz o que falta; duas
// sêniores dispensam, com justificativa; o chat recusa pular o parecer. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const JUSTIFICATIVA = 'Prazo do juiz vence em dois dias e o médico só atende em novembro.'

async function parecerInsuficiente(page: Page) {
  await page.goto('/casos/rita-exemplo-1/parecer')
  const selects = page.getByRole('combobox', { name: /^Conferência:/ })
  await expect(selects.first()).toBeVisible()
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption('confere')
  await page.getByRole('radio', { name: 'Insuficiente — pedir complemento' }).click()
  await page.getByRole('button', { name: 'Registrar parecer' }).click()
  await expect(page.getByRole('heading', { name: '✓ Parecer registrado: Insuficiente' })).toBeVisible()
}

test('CA1, CA2 e CA4 · o Insuficiente trava a liberação; duas sêniores dispensam e a liberação mostra a dispensa', async ({ page }) => {
  await parecerInsuficiente(page)
  await page.goto('/casos/rita-exemplo-1/liberar')
  await expect(page.getByText(/Parecer médico Insuficiente \(G17\) · confirmado por Dra\. Paula \(exemplo\), [0-9/]+: falta o complemento do médico/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Liberar ao Jurídico' })).toBeDisabled()

  // A Dra. Renata pede; ela mesma não aprova.
  await page.goto('/casos/rita-exemplo-1/parecer/dispensa?perfil=senior')
  await page.getByRole('textbox', { name: /Justificativa: por que seguir sem a prova médica/ }).fill(JUSTIFICATIVA)
  await page.getByRole('button', { name: 'Pedir a dispensa (1ª sênior)' }).click()
  await expect(page.getByRole('status')).toHaveText('Pedido registrado: falta a aprovação de outra sênior.')
  await expect(page.getByRole('button', { name: 'Aprovar a dispensa (2ª sênior)' })).toBeDisabled()

  // O Dr. Otávio vê o pedido na Central e aprova.
  await page.goto('/advogada?perfil=senior-2')
  await page.getByRole('link', { name: 'Rita Exemplo · Aprovar dispensa do parecer' }).click()
  await page.goto('/casos/rita-exemplo-1/parecer/dispensa?perfil=senior-2')
  await page.getByRole('button', { name: 'Aprovar a dispensa (2ª sênior)' }).click()
  await expect(page.getByRole('heading', { name: '✓ Parecer dispensado' })).toBeVisible()

  await page.goto('/casos/rita-exemplo-1/liberar')
  await expect(page.getByRole('checkbox', { name: /Parecer médico dispensado por duas sêniores \(G17\) · Dra\. Renata \(exemplo\) e Dr\. Otávio \(exemplo\)/ })).toBeChecked()
  await page.getByRole('button', { name: 'Abrir o parecer médico' }).click()
  await expect(page.getByRole('dialog', { name: 'Parecer médico de suficiência' })).toContainText(`Justificativa: ${JUSTIFICATIVA}`)
})

test('CA3 · o chat recusa pular o parecer e diz o portão que falta', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: /Pergunte ou peça/ }).fill('libera a Rita sem o parecer')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status')).toContainText('Não posso pular o parecer médico.')
  await expect(page.getByRole('status')).toContainText('Só duas sêniores dispensam, com justificativa')
})

test('tema escuro e fonte grande na dispensa', async ({ page }) => {
  await page.goto('/casos/rita-exemplo-1/parecer/dispensa?perfil=senior&tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Dispensar o parecer médico')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
