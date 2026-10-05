import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-81 · Ler e arquivar os documentos: da Central à conferência da leitura da IA, com divergência, duplicado,
// quarentena e "Arquivar"; e do balcão ao scanner até a conferência. Cada teste começa da semente de exemplo.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('CA7 a CA11 · da Central à conferência da Rita: divergência, quarentena movida, duplicado e "Arquivar"', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Rita Exemplo · Conferir documento' }).click()
  await expect(page).toHaveURL('/clientes/rita-exemplo/conferir-documentos')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Conferir documento')
  await expect(page.getByRole('list', { name: 'Documentos lidos pela IA' })).toContainText('baixa confiança: confira com atenção')

  // CA8: a divergência fica destacada; o cadastro muda só com "Usar no cadastro".
  const nome = page.getByRole('row', { name: /Rita de Cássia Exemplo/ })
  await expect(nome).toContainText('diferente do cadastro')
  await nome.getByRole('button', { name: /Usar no cadastro/ }).click()
  await expect(page.getByRole('status')).toHaveText('Nome atualizado no cadastro com o que a IA leu.')

  // CA10 e CA11: o CNIS do Antônio sai da quarentena só com motivo.
  const quarentena = page.locator('section', { has: page.getByRole('heading', { name: /Em quarentena/ }) })
  await expect(quarentena).toContainText('o nome lido é Antônio Exemplo')
  await quarentena.getByRole('button', { name: 'Mover para outro caso' }).click()
  await quarentena.getByRole('button', { name: 'Mover' }).click()
  await expect(quarentena.getByRole('alert')).toHaveText('Informe o motivo para mover o documento')
  await quarentena.getByRole('textbox', { name: 'Motivo (obrigatório)' }).fill('veio na pilha da Rita')
  await quarentena.getByRole('button', { name: 'Mover' }).click()
  await expect(page.getByRole('status')).toContainText('Moveu CNIS para o caso Aposentadoria por Incapacidade Permanente de Antônio Exemplo')

  // CA7 e CA9: "Arquivar" só com a decisão do duplicado e a conferência.
  const arquivar = page.getByRole('button', { name: 'Arquivar' })
  await expect(arquivar).toBeDisabled()
  await page.getByRole('radio', { name: 'Descartar a cópia menos legível' }).click()
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await arquivar.click()
  await expect(page.getByRole('heading', { name: /✓ Arquivado às/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir o checklist' })).toHaveAttribute('href', '/casos/rita-exemplo-1/checklist')

  // A tarefa da Rita sai da Central; o CNIS movido vira conferência na pasta do Antônio.
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Rita Exemplo · Conferir documento' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Conferir documento' })).toBeVisible()
  await page.goto('/clientes/rita-exemplo')
  await expect(page.getByRole('heading', { level: 2, name: 'Rita de Cássia Exemplo' })).toBeVisible()
})

test('CA1 · o papel que o scanner guardou no balcão chega à conferência, sem digitalizar de novo', async ({ page }) => {
  await page.goto('/balcao')
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('antonio')
  await page.getByRole('button', { name: /Antônio Exemplo/ }).click()
  await page.getByRole('radio', { name: 'Entregar documento' }).click()
  await page.getByRole('button', { name: 'Encaminhar' }).click()
  await page.getByRole('link', { name: 'Abrir a tarefa' }).click()
  await page.getByRole('radio', { name: 'Papel — vai ao scanner' }).click()
  await page.getByRole('button', { name: 'Digitalizar (scanner simulado)' }).click()
  await expect(page.getByRole('list', { name: 'Documentos do lote' })).toContainText('CNIS - Antônio Exemplo -')

  await page.goto('/')
  await page.getByRole('link', { name: 'Antônio Exemplo · Conferir documento' }).click()
  const lidos = page.getByRole('list', { name: 'Documentos lidos pela IA' })
  await expect(lidos.getByRole('listitem')).toHaveCount(2)
  await expect(lidos).toContainText('Comprovante de residência')
  await expect(lidos).toContainText('CNIS')
  await expect(page.getByRole('button', { name: /Digitalizar/ })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('heading', { name: /✓ Arquivado às/ })).toBeVisible()
})

test('tema escuro e fonte grande na conferência', async ({ page }) => {
  await page.goto('/clientes/rita-exemplo/conferir-documentos?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Conferir documento')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'A IA sugere · você confere' }) })).toHaveCSS(
    'background-color',
    rgb(tokens.cores.superficie.escuro),
  )
})
