import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-24 · Preencher a ficha de atendimento. Cada teste abre um navegador novo, então começa da semente de exemplo.ts.
// A semente só tem um CPF, o de teste, que é do Antônio: o caminho que salva usa a ficha dele.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** Senha de teste: não pode aparecer na tela nem no armazenamento depois de guardada (CA9). */
const SENHA_DE_TESTE = 'Teste#Senha-9137'

test('CA5 e CA14 · da pendência à ficha em papel lida pela IA; sem CPF e data de nascimento, não salva', async ({ page }) => {
  await page.goto('/agenda/confirmar/josefa-entrevista')
  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByRole('radio', { name: 'Confirmou a entrevista' }).click()
  await page.getByRole('radio', { name: 'Não, enviar a ficha à cliente' }).click()
  await page.getByRole('button', { name: 'Confirmar entrevista' }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista confirmada/ })).toBeVisible()
  await page.goto('/')
  await page.getByRole('link', { name: 'Josefa Exemplo · Preencher ficha' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Preencher ficha')

  await page.getByRole('button', { name: 'Digitalizar a ficha em papel (scanner simulado)' }).click()
  await expect(page.getByText(/Ficha de atendimento GGV - Josefa Exemplo - .* em Documentos pessoais/)).toContainText('não leu: CPF, Data de nascimento e Endereço')
  await expect(page.getByLabel('Última atividade')).toHaveValue('auxiliar de limpeza, com carteira, até 05/2026')
  await expect(page.getByRole('button', { name: 'Conferi a senha do cofre com o papel' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar ficha' })).toBeDisabled()
  await expect(page.getByText('Falta: CPF e Data de nascimento.')).toBeVisible()
})

test('CA4, CA6 e CA9 · salva com campos em branco, o cartão mostra o que ficou em branco e a senha de teste não aparece', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo/ficha-de-atendimento')
  await page.getByLabel('Data de nascimento *').fill('10/03/1964')
  await page.getByLabel('Data de nascimento *').blur()
  await expect(page.getByText('62 anos')).toBeVisible()
  await page.getByLabel(/Trocar a senha|Digite a senha/).fill(SENHA_DE_TESTE)
  await page.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(page.getByText(/gov.br: senha no cofre · atualizada em .* por Você \(Atendimento\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Salvar ficha' }).click()
  await expect(page.getByRole('heading', { name: /✓ Ficha salva/ })).toBeVisible()

  expect(await page.content()).not.toContain(SENHA_DE_TESTE)
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(SENHA_DE_TESTE)

  await page.getByRole('link', { name: 'Abrir a ficha do cliente' }).last().click()
  const cartao = page.getByRole('region', { name: 'Ficha de atendimento' })
  await expect(cartao).toContainText('Em branco: Endereço, Quantas pessoas moram na casa, Última atividade, Desde quando está sem trabalhar, O que já pediu ao INSS.')
  await expect(cartao).toContainText('gov.br: senha no cofre')
  expect(await page.content()).not.toContain(SENHA_DE_TESTE)
})

test('CA1 · no tablet, uma pergunta por vez até salvar', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo/ficha-de-atendimento?modo=tablet')
  await expect(page.getByText('Pergunta 1 de 11')).toBeVisible()
  await page.getByRole('button', { name: 'Próxima' }).click()
  await page.getByRole('button', { name: 'Próxima' }).click()
  await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  await page.getByLabel('Qual é a sua data de nascimento?').fill('10/03/1964')
  await page.getByLabel('Qual é a sua data de nascimento?').blur()
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Próxima' }).click()
  await expect(page.getByText('Você sabe a senha do gov.br?')).toBeVisible()
  await expect(page.getByText(/gov.br: senha no cofre/)).toBeVisible()
  await page.getByRole('button', { name: 'Salvar ficha' }).click()
  await expect(page.getByText('Obrigado! Sua ficha foi salva. Devolva o tablet ao balcão.')).toBeVisible()
})

for (const caminho of ['/clientes/josefa-exemplo/ficha-de-atendimento', '/clientes/josefa-exemplo/ficha-de-atendimento?modo=tablet']) {
  test(`tema escuro e fonte grande em ${caminho}`, async ({ page }) => {
    await page.goto(`${caminho}${caminho.includes('?') ? '&' : '?'}tema=escuro&fonte=grande`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const corpo = page.locator('body')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })
}
