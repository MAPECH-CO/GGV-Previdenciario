import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-95 · Classificar cada documento médico que entra: o laudo da Rita com o médico e o registro, reclassificado e
// arquivado, com a correção no histórico; o laudo ilegível vira pendência do Atendimento. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

test('CA1, CA2 e CA10 · o laudo da Rita: médico e registro, a correção do tipo no histórico e o checklist recalculado', async ({ page }) => {
  await page.goto('/clientes/rita-exemplo/conferir-documentos')
  const laudo = page.getByRole('list', { name: 'Documentos lidos pela IA' }).getByRole('listitem').filter({ hasText: 'Laudo médico' })
  await expect(laudo).toContainText('emitido em 20/08/2026 · Dra. Exemplo Neurologista · CRM-SP 000000 · confiança 62%')
  await expect(laudo).toContainText('o conteúdo fica com o Jurídico')

  await page.getByRole('button', { name: 'Reclassificar' }).click()
  await page.getByRole('combobox', { name: /Tipo de Laudo medico/ }).selectOption('relatorio-medico')
  await expect(page.getByText('corrigido: a IA sugeriu Laudo médico')).toBeVisible()
  await page.getByRole('radio', { name: 'Manter os dois' }).click()
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('heading', { name: /✓ Arquivado às/ })).toBeVisible()
  await expect(page.getByText(/O checklist do LOAS Deficiente foi recalculado com o que entrou\. Ainda falta:/)).toBeVisible()

  await page.goto('/clientes/rita-exemplo')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('a IA sugeriu Laudo médico; ficou Relatório médico')
})

test('CA3 · o laudo ilegível que sobe pelo card vira "Pedir documento legível" na Central, com o original guardado', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: /Solte os documentos do cliente aqui/ }).click()
  const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
  await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles([pdf('laudo ilegivel.pdf')])
  await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(janela).toBeHidden()

  await page.goto('/')
  const pedir = page.getByRole('link', { name: 'Maria Exemplo · Pedir documento legível' })
  await expect(pedir).toHaveAttribute('href', '/clientes/maria-exemplo')
  await page.goto('/clientes/maria-exemplo/conferir-documentos')
  await expect(page.getByRole('list', { name: 'Documentos ilegíveis' })).toContainText('O original fica guardado na pasta')
})

test('tema escuro e fonte grande na conferência do documento médico', async ({ page }) => {
  await page.goto('/clientes/rita-exemplo/conferir-documentos?tema=escuro&fonte=grande')
  await expect(page.getByText('Dra. Exemplo Neurologista', { exact: false })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
