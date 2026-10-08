import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-43 · Cadastrar o lead depois da entrevista. Cada teste abre um navegador novo, então começa da semente de
// exemplo.ts. A semente só tem um CPF, o de teste, que é do Antônio: o cadastro que salva é o dele.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** A entrevista da Josefa gravada e encerrada, com o relógio do Playwright. */
async function entrevistaEncerrada(page: Page) {
  await page.clock.install()
  await page.goto('/entrevista/josefa-entrevista/gravacao')
  await page.getByRole('button', { name: 'Gravar' }).click()
  await page.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await page.getByRole('button', { name: 'Começar a gravar' }).click()
  await expect(page.getByText(/● Gravando/)).toBeVisible()
  await page.clock.runFor(140_000)
  await page.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(page.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
}

test('CA1, CA8 e CA10 · da tarefa ao cadastro preenchido pela ficha e pela entrevista, com a diferença do telefone, a idade e o CEP', async ({ page }) => {
  await entrevistaEncerrada(page)
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Josefa Exemplo · Cadastrar lead' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Cadastrar lead')
  await expect(page.getByLabel('Nome completo *')).toHaveValue('Josefa Exemplo')
  await expect(page.getByLabel('Estado civil *')).toHaveValue('União estável')
  await expect(page.getByLabel('Profissão *')).toHaveValue('Auxiliar de limpeza')
  const diferenca = page.getByRole('region', { name: 'A ficha e a entrevista dizem diferente' })
  await diferenca.getByRole('radio', { name: 'Entrevista: (11) 90000-0021' }).click()
  await expect(page.getByLabel('Telefone *')).toHaveValue('(11) 90000-0021')
  await page.getByLabel('Data de nascimento').fill('10/03/1958')
  await page.getByLabel('Data de nascimento').blur()
  await expect(page.getByText(/^\d+ anos$/)).toBeVisible()
  await page.getByLabel('CEP *').fill('01001000')
  await page.getByLabel('CEP *').blur()
  await expect(page.getByLabel('Bairro *')).toHaveValue('Sé')
  await expect(page.getByLabel('UF *')).toHaveValue('SP')
  await expect(page.getByRole('button', { name: 'Salvar cadastro' })).toBeDisabled()
  await expect(page.getByText('Falta: CPF e RG.')).toBeVisible()
})

test('CA2 · CPF de outra ficha mostra o cadastro existente', async ({ page }) => {
  await page.goto('/clientes/josefa-exemplo/cadastro')
  await page.getByLabel('CPF *').fill('00000000191')
  await page.getByLabel('RG *').fill('1234567')
  await page.getByLabel('Estado civil *').selectOption('Viúvo(a)')
  await page.getByLabel('Profissão *').selectOption('Do lar')
  await page.getByLabel('CEP *').fill('01001000')
  await page.getByLabel('CEP *').blur()
  await page.getByLabel('Rua e número *').fill('Praça da Sé, 1')
  await page.getByRole('button', { name: 'Salvar cadastro' }).click()
  await expect(page.getByRole('alert')).toContainText('Este CPF já é do cadastro de Antônio Exemplo')
  await expect(page.getByRole('link', { name: 'Abrir o cadastro existente' })).toHaveAttribute('href', '/clientes/antonio-exemplo')
})

test('CA4, CA7 e CA9 · salvar na mesma ficha: o valor anterior no histórico e o kit liberado', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo/cadastro')
  await expect(page.getByText(/Ainda não pode ser gerado\. Falta: RG e endereço\./)).toBeVisible()
  await expect(page.getByText('Na ficha: Trabalhador rural (2018–2020) · porteiro (2021–2025) · escolha na lista')).toBeVisible()
  await page.getByLabel('RG *').fill('12.345.678-9')
  await page.getByLabel('Profissão *').selectOption('Porteiro(a)')
  await page.getByLabel('CEP *').fill('01001000')
  await page.getByLabel('CEP *').blur()
  await page.getByLabel('Rua e número *').fill('Praça da Sé, 10')
  await page.getByRole('button', { name: 'Salvar cadastro' }).click()
  await expect(page.getByRole('heading', { name: '✓ Cadastro salvo na mesma ficha (cliente)' })).toBeVisible()
  await expect(page.getByText('Pode ser gerado: o cadastro tem os campos do modelo.')).toBeVisible()
  await page.getByRole('link', { name: 'Abrir a ficha do cliente' }).click()
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Alterou profissão: «Trabalhador rural (2018–2020) · porteiro (2021–2025)» → «Porteiro(a)»')
})

test('CA11 · duas abas na mesma ficha: a outra vê "está editando" na hora', async ({ page, context }) => {
  await page.goto('/clientes/josefa-exemplo/cadastro')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Cadastrar lead')
  const outra = await context.newPage()
  await outra.goto('/clientes/josefa-exemplo/cadastro')
  await expect(page.getByRole('alert')).toContainText('Você (Advogada), em outra aba, está editando esta ficha agora.')
  await expect(outra.getByRole('alert')).toContainText('em outra aba, está editando')
  await outra.close()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('tema escuro e fonte grande no cadastro', async ({ page }) => {
  await page.goto('/clientes/josefa-exemplo/cadastro?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Cadastrar lead')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
