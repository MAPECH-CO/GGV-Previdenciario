import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

type Tokens = {
  cores: Record<string, { claro: string; escuro: string }>
  fontes: Record<string, { padrao: number; grande: number }>
}

const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))

// Desde o login (GGVP-117), as telas com dado pedem sessão.
test.beforeEach(({ page }) => entrarPelaApi(page))

/** "#121417" → "rgb(18, 20, 23)", que é como o navegador devolve a cor calculada. */
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

// Desde 11/10 o tamanho é livre (70% a 200%) e aumenta o portal inteiro, pelo zoom no <html>.
test.describe('CA2 · tema e tamanho', () => {
  test('o tema escuro e o "aumentar" mudam a tela inteira, e recarregar mantém a escolha', async ({ page }) => {
    const corpo = page.locator('body')
    const html = page.locator('html')
    await page.goto('/')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.claro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].padrao}px`)

    await page.getByRole('button', { name: 'Mudar para o tema escuro' }).click()
    await page.getByRole('button', { name: 'Aumentar o tamanho' }).click()
    await page.getByRole('button', { name: 'Aumentar o tamanho' }).click()
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(html).toHaveCSS('zoom', '1.2')
    await expect(page.getByRole('button', { name: /^Tamanho em 120%/ })).toBeVisible()

    await page.reload()
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(html).toHaveCSS('zoom', '1.2')
  })

  test('?tema=escuro&escala=130 já abre escuro e em 130%; o "fonte=grande" de antes abre em 125%', async ({ page }) => {
    const corpo = page.locator('body')
    await page.goto('/?tema=escuro&escala=130')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(page.locator('html')).toHaveCSS('zoom', '1.3')
    await page.goto('/?fonte=grande')
    await expect(page.locator('html')).toHaveCSS('zoom', '1.25')
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
  await page.getByRole('button', { name: 'Aumentar o tamanho' }).click()
  await expect(amostra).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  // Desde 11/10 o tamanho aumenta tudo pelo zoom; a fonte calculada segue a do token.
  await expect(page.locator('html')).toHaveCSS('zoom', '1.1')
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
