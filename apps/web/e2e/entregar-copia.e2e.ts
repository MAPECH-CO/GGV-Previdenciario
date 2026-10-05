import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-89 · Cópia do contrato para o cliente levar. Cada teste abre um navegador novo, então começa da semente: a Cleide
// assinou a Aposentadoria Especial pelo ZapSign em 12/07 e vem buscar a cópia hoje às 16:00, no relógio da máquina.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const doisDigitos = (n: number) => String(n).padStart(2, '0')
const daquiA = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`
}

test('GGVP-89 CA1, CA2, CA3 e CA5 · da Central à entrega registrada; a tarefa sai e o caso segue para o checklist', async ({ page }) => {
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Cleide Exemplo · Entregar cópia do contrato' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('Aposentadoria Especial · contrato assinado em 12/07 · retirada hoje às 16:00')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Entregar cópia do contrato')
  await page.getByRole('button', { name: 'Imprimir cópia para o cliente' }).click()
  await expect(page.getByText(/Impressa em .* \(impressora simulada\)\./)).toBeVisible()
  const registrar = page.getByRole('button', { name: 'Registrar entrega' })
  await expect(registrar).toBeDisabled()
  await page.getByRole('checkbox', { name: 'É a cópia impressa da versão assinada *' }).check()
  await page.getByLabel('Quem recebeu *').fill('Cleide Exemplo')
  await page.getByLabel('Observação').fill('Levou numa pastinha.')
  await registrar.click()
  await expect(page.getByRole('heading', { name: '✓ Entrega registrada' })).toBeVisible()
  await expect(page.getByText(/O caso segue para a conferência do checklist do benefício \(D1\.21\)/)).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Cleide Exemplo · Entregar cópia do contrato' })).toHaveCount(0)
})

test('GGVP-89 CA4 · a entrega numa visita depois: o compromisso "Entregar cópia do contrato" entra na agenda', async ({ page }) => {
  await page.goto('/contrato/cleide-exemplo-2/copia')
  await page.getByLabel('Data da visita *').fill(daquiA(2))
  await page.getByLabel('Hora *').fill('10:30')
  await page.getByRole('button', { name: 'Marcar a visita na agenda' }).click()
  await expect(page.getByText(/Visita marcada: .* às 10:30 · na agenda como "Entregar cópia do contrato"\./)).toBeVisible()
  await page.goto('/agenda?ver=lista')
  await expect(page.getByText('Entregar cópia do contrato').first()).toBeVisible()
})

test('tema escuro e fonte grande no entregar cópia', async ({ page }) => {
  await page.goto('/contrato/cleide-exemplo-2/copia?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Entregar cópia do contrato')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Registrar a entrega' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
