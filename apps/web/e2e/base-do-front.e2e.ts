import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

type Tokens = {
  cores: Record<string, { claro: string; escuro: string }>
  fontes: Record<string, { padrao: number; grande: number }>
}

const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))

/** "#121417" → "rgb(18, 20, 23)", que é como o navegador devolve a cor calculada. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test.describe('CA2 · tema e fonte', () => {
  test('"☾ Escuro" e "A+" mudam a tela inteira, e recarregar mantém a escolha', async ({ page }) => {
    const corpo = page.locator('body')
    await page.goto('/')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.claro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].padrao}px`)

    await page.getByRole('button', { name: 'Mudar para o tema escuro' }).click()
    await page.getByRole('button', { name: 'Aumentar a fonte' }).click()
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)

    await page.reload()
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })

  test('?tema=escuro&fonte=grande já abre escuro e grande', async ({ page }) => {
    const corpo = page.locator('body')
    await page.goto('/?tema=escuro&fonte=grande')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })
})

test('CA4 · tarefa urgente da Central tem o prazo na cor de ação', async ({ page }) => {
  await page.goto('/')
  // O aviso "Urgente:" é só para leitor de tela e mora dentro do prazo.
  const prazo = page.getByText('Urgente:').first().locator('..')
  await expect(prazo).toHaveCSS('color', rgb(tokens.cores.erro.claro))
})

test('CA6 · /tokens reage à troca de tema e de fonte', async ({ page }) => {
  await page.goto('/tokens')
  const item = (nome: string) => page.getByRole('listitem').filter({ has: page.getByText(nome, { exact: true }) })
  const amostra = item('cor/fundo').locator('span').first()
  const exemplo = item('fonte/13').getByText('Aposentadoria por idade')
  await expect(amostra).toHaveCSS('background-color', rgb(tokens.cores.fundo.claro))
  await expect(exemplo).toHaveCSS('font-size', `${tokens.fontes['13'].padrao}px`)

  await page.getByRole('button', { name: 'Mudar para o tema escuro' }).click()
  await page.getByRole('button', { name: 'Aumentar a fonte' }).click()
  await expect(amostra).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(exemplo).toHaveCSS('font-size', `${tokens.fontes['13'].grande}px`)
})

test('CA7 · caminho sem tela avisa, e "Voltar ao início" leva à Central', async ({ page }) => {
  await page.goto('/qualquer-coisa')
  await expect(page.getByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeVisible()
  await expect(page.getByText('/qualquer-coisa')).toBeVisible()

  await page.getByRole('link', { name: 'Voltar ao início' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
})

test('CA9 · cada tela tem o próprio título na aba do navegador', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Início · GGV Previdenciário')
  await page.goto('/tokens')
  await expect(page).toHaveTitle('Tokens do Figma · GGV Previdenciário')
  await page.goto('/qualquer-coisa')
  await expect(page).toHaveTitle('Tela não construída · GGV Previdenciário')
})
