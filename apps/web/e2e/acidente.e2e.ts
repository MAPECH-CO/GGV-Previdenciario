import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-47 · Auxílio-Acidente: prova do acidente. O Sebastião da semente: a circunstância que muda o checklist, os
// documentos que completam o checklist e liberam o caso, e o laudo de lesão não consolidada que trava (G18).

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

async function marcar(page: Page, circunstancia: string, auxilioAnterior: boolean) {
  await page.getByRole('combobox', { name: 'Circunstância' }).selectOption(circunstancia)
  await page.getByRole('combobox', { name: 'Categoria do segurado' }).selectOption('empregado')
  await page.getByRole('textbox', { name: 'Data do acidente' }).fill('15/03/2024')
  await page.getByRole('checkbox', { name: /Houve auxílio por incapacidade temporária antes/ }).setChecked(auxilioAnterior)
  await page.getByRole('button', { name: 'Salvar a circunstância' }).click()
  await expect(page.getByRole('status')).toHaveText('Circunstância salva: o checklist foi refeito.')
}

/** Chegam pelo card do cliente, com o tipo conferido, e a Documentação arquiva. */
async function chegam(page: Page, tipos: [string, string][]) {
  await page.goto('/clientes/sebastiao-exemplo')
  await page.getByRole('button', { name: /Solte os documentos do cliente aqui/ }).click()
  const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
  await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles(tipos.map(([nome]) => pdf(nome)))
  for (const [nome, tipo] of tipos) await janela.getByRole('combobox', { name: `Tipo de ${nome}` }).selectOption(tipo)
  await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(janela).toBeHidden()
  await page.goto('/clientes/sebastiao-exemplo/conferir-documentos')
  await page.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await page.getByRole('button', { name: 'Arquivar' }).click()
  await expect(page.getByRole('heading', { name: /✓ Arquivado às/ })).toBeVisible()
}

// Entra pela API com o usuário de exemplo: o checklist e a liberação são da Documentação.
test.beforeEach(async ({ page }) => entrarPelaApi(page, 'documentacao@exemplo.ggv'))

test('CA1 e CA2 · a circunstância muda o checklist: o trânsito sem CAT e com boletim e fotos, o trabalho com a CAT e o processo do auxílio anterior', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/checklist')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sebastião Exemplo · Conferir checklist')
  await expect(page.getByText(/Liberar ao Jurídico: bloqueado\. Marque a circunstância do acidente/)).toBeVisible()

  await marcar(page, 'transito', false)
  await expect(page.getByText('B36 · auxílio-acidente previdenciário')).toBeVisible()
  const itens = page.getByRole('list', { name: 'Checklist · Auxílio Acidentário' })
  await expect(itens.getByRole('listitem').filter({ hasText: 'Ficha do pronto-socorro' })).toContainText('obrigatório')
  await expect(itens.getByRole('listitem').filter({ hasText: 'CAT' })).toHaveCount(0)
  await expect(itens.getByRole('listitem').filter({ hasText: 'Boletim de ocorrência' })).toContainText('obrigatório')
  await expect(itens.getByRole('listitem').filter({ hasText: 'Fotos do acidente' })).toContainText('obrigatório')
  await expect(itens.getByRole('listitem').filter({ hasText: 'Prontuário' })).toContainText('obrigatório')

  await marcar(page, 'trabalho', true)
  await expect(page.getByText('B94 · auxílio-acidente acidentário')).toBeVisible()
  const cat = itens.getByRole('listitem').filter({ hasText: 'CAT (Comunicação de Acidente de Trabalho)' })
  await expect(cat).toContainText('obrigatório')
  await expect(cat).toContainText('ok')
  await expect(itens.getByRole('listitem').filter({ hasText: 'Boletim de ocorrência' })).toContainText('desejável: não conta para o completo')
  const processo = itens.getByRole('listitem').filter({ hasText: 'Cópia do processo do auxílio' })
  await expect(processo).toContainText('condicional')
  await expect(processo).toContainText('falta')
})

test('CA3 · chegam a ficha do pronto-socorro, o prontuário e o exame da época: completo, e a Documentação libera (G1)', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/checklist')
  await marcar(page, 'trabalho', false)
  await expect(page.getByText(/Falta: Ficha do pronto-socorro, Prontuário e Exame de imagem da época do acidente/)).toBeVisible()

  await chegam(page, [
    ['pronto socorro.pdf', 'ficha-pronto-socorro'],
    ['prontuario cirurgia.pdf', 'prontuario'],
    ['raio x do acidente.pdf', 'exame-imagem-epoca'],
  ])

  await page.goto('/casos/sebastiao-exemplo-1/checklist')
  await expect(page.getByText('Situação: completo')).toBeVisible()
  await page.getByRole('button', { name: 'Concluir a conferência' }).click()
  await expect(page.getByText(/Checklist completo: o caso segue para liberar ao Jurídico/)).toBeVisible()

  await page.goto('/casos/sebastiao-exemplo-1/liberar')
  await page.getByRole('checkbox', { name: /Checklist do Auxílio Acidentário/ }).check()
  await expect(page.getByRole('checkbox', { name: /Parecer médico Suficiente \(G17\)/ })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Assinaturas e datas preenchidas — confira e marque' }).check()
  await page.getByRole('button', { name: 'Liberar ao Jurídico' }).click()
  await expect(page.getByRole('heading', { name: /✓ Liberado ao Jurídico às/ })).toBeVisible()
})

test('CA4 · o laudo de lesão não consolidada trava a liberação (G18) e sugere a troca de benefício', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/checklist')
  await marcar(page, 'trabalho', false)
  await chegam(page, [
    ['pronto socorro.pdf', 'ficha-pronto-socorro'],
    ['prontuario cirurgia.pdf', 'prontuario'],
    ['raio x do acidente.pdf', 'exame-imagem-epoca'],
    ['laudo lesao nao consolidada.pdf', 'laudo'],
  ])
  await page.goto('/casos/sebastiao-exemplo-1/liberar')
  await expect(page.getByRole('checkbox', { name: /Parecer médico \(G18\): a IA achou contradição/ })).not.toBeChecked()
  await expect(page.getByText(/lesão ainda não consolidada\)\. O caso fica parado até o Jurídico conferir o parecer \(G18\)\. Sugestão: trocar para Auxílio por Incapacidade Temporária/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Liberar ao Jurídico' })).toBeDisabled()
})

test('tema escuro e fonte grande na circunstância do acidente', async ({ page }) => {
  await page.goto('/casos/sebastiao-exemplo-1/checklist?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { name: 'Circunstância do acidente' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Circunstância do acidente' }) })).toHaveCSS(
    'background-color',
    rgb(tokens.cores.superficie.escuro),
  )
})
