import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-28 · Segunda ficha para auxílio acidentário. Cada teste abre um navegador novo, então começa da semente de
// exemplo.ts: a entrevista da Josefa é hoje às 15:30, no relógio da máquina.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1, CA2, CA3, CA6 e CA8 · da análise com "Sim" à segunda ficha em papel, as duas fichas juntas e a entrevista liberada', async ({ page }) => {
  await page.goto('/entrevista/josefa-entrevista/preparar')
  await page.getByRole('link', { name: 'Analisar a ficha' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Analisar ficha')
  await page.getByRole('radio', { name: 'Sim — abrir 2ª ficha' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/O Atendimento recebeu: "Preencher segunda ficha"/)).toBeVisible()

  await page.getByRole('link', { name: 'Voltar à preparação' }).click()
  await expect(page.getByText('A cliente ainda não preencheu a segunda ficha (auxílio acidentário).')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Iniciar entrevista (Transcrição)' })).toBeDisabled()

  await page.goto('/')
  await page.getByRole('link', { name: 'Josefa Exemplo · Preencher segunda ficha' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Preencher segunda ficha')
  await page.getByRole('button', { name: 'Digitalizar a segunda ficha (scanner simulado)' }).click()
  await expect(page.getByLabel('Empresa')).toHaveValue('Exemplo Indústria Ltda')
  await expect(page.getByRole('region', { name: '5. Dados médicos' })).toContainText('Só o Jurídico vê')
  expect(await page.content()).not.toContain('perda de força')
  await page.getByRole('button', { name: 'Enviar segunda ficha' }).click()
  await expect(page.getByRole('heading', { name: /✓ Segunda ficha salva/ })).toBeVisible()

  await page.goto('/entrevista/josefa-entrevista/preparar')
  await expect(page.getByRole('region', { name: 'Segunda ficha (auxílio acidentário)' })).toContainText('dor e perda de força na mão')
  await expect(page.getByRole('link', { name: 'Iniciar entrevista (Transcrição)' })).toBeVisible()

  await page.goto('/clientes/josefa-exemplo')
  await expect(page.getByText(/Segunda ficha \(auxílio acidentário\): preenchida em/)).toBeVisible()
  expect(await page.content()).not.toContain('perda de força')
})

for (const caminho of ['/entrevista/josefa-entrevista/analisar', '/clientes/josefa-exemplo/segunda-ficha', '/clientes/josefa-exemplo/segunda-ficha?modo=tablet']) {
  test(`tema escuro e fonte grande em ${caminho}`, async ({ page }) => {
    await page.goto(`${caminho}${caminho.includes('?') ? '&' : '?'}tema=escuro&fonte=grande`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const corpo = page.locator('body')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })
}
