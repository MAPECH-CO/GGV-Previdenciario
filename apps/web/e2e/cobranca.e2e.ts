import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-101 · Cobrar os documentos pendentes: o checklist incompleto abre a cobrança, "Enviar cobrança" pelo Chatwoot
// simulado, o limite de 2 tentativas e a decisão da sênior. Cada teste começa da semente de exemplo.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1, CA4, CA6 e CA11 · do checklist incompleto à cobrança na Central, enviada pelo Chatwoot com a mensagem pronta', async ({ page }) => {
  await page.goto('/casos/rita-exemplo-1/checklist')
  await page.getByRole('button', { name: 'Gerar cobrança das pendências' }).click()
  await expect(page.getByRole('heading', { name: /✓ Conferido às/ })).toBeVisible()

  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Rita Exemplo · Cobrar documento' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('1ª tentativa')
  await tarefa.click()
  await expect(page).toHaveURL('/casos/rita-exemplo-1/cobranca')
  await expect(page.getByRole('list', { name: 'Documentos pendentes' })).toContainText('Ficha de grupo familiar')
  await expect(page.getByText('Próximo lembrete: hoje')).toBeVisible()

  await page.getByRole('button', { name: 'Enviar cobrança' }).click()
  const janela = page.getByRole('dialog', { name: 'Chatwoot · conversa com Rita Exemplo' })
  await expect(janela.getByRole('textbox', { name: 'Mensagem de cobrança (confira antes de enviar)' })).toHaveValue(/ainda faltam: Documento pessoal \(RG\)/)
  await janela.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status')).toHaveText('Cobrança enviada pelo Chatwoot e registrada como tentativa.')
  await expect(page.getByRole('list', { name: 'Tentativas de cobrança' })).toContainText('1ª · ')
  await expect(page.getByText(/A próxima tentativa é em .*, 3 dias depois da última\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar cobrança' })).toBeDisabled()
})

test('CA7, CA8 e CA12 · a cobrança do Antônio passou do limite: a sênior decide com justificativa e volta ao Atendimento', async ({ page }) => {
  await page.goto('/casos/antonio-exemplo-1/cobranca')
  await expect(page.getByText('Passou do limite: a sênior decide o que fazer. A cobrança continua à vista aqui.')).toBeVisible()
  await expect(page.getByText(/O prazo do juiz vence em/)).toBeVisible()

  // A decisão é da Sênior: a cobrança chega à tela inicial dela.
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Antônio Exemplo · Decidir cobrança' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Antônio Exemplo · Decidir cobrança')
  await expect(page.getByRole('list', { name: 'Tentativas de cobrança' }).getByRole('listitem')).toHaveCount(2)
  const registrar = page.getByRole('button', { name: 'Registrar decisão' })
  await page.getByRole('radio', { name: 'Pedir visita ao escritório' }).click()
  await expect(registrar).toBeDisabled()
  await page.getByRole('textbox', { name: 'Justificativa *' }).fill('o cliente não lê mensagens; melhor conversar no escritório')
  await registrar.click()
  await expect(page.getByRole('heading', { name: /✓ Decisão registrada às/ })).toBeVisible()

  await entrarPelaApi(page)
  await page.goto('/')
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Antônio Exemplo · Cobrar documento' }) })).toContainText(
    'decisão da sênior: pedir visita ao escritório',
  )
})

test('tema escuro e fonte grande na cobrança e na decisão', async ({ page }) => {
  for (const caminho of ['/casos/antonio-exemplo-1/cobranca', '/casos/antonio-exemplo-1/cobranca/decidir']) {
    // A decisão no limite (G15) é da Sênior: a tela pede o perfil dela (GGVP-135).
    if (caminho.endsWith('/decidir')) await entrarPelaApi(page, 'senior@exemplo.ggv')
    await page.goto(`${caminho}?tema=escuro&fonte=grande`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Antônio Exemplo')
    await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  }
})
