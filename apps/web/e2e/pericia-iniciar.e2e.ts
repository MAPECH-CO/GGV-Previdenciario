import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-49 · Iniciar a tarefa de perícia: a perícia médica da Maria, pedida pela advogada no D2.03 e liberada pelo INSS,
// abre sozinha a tarefa do Jurídico administrativo; o caso mostra "Em perícia" com a origem. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1 a CA4 · a tarefa aberta pelo sistema, a Central do Jurídico administrativo e o caso "Em perícia"', async ({ page }) => {
  // A advogada vê o que o sistema fez, o que veio preenchido, os prazos e o histórico (CA3, CA4; pedido do Lucas de 02/10).
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/aberta')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tarefa de perícia aberta pelo sistema')
  await expect(page.getByRole('list', { name: 'Preenchido pelo sistema' })).toContainText('Quem pediu: D2 · necessidade inicial · Dra. Paula (exemplo)')
  await expect(page.getByRole('list', { name: 'Preenchido pelo sistema' })).toContainText('Instância: INSS')
  await expect(page.getByText(/tentativa diária; a próxima é hoje/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Histórico da perícia' })).toContainText(
    'Sistema · Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de Dra. Paula (exemplo) (D2 · necessidade inicial)',
  )
  await expect(page.getByRole('link', { name: 'Ver a tarefa aberta' })).toHaveAttribute('href', '/casos/maria-exemplo-1/pericia/marcar')

  // A página do processo: perícia em andamento e o DP.01 do sistema na linha (CA1, CA4).
  await page.getByRole('link', { name: 'Abrir a página do processo' }).click()
  await expect(page).toHaveURL(/\/casos\/maria-exemplo-1\/pericia$/)
  await expect(page.getByRole('link', { name: '▶ Perícia INSS' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Linha da perícia' })).toContainText('O sistema: abriu a tarefa de perícia para o Jurídico administrativo')

  // A Central do Jurídico administrativo: "<nome> · Marcar perícia" e o chat "Perícias para marcar" (CA2).
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('link', { name: 'Maria Exemplo · Marcar perícia' })).toHaveAttribute('href', '/casos/maria-exemplo-1/pericia/marcar')
  await page.getByRole('button', { name: 'Perícias para marcar' }).click()
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/perícias? esperam? você/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tarefas sugeridas' }).getByRole('link', { name: /Maria Exemplo · Marcar perícia/ })).toBeVisible()

  // A ficha mostra o caso "Em perícia" com o diagrama de origem (CA1).
  await page.goto('/clientes/maria-exemplo')
  await expect(page.getByRole('link', { name: /Em perícia · pedido ao INSS \(D2\)/ })).toHaveAttribute('href', '/casos/maria-exemplo-1/pericia')
})

test('tema escuro e fonte grande na tarefa aberta pelo sistema', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/aberta?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tarefa de perícia aberta pelo sistema')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
