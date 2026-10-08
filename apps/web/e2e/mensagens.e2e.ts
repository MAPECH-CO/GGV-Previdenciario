import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-102 · Mensagens ao cliente com modelo e registro. O Chatwoot é simulado: a Maria tem uma conversa, o Antônio duas,
// a conversa da Nair recusa a mensagem e a Lúcia tem o OK da advogada no aviso de resultado.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1, CA2, CA4, CA6 e CA9 · a orientação da perícia da Maria sai pelo Chatwoot e fica no card com o status', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Maria Exemplo' })
  await janela.getByLabel('Modelo').selectOption('pericia-orientacao')
  await expect(janela.getByRole('textbox')).toHaveValue(/^Olá, Maria! Sua perícia no INSS é sexta, 02\/10\. Chegue 30 minutos antes\./)
  const chatwoot = janela.getByRole('region', { name: 'Na central do Chatwoot' })
  await expect(chatwoot).toContainText('Contato: Maria Exemplo · (11) 90000-0004')
  await expect(chatwoot.getByRole('link', { name: 'Abrir a conversa' })).toHaveAttribute('href', /chatwoot\.mapech\.com\.br\/app\/accounts\/.+\/conversations\/5004$/)
  await janela.getByRole('button', { name: 'Enviar pelo Chatwoot' }).click()
  await expect(janela.getByText(/✓ Entregue no Chatwoot às \d\d:\d\d/)).toBeVisible()
  await janela.getByRole('button', { name: 'Fechar', exact: true }).last().click()
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText(/Chatwoot · \d\d:\d\d · entregue/)
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText('Sua perícia no INSS é sexta, 02/10.')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Enviou pelo Chatwoot a mensagem «Perícia: data, o que levar e orientação» (entregue)')
})

test('CA3, CA9 e G9 · a IA aponta o termo jurídico; o texto que esconde a situação ou pede a senha não sai', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Maria Exemplo' })
  await janela.getByLabel('Modelo').selectOption('pericia-orientacao')
  await janela.getByRole('textbox').fill('O pedido foi indeferido. Não conte ao perito que voltou a trabalhar.')
  await expect(janela.getByRole('list', { name: 'A IA aponta' })).toContainText('Termo jurídico "indeferido": diga "negado".')
  await expect(janela.getByText('Nunca oriente a esconder ou mudar a situação real (G11).')).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Enviar pelo Chatwoot' })).toBeDisabled()
  await janela.getByRole('textbox').fill('Mande a sua senha do gov.br por aqui.')
  await expect(janela.getByText('O escritório nunca pede a senha do gov.br por mensagem (G9).')).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Enviar pelo Chatwoot' })).toBeDisabled()
})

test('CA5 · a falha do Chatwoot aparece na tela e fica no histórico da Nair, sem reenvio', async ({ page }) => {
  await page.goto('/clientes/nair-exemplo')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Nair Exemplo' })
  await expect(janela.getByRole('region', { name: 'Na central do Chatwoot' })).toContainText('Nair Exemplo')
  await janela.getByRole('button', { name: 'Enviar pelo Chatwoot' }).click()
  await expect(janela.getByText('A mensagem não saiu pelo Chatwoot: o WhatsApp recusou: o número não tem WhatsApp. Ficou no histórico do cliente; nada foi reenviado sozinho.')).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
  await janela.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('A mensagem «Boas-vindas» não saiu pelo Chatwoot: o WhatsApp recusou: o número não tem WhatsApp. Nada foi reenviado sozinho.')
})

test('CA7 e CA6 · o aviso favorável da Lúcia com o texto aprovado; o do Antônio travado sem o OK (G8); a conversa de mais mensagens primeiro', async ({ page }) => {
  await page.goto('/clientes/lucia-exemplo')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const lucia = page.getByRole('dialog', { name: 'Mensagem ao cliente · Lúcia Exemplo' })
  await lucia.getByLabel('Modelo').selectOption('resultado-favoravel')
  await expect(lucia.getByText('Mensagem aprovada pelo Jurídico (não muda)')).toBeVisible()
  await expect(lucia.getByRole('textbox')).toHaveAttribute('readonly', '')
  await lucia.getByRole('button', { name: 'Enviar pelo Chatwoot' }).click()
  await expect(lucia.getByText(/✓ Entregue no Chatwoot/)).toBeVisible()

  await page.goto('/clientes/antonio-exemplo')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const antonio = page.getByRole('dialog', { name: 'Mensagem ao cliente · Antônio Exemplo' })
  await antonio.getByLabel('Modelo').selectOption('resultado-favoravel')
  await expect(antonio.getByText('Falta o OK da advogada na prestação de contas: o aviso só sai depois dele (G8).')).toBeVisible()
  await expect(antonio.getByRole('button', { name: 'Enviar pelo Chatwoot' })).toBeDisabled()
  await antonio.getByLabel('Modelo').selectOption('boas-vindas')
  const conversas = antonio.getByRole('radiogroup', { name: 'Conversas do cliente' }).getByRole('radio')
  await expect(conversas).toHaveText(['Conversa #4102 · 14 mensagens · aberta · GGV PREV', 'Conversa #4101 · 3 mensagens · resolvida · GGV PREV'])
})

test('tema escuro e fonte grande na mensagem ao cliente', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo?tema=escuro&fonte=grande')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  await expect(page.getByRole('dialog', { name: 'Mensagem ao cliente · Maria Exemplo' })).toBeVisible()
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
