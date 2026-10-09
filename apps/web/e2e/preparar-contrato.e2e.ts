import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-65 · Kit de documentos por benefício. Cada teste abre um navegador novo, então começa da semente: a Cleide fechou a
// Aposentadoria PCD e o contrato está para preparar.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('GGVP-65 CA1, CA4 e CA5 · da Central ao kit das aposentadorias, pelo Contrato Completo de aposentadorias', async ({ page }) => {
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Cleide Exemplo · Preparar contrato' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('kit Aposentadorias · Contrato Completo de aposentadorias')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Preparar contrato')
  const kit = page.getByRole('list', { name: 'Documentos do kit' })
  await expect(kit.getByRole('listitem')).toHaveText([
    '✓Contrato de honorários',
    '✓Procuração',
    '✓Declaração de hipossuficiência',
    '✓Declaração de residência',
    '✓Termo INSS · aposentadorias, CTC, recursos',
    '✓Código Penal',
  ])
  await expect(page.getByText('Aposentadorias · modelo Contrato Completo de aposentadorias · pasta MODELOS ZAPSIGN · PREV')).toBeVisible()
  await expect(page.getByText('Assinam: o cliente.')).toBeVisible()
})

test('GGVP-69 CA1, CA5 e CA11 · cada campo do modelo com de onde veio, e os honorários do modelo', async ({ page }) => {
  await page.goto('/contrato/cleide-exemplo-1/preparar')
  const documento = page.getByRole('region', { name: 'Documento preenchido' })
  await expect(documento.locator('div').filter({ hasText: /^Nome completo/ })).toHaveText('Nome completoCleide Exemplocadastro')
  await expect(documento.locator('div').filter({ hasText: /^CPF/ })).toHaveText('CPFfaltacadastro')
  await expect(documento.locator('div').filter({ hasText: /^Honorários/ })).toHaveText('Honoráriosos do modelo: confira no kit antes de imprimirdo modelo, sem campo para digitar')
  await expect(page.getByRole('region', { name: 'O que conferir' }).getByRole('listitem')).toHaveCount(3)
})

test('GGVP-69 CA3, CA6 e CA7 · campo vazio trava, corrigir vira caixa e o CPF de outra ficha não grava', async ({ page }) => {
  await page.goto('/contrato/cleide-exemplo-1/preparar')
  const gerar = page.getByRole('button', { name: 'Gerar contrato' })
  await expect(gerar).toBeDisabled()
  await page.getByRole('radio', { name: 'Sim' }).click()
  await expect(page.getByText('Falta: Estado civil, Profissão, CPF, RG e Endereço.')).toBeVisible()
  await page.getByRole('radio', { name: 'Não, corrigir campos' }).click()
  await page.getByLabel('CPF *').fill('000.000.001-91')
  await page.getByLabel('Estado civil *').fill('Casada')
  await page.getByLabel('Profissão *').fill('costureira')
  await page.getByLabel('RG *').fill('12.345.678-X')
  await page.getByLabel('Endereço *').fill('Rua Exemplo, 5 · São Paulo/SP')
  await page.getByLabel('O que corrigir *').fill('faltavam os dados pessoais')
  await expect(page.getByText('Marque as quatro conferências.')).toBeVisible()
  for (const nome of [
    'Campos certos e completos',
    'Datas feitas à mão serão preenchidas na assinatura',
    'Ficha LOAS: cliente ou representante legal (se aplicável)',
    'A página do Código Penal não tem assinatura',
  ]) {
    await page.getByRole('checkbox', { name: nome }).check()
  }
  await gerar.click()
  await expect(page.getByText('Este CPF já está na ficha de Antônio Exemplo.')).toBeVisible()
})

test('tema escuro e fonte grande no preparar contrato', async ({ page }) => {
  await page.goto('/contrato/cleide-exemplo-1/preparar?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Preparar contrato')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Kit do benefício' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
