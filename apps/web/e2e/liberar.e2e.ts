import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-18 · Liberar o caso ao Jurídico: o caminho inteiro da Rita no localhost, da leitura ao OK da Documentação e à fila
// da sênior; o Sebastião travado sem lista; outro perfil vê só a situação. Cada teste começa da semente de exemplo.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

test('CA1, CA6 e CA7 · da leitura ao OK: a Rita completa o checklist, a Documentação libera e a sênior recebe', async ({ page }) => {
  // A pilha do scanner: arquivar.
  await page.goto('/clientes/rita-exemplo/conferir-documentos')
  await page.getByRole('radio', { name: 'Manter os dois' }).click()
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('heading', { name: /✓ Arquivado às/ })).toBeVisible()

  // O que faltava chega pelo card, com o tipo conferido.
  await page.goto('/clientes/rita-exemplo')
  await page.getByRole('button', { name: /Solte os documentos do cliente aqui/ }).click()
  const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
  const tipos: [string, string][] = [
    ['cpf.pdf', 'cpf'],
    ['renda.pdf', 'comprovante-renda'],
    ['cadunico.pdf', 'cadunico'],
    ['grupo familiar.pdf', 'grupo-familiar'],
    ['moradia.pdf', 'declaracao-moradia'],
    // O relatório médico que completa o laudo (GGVP-20).
    ['relatorio medico.pdf', 'laudo'],
  ]
  await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles(tipos.map(([nome]) => pdf(nome)))
  for (const [nome, tipo] of tipos) await janela.getByRole('combobox', { name: `Tipo de ${nome}` }).selectOption(tipo)
  await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(janela).toBeHidden()

  await page.goto('/clientes/rita-exemplo/conferir-documentos')
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByText(/Nada falta\./)).toBeVisible()

  // A advogada confere a análise da IA e registra o parecer Suficiente (GGVP-20).
  await page.goto('/casos/rita-exemplo-1/parecer')
  const selects = page.getByRole('combobox', { name: /^Conferência:/ })
  await expect(selects.first()).toBeVisible()
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption('confere')
  await page.getByRole('radio', { name: 'Suficiente — liberar' }).click()
  await page.getByRole('button', { name: 'Registrar parecer' }).click()
  await expect(page.getByRole('heading', { name: '✓ Parecer registrado: Suficiente' })).toBeVisible()

  // Checklist completo: a conferência manda o caso à fila de liberação.
  await page.goto('/casos/rita-exemplo-1/checklist')
  await expect(page.getByText('Situação: completo')).toBeVisible()
  await page.getByRole('button', { name: 'Concluir a conferência' }).click()
  await expect(page.getByText(/Checklist completo: o caso segue para liberar ao Jurídico/)).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Rita Exemplo · Liberar ao Jurídico' }) })).toContainText('na fila desde hoje')
  await page.getByRole('link', { name: 'Rita Exemplo · Liberar ao Jurídico' }).click()
  const botao = page.getByRole('button', { name: 'Liberar ao Jurídico' })
  await expect(botao).toBeDisabled()
  await page.getByRole('checkbox', { name: /Checklist do LOAS Deficiente: 9 de 9 itens recebidos/ }).check()
  await expect(page.getByRole('checkbox', { name: /Parecer médico Suficiente \(G17\)/ })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Assinaturas e datas preenchidas — confira e marque' }).check()
  await botao.click()
  await expect(page.getByRole('heading', { name: /✓ Liberado ao Jurídico às/ })).toBeVisible()

  await page.goto('/clientes/rita-exemplo')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Caso liberado ao Jurídico pela Documentação')
  await page.goto('/advogada')
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Rita Exemplo · Conferir antes do INSS' }) })).toContainText(
    'liberado pela Documentação hoje',
  )
})

test('CA2 e CA5 · o Sebastião espera na fila há 2 dias e não libera: o benefício não tem lista', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sebastião Exemplo · Liberar ao Jurídico' }).click()
  await expect(page).toHaveURL('/casos/sebastiao-exemplo-1/liberar')
  await expect(page.getByRole('button', { name: 'Liberar ao Jurídico' })).toBeDisabled()
  await expect(page.getByText(/Auxílio Acidentário ainda não tem lista de documentos obrigatórios aprovada/)).toBeVisible()
})

test('CA4 · outro perfil vê só a situação', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/liberar?perfil=juridico')
  await expect(page.getByRole('status')).toContainText('Você está como Jurídico: vê só a situação')
  await expect(page.getByRole('button', { name: 'Liberar ao Jurídico' })).toHaveCount(0)
})

test('tema escuro e fonte grande na liberação', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/liberar?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sebastião Exemplo · Liberar ao Jurídico')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Conferir' }) })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
