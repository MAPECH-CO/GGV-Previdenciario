import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-72 · Assinatura digital pelo ZapSign. Cada teste abre um navegador novo, então começa da semente: a Nair recebeu o link
// do ZapSign há 9 dias e ainda não assinou. O ZapSign e o Chatwoot são simulados.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('GGVP-72 CA2, CA4, CA5, CA11 e CA12 · da Central ao lembrete pelo WhatsApp; a segunda tentativa sobe para a sênior', async ({ page }) => {
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura' })
  const linha = page.getByRole('listitem').filter({ has: tarefa })
  await expect(linha).toContainText(/Aposentadoria por Idade · ZapSign enviado \d\d\/\d\d · tentativa 1 de 2/)
  await expect(linha).toContainText('tentar contato hoje')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nair Exemplo · Colher assinatura')
  await expect(page.getByText('zapsign-exemplo-nair-exemplo-1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lembrar pelo WhatsApp' }).click()
  const janela = page.getByRole('dialog', { name: 'Chatwoot · conversa com Nair Exemplo' })
  await expect(janela.getByLabel('Lembrete com o mesmo link do ZapSign (confira antes de enviar)')).toHaveValue(/O link é o mesmo: https:\/\/zapsign\.exemplo\/assinar\/zapsign-exemplo-nair-exemplo-1/)
  await janela.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/Limite de 2 tentativas atingido \(G15\): o caso subiu para a advogada sênior/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tentativas de contato' }).getByRole('listitem')).toHaveCount(2)

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura' })).toHaveCount(0)
  await page.goto('/advogada')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura · limite de tentativas' })).toBeVisible()
})

test('GGVP-72 CA3, CA6 e CA10 · o ZapSign devolve assinado: o arquivo final vai para a pasta do caso e a tarefa sai da Central', async ({ page }) => {
  await page.goto('/contrato/nair-exemplo-1/assinatura')
  await page.getByRole('button', { name: 'Simular o retorno do ZapSign (assinado)' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato assinado pelo ZapSign' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura' })).toHaveCount(0)
  await page.goto('/clientes/nair-exemplo')
  await expect(page.getByText(/Contrato assinado - Nair Exemplo - .* \(ZapSign, com evidências\)\.pdf/)).toBeVisible()
})

test('tema escuro e fonte grande no colher assinatura', async ({ page }) => {
  await page.goto('/contrato/nair-exemplo-1/assinatura?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nair Exemplo · Colher assinatura')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Assinatura pelo ZapSign' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
