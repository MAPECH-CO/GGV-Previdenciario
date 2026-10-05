import { expect, test } from '@playwright/test'

test.describe('Trocar perfil (perfis de exemplo, só na tela)', () => {
  test('"Entrar como…" abre embaixo da função, como no Figma', async ({ page }) => {
    await page.goto('/')
    const funcao = page.getByRole('button', { name: 'Atendimento', exact: true })
    await funcao.click()

    const menu = page.getByRole('menu', { name: 'Entrar como…' })
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS('width', '280px')
    const caixaBotao = await funcao.boundingBox()
    const caixaMenu = await menu.boundingBox()
    expect(caixaMenu!.y).toBeGreaterThan(caixaBotao!.y + caixaBotao!.height)
  })

  test('trocar leva à tela inicial da função e troca a ação do topo; a escolha fica', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Atendimento', exact: true }).click()
    await page.getByRole('menuitemradio', { name: /^Sênior/ }).click()

    // Sênior ainda não tem Central: cai na tela "não construída".
    await expect(page).toHaveURL('/senior')
    await expect(page.getByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeVisible()

    // A escolha fica: de volta à Central, a barra mostra a Sênior, sem "+ Novo cliente" (o Figma dela não tem).
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page.getByRole('button', { name: 'Sênior', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: '+ Novo cliente' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Sênior', exact: true }).click()
    await page.getByRole('menuitemradio', { name: /^Documentação/ }).click()
    await expect(page.getByRole('button', { name: 'Documentação', exact: true })).toBeVisible()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: '+ Novo cliente' })).toBeVisible()
  })

  test('?perfil=documentacao já abre como Documentação', async ({ page }) => {
    await page.goto('/?perfil=documentacao')
    await expect(page.getByRole('button', { name: 'Documentação', exact: true })).toBeVisible()
  })
})
