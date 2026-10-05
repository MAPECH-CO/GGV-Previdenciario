import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-17 · Receber documento entregue no balcão: tarefa da Documentação, scanner simulado, "Conferir e enviar",
// laudo novo pela ficha e pelo chat. Cada teste abre um navegador novo, então começa da semente de exemplo.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string, conteudo = name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(conteudo) })

/** Do balcão até a tela de receber documento da pessoa. */
async function entregarDocumento(page: Page, termo: string, nome: RegExp) {
  await page.goto('/balcao')
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill(termo)
  await page.getByRole('button', { name: nome }).click()
  await page.getByRole('radio', { name: 'Entregar documento' }).click()
  await page.getByRole('button', { name: 'Encaminhar' }).click()
  const feito = page.getByRole('region', { name: /Encaminhado ao setor Documentação · ADM/ })
  await expect(feito).toContainText('recebeu a tarefa "Receber documento"')
  await feito.getByRole('link', { name: 'Abrir a tarefa' }).click()
  await expect(page).toHaveURL(/\/balcao\/documento\//)
}

test('CA1, CA2, CA5 e CA10 · do balcão à tarefa, papel no scanner, as duas conferências e "Registrar"', async ({ page }) => {
  await entregarDocumento(page, 'antonio', /Antônio Exemplo/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Antônio Exemplo · Receber documento')
  const registrar = page.getByRole('button', { name: 'Registrar' })
  await expect(registrar).toBeDisabled()

  await page.getByRole('radio', { name: 'Papel — vai ao scanner' }).click()
  await page.getByRole('button', { name: 'Digitalizar (scanner simulado)' }).click()
  await expect(page.getByRole('list', { name: 'Documentos do lote' })).toContainText('CNIS - Antônio Exemplo -')
  await expect(page.getByRole('alert')).toContainText('CONFERIR O PAPEL')
  await page.getByRole('checkbox', { name: 'Conferi o tipo de cada documento' }).check()
  await expect(registrar).toBeDisabled()
  await page.getByRole('checkbox', { name: /Conferi o papel/ }).check()
  await registrar.click()
  await expect(page.getByRole('heading', { name: /✓ Registrado às/ })).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Receber documento' })).toHaveCount(0)
})

test('CA4 · sem dono certo, o lote vai para "A REVISAR" com o motivo', async ({ page }) => {
  await entregarDocumento(page, 'natalia', /Natália Exemplo/)
  await page.getByRole('radio', { name: 'Papel — vai ao scanner' }).click()
  await page.getByRole('button', { name: 'Digitalizar (scanner simulado)' }).click()
  await expect(page.getByText(/Foi para A REVISAR/)).toBeVisible()
  await expect(page.getByText(/o CPF dessa pessoa não está escrito no papel/)).toBeVisible()
})

test('CA6, CA9 e CA13 · laudo pela ficha: "Laudo novo", aguarda o Jurídico, e o mesmo arquivo de novo vira "(2)"', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo')
  for (const vez of [1, 2]) {
    await page.getByRole('button', { name: /Solte os documentos do cliente aqui/ }).click()
    const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
    await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles(pdf('laudo_ortopedia.pdf', 'o mesmo laudo'))
    await expect(janela.getByRole('combobox', { name: 'Tipo de laudo_ortopedia.pdf' })).toHaveValue('laudo')
    await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'arquivo enviado' })).toBeVisible()
    if (vez === 1) await expect(page.getByText(/enviado ao Jurídico: aguarda a análise/)).toBeVisible()
  }
  const subpasta = page.getByRole('list', { name: 'Subpasta Aposentadoria por Incapacidade Permanente' })
  await expect(subpasta).toContainText('laudo_ortopedia (2).pdf')
  await expect(subpasta).toContainText('repetido')
})

test('CA8 · laudo pelo chat da Central só sobe depois de "Confirmar"', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('+ Anexar arquivo').setInputFiles(pdf('laudo_antonio_ortopedia.pdf'))
  await page.getByLabel('✦ Pergunte ou peça').fill('Esse aqui é o laudo do Antônio. Atualizar.')
  await page.getByRole('button', { name: 'Enviar' }).click()
  const card = page.getByRole('region', { name: 'Atualizar o laudo · Antônio Exemplo' })
  await expect(card).toContainText('Marcar «Laudo novo» na ficha e no processo')
  await card.getByRole('button', { name: 'Confirmar e enviar ao Jurídico' }).click()
  await expect(page.getByRole('status').filter({ hasText: '✓ Feito' })).toBeVisible()
  await page.getByRole('link', { name: 'Abrir a ficha' }).click()
  await expect(page.getByRole('list', { name: 'Subpasta Aposentadoria por Incapacidade Permanente' })).toContainText('laudo_antonio_ortopedia.pdf')
})

test('tema escuro e fonte grande na tela do passo e na janela "Conferir e enviar"', async ({ page }) => {
  await entregarDocumento(page, 'rita', /Rita Exemplo/)
  await page.goto(`${new URL(page.url()).pathname}?tema=escuro&fonte=grande`)
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await page.getByRole('radio', { name: 'Digital — anexar ao card' }).click()
  await page.getByRole('button', { name: 'Anexar ao card' }).click()
  await expect(page.getByRole('dialog', { name: 'Conferir e enviar' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
