import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-56 · Reunir o que a perícia pede: a Documentação recebe a lista da avaliação social do Pedro, anexa o que chega
// (segue a leitura do D1), registra a falta com justificativa, confere e conclui; a cobrança diária com o pedido ao médico
// barrado pelo G20. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

test('CA2, CA4, CA5, CA6 · a lista da avaliação social, o anexo, a falta justificada, as conferências e a volta ao Jurídico administrativo', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Pedro Exemplo · Reunir documentos da perícia' }).click()
  await expect(page).toHaveURL('/casos/pedro-exemplo-1/pericia/documentos')
  const lista = page.getByRole('list', { name: 'O que a perícia pede' })
  await expect(lista).toContainText('CadÚnico atualizado')
  await expect(lista).toContainText('Composição do grupo familiar')

  // CA4: o CadÚnico chega e segue a leitura da IA do D1.
  const cadunico = lista.getByRole('listitem').filter({ hasText: 'CadÚnico atualizado' })
  await cadunico.getByRole('button', { name: 'Anexar' }).click()
  const janela = page.getByRole('dialog', { name: 'Conferir e enviar' })
  await janela.getByLabel(/Solte mais arquivos aqui/).setInputFiles([pdf('cadunico pedro.pdf')])
  await janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(cadunico).toContainText('anexado: cadunico pedro.pdf')

  // CA5: o resto fica com a falta justificada; "Concluir" pede as conferências.
  for (const [item, porque] of [
    ['Composição do grupo familiar', 'a assistente social preenche na visita'],
    ['Declaração de moradia', 'mora em casa própria, com escritura na pasta'],
    ['união estável', 'não se aplica: viúvo'],
  ]) {
    const linha = lista.getByRole('listitem').filter({ hasText: item })
    await linha.getByRole('button', { name: 'Registrar a falta' }).click()
    await linha.getByLabel(/Por que falta/).fill(porque)
    await linha.getByRole('button', { name: 'Registrar a falta' }).last().click()
    await expect(linha).toContainText(`falta registrada: ${porque}`)
  }
  await expect(page.getByRole('button', { name: 'Concluir' })).toBeDisabled()
  await page.getByLabel('CadÚnico (se BPC/social)').check()
  await page.getByLabel('Composição do grupo familiar').check()
  await page.getByLabel(/Conferi a leitura da IA/).check()
  await page.getByRole('button', { name: 'Concluir' }).click()

  // CA6: quem concluiu e quando; o fluxo volta ao Jurídico administrativo.
  await expect(page.getByRole('heading', { name: '✓ Documentos da perícia reunidos' })).toBeVisible()
  await expect(page.getByText(/O fluxo voltou ao Jurídico administrativo: ligar e orientar Pedro \(DP\.06\)/)).toBeVisible()
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Pedro Exemplo · Reunir documentos da perícia' })).toHaveCount(0)
})

test('CA1, CA3, CA7 · a perícia médica da Maria pede documento novo; a cobrança com o pedido ao médico passa pelo G20', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/marcar')
  await page.getByRole('radio', { name: 'Sim, marcado' }).click()
  await page.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf('comprovante_maria.pdf')])
  await expect(page.getByRole('group', { name: 'Lido do comprovante · confira' })).toBeVisible()
  await page.getByRole('radio', { name: 'Sim: atribuir à Documentação' }).click()
  await page.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(page.getByRole('heading', { name: '✓ Perícia registrada' })).toBeVisible()

  // CA1: a Documentação recebe a lista de laudos e exames.
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Maria Exemplo · Reunir documentos da perícia' }).click()
  await expect(page.getByRole('list', { name: 'O que a perícia pede' })).toContainText('Laudo médico recente (até 30 dias)')
  await page.getByRole('link', { name: 'Cobrar e pedir ao médico' }).click()

  // CA7: o pedido ao médico vem do roteiro; CID e diagnóstico são barrados (G20).
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maria Exemplo · Cobrar documento')
  const abordar = page.getByLabel('O que o documento deve abordar')
  await expect(abordar).toHaveValue(/^O relatório médico precisa responder:/)
  const sugerido = await abordar.inputValue()
  await abordar.fill('Escreva que a paciente tem CID M54.5')
  await expect(page.getByRole('button', { name: 'Salvar o pedido ao médico' })).toBeDisabled()
  await expect(page.getByText(/\(G20\)/).first()).toBeVisible()
  await abordar.fill(sugerido)
  await page.getByRole('button', { name: 'Salvar o pedido ao médico' }).click()
  await expect(page.getByRole('status')).toHaveText('Pedido ao médico salvo: ele vai junto na mensagem de cobrança.')

  // A cobrança do dia sai pelo Chatwoot, conferida; a próxima é amanhã.
  await page.getByRole('button', { name: 'Enviar cobrança' }).click()
  const chatwoot = page.getByRole('dialog', { name: 'Chatwoot · conversa com Maria Exemplo' })
  await expect(chatwoot.getByRole('textbox')).toHaveValue(/Para o laudo, leve ao seu médico este pedido/)
  await chatwoot.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status')).toHaveText('Cobrança enviada pelo Chatwoot e registrada.')
  await expect(page.getByText('A cobrança de hoje já foi feita: a próxima é amanhã.')).toBeVisible()

  // CA3: a do Antônio (judicial, sem documento novo) não abre tarefa da Documentação.
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Reunir documentos da perícia' })).toHaveCount(0)
})

test('tema escuro e fonte grande na lista da perícia', async ({ page }) => {
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/casos/pedro-exemplo-1/pericia/documentos?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pedro Exemplo · Reunir documentos da perícia')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
