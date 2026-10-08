import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-86 · Navegar pelo caso numa linha só: a página do processo do Antônio (judicial, exigência do juiz, perícia pedida
// pelo juiz e laudo novo), a do Pedro (administrativo, perito ainda não conhecido) e a visão do Atendimento. Cada teste
// começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1 a CA6, CA8 a CA12 · a advogada percorre o caso do Antônio numa linha só', async ({ page }) => {
  await page.goto('/casos/antonio-exemplo-1?perfil=advogada')
  const etapas = page.getByRole('navigation', { name: 'Etapas do processo' })
  await expect(etapas.locator('[aria-current="step"]')).toContainText('Vigília')
  await expect(etapas.getByRole('link', { name: /Em perícia/ })).toHaveAttribute('href', '/casos/antonio-exemplo-1/pericia')
  await expect(page.getByRole('link', { name: 'Laudo novo · 29/09' })).toHaveAttribute('href', '/casos/antonio-exemplo-1/laudo-novo')

  // Um passo feito: quem fez, quando e os documentos (CA4).
  await page.getByRole('button', { name: '✓ Entrevista' }).click()
  await expect(page.getByRole('heading', { name: /Entrevista · feita/ }).locator('..').locator('..')).toContainText('contrato-zapsign.pdf')

  // Setores, esperas de fora e tarefas (CA3, CA8, CA9).
  await expect(page.getByRole('heading', { name: 'Esperando os setores' }).locator('..')).toContainText('ainda não subiu o card')
  await expect(page.getByRole('heading', { name: 'Esperando alguém de fora' }).locator('..')).toContainText(/prazo \d{2}\/\d{2}/)
  await expect(page.getByRole('heading', { name: 'Tarefas em andamento' }).locator('..')).toContainText('Jurídico administrativo')

  // Jurimetria do juízo numa sobreposição, sem sair do caso (CA6).
  await page.getByRole('button', { name: 'Vara Federal de Santo Amaro (exemplo)' }).click()
  await expect(page.getByRole('dialog')).toContainText('58% · 7 de 12')
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).first().click()
  await expect(page).toHaveURL(/\/casos\/antonio-exemplo-1/)

  // O histórico e um documento aberto pelo caso (CA10, CA11); só os prazos do judicial (CA12).
  await page.getByRole('button', { name: /Histórico/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Vigília (IA) (IA) · D3a.01')
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Abrir Publicação no diário' }).click()
  await expect(page.getByRole('dialog')).toContainText('Origem: Diário (vigília)')
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('heading', { name: 'Prazos' }).locator('..')).not.toContainText('Vigília do Meu INSS')
})

test('CA7, CA13 · o Jurídico administrativo identifica o perito do Pedro em um clique; o caso aparece pelo NB', async ({ page }) => {
  await page.goto('/casos/pedro-exemplo-1?perfil=juridico-adm')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('456.123.789-6')
  await page.getByRole('group', { name: 'Identificar o perito' }).getByRole('button', { name: /Sra\. L\. Assis/ }).click()
  await expect(page.getByText(/Perito identificado: Sra\. L\. Assis/)).toBeVisible()
})

test('Permissão · o Atendimento vê o caso sem petição, estratégia, valores nem saúde', async ({ page }) => {
  await page.goto('/casos/antonio-exemplo-1?perfil=atendimento')
  await expect(page.getByRole('heading', { name: 'Linha do processo · completa' })).toBeVisible()
  await expect(page.getByText('Petição, estratégia e valores não aparecem para o Atendimento.')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('R$')
  await expect(page.locator('main')).not.toContainText('Petição inicial')
  // A ficha leva ao caso (CA5 na ficha: o laudo novo leva à análise).
  await page.goto('/clientes/antonio-exemplo')
  await expect(page.getByRole('link', { name: 'Laudo novo · 29/09' })).toHaveAttribute('href', '/casos/antonio-exemplo-1/laudo-novo')
})

test('tema escuro e fonte grande na página do processo', async ({ page }) => {
  await page.goto('/casos/antonio-exemplo-1?perfil=advogada&tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { name: 'Linha do processo · completa' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
