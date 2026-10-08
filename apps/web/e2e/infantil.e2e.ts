import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-50 · BPC/LOAS de menor de 16 anos. O Davi da semente, de 7 anos: a análise com o roteiro infantil, a condição e as
// terapias que a advogada marca no parecer, e os relatórios que o checklist passa a pedir. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA1 · da Central da Advogada ao parecer do Davi, com o roteiro infantil', async ({ page }) => {
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Davi Exemplo · Dar parecer médico' }).click()
  await expect(page).toHaveURL('/casos/davi-exemplo-1/parecer')
  await expect(page.getByText(/BPC\/LOAS Deficiente · menor de 16 anos, versão 1/)).toBeVisible()
  await expect(page.getByText('roteiro infantil · 7 anos')).toBeVisible()
  const itens = page.getByRole('list', { name: 'Itens obrigatórios' }).getByRole('listitem')
  await expect(itens.filter({ hasText: 'Impacto na participação social e nas atividades próprias da idade' })).toContainText('ausente')
  await expect(itens.filter({ hasText: 'Necessidade de cuidados que limitam o trabalho dos responsáveis' })).toContainText('ausente')
})

test('CA2 · a advogada marca a condição e as terapias; o checklist pede os relatórios por condição', async ({ page }) => {
  await page.goto('/casos/davi-exemplo-1/checklist')
  await expect(page.getByText('A advogada marca a condição da criança no parecer: os relatórios que o caso pede dependem dela.', { exact: true })).toBeVisible()

  await page.goto('/casos/davi-exemplo-1/parecer')
  const cartao = page.locator('section', { has: page.getByRole('heading', { name: 'Criança · condição e terapias' }) })
  await cartao.getByRole('checkbox', { name: /Paralisia cerebral, má formação ou parecido/ }).check()
  await cartao.getByRole('checkbox', { name: 'Fonoaudiologia' }).check()
  await cartao.getByRole('checkbox', { name: 'Terapia ocupacional' }).check()
  await cartao.getByRole('checkbox', { name: /Frequenta escola ou creche/ }).check()
  await cartao.getByRole('button', { name: 'Salvar a condição' }).click()
  await expect(cartao.getByRole('status')).toHaveText('Condição salva: o checklist pede os relatórios dela.')
  await expect(cartao.getByRole('list', { name: 'Relatórios que o caso pede' }).getByRole('listitem')).toHaveText([
    'Relatório escolar',
    'Relatório da neurologia',
    'Relatório de fonoaudiologia',
    'Relatório de terapia ocupacional',
  ])

  await cartao.getByRole('link', { name: 'Abrir o checklist' }).click()
  const checklist = page.getByRole('list', { name: 'Checklist · LOAS Deficiente' })
  for (const nome of ['Relatório escolar', 'Relatório da neurologia', 'Relatório de fonoaudiologia', 'Relatório de terapia ocupacional']) {
    await expect(checklist.getByRole('listitem').filter({ hasText: nome })).toContainText('obrigatório')
  }
  await expect(checklist.getByRole('listitem').filter({ hasText: 'CAPS' })).toHaveCount(0)
  await expect(page.getByText(/A advogada marca a condição da criança/)).toHaveCount(0)
})

test('dado de saúde · a Documentação vê o parecer do Davi sem o cartão da condição', async ({ page }) => {
  await page.goto('/casos/davi-exemplo-1/parecer?perfil=documentacao')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Davi Exemplo · Dar parecer médico')
  await expect(page.getByRole('heading', { name: 'Criança · condição e terapias' })).toHaveCount(0)
})

test('tema escuro e fonte grande no cartão da criança', async ({ page }) => {
  await page.goto('/casos/davi-exemplo-1/parecer?tema=escuro&fonte=grande')
  const cartao = page.locator('section', { has: page.getByRole('heading', { name: 'Criança · condição e terapias' }) })
  await expect(cartao).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(cartao).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
