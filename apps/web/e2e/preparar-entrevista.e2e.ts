import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { ADVOGADA, entrarPelaApi } from './entrar.ts'

// GGVP-32 · Preparar a conversa lendo a ficha. Cada teste abre um navegador novo, então começa da semente de exemplo.ts:
// a entrevista da Josefa é hoje às 15:30, no relógio da máquina.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/** O Atendimento confirma a entrevista da Josefa dizendo que a ficha já foi preenchida: a advogada recebe a preparação. */
async function confirmarComFicha(page: Page) {
  await page.goto('/agenda/confirmar/josefa-entrevista')
  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByRole('radio', { name: 'Confirmou a entrevista' }).click()
  await page.getByRole('radio', { name: 'Sim, a doutora prepara a conversa' }).click()
  await page.getByRole('button', { name: 'Confirmar entrevista' }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista confirmada/ })).toBeVisible()
}

test('CA1, CA2 e CA4 · da Central da Advogada à preparação, com os pontos de atenção e a senha só pela situação', async ({ page }) => {
  await confirmarComFicha(page)
  await entrarPelaApi(page, ADVOGADA)
  await page.goto('/advogada')
  const tarefa = page.getByRole('link', { name: 'Josefa Exemplo · Preparar entrevista' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('atenção: sem senha do gov.br')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Preparar entrevista')
  await expect(page.getByRole('heading', { name: 'Resumo da ficha' })).toBeVisible()
  const pontos = page.getByRole('region', { name: 'Pontos de atenção' })
  await expect(pontos).toContainText('Sem senha do gov.br · o Atendimento ainda não tentou renovar')
  await expect(pontos).toContainText('Benefício que o cliente procura: LOAS Idoso')
  await expect(page.getByRole('button', { name: 'Iniciar entrevista (Transcrição)' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/')
})

test('CA5 · pela agenda, a preparação mostra a anotação do primeiro contato', async ({ page }) => {
  await entrarPelaApi(page, ADVOGADA)
  await page.goto('/agenda?ver=lista')
  await page.getByRole('button', { name: /Josefa Exemplo · Fazer entrevista/ }).click()
  await page.getByRole('link', { name: 'Preparar entrevista' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Preparar entrevista')
  await expect(page.getByRole('region', { name: 'Anotação do Atendimento no primeiro contato' })).toContainText('Perguntou do LOAS; marcou a entrevista.')
})

for (const caminho of ['/advogada', '/entrevista/josefa-entrevista/preparar']) {
  test(`tema escuro e fonte grande em ${caminho}`, async ({ page }) => {
    await entrarPelaApi(page, ADVOGADA)
    await page.goto(`${caminho}?tema=escuro&fonte=grande`)
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
    const corpo = page.locator('body')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })
}
