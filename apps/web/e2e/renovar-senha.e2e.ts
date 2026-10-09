import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { ADVOGADA, entrarPelaApi } from './entrar.ts'

// GGVP-36 · Renovar a senha do gov.br antes da entrevista. Cada teste abre um navegador novo, então começa da semente de
// exemplo.ts: a Josefa está sem senha e a entrevista dela é hoje às 15:30, no relógio da máquina.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** Senha de teste: não pode aparecer na tela nem no armazenamento depois de guardada (G9). */
const SENHA_DE_TESTE = 'Teste#Renovada-4821'

/** A advogada analisa a ficha da Josefa ("Não" ao acidentário); sem senha, o Atendimento recebe a renovação. */
async function analisarSemSenha(page: Page) {
  await entrarPelaApi(page, ADVOGADA)
  await page.goto('/entrevista/josefa-entrevista/analisar')
  await page.getByRole('radio', { name: 'Não' }).click()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText(/O Atendimento recebeu: "Renovar senha do gov.br" até 15:30/)).toBeVisible()
  // A renovação (D1.08) é do Atendimento: volta ao login dele.
  await entrarPelaApi(page)
}

test('CA1, CA2, CA7 e CA9 · da análise sem senha à tarefa na Central; renovar com a senha só no cofre e a advogada vê', async ({ page }) => {
  await analisarSemSenha(page)
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Josefa Exemplo · Renovar senha do gov.br' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('até 15:30')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Renovar senha do gov.br')
  await page.getByRole('radio', { name: 'Sim' }).click()
  await page.getByLabel('Nova senha do gov.br (vai direto ao cofre, G9)').fill(SENHA_DE_TESTE)
  await expect(page.getByRole('button', { name: 'Guardar no cofre' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Conferi que o Meu INSS abre e que o CNIS aparece' }).check()
  await page.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(page.getByRole('heading', { name: /✓ senha no cofre · atualizada em .* por Ana \(exemplo\)/ })).toBeVisible()
  expect(await page.content()).not.toContain(SENHA_DE_TESTE)
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(SENHA_DE_TESTE)

  await entrarPelaApi(page, ADVOGADA)
  await page.goto('/entrevista/josefa-entrevista/preparar')
  await expect(page.getByRole('region', { name: 'Pontos de atenção' })).toContainText('Senha do gov.br no cofre · funcionou pela última vez em')
  await expect(page.getByRole('link', { name: 'Iniciar entrevista (Transcrição)' })).toBeVisible()
})

test('CA3 e CA6 · "Não conseguiu": motivo e aviso obrigatórios, o aviso nos contatos e a entrevista segue', async ({ page }) => {
  await analisarSemSenha(page)
  await page.goto('/entrevista/josefa-entrevista/renovar-senha')
  await page.getByRole('radio', { name: 'Não' }).click()
  await page.getByLabel('Por que não foi possível *').fill('o celular cadastrado não é mais dela')
  await expect(page.getByRole('button', { name: 'Registrar' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /Avisei o cliente/ }).check()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('heading', { name: '✓ Registrado: não foi possível renovar' })).toBeVisible()

  await page.goto('/clientes/josefa-exemplo')
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText('se preciso numa agência do INSS')
  await entrarPelaApi(page, ADVOGADA)
  await page.goto('/entrevista/josefa-entrevista/preparar')
  await expect(page.getByRole('region', { name: 'Pontos de atenção' })).toContainText('o Atendimento tentou renovar e não conseguiu: o celular cadastrado não é mais dela')
})

test('tema escuro e fonte grande na renovação', async ({ page }) => {
  await page.goto('/entrevista/josefa-entrevista/renovar-senha?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Renovar senha do gov.br')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
