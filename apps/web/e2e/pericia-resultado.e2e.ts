import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-70 · Conferir o resultado e decidir o próximo passo: o Antônio vai à perícia do juízo em 16/10; em 20/10 a advogada
// anexa o laudo, lê o resumo da IA com a jurimetria do perito, confere e registra. Favorável volta ao juízo com 15 dias para
// manifestar; desfavorável com nova perícia volta ao Jurídico administrativo. O chat da advogada responde as perícias da
// semana e como o perito avalia. O relógio da página começa em 07/10, o dia da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })
const ADVOGADA = '/advogada'

/** A semente em 07/10; em 16/10, o Jurídico administrativo registra que o Antônio compareceu; o relógio vai a 20/10. */
async function antonioCompareceu(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 7, 10, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeVisible()
  await page.clock.setFixedTime(new Date(2026, 9, 16, 14, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia/comparecimento')
  await page.getByRole('radio', { name: 'Compareceu' }).click()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('heading', { name: '✓ Comparecimento registrado' })).toBeVisible()
  await page.clock.setFixedTime(new Date(2026, 9, 20, 9, 0))
}

async function conferirTudo(page: Page) {
  for (const caixa of await page.getByRole('region', { name: 'Conferência (você decide; a IA só resume)' }).getByRole('checkbox').all()) await caixa.check()
}

test('CA1, CA2, CA5, CA8 e o perfil do perito · favorável: o resumo da IA, a jurimetria do sistema, as conferências e a volta ao juízo com 15 dias', async ({ page }) => {
  test.setTimeout(120_000)
  await antonioCompareceu(page)
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto(ADVOGADA)
  await page.getByRole('link', { name: 'Antônio Exemplo · Conferir resultado da perícia' }).click()
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Conferir resultado da perícia' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar resultado' })).toBeDisabled()

  await page.getByLabel(/Laudo ou registro do GERID/).setInputFiles([pdf('laudo_pericia_antonio.pdf')])
  const resumo = page.getByRole('region', { name: 'Resumo do laudo pela IA' })
  await expect(resumo).toContainText('Favorável · incapacidade para o trabalho habitual')
  await expect(resumo).toContainText(/71% favorável em 34 laudos · base de \d\d\/\d\d \(G22\)/)
  await page.getByRole('radio', { name: 'Favorável — seguir' }).click()
  await expect(page.getByText('Marque as conferências antes de registrar.')).toBeVisible()
  await conferirTudo(page)
  await page.getByRole('button', { name: 'Registrar resultado' }).click()
  await expect(page.getByRole('heading', { name: '✓ Resultado registrado: favorável' })).toBeVisible()
  await expect(page.getByText(/volta ao judicial \(D3a\): manifestar sobre o laudo, até 04\/11 \(15 dias, G12\)/)).toBeVisible()
  // GGVP-73: o laudo entrou no perfil do perito, um registro a mais (CA1, CA3).
  await expect(page.getByRole('region', { name: 'Perfil do perito' })).toContainText('versão 35, formada por 35 laudos')
  await page.getByRole('button', { name: 'Ver o perfil do perito' }).click()
  await expect(page.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' })).toContainText('Histórico do perfil · 35 laudos')
  await page.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' }).getByRole('button', { name: 'Fechar' }).last().click()

  await page.getByRole('link', { name: 'Ver a página do processo' }).click()
  // A primeira abertura da página do processo compila a tela no servidor de desenvolvimento: nesta máquina passa dos 5 s.
  await expect(page.getByRole('heading', { name: 'Perícias' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('region', { name: 'Perícias' })).toContainText('Favorável')
  await expect(page.getByRole('region', { name: 'Prazos' })).toContainText('Manifestação sobre o laudo (15 dias, G12)')
})

test('CA3 · desfavorável: a indicação da IA, a advogada pede nova perícia e o Jurídico administrativo marca de novo', async ({ page }) => {
  test.setTimeout(120_000)
  await antonioCompareceu(page)
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia/resultado')
  await page.getByLabel(/Laudo ou registro do GERID/).setInputFiles([pdf('laudo_desfavoravel_antonio.pdf')])
  await expect(page.getByRole('region', { name: 'Resumo do laudo pela IA' })).toContainText('Indicação da IA: sim. Fica no histórico; quem decide é você.')
  await page.getByRole('radio', { name: 'Desfavorável — avaliar nova perícia' }).click()
  await page.getByRole('radio', { name: 'Sim, pedir nova perícia' }).click()
  await conferirTudo(page)
  await page.getByRole('button', { name: 'Registrar resultado' }).click()
  await expect(page.getByRole('heading', { name: '✓ Resultado registrado: desfavorável' })).toBeVisible()

  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Marcar perícia' })).toBeVisible()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia')
  await expect(page.getByRole('region', { name: 'Perícias' })).toContainText('Desfavorável')
  await expect(page.getByRole('list', { name: 'Linha da perícia' })).toContainText('pediu a perícia médica')
})

test('CA9 e "como o perito avalia" · o chat da advogada abre a página do processo, com os números do sistema', async ({ page }) => {
  test.setTimeout(120_000)
  await antonioCompareceu(page)
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto(ADVOGADA)
  await page.getByRole('textbox').fill('Quais perícias temos esta semana?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/^Uma perícia até 26\/10\./)).toBeVisible()
  await page.getByRole('textbox').fill('Como o Dr. A. Prado costuma avaliar problemas de coluna?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/Em coluna: 75% favorável em 8 laudos · base de \d\d\/\d\d \(G22\)/)).toBeVisible()
  await page.getByRole('list', { name: 'Tarefas sugeridas' }).first().getByRole('link', { name: /Pedro Exemplo · Avaliação social/ }).click()
  await expect(page).toHaveURL(/\/casos\/pedro-exemplo-1\/pericia/)
  await expect(page.getByRole('region', { name: 'Perícias' })).toBeVisible()
})

test('tema escuro e fonte grande no resultado', async ({ page }) => {
  test.setTimeout(120_000)
  await antonioCompareceu(page)
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia/resultado?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Conferir resultado da perícia' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
