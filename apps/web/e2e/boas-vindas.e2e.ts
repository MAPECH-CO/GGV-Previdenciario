import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-97 · Boas-vindas ao cliente: depois da conferência do checklist, conferir a mensagem e enviar pelo Chatwoot
// simulado; quem já era cliente não recebe; sem telefone, a falha vira tarefa. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1, CA2, CA4 e CA5 · conferido o checklist, a mensagem com as pendências sai uma vez pelo Chatwoot e fica no histórico', async ({ page }) => {
  await page.goto('/casos/rita-exemplo-1/checklist')
  const bloco = page.getByRole('region', { name: 'Boas-vindas (D1.22)' })
  await expect(bloco).toContainText('Depois de concluir a conferência do checklist')
  await page.getByRole('button', { name: 'Concluir a conferência' }).click()

  const mensagem = bloco.getByRole('textbox', { name: 'Mensagem (confira antes de enviar)' })
  await expect(mensagem).toHaveValue(/Olá, Rita! Boas-vindas ao escritório GGV\./)
  await expect(mensagem).toHaveValue(/ainda precisamos destes documentos: Documento pessoal \(RG\)/)
  const enviar = bloco.getByRole('button', { name: 'Enviar pelo Chatwoot' })
  await expect(enviar).toBeDisabled()
  await bloco.getByRole('checkbox', { name: 'Conferi a mensagem' }).check()
  await enviar.click()
  await expect(bloco).toContainText(/hoje às \d\d:\d\d · Chatwoot/)
  await expect(bloco.getByRole('button', { name: /pelo Chatwoot/ })).toHaveCount(0)

  await page.goto('/clientes/rita-exemplo')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Enviou as boas-vindas pelo Chatwoot')
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText('Boas-vindas, com as cópias do kit e o que falta.')
})

test('CA3 · quem já era cliente não recebe as boas-vindas', async ({ page }) => {
  await page.goto('/casos/cleide-exemplo-2/checklist')
  await expect(page.getByText('já era cliente · sem boas-vindas')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Boas-vindas (D1.22)' })).toContainText('as boas-vindas só vão ao cliente novo')
})

test('CA6 · sem telefone, a falha fica no histórico e vira "Reenviar boas-vindas" na Central', async ({ page }) => {
  await page.goto('/casos/marta-exemplo-1/checklist')
  await page.getByRole('button', { name: 'Concluir a conferência' }).click()
  const bloco = page.getByRole('region', { name: 'Boas-vindas (D1.22)' })
  await bloco.getByRole('checkbox', { name: 'Conferi a mensagem' }).check()
  await bloco.getByRole('button', { name: 'Enviar pelo Chatwoot' }).click()
  await expect(bloco).toContainText('a ficha não tem telefone')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Marta Exemplo · Reenviar boas-vindas' })).toHaveAttribute('href', '/casos/marta-exemplo-1/checklist')
})

test('tema escuro e fonte grande nas boas-vindas', async ({ page }) => {
  await page.goto('/casos/rita-exemplo-1/checklist?tema=escuro&fonte=grande')
  const bloco = page.getByRole('region', { name: 'Boas-vindas (D1.22)' })
  await expect(bloco).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
