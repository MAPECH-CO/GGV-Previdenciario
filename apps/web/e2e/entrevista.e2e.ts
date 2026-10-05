import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-40 · Entrevistar com gravação. Cada teste abre um navegador novo, então começa da semente de exemplo.ts: a
// entrevista da Josefa é hoje às 15:30. O relógio da página é do Playwright (`page.clock`), para a gravação correr rápido.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** Senha de teste: não pode aparecer na tela nem no armazenamento depois de guardada (G9). */
const SENHA_DE_TESTE = 'Teste#Entrevista-7314'

async function comecarAGravar(page: Page) {
  await page.getByRole('button', { name: 'Gravar' }).click()
  await expect(page.getByRole('heading', { name: 'Antes de gravar, avise o cliente (G10)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Começar a gravar' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await page.getByRole('button', { name: 'Começar a gravar' }).click()
  await expect(page.getByText(/● Gravando · 00:00:\d\d · aviso de gravação feito às \d\d:\d\d \(G10\)/)).toBeVisible()
}

/** Sem internet de mentira: só o navegador acha que caiu, sem derrubar o servidor de desenvolvimento. */
async function internet(page: Page, ligada: boolean) {
  await page.evaluate((on) => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on })
    window.dispatchEvent(new Event(on ? 'online' : 'offline'))
  }, ligada)
}

test('CA1, CA4, CA5 e CA6 · da preparação à gravação com o aviso, o cofre e o "Cadastrar lead" na Central da Advogada', async ({ page }) => {
  await page.clock.install()
  await page.goto('/entrevista/josefa-entrevista/analisar')
  await page.getByRole('radio', { name: 'Não' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/O Atendimento recebeu/)).toBeVisible()

  await page.goto('/entrevista/josefa-entrevista/preparar')
  await page.getByRole('link', { name: 'Iniciar entrevista (Transcrição)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Fazer entrevista')
  await expect(page.getByText('A gravação começa com o aviso ao cliente (G10).')).toBeVisible()
  await page.getByRole('link', { name: 'Iniciar entrevista (Transcrição)' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entrevista com Josefa Exemplo')
  await comecarAGravar(page)

  await page.clock.runFor(70_000)
  await expect(page.getByText(/Parei em junho de 2026/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Definir o benefício (D1.12) · libera ao encerrar a entrevista' })).toBeDisabled()

  await page.getByRole('button', { name: /Abrir o cofre/ }).click()
  await expect(page.getByText(/❚❚ Pausada para a senha do gov.br/)).toBeVisible()
  await page.getByLabel('Digite a senha (vai direto ao cofre)').fill(SENHA_DE_TESTE)
  await page.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(page.getByText(/● Gravando/)).toBeVisible()
  expect(await page.content()).not.toContain(SENHA_DE_TESTE)
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(SENHA_DE_TESTE)

  await page.clock.runFor(70_000)
  await page.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista encerrada/ })).toBeVisible()
  await expect(page.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Definir o benefício (D1.12)' })).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(SENHA_DE_TESTE)

  await page.goto('/advogada')
  await expect(page.getByRole('link', { name: 'Josefa Exemplo · Cadastrar lead' })).toBeVisible()
})

test('CA12 · a internet cai: a gravação segue e a transcrição espera a conexão voltar', async ({ page }) => {
  await page.clock.install()
  await page.goto('/entrevista/josefa-entrevista/gravacao')
  await comecarAGravar(page)
  await page.clock.runFor(30_000)
  await internet(page, false)
  await expect(page.getByRole('alert')).toContainText('Sem internet: a gravação continua e o áudio fica guardado neste computador.')
  await page.clock.runFor(10_000)
  await page.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(page.getByText(/Sem internet: o áudio está guardado neste computador/)).toBeVisible()
  await internet(page, true)
  await expect(page.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
})

test('CA8 · a gravação falha: aviso na hora e a entrevista registrada sem áudio', async ({ page }) => {
  await page.clock.install()
  await page.goto('/entrevista/josefa-entrevista/gravacao?simular=falha-do-microfone')
  await comecarAGravar(page)
  await page.clock.runFor(45_000)
  await expect(page.getByRole('heading', { name: 'A gravação falhou em 00:00:40' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar como sem áudio' }).click()
  await page.getByLabel('O que foi conversado *').fill('Conversamos sobre o LOAS; a cliente traz a carta do INSS.')
  await page.getByRole('button', { name: 'Registrar sem áudio' }).click()
  await expect(page.getByRole('heading', { name: '✓ Entrevista registrada sem áudio' })).toBeVisible()
})

for (const caminho of ['/entrevista/josefa-entrevista', '/entrevista/josefa-entrevista/gravacao']) {
  test(`tema escuro e fonte grande em ${caminho}`, async ({ page }) => {
    await page.goto(`${caminho}?tema=escuro&fonte=grande`)
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
    const corpo = page.locator('body')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })
}
