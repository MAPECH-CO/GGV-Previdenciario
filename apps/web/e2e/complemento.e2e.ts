import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-29 · Pedir o complemento ao médico do cliente: do parecer Insuficiente da Rita à orientação enviada pelo Chatwoot
// simulado; o relatório anexado vira laudo novo, a prévia da IA diz que responde ao pedido, a advogada refaz o parecer e
// o pedido se encerra. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

/** A advogada confere a análise como veio e registra a decisão. */
async function darParecer(page: Page, decisao: 'Suficiente — liberar' | 'Insuficiente — pedir complemento') {
  await page.goto('/casos/rita-exemplo-1/parecer')
  const selects = page.getByRole('combobox', { name: /^Conferência:/ })
  await expect(selects.first()).toBeVisible()
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption('confere')
  await page.getByRole('radio', { name: decisao }).click()
  await page.getByRole('button', { name: 'Registrar parecer' }).click()
  await expect(page.getByRole('heading', { name: /✓ Parecer registrado/ })).toBeVisible()
}

test('CA1, CA2, CA4, CA5 e CA6 · da orientação ao médico ao pedido encerrado com o parecer refeito', async ({ page }) => {
  // Fluxo longo, de várias telas; o envio passa também pela conversa do Chatwoot (GGVP-102): o triplo do tempo padrão.
  test.slow()
  await darParecer(page, 'Insuficiente — pedir complemento')

  await page.goto('/')
  await page.getByRole('link', { name: 'Rita Exemplo · Pedir complemento ao médico' }).click()
  await expect(page).toHaveURL('/casos/rita-exemplo-1/complemento')
  await expect(page.getByRole('list', { name: 'Perguntas ao médico' })).toContainText('1. Qual a previsão de duração do quadro?')
  await expect(page.getByText('Impedimento físico')).toHaveCount(0)

  // CA3: o envio pelo Chatwoot conta como tentativa, e a próxima espera 3 dias.
  await page.getByRole('button', { name: 'Enviar orientação' }).click()
  const chatwoot = page.getByRole('dialog', { name: 'Chatwoot · conversa com Rita Exemplo' })
  await expect(chatwoot.getByRole('textbox')).toHaveValue(/Leve ao seu médico estas perguntas/)
  await chatwoot.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status')).toHaveText('Orientação enviada pelo Chatwoot e registrada como tentativa.')
  await expect(page.getByRole('button', { name: 'Enviar orientação' })).toBeDisabled()

  // CA5: o relatório chega e sobe como laudo novo; a prévia da IA diz que responde ao pedido.
  await page.getByRole('button', { name: /Anexar o documento recebido/ }).click()
  const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
  await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles([pdf('relatorio medico.pdf')])
  await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(page.getByRole('heading', { name: 'O documento novo chegou · prévia da IA' })).toBeVisible()
  await expect(page.getByText(/responde a tudo o que foi pedido/)).toBeVisible()

  // A advogada compara e refaz o parecer: o pedido se encerra.
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Rita Exemplo · Analisar laudo novo' }).click()
  await expect(page.getByText('Passa a cobrir', { exact: true })).toBeVisible()
  await darParecer(page, 'Suficiente — liberar')
  await page.goto('/casos/rita-exemplo-1/complemento')
  await expect(page.getByRole('heading', { name: '✓ Complemento encerrado' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Rita Exemplo · Pedir complemento ao médico' })).toHaveCount(0)
})

test('tema escuro e fonte grande no pedido de complemento', async ({ page }) => {
  await darParecer(page, 'Insuficiente — pedir complemento')
  await page.goto('/casos/rita-exemplo-1/complemento?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Pedir complemento ao médico')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
