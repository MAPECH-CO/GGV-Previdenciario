import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { CPF_DE_TESTE, telefoneDeExemplo } from '../src/dados/exemplo.ts'
import { entrarPelaApi } from './entrar.ts'

// GGVP-16 · Reconhecer quem chegou e para quê: balcão, novo cliente e ficha, sobre o servidor de exemplo.
// Cada teste abre um navegador novo, então começa da semente de exemplo.ts.

type Tokens = {
  cores: Record<string, { claro: string; escuro: string }>
  fontes: Record<string, { padrao: number; grande: number }>
}

const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
const PRETENDE = 'Quer saber da aposentadoria por idade.'

async function buscar(page: Page, termo: string) {
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill(termo)
}

async function preencherMinimo(page: Page, nome: string, telefone: string) {
  await page.getByLabel('Nome completo *').fill(nome)
  await page.getByLabel('Idade *').fill('58')
  await page.getByLabel('Telefone / WhatsApp *').fill(telefone)
  await page.getByLabel('O que a pessoa pretende *').fill(PRETENDE)
}

// Com o lead no servidor (GGVP-125), a busca junta o banco do portal, que tem a "Rosa Amaral (exemplo)": por isso a busca
// de quem não existe é "rosana", a ficha nova tem o id do banco e a contagem final olha só a Rosa Exemplo.
test('CA3, CA13, CA14 e CA16 · do balcão ao novo cliente e à ficha, com uma ficha e uma pasta só', async ({ page }) => {
  await page.goto('/balcao')
  await buscar(page, 'rosana')
  await page.getByRole('link', { name: '+ Novo cliente' }).click()
  await expect(page).toHaveURL('/clientes/novo')

  await preencherMinimo(page, 'Rosa Exemplo', telefoneDeExemplo(51))
  await page.getByRole('button', { name: 'Salvar apenas' }).dblclick()
  const pastas = page.getByRole('group', { name: /Há 2 pastas no Drive/ })
  await pastas.getByRole('radio', { name: 'Clientes/2024/Rosa Exemplo' }).check()
  await pastas.getByRole('button', { name: 'Usar esta pasta' }).click()

  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Rosa Exemplo' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText(PRETENDE)
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Ligou à pasta que já existia no Drive: Clientes/2024/Rosa Exemplo')

  await page.goto('/balcao')
  await buscar(page, 'rosa')
  await expect(page.getByRole('list', { name: 'Pessoas encontradas' }).getByRole('button', { name: /Rosa Exemplo/ })).toHaveCount(1)
})

test('CA6 · CPF que já existe abre a ficha que já existe', async ({ page }) => {
  await page.goto('/clientes/novo')
  await preencherMinimo(page, 'Antônio Exemplo', telefoneDeExemplo(1))
  await page.getByLabel('CPF (opcional)').fill(CPF_DE_TESTE)
  await page.getByLabel('CPF (opcional)').blur()
  await expect(page.getByRole('region', { name: 'Já existe?' })).toContainText('Este CPF já está na ficha de Antônio Exemplo')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await expect(page).toHaveURL('/clientes/antonio-exemplo')
})

test('CA4, CA7 e CA8 · encaminhar à Documentação: pede o setor, entra na Central e fica no histórico', async ({ page }) => {
  await page.goto('/balcao')
  await buscar(page, 'rita')
  await page.getByRole('button', { name: /Rita Exemplo/ }).click()
  await page.getByRole('radio', { name: 'Outra etapa' }).click()
  const encaminhar = page.getByRole('button', { name: 'Encaminhar' })
  await expect(encaminhar).toBeDisabled()
  await page.getByRole('radio', { name: 'Documentação · ADM' }).click()
  await encaminhar.click()
  const feito = page.getByRole('region', { name: /Encaminhado ao setor Documentação · ADM/ })
  await expect(feito).toBeVisible()

  await feito.getByRole('link', { name: 'Abrir a ficha do cliente' }).click()
  const historico = page.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Ana (exemplo)')
  await expect(historico).toContainText('Encaminhou ao setor Documentação · ADM')

  // A tarefa vai à Central da Documentação, não à do Atendimento (GGVP-130).
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Início do Atendimento' })).toBeAttached()
  await expect(page.getByRole('link', { name: /Rita Exemplo.*Atender quem chegou/ })).toHaveCount(0)
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Rita Exemplo.*Atender quem chegou/ }).first()).toBeVisible()
})

test('CA15 · letra não entra no CPF, no telefone nem na idade', async ({ page }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('CPF (opcional)').pressSequentially('ab0c')
  await expect(page.getByLabel('CPF (opcional)')).toHaveValue('0')
  await page.getByLabel('Telefone / WhatsApp *').pressSequentially('x1y1')
  await expect(page.getByLabel('Telefone / WhatsApp *')).toHaveValue('11')
  await page.getByLabel('Idade *').pressSequentially('5a8')
  await expect(page.getByLabel('Idade *')).toHaveValue('58')

  await page.goto('/clientes/josefa-exemplo')
  await page.getByLabel('Telefone / WhatsApp *').fill('')
  await page.getByLabel('Telefone / WhatsApp *').pressSequentially('z9')
  await expect(page.getByLabel('Telefone / WhatsApp *')).toHaveValue('9')
})

for (const caminho of ['/balcao', '/clientes/novo', '/clientes/antonio-exemplo']) {
  test(`tema escuro e fonte grande em ${caminho}`, async ({ page }) => {
    await page.goto(`${caminho}?tema=escuro&fonte=grande`)
    const corpo = page.locator('body')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
    await expect(page.locator('header').first()).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
  })
}
