import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-21 · Confirmar o agendamento do lead. Cada teste abre um navegador novo, então começa da semente de exemplo.ts:
// a entrevista da Josefa é hoje às 15:30, no relógio da máquina.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

async function ligarERegistrar(page: Page, resultado: 'Confirmou a entrevista' | 'Sem resposta', ficha?: 'Sim, a doutora prepara a conversa' | 'Não, enviar a ficha à cliente') {
  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByRole('radio', { name: resultado }).click()
  if (ficha) await page.getByRole('radio', { name: ficha }).click()
  await page.getByRole('button', { name: resultado === 'Sem resposta' ? 'Registrar tentativa' : 'Confirmar entrevista' }).click()
}

test('CA3 e CA5 · da Central à confirmação por ligação, com ficha: o Jurídico prepara e fica no histórico', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Josefa Exemplo · Confirmar agendamento' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Confirmar agendamento')
  await expect(page.getByRole('button', { name: 'Confirmar entrevista' })).toBeDisabled()
  await ligarERegistrar(page, 'Confirmou a entrevista', 'Sim, a doutora prepara a conversa')
  await expect(page.getByRole('heading', { name: /✓ Entrevista confirmada/ })).toBeVisible()
  await expect(page.getByText('Dra. Paula recebeu "Preparar entrevista" com a ficha de Josefa.')).toBeVisible()

  await page.getByRole('link', { name: 'Abrir a ficha do cliente' }).last().click()
  const historico = page.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Confirmou a entrevista de hoje às 15:30 (ligação, tentativa 1)')
  await expect(historico).toContainText('Mandou ao Jurídico: preparar a entrevista de hoje às 15:30')
})

test('CA1 e CA8 · o Chatwoot abre com a mensagem do LOAS e os quatro documentos', async ({ page }) => {
  await page.goto('/agenda/confirmar/josefa-entrevista')
  await page.getByRole('button', { name: 'Chatwoot' }).click()
  const chatwoot = page.getByRole('dialog', { name: 'Chatwoot · conversa com Josefa Exemplo' })
  const mensagem = chatwoot.getByLabel('Mensagem de confirmação (confira antes de enviar)')
  await expect(mensagem).toHaveValue(/RG e CPF de todos da casa, comprovante de renda e CadÚnico/)
  await expect(mensagem).toHaveValue(/biometria, CadÚnico, senha do Meu INSS e comprovantes de gastos/)
  await chatwoot.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status')).toContainText('Mensagem de confirmação enviada pelo Chatwoot')
})

test('CA2 e CA7 · confirmou sem ficha: a Central mostra "Preencher ficha" até a hora da entrevista', async ({ page }) => {
  await page.goto('/agenda/confirmar/josefa-entrevista')
  await ligarERegistrar(page, 'Confirmou a entrevista', 'Não, enviar a ficha à cliente')
  await expect(page.getByText(/Ficou a pendência "Preencher ficha" até 15:30/)).toBeVisible()
  await page.goto('/')
  const pendencia = page.getByRole('link', { name: 'Josefa Exemplo · Preencher ficha' })
  await expect(pendencia).toHaveAttribute('href', '/clientes/josefa-exemplo/ficha-de-atendimento')
  await expect(page.getByRole('listitem').filter({ has: pendencia })).toContainText('até 15:30')
  await expect(page.getByRole('link', { name: 'Josefa Exemplo · Confirmar agendamento' })).toHaveCount(0)
})

test('CA6 · duas tentativas sem resposta, com 3 dias entre elas: a tarefa vai para a advogada sênior', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 5, 14, 32))
  // Uma entrevista da Natália no quinto dia útil, para as duas tentativas caberem antes dela.
  await page.goto('/agenda/marcar/natalia-exemplo')
  await page.getByLabel(/Enviar convite e lembrete/).uncheck()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').last().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '10:30' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista marcada/ })).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Natália Exemplo · Confirmar agendamento' }).click()
  await expect(page.getByText('Tentativa 1 de 2 · a próxima em 3 dias · sem resposta na segunda, sobe para a sênior (G15)')).toBeVisible()
  await ligarERegistrar(page, 'Sem resposta')
  await expect(page.getByText('Sem resposta: a próxima tentativa é em 08/10.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Sem resposta' })).toBeDisabled()

  await page.clock.setFixedTime(new Date(2026, 9, 8, 9, 0))
  await page.reload()
  await expect(page.getByText('Tentativa 2 de 2 · sem resposta na segunda, sobe para a sênior (G15)')).toBeVisible()
  await ligarERegistrar(page, 'Sem resposta')
  await expect(page.getByText(/a tarefa passou para a advogada sênior/)).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Natália Exemplo · Confirmar agendamento' })).toHaveCount(0)
})

test('tema escuro e fonte grande na confirmação', async ({ page }) => {
  await page.goto('/agenda/confirmar/josefa-entrevista?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Confirmar agendamento')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
