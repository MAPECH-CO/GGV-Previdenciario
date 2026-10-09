import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { ADVOGADA, entrarPelaApi } from './entrar.ts'

// GGVP-51 · Definir o benefício com apoio do acervo. Cada teste abre um navegador novo, então começa da semente de
// exemplo.ts: a advogada da Josefa não cita benefício na entrevista; a da Natália cita a aposentadoria por invalidez.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

// As telas do Jurídico pedem o perfil (GGVP-135): a advogada entra pela API.
test.beforeEach(async ({ page }) => entrarPelaApi(page, ADVOGADA))

/** A entrevista gravada e transcrita, com o relógio do Playwright. */
async function entrevistaTranscrita(page: Page, agendamentoId: string) {
  await page.clock.install()
  await page.goto(`/entrevista/${agendamentoId}/gravacao`)
  await page.getByRole('button', { name: 'Gravar' }).click()
  await page.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await page.getByRole('button', { name: 'Começar a gravar' }).click()
  await expect(page.getByText(/● Gravando/)).toBeVisible()
  await page.clock.runFor(140_000)
  await page.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(page.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
}

test('CA2, CA3, CA4, CA6 e CA7 · da tarefa à sugestão com a base e os requisitos; recusar com motivo e ver no histórico', async ({ page }) => {
  await entrevistaTranscrita(page, 'josefa-entrevista')
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Josefa Exemplo · Definir benefício' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Definir benefício')
  const ia = page.getByRole('region', { name: 'A IA sugere · você confere' })
  await expect(ia).toContainText('Auxílio por Incapacidade Temporária')
  await expect(page.getByRole('list', { name: 'Casos parecidos do acervo' }).getByRole('listitem')).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'Requisitos de Auxílio por Incapacidade Temporária' })).toContainText('(calculado por código, G19)')
  await expect(page.getByRole('button', { name: 'Confirmar benefício' })).toBeDisabled()

  await page.getByRole('radio', { name: 'LOAS Idoso' }).click()
  await page.getByLabel('Por que não a sugestão da IA? (fica no histórico)').fill('tem 65 anos e a renda da casa é baixa')
  await expect(page.getByRole('button', { name: 'Confirmar benefício' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Conferi a recomendação com a entrevista' }).check()
  await page.getByRole('button', { name: 'Confirmar benefício' }).click()
  await expect(page.getByRole('heading', { name: '✓ Benefício definido: LOAS Idoso' })).toBeVisible()

  await page.getByRole('link', { name: 'Abrir a ficha do cliente' }).click()
  const historico = page.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Definiu o benefício do caso (D1.12): LOAS Idoso')
  await expect(historico).toContainText('Recusou a sugestão da IA (Auxílio por Incapacidade Temporária): tem 65 anos e a renda da casa é baixa')
})

test('CA1 · o benefício citado pela advogada prevalece; o do acervo fica só como sugestão', async ({ page }) => {
  await entrevistaTranscrita(page, 'natalia-entrevista')
  await page.getByRole('link', { name: 'Definir o benefício (D1.12)' }).click()
  const ia = page.getByRole('region', { name: 'A IA sugere · você confere' })
  await expect(ia).toContainText('Aposentadoria por Incapacidade Permanente · prevalece (G3)')
  await expect(ia).toContainText('Auxílio por Incapacidade Temporária · só como sugestão')
  await expect(page.getByRole('radio', { name: 'O que você citou: Aposentadoria por Incapacidade Permanente' })).toHaveAttribute('aria-checked', 'true')
})

test('tema escuro e fonte grande na definição do benefício', async ({ page }) => {
  await page.goto('/entrevista/josefa-entrevista/beneficio?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Josefa Exemplo · Definir benefício')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
