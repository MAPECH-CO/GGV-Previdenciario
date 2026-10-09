import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-102 · Mensagens ao cliente com modelo e registro, no servidor (GGVP-138): cada teste cadastra o seu lead no banco.
// O Chatwoot é simulado no servidor: o contato é o do telefone da ficha, com uma conversa aberta, e a entrega é confirmada.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** O lead do balcão, no banco, pela API, com a sessão da Ana; a tela abre na ficha dele. */
async function fichaDoLead(page: Page, nome: string, telefone: string) {
  await page.goto('/')
  const r = await page.request.post('/api/fichas', { data: { nome, idade: 66, pretende: 'Quer saber do BPC do idoso.', telefone, beneficioInteresse: 'loas-idoso', outraPessoa: false } })
  expect(r.ok()).toBe(true)
  await page.goto(`/clientes/${(await r.json()).id}`)
}

test('CA1, CA2, CA4 e CA6 · as boas-vindas saem pelo Chatwoot e ficam no card com o status e no histórico', async ({ page }) => {
  await fichaDoLead(page, 'Rosa Mensagem Teste', '11933332222')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Rosa Mensagem Teste' })
  await janela.getByLabel('Modelo').selectOption('boas-vindas')
  await expect(janela.getByRole('textbox')).toHaveValue(/^Olá, Rosa! Boas-vindas ao escritório GGV\./)
  const chatwoot = janela.getByRole('region', { name: 'Na central do Chatwoot' })
  await expect(chatwoot).toContainText('Contato: Rosa Mensagem Teste · (11) 93333-2222')
  await expect(chatwoot.getByRole('link', { name: 'Abrir a conversa' })).toHaveAttribute('href', /chatwoot\.mapech\.com\.br\/app\/accounts\/.+\/conversations\/33332222$/)
  await janela.getByRole('button', { name: 'Enviar pelo Chatwoot' }).click()
  await expect(janela.getByText(/✓ Entregue no Chatwoot às \d\d:\d\d/)).toBeVisible()
  await janela.getByRole('button', { name: 'Fechar', exact: true }).last().click()
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText(/Chatwoot · \d\d:\d\d · entregue/)
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText('Boas-vindas ao escritório GGV.')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Enviou pelo Chatwoot a mensagem «Boas-vindas» (entregue)')
})

test('CA3, CA9 e G9 · a IA aponta o termo jurídico; o texto que esconde a situação ou pede a senha não sai', async ({ page }) => {
  await fichaDoLead(page, 'Rosa Portao Teste', '11933331111')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Rosa Portao Teste' })
  await janela.getByLabel('Modelo').selectOption('boas-vindas')
  // O modelo chega do servidor e troca o texto: escrever antes dele perde o que foi escrito (falhava com a CI lenta).
  await expect(janela.getByRole('textbox')).toHaveValue(/^Olá, Rosa! Boas-vindas ao escritório GGV\./)
  await janela.getByRole('textbox').fill('O pedido foi indeferido. Não conte ao perito que voltou a trabalhar.')
  await expect(janela.getByRole('list', { name: 'A IA aponta' })).toContainText('Termo jurídico "indeferido": diga "negado".')
  await expect(janela.getByText('Nunca oriente a esconder ou mudar a situação real (G11).')).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Enviar pelo Chatwoot' })).toBeDisabled()
  await janela.getByRole('textbox').fill('Mande a sua senha do gov.br por aqui.')
  await expect(janela.getByText('O escritório nunca pede a senha do gov.br por mensagem (G9).')).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Enviar pelo Chatwoot' })).toBeDisabled()
  // O servidor barra de novo, para quem tentar sem a tela.
  const id = new URL(page.url()).pathname.split('/').at(-1)
  const r = await page.request.post(`/api/fichas/${id}/mensagens`, { data: { modelo: 'boas-vindas', texto: 'Mande a sua senha do gov.br por aqui.', conversa: 33331111 } })
  expect([r.status(), (await r.json()).erro]).toEqual([400, 'O escritório nunca pede a senha do gov.br por mensagem (G9).'])
})

test('CA7 · o aviso de resultado favorável não sai daqui: vai pela tela do Financeiro, com o texto da prestação de contas (G8)', async ({ page }) => {
  await fichaDoLead(page, 'Rosa Resultado Teste', '11933330000')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Rosa Resultado Teste' })
  await janela.getByLabel('Modelo').selectOption('resultado-favoravel')
  await expect(
    janela.getByText('O aviso de resultado favorável sai pela tela «Avisar resultado e agendar a ida ao banco», do Financeiro, com o texto que a advogada revisou na prestação de contas (G8).'),
  ).toBeVisible()
  await expect(janela.getByRole('button', { name: 'Enviar pelo Chatwoot' })).toBeDisabled()
})

test('tema escuro e fonte grande na mensagem ao cliente', async ({ page }) => {
  await fichaDoLead(page, 'Rosa Escuro Teste', '11933339999')
  await page.goto(`${new URL(page.url()).pathname}?tema=escuro&fonte=grande`)
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  await expect(page.getByRole('dialog', { name: 'Mensagem ao cliente · Rosa Escuro Teste' })).toBeVisible()
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
