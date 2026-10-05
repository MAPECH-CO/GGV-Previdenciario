import { expect, test } from '@playwright/test'

test.describe('Trocar perfil (perfis de exemplo, só na tela)', () => {
  test('"Entrar como…" abre embaixo da função, troca o perfil e recarregar mantém a escolha', async ({ page }) => {
    await page.goto('/')
    const funcao = page.getByRole('button', { name: 'Atendimento', exact: true })
    await funcao.click()

    const menu = page.getByRole('menu', { name: 'Entrar como…' })
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS('width', '280px')
    const caixaBotao = await funcao.boundingBox()
    const caixaMenu = await menu.boundingBox()
    expect(caixaMenu!.y).toBeGreaterThan(caixaBotao!.y + caixaBotao!.height)

    await page.getByRole('menuitemradio', { name: /^Sênior/ }).click()
    await expect(menu).toBeHidden()
    await expect(page.getByRole('button', { name: 'Sênior', exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Sênior', exact: true })).toBeVisible()
  })

  test('?perfil=documentacao já abre como Documentação', async ({ page }) => {
    await page.goto('/?perfil=documentacao')
    await expect(page.getByRole('button', { name: 'Documentação', exact: true })).toBeVisible()
  })
})
