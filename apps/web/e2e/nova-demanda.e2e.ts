import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-124 · Nova demanda de quem já é cliente. Cada teste abre um navegador novo, então começa da semente: o Antônio é cliente,
// com um processo e os documentos pessoais na pasta.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('GGVP-124 CA1, CA2, CA5 e CA7 · da ficha do cliente: abre a demanda na mesma ficha e leva a marcar a entrevista', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo')
  await page.getByRole('link', { name: '+ Nova demanda' }).click()
  await page.waitForURL('**/clientes/antonio-exemplo/nova-demanda')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Antônio Exemplo · Nova demanda')
  const naFicha = page.getByRole('region', { name: 'O que já está na ficha' })
  await expect(naFicha).toContainText('Documento pessoal (RG), Documento pessoal (CPF), Comprovante de residência, CNIS, CTPS: já estão na pasta')

  const abrir = page.getByRole('button', { name: 'Abrir a nova demanda' })
  await expect(abrir).toBeDisabled()
  await page.getByRole('radio', { name: 'Outro pedido' }).click()
  await page.getByLabel('O que a pessoa quer *').fill('auxílio-acidente pelo braço que não fecha')
  await page.getByLabel('Benefício de interesse *').selectOption('auxilio-acidente')
  await expect(naFicha).toContainText('a subpasta «AUXÍLIO ACIDENTÁRIO 2026» na pasta do cliente')
  await abrir.click()
  await expect(page.getByRole('heading', { name: '✓ Nova demanda aberta na mesma ficha' })).toBeVisible()

  await page.getByRole('link', { name: 'Marcar a entrevista' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Marcar a entrevista com Antônio Exemplo')
  await page.goto('/clientes/antonio-exemplo')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Nova demanda (outro pedido): auxílio-acidente pelo braço que não fecha')
})

test('GGVP-124 CA9 · aberta pela advogada: o Atendimento recebe "Ligar para o cliente" na Central', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo/nova-demanda')
  await page.getByRole('radio', { name: 'Tentar de novo depois de perder' }).click()
  await page.getByLabel('O que a pessoa quer *').fill('tentar de novo o auxílio negado')
  await page.getByLabel('Benefício de interesse *').selectOption('incapacidade-temporaria')
  await page.getByLabel('Quem abre a demanda *').selectOption('advogada')
  await page.getByRole('button', { name: 'Abrir a nova demanda' }).click()
  await expect(page.getByText('O Atendimento recebeu a tarefa "Ligar para o cliente" para marcar a entrevista.')).toBeVisible()

  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Antônio Exemplo · Ligar para o cliente' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText(
    'nova demanda da advogada: tentar de novo depois de perder · Auxílio por Incapacidade Temporária · (11) 90000-0001',
  )
})

test('GGVP-124 CA8 · do balcão; recurso e defesa seguem no mesmo processo', async ({ page }) => {
  await page.goto('/balcao')
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('antonio')
  await page.getByRole('button', { name: /Antônio Exemplo/ }).click()
  await page.getByRole('radio', { name: 'Nova demanda' }).click()
  await page.getByRole('button', { name: 'Encaminhar' }).click()
  await page.waitForURL('**/clientes/antonio-exemplo/nova-demanda')
  await page.getByRole('radio', { name: 'Recurso ou defesa' }).click()
  await expect(page.getByText('Recurso e defesa seguem no mesmo processo: não abre processo novo.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir a nova demanda' })).toBeDisabled()
})

test('tema escuro e fonte grande na nova demanda', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo/nova-demanda?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Antônio Exemplo · Nova demanda')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Preencher' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
