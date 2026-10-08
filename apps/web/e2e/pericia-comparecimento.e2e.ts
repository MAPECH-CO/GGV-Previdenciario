import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-66 · Comparecimento e remarcação: a confirmação de presença da véspera do Antônio (perícia do juízo em 16/10,
// 10:30), o alerta das 16h, o "não vai poder ir" que remarca na hora, o comparecimento depois do dia e da hora, a falta que
// volta para remarcar e o alerta do dia seguinte. O relógio da página começa em 07/10, o dia da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const CENTRAL = '/juridico-administrativo'
const ANTONIO = '/casos/antonio-exemplo-1/pericia/comparecimento'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 7, 10, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(CENTRAL)
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeVisible()
})

test('CA7, CA8 · na véspera a confirmação; às 16h o alerta; "não consegui" fica registrado e "confirmou" tira da Central', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 15, 16, 30))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(CENTRAL)
  await expect(page.getByText(/presença não confirmada até 16h: contatar o cliente/)).toBeVisible()
  await page.getByRole('link', { name: 'Antônio Exemplo · Confirmar presença na perícia' }).click()
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Confirmar presença na perícia' })).toBeVisible()
  await expect(page.getByText('Presença não confirmada até 16h: contate o cliente.')).toBeVisible()

  await page.getByRole('radio', { name: 'Não consegui confirmar' }).click()
  await page.getByLabel('O que aconteceu *').fill('caixa postal')
  await page.getByRole('button', { name: 'Registrar a confirmação' }).click()
  await expect(page.getByRole('status')).toHaveText('Tentativa registrada: a confirmação segue na sua Central.')
  await page.getByRole('radio', { name: 'Confirmou' }).click()
  await page.getByRole('button', { name: 'Registrar a confirmação' }).click()
  await expect(page.getByRole('status')).toHaveText('Presença confirmada e registrada.')

  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(CENTRAL)
  await expect(page.getByRole('heading', { name: /O que você tem que fazer/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Confirmar presença na perícia' })).toHaveCount(0)
})

test('CA9 · o cliente avisa antes que não vai poder ir: remarca na hora, com o motivo, e volta para marcar', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 15, 10, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(ANTONIO)
  await page.getByRole('radio', { name: 'Não vai poder ir' }).click()
  await expect(page.getByText('Remarcar na hora: remarcação 1 · limite 2 (G15); passou, sobe para a advogada.')).toBeVisible()
  await page.getByLabel('Motivo da remarcação *').fill('vai estar internado')
  await page.getByRole('button', { name: 'Remarcar agora' }).click()
  await expect(page.getByRole('heading', { name: '✓ Remarcação registrada' })).toBeVisible()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(CENTRAL)
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Remarcar perícia' })).toBeVisible()
})

test('CA1, CA4, CA5 · pela agenda, "Marcar como realizado"; compareceu, e a advogada fica com o resultado', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 14, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/agenda')
  await page.getByRole('button', { name: /Perícias Antônio Exemplo Perícia médica/ }).click()
  const janela = page.getByRole('dialog', { name: /Antônio Exemplo/ })
  await janela.getByRole('link', { name: 'Marcar como realizado' }).click()
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Registrar comparecimento' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Compareceu' }).click()
  await page.getByLabel('Justificativa, se houver').fill('chegou cedo')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('region', { name: '✓ Comparecimento registrado' })).toContainText('a advogada responsável acompanha no processo')

  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/advogada')
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Conferir resultado da perícia' })).toBeVisible()
})

test('CA2, CA6 · sem registro no dia seguinte, o alerta; faltou, a tarefa volta para remarcar', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 17, 9, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(CENTRAL)
  await expect(page.getByText(/alerta: o comparecimento não foi registrado/)).toBeVisible()
  await page.getByRole('link', { name: 'Antônio Exemplo · Registrar comparecimento' }).click()
  await page.getByRole('radio', { name: 'Faltou' }).click()
  await page.getByLabel('Justificativa, se houver').fill('ônibus não passou')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('heading', { name: '✓ Falta registrada' })).toBeVisible()
  await expect(page.getByText('A perícia voltou para remarcar: 1ª remarcação, limite 2 (G15).')).toBeVisible()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(CENTRAL)
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Remarcar perícia' })).toBeVisible()
})

test('tema escuro e fonte grande no comparecimento', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 14, 0))
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto(`${ANTONIO}?tema=escuro&fonte=grande`)
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Registrar comparecimento' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
