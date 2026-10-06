import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-20 · Parecer de suficiência da documentação médica: a Rita da Central da Advogada ao parecer Insuficiente; o laudo
// novo do Antônio comparado e mantido; a contradição da Cleide; a janela do parecer na liberação. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

/** Confere cada item como a IA achou. */
async function conferirTudo(page: Page) {
  const selects = page.getByRole('combobox', { name: /^Conferência:/ })
  await expect(selects.first()).toBeVisible()
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption('confere')
}

test('CA1, CA3, CA5 e CA8 · a Rita: da Central da Advogada ao parecer Insuficiente, com o pedido ao médico para o Atendimento', async ({ page }) => {
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Rita Exemplo · Dar parecer médico' }).click()
  await expect(page).toHaveURL('/casos/rita-exemplo-1/parecer')
  const obrigatorios = page.getByRole('list', { name: 'Itens obrigatórios' })
  await expect(obrigatorios.getByRole('listitem').first()).toContainText('Laudo médico · 20/08/2026 · pág. 1')
  await expect(obrigatorios.getByRole('listitem').nth(2)).toContainText('ausente')

  const registrar = page.getByRole('button', { name: 'Registrar parecer' })
  await expect(registrar).toBeDisabled()
  await conferirTudo(page)
  await page.getByRole('radio', { name: 'Insuficiente — pedir complemento' }).click()
  const abordar = page.getByRole('textbox', { name: /O que o documento deve abordar/ })
  await expect(abordar).toHaveValue(/Qual a previsão de duração do quadro\?/)
  await abordar.fill('Confirmar o CID G80')
  await expect(page.getByText(/Tire o código de doença \(CID\)/).first()).toBeVisible()
  await expect(registrar).toBeDisabled()
  await abordar.fill('O relatório precisa responder: qual a previsão de duração do quadro? O paciente depende de outra pessoa?')
  await registrar.click()
  await expect(page.getByRole('heading', { name: '✓ Parecer registrado: Insuficiente' })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Rita Exemplo · Pedir complemento ao médico' })).toHaveAttribute('href', '/casos/rita-exemplo-1/complemento')
})

test('CA6 e CA7 · o laudo novo do Antônio: a comparação, o parecer mantido e a ficha sem "Laudo novo"', async ({ page }) => {
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Antônio Exemplo · Analisar laudo novo' }).click()
  await expect(page).toHaveURL('/casos/antonio-exemplo-1/laudo-novo')
  const tabela = page.getByRole('table', { name: 'Comparação com o último laudo (18/09)' })
  await expect(tabela.locator('[data-mudou]')).toHaveText(['Raio-X de coluna lombar e ressonância magnética (22/09)', 'Carregar peso, ficar em pé e dirigir'])
  await expect(page.getByText('A IA só compara: não sugere CID, grau nem conclusão (G20).', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: 'Ir para o parecer (D1.21M)' }).click()

  await conferirTudo(page)
  await page.getByRole('radio', { name: 'Suficiente — liberar' }).click()
  await page.getByRole('button', { name: 'Registrar parecer' }).click()
  await expect(page.getByText(/O laudo novo de 29\/09 foi conferido e saiu da ficha e do processo/)).toBeVisible()
  await page.goto('/clientes/antonio-exemplo')
  await expect(page.getByText('Laudo novo · 29/09')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Conferiu o laudo novo de 29/09 e manteve o parecer')
})

test('CA2 · o laudo com "incapacidade total" da Cleide deixa o parecer Contraditório (G18)', async ({ page }) => {
  await page.goto('/clientes/cleide-exemplo')
  await page.getByRole('button', { name: /Solte os documentos do cliente aqui/ }).click()
  const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
  await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles([pdf('laudo incapacidade total.pdf')])
  await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(janela).toBeHidden()

  await page.goto('/casos/cleide-exemplo-1/parecer')
  await expect(page.getByRole('list', { name: 'Contradições que bloqueiam' })).toContainText('encontrada')
  await conferirTudo(page)
  await expect(page.getByRole('radio', { name: 'Suficiente — liberar' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Insuficiente — pedir complemento' }).click()
  await page.getByRole('button', { name: 'Registrar parecer' }).click()
  await expect(page.getByRole('heading', { name: '✓ Parecer registrado: Contraditório' })).toBeVisible()
})

test('dado de saúde · na liberação, a janela do parecer mostra à Documentação o resultado, sem o conteúdo', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/liberar')
  await page.getByRole('button', { name: 'Abrir o parecer médico' }).click()
  const janela = page.getByRole('dialog', { name: 'Parecer médico de suficiência' })
  await expect(janela.getByRole('status')).toContainText('confirmado por pessoa: Dra. Paula, 15/07 (G17)')
  await expect(janela.getByRole('list', { name: 'Roteiro aplicado' })).toHaveCount(0)
  await expect(janela).not.toContainText('sequela consolidada')
})

test('tema escuro e fonte grande no parecer', async ({ page }) => {
  await page.goto('/casos/rita-exemplo-1/parecer?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Dar parecer médico')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Documentos analisados' }) })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
