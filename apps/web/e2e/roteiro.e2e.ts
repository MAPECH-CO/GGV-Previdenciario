import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-93 · Roteiro de conteúdo mínimo por benefício: a sênior edita e nasce a versão 2; a advogada só vê; o Atendimento
// não vê. Cada teste começa da semente de exemplo.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1 e CA2 · a sênior abre o roteiro do LOAS Deficiente, edita um item e salva a versão 2', async ({ page }) => {
  await page.goto('/roteiros?perfil=senior')
  // GGVP-50: o roteiro infantil também começa com "BPC/LOAS Deficiente"; o do adulto é o primeiro.
  await expect(page.getByRole('link', { name: /BPC\/LOAS Deficiente/ }).first()).toHaveAttribute('href', '/roteiros/loas-deficiente')
  // O perfil escolhido pelo endereço vale para a página aberta (dados/perfis.ts).
  await page.goto('/roteiros/loas-deficiente?perfil=senior')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('BPC/LOAS Deficiente · Roteiro de conteúdo mínimo')
  await expect(page.getByRole('list', { name: 'Contradições que bloqueiam (G18)' })).toContainText('menor que 24 meses')

  await page.getByRole('button', { name: 'Editar o roteiro' }).click()
  const prognostico = page.getByRole('textbox', { name: 'Texto do item' }).nth(2)
  await prognostico.fill('Prognóstico: duração prevista em meses, ou permanente')
  await page.getByRole('button', { name: 'Salvar como versão 2' }).click()
  await expect(page.getByRole('heading', { name: '✓ Nova versão salva' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Versões' }).getByRole('listitem').first()).toContainText('Versão 2 · em vigor')
  await expect(page.getByRole('list', { name: 'Versões' }).getByRole('listitem').first()).toContainText('1 item alterado')
})

test('CA1 · a advogada vê o roteiro sem editar; o Atendimento não vê', async ({ page }) => {
  await page.goto('/roteiros/pcd?perfil=advogada')
  await expect(page.getByRole('list', { name: 'Contradições que bloqueiam (G18)' })).toContainText('incapacidade total para o trabalho')
  await expect(page.getByRole('button', { name: 'Editar o roteiro' })).toHaveCount(0)
  await page.goto('/roteiros/pcd?perfil=atendimento')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('O roteiro de laudos é do Jurídico')
})

test('tema escuro e fonte grande no roteiro', async ({ page }) => {
  await page.goto('/roteiros/auxilio-acidente?perfil=senior&tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Auxílio-Acidente · Roteiro de conteúdo mínimo')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Versões' }) })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
