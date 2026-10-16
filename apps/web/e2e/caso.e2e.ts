import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-86 · Navegar pelo caso numa linha só: a página do processo do Antônio (judicial, exigência do juiz, perícia pedida
// pelo juiz e laudo novo), a do Pedro (administrativo, perito ainda não conhecido) e a recusa ao Atendimento e à
// Documentação, que leem o caso pela ficha (GGVP-162). Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1 a CA6, CA8 a CA12 · a advogada percorre o caso do Antônio numa linha só', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1')
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
  await expect(page.getByRole('dialog')).toContainText('Vigília (IA) (IA)')
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
  await page.getByRole('button', { name: 'Abrir Publicação no diário' }).click()
  await expect(page.getByRole('dialog')).toContainText('Origem: Diário (vigília)')
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('heading', { name: 'Prazos' }).locator('..')).not.toContainText('Vigília do Meu INSS')
})

test('CA7, CA13 · o Jurídico administrativo identifica o perito do Pedro em um clique; o caso aparece pelo NB', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/pedro-exemplo-1')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('456.123.789-6')
  await page.getByRole('group', { name: 'Identificar o perito' }).getByRole('button', { name: /Sra\. L\. Assis/ }).click()
  await expect(page.getByText(/Perito identificado: Sra\. L\. Assis/)).toBeVisible()
})

test('GGVP-162 · o Atendimento e a Documentação não abrem o processo; a ficha mostra o caso, sem link para a página dele', async ({ page }) => {
  for (const email of ['atendimento@exemplo.ggv', 'documentacao@exemplo.ggv']) {
    await entrarPelaApi(page, email)
    await page.goto('/casos/antonio-exemplo-1')
    await expect(page.getByRole('heading', { level: 1 }), email).toHaveText('Sem permissão')
    await expect(page.locator('main'), email).not.toContainText('Linha do processo')
  }
  // A ficha mostra o caso e o que falta, sem link para a página do processo (CA3); o laudo novo segue levando à análise.
  await entrarPelaApi(page)
  await page.goto('/clientes/antonio-exemplo')
  await expect(page.getByRole('link', { name: 'Laudo novo · 29/09' })).toHaveAttribute('href', '/casos/antonio-exemplo-1/laudo-novo')
  await expect(page.locator('a[href="/casos/antonio-exemplo-1"]')).toHaveCount(0)
})

// GGVP-146 (parte 5): o caso que nasceu no servidor lê a página do banco, na visão de quem está na sessão. A Maria (de
// exemplo) não é mexida por nenhum outro teste de tela: o banco do Playwright é um só para todos.
test('caso do servidor · a página do processo lê o banco: a advogada vê o laudo pelo nome; o Atendimento não abre (GGVP-162)', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  const tarefas: { casoId: string; cliente: { nome: string } }[] = await (await page.request.get('/api/tarefas')).json()
  const casoId = tarefas.find((t) => t.cliente.nome === 'Maria Souza (exemplo)')!.casoId
  await page.goto(`/casos/${casoId}`)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Maria Souza (exemplo)')
  await expect(page.getByText('Sem número ainda')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Etapas do processo' }).locator('[aria-current="step"]')).toContainText('INSS')
  const tarefasDoCaso = page.getByRole('heading', { name: 'Tarefas em andamento' }).locator('..')
  // A decisão da perícia (D2.03) tem tela própria; /casos/:id/pericia é a página da perícia.
  await expect(tarefasDoCaso.getByRole('link', { name: 'Decidir perícia' })).toHaveAttribute('href', `/casos/${casoId}/pericia/decidir`)
  await expect(tarefasDoCaso).toContainText('Jurídico administrativo')
  const dados = page.getByRole('heading', { name: 'Dados do processo' }).locator('..')
  await expect(dados).toContainText('Maria Souza (exemplo)')
  await expect(dados).toContainText('senha no cofre')
  await expect(dados).toContainText('Saúde (Jurídico)')
  await page.getByRole('button', { name: 'Abrir Laudo médico (exemplo).pdf' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Abrir o arquivo' })).toHaveAttribute('href', new RegExp(`^/api/casos/${casoId}/documentos/`))
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()

  // O Atendimento não abre o processo (GGVP-162): a tela diz "Sem permissão" e a API recusa.
  await entrarPelaApi(page)
  await page.goto(`/casos/${casoId}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sem permissão')
  expect((await page.request.get(`/api/casos/${casoId}/processo`)).status()).toBe(403)

  // O Financeiro não abre o caso.
  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  expect((await page.request.get(`/api/casos/${casoId}/processo`)).status()).toBe(403)
})

test('tema escuro e fonte grande na página do processo', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { name: 'Linha do processo · completa' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('html')).toHaveCSS('zoom', '1.25')
})
