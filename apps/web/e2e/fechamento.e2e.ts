import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-60 · Registrar por que não virou cliente e recontatar. Cada teste abre um navegador novo, então começa da semente: a
// entrevista da Natália foi ontem e ninguém registrou; o teste marca como realizada na agenda.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

async function nataliaEntrevistada(page: Page) {
  await page.goto('/agenda?ver=lista')
  await page.getByRole('region', { name: 'Para confirmar se aconteceu' }).getByRole('button', { name: /Natália Exemplo/ }).click()
  await page.getByRole('dialog', { name: /Natália Exemplo · Fazer entrevista/ }).getByRole('button', { name: 'Marcar como realizado' }).click()
  // A agenda grava depois de um instante: sair antes perde o "realizado". Gravado, sai de "Para confirmar se aconteceu".
  await expect(page.getByRole('region', { name: 'Para confirmar se aconteceu' }).getByRole('button', { name: /Natália Exemplo/ })).toHaveCount(0)
  await page.goto('/')
  await page.getByRole('link', { name: 'Natália Exemplo · Registrar fechamento' }).click()
  await page.waitForURL('**/clientes/natalia-exemplo/fechamento')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Natália Exemplo · Registrar fechamento')
}

test('GGVP-60 CA1, CA2, CA5, CA6, CA8 e CA12 · não fechou com recontato: a data sugerida, a agenda e a tarefa no dia', async ({ page }) => {
  await nataliaEntrevistada(page)
  const registrar = page.getByRole('button', { name: 'Registrar e agendar retorno' })
  await expect(registrar).toBeDisabled()
  await page.getByRole('radio', { name: 'Não fechou' }).click()
  await expect(page.getByText('Escolha o motivo: sem ele o lead não pode ser encerrado (G16).')).toBeVisible()
  await page.getByLabel('Motivo *').selectOption('preco')
  await page.getByLabel('Detalhe do motivo (opcional)').fill('achou o valor alto')
  await page.getByRole('radio', { name: 'Sim, agendar recontato' }).click()
  await page.getByRole('radio', { name: 'Ficou de pensar · 15 dias' }).click()
  const data = await page.getByLabel('Recontatar em *').inputValue()
  expect(data).toMatch(/^\d\d\/\d\d\/\d{4}$/)
  await registrar.click()
  await expect(page.getByRole('heading', { name: /✓ Registrado: recontatar em/ })).toBeVisible()

  await page.goto('/agenda?ver=lista')
  await expect(page.getByRole('button', { name: /Natália Exemplo · Recontatar lead/ })).toBeVisible()

  const [d, m, a] = data.split('/').map(Number)
  await page.clock.setFixedTime(new Date(a, m - 1, d, 9, 0))
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Natália Exemplo · Recontatar lead' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('motivo: preço · último cálculo: nenhum registrado · (11) 90000-0003')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Natália Exemplo · Recontatar lead')
  await page.getByRole('radio', { name: 'Quer seguir: voltar ao cálculo (D1.13)' }).click()
  await page.getByRole('button', { name: 'Registrar o recontato' }).click()
  await expect(page.getByRole('heading', { name: '✓ O caso volta ao cálculo de tempo e pontos' })).toBeVisible()
})

test('GGVP-60 CA4 e CA7 · não fechou sem recontato: arquivado com o motivo, pesquisável no balcão e na ficha', async ({ page }) => {
  await nataliaEntrevistada(page)
  await page.getByRole('radio', { name: 'Não fechou' }).click()
  await page.getByLabel('Motivo *').selectOption('outro-escritorio')
  await page.getByRole('radio', { name: 'Não, arquivar o lead' }).click()
  await page.getByRole('button', { name: 'Registrar e arquivar o lead' }).click()
  await expect(page.getByRole('heading', { name: '✓ Lead arquivado com o motivo' })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Natália Exemplo · Registrar fechamento' })).toHaveCount(0)
  await page.goto('/balcao')
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('natalia')
  await expect(page.getByRole('button', { name: /Natália Exemplo/ })).toContainText(/Lead arquivado · Foi a outro escritório · \d\d\/\d\d/)
  await page.goto('/clientes/natalia-exemplo')
  await expect(page.getByRole('region', { name: 'Fechamento' })).toContainText('Foi a outro escritório')
})

test('GGVP-60 CA5 · "Sim, fechou": vira cliente e segue para o kit', async ({ page }) => {
  await nataliaEntrevistada(page)
  await page.getByRole('radio', { name: 'Sim, fechou' }).click()
  await page.getByRole('button', { name: 'Registrar fechamento' }).click()
  await expect(page.getByRole('heading', { name: '✓ Fechou com o escritório: Natália é cliente' })).toBeVisible()
  await expect(page.getByText('Auxílio por Incapacidade Temporária: segue para o kit do benefício (D1.15).')).toBeVisible()
})

test('tema escuro e fonte grande no registrar fechamento', async ({ page }) => {
  await page.goto('/clientes/natalia-exemplo/fechamento?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Natália Exemplo · Registrar fechamento')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Preencher' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
