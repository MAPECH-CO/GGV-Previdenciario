import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-57 · Calcular tempo e pontos sobre o CNIS. Cada teste abre um navegador novo, então começa da semente de
// exemplo.ts: o CNIS da Josefa foi baixado do Meu INSS em 02/10.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** A advogada define o benefício da Josefa pela lista do escritório. */
async function definir(page: Page, beneficio: string) {
  await page.goto('/entrevista/josefa-entrevista/beneficio')
  await page.getByRole('radio', { name: 'Outro benefício' }).click()
  await page.getByLabel('Benefício definido *').selectOption(beneficio)
  await page.getByRole('checkbox', { name: 'Conferi a recomendação com a entrevista' }).check()
  await page.getByRole('button', { name: 'Confirmar benefício' }).click()
  await expect(page.getByRole('heading', { name: /✓ Benefício definido/ })).toBeVisible()
}

async function calcular(page: Page, tempo: [string, string, string], pontos: string) {
  await page.getByLabel('Anos').fill(tempo[0])
  await page.getByLabel('Meses').fill(tempo[1])
  await page.getByLabel('Dias').fill(tempo[2])
  await page.getByLabel('Pontos *').fill(pontos)
  await page.getByLabel('Regra aplicada *').selectOption('Transição por pontos (EC 103, art. 15)')
}

test('CA1, CA2, CA4, CA5 e CA6 · da tarefa na Central ao cálculo concluído; refazer com "Ainda não" guarda o anterior', async ({ page }) => {
  await definir(page, 'aposentadoria-idade')
  await expect(page.getByText(/Depois: «Calcular tempo e pontos» \(D1\.13\), obrigatório antes do fechamento/)).toBeVisible()
  await page.goto('/clientes/josefa-exemplo')
  await expect(page.getByText('Calcular tempo e pontos (D1.13): obrigatório antes do fechamento')).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Josefa Exemplo · Calcular tempo e pontos' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Calcular tempo e pontos')
  await expect(page.getByText('CNIS baixado do Meu INSS · extraído em 02/10')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Vínculos do CNIS' }).getByRole('listitem')).toHaveCount(2)
  await calcular(page, ['18', '4', '0'], '79,5')
  await expect(page.getByRole('button', { name: 'Concluir' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Sim' }).click()
  await page.getByRole('checkbox', { name: 'Conferi o cálculo com o CNIS' }).check()
  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByRole('heading', { name: '✓ Cálculo registrado: 18 anos e 4 meses, 79,5 pontos' })).toBeVisible()

  await page.getByRole('button', { name: 'Refazer o cálculo' }).click()
  await calcular(page, ['14', '2', '10'], '74')
  await page.getByRole('radio', { name: 'Ainda não' }).click()
  await page.getByLabel('Data prevista em que poderá se aposentar *').fill('15/03/2028')
  await page.getByRole('checkbox', { name: 'Conferi o cálculo com o CNIS' }).check()
  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByText(/previsto para 15\/03\/2028\. O caso segue para «Registrar o motivo» \(D1\.14\)/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Cálculos anteriores' })).toContainText('18 anos e 4 meses, 79,5 pontos')

  await page.getByRole('link', { name: 'Abrir a ficha do cliente' }).click()
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Refez o cálculo de tempo e pontos (D1.13)')
  await expect(page.getByText('Calcular tempo e pontos (D1.13): obrigatório antes do fechamento')).toHaveCount(0)
})

test('CA3 · benefício sem cálculo: o passo não aparece', async ({ page }) => {
  await definir(page, 'loas-idoso')
  await expect(page.getByText('Depois: «O cliente fechou com o escritório?» (D1.14).')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Josefa Exemplo · Calcular tempo e pontos' })).toHaveCount(0)
  await page.goto('/entrevista/josefa-entrevista/calculo')
  await expect(page.getByRole('heading', { name: 'Este passo não se aplica' })).toBeVisible()
})

test('tema escuro e fonte grande no cálculo', async ({ page }) => {
  await page.goto('/entrevista/josefa-entrevista/calculo?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Calcular tempo e pontos')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
