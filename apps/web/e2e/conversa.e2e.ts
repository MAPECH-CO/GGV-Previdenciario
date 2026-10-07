import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// GGVP-12 · a conversa com o lead ou o cliente (fluxo D5). Cada teste abre um navegador novo e começa da semente de
// exemplo.ts: a Maria Exemplo (perícia do INSS) e a ligação de hoje do Pedro Exemplo, que a Bruna ainda não subiu.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
/** A senha que a cliente fala em voz alta na conversa de exemplo: não pode aparecer na tela (G9). */
const SENHA_DITA = 'Exemplo@2026'

test('GGVP-76 CA1, CA3 a CA7 e CA9, e GGVP-80 · pelo card, conversa presencial com o aviso, transcrição sem a senha, finalizar e o que mudou', async ({ page }) => {
  await page.clock.install()
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: 'Iniciar conversa' }).click()
  const janela = page.getByRole('dialog', { name: /Registrar conversa com o cliente/ })
  await expect(janela.getByRole('radio', { name: /WhatsApp|Vídeo/ })).toHaveCount(0)
  await janela.getByRole('radio', { name: 'Presencial', exact: true }).click()
  await expect(janela.getByRole('radio', { name: 'Transcrição em tempo real · avise o cliente antes de gravar (G10)' })).toBeChecked()
  await janela.getByRole('button', { name: 'Iniciar conversa' }).click()

  await expect(page).toHaveURL(/\/conversas\/conversa-\d+$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Maria Exemplo · Registrar conversa' })).toBeVisible()
  await page.getByRole('button', { name: 'Gravar' }).click()
  await expect(page.getByRole('button', { name: 'Começar a gravar' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Avisei que a conversa será gravada' }).check()
  await page.getByRole('button', { name: 'Começar a gravar' }).click()
  await expect(page.getByText(/● Gravando · 00:00:\d\d · aviso de gravação feito às \d\d:\d\d \(G10\)/)).toBeVisible()
  await page.clock.runFor(110_000)
  const falas = page.getByRole('list', { name: 'Falas' })
  await expect(falas).toContainText('Rua Exemplo das Acácias, 45')
  await expect(falas).toContainText('[senha retirada: vai ao cofre]')
  await expect(page.locator('body')).not.toContainText(SENHA_DITA)
  await page.getByRole('button', { name: 'Finalizar conversa' }).click()

  await expect(page.getByRole('heading', { name: /✓ Conversa finalizada/ })).toBeVisible()
  await expect(page.getByText(/O áudio ficou guardado no card do cliente: conversa-maria-exemplo-.*\.webm/)).toBeVisible()
  await expect(page.getByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeVisible()
  await page.getByRole('button', { name: 'Ver a transcrição' }).click()
  const transcricoes = page.getByRole('dialog', { name: 'Transcrições do caso' })
  await expect(transcricoes.getByRole('button', { name: /Presencial · cliente.*presencial · Bruna \(exemplo\) \+ Maria Exemplo.*transcrita/ })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(SENHA_DITA)
  await transcricoes.getByRole('button', { name: 'Fechar' }).click()

  // GGVP-80: o quadro da IA, com o que mudou e os dados novos; o fato de saúde só o Jurídico vê.
  const quadro = page.getByRole('region', { name: 'O que a IA encontrou na conversa' })
  await expect(quadro.getByRole('list', { name: 'O que mudou' })).toContainText('Ficha · telefone de contato: (11) 90000-0004 → (11) 90000-0044')
  await expect(quadro.getByRole('list', { name: 'O que mudou' })).toContainText('Processo · data da perícia do INSS: 02/10/2026 → 16/10/2026')
  await expect(quadro.getByRole('list', { name: 'Dados novos' })).toContainText('Ficha · endereço: Rua Exemplo das Acácias, 45')
  await expect(quadro.getByRole('list', { name: 'Dados novos' })).toContainText('Processo · fato novo de saúde · só o Jurídico vê')
  await expect(quadro).not.toContainText('hospital no fim de setembro')
  await expect(quadro.getByText('✓ Ficha do cliente')).toBeVisible()
  await expect(quadro.getByText('✓ Campos do processo')).toBeVisible()
  await expect(quadro.getByText(/A senha do gov.br foi dita em voz alta: saiu da transcrição e foi para o cofre \(G9\)/)).toBeVisible()
  await expect(quadro.getByText('Documentação: receber e digitalizar o relatório da alta hospitalar.')).toBeVisible()
  await expect(quadro.getByRole('link', { name: 'Conferir e atualizar (D5.04)' })).toBeVisible()
})

test('GGVP-76 CA2 e CA8, e GGVP-80 CA4 · a ligação do Pedro Exemplo na Central: subir a gravação com o aviso, a IA marca o que mudou; a tarefa sai da Central', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Pedro Exemplo · Registrar conversa' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Pedro Exemplo · Registrar conversa' })).toBeVisible()
  await page.getByLabel(/Áudio da ligação/).setInputFiles({ name: 'ligacao-pedro.ogg', mimeType: 'audio/ogg', buffer: Buffer.alloc(4096) })
  await expect(page.getByRole('button', { name: 'Anexar e transcrever' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'A ligação começou com o aviso de que seria gravada (G10)' }).check()
  await page.getByRole('button', { name: 'Anexar e transcrever' }).click()
  await expect(page.getByRole('heading', { name: '✓ Gravação da ligação anexada' })).toBeVisible()
  await expect(page.getByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'O que a IA encontrou na conversa' }).getByRole('list', { name: 'Dados novos' })).toContainText('Ficha · endereço')
  // Gravada, falta a conferência de quem conversou: a tarefa continua, com o que falta.
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Pedro Exemplo · Registrar conversa' }).locator('xpath=ancestor::li')).toContainText('conferir a conversa (D5.04)')
  await page.getByRole('link', { name: 'Pedro Exemplo · Registrar conversa' }).click()
  await page.getByRole('link', { name: 'Conferir e atualizar (D5.04)' }).click()
  const concluir = page.getByRole('group', { name: 'Concluir a conferência' })
  await concluir.getByRole('button', { name: 'Desfazer' }).click()
  await page.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }).click()
  await concluir.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('heading', { name: '✓ Conversa conferida por Bruna (exemplo)' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Pedro Exemplo · Registrar conversa' })).toHaveCount(0)
})

test('GGVP-84 · quem conversou confere campo por campo; a ficha muda; Ctrl+Z volta o texto; a Sênior volta a versão', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: 'Iniciar conversa' }).click()
  const janela = page.getByRole('dialog', { name: /Registrar conversa com o cliente/ })
  await janela.getByRole('radio', { name: 'Ligação', exact: true }).click()
  await janela.getByRole('button', { name: 'Anexar o áudio' }).click()
  await page.getByLabel(/Áudio da ligação/).setInputFiles({ name: 'ligacao-maria.ogg', mimeType: 'audio/ogg', buffer: Buffer.alloc(4096) })
  await page.getByRole('checkbox', { name: 'A ligação começou com o aviso de que seria gravada (G10)' }).check()
  await page.getByRole('button', { name: 'Anexar e transcrever' }).click()
  await page.getByRole('link', { name: 'Conferir e atualizar (D5.04)' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Maria Exemplo · Conferir conversa' })).toBeVisible()
  const linha = (texto: string) => page.getByRole('list', { name: 'O que a IA quer mudar' }).getByRole('listitem').filter({ hasText: texto })
  await expect(linha('fato novo de saúde')).toContainText('quem pode: a advogada responsável ou a Sênior')
  await linha('endereço').getByRole('button', { name: 'Confirmar' }).click()
  await linha('telefone de contato').getByRole('button', { name: 'Corrigir' }).click()
  await page.getByLabel('Corrigir telefone de contato').fill('(11) 90000-0055')
  await linha('data da perícia').getByRole('button', { name: 'Confirmar' }).click()
  await linha('documento citado').getByRole('button', { name: 'Desfazer' }).click()
  await page.getByRole('radio', { name: 'Não — confirmar e voltar ao D1' }).click()
  await page.getByRole('group', { name: 'Concluir a conferência' }).getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('O caso segue de onde parou: Administrativo · perícia em 02/10 · cobrar o laudo que a perícia pede.')).toBeVisible()

  await page.goto('/clientes/maria-exemplo')
  await expect(page.getByLabel('Endereço')).toHaveValue('Rua Exemplo das Acácias, 45')
  await expect(page.getByLabel('Telefone / WhatsApp *')).toHaveValue('(11) 90000-0055')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('Atualizou na ficha, pela conversa, o telefone de contato: «(11) 90000-0004» → «(11) 90000-0055»')

  // CA9: Ctrl+Z volta o que foi digitado, também no campo com máscara.
  const telefone = page.getByLabel('Telefone / WhatsApp *')
  await telefone.click()
  await telefone.press('End')
  await telefone.press('Backspace')
  await telefone.press('Backspace')
  await expect(telefone).toHaveValue('(11) 90000-00')
  await telefone.press('Control+z')
  await telefone.press('Control+z')
  await expect(telefone).toHaveValue('(11) 90000-0055')

  // CA2: a Sênior abre as versões e volta o telefone para o de antes da conversa.
  await page.goto('/clientes/maria-exemplo?perfil=senior')
  await page.getByRole('button', { name: 'Ver versões' }).click()
  const versoes = page.getByRole('dialog', { name: /Histórico do processo/ })
  const doTelefone = versoes.getByRole('region', { name: 'Ficha · telefone de contato' })
  await expect(doTelefone.getByRole('listitem')).toHaveCount(2)
  await doTelefone.getByRole('button', { name: /Voltar telefone de contato para a versão de/ }).click()
  await expect(doTelefone.getByRole('listitem')).toHaveCount(3)
  await expect(doTelefone.getByRole('listitem').first()).toContainText('Dra. Renata (exemplo) · em vigor(11) 90000-0004')
  await versoes.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByLabel('Telefone / WhatsApp *')).toHaveValue('(11) 90000-0004')
})

test('GGVP-76 CA7 · pelas Transcrições, o registro escrito aparece como "só registro", com quem registrou', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: /Transcrições/ }).click()
  const transcricoes = page.getByRole('dialog', { name: 'Transcrições do caso' })
  await transcricoes.getByRole('button', { name: 'Registrar nova conversa' }).click()
  const janela = page.getByRole('dialog', { name: /Registrar conversa com o cliente/ })
  await janela.getByRole('radio', { name: 'Ligação', exact: true }).click()
  await janela.getByRole('radio', { name: 'Sem áudio · só o registro escrito' }).check()
  await janela.getByLabel('Resumo da conversa *').fill('Perguntou o que levar na perícia.')
  await janela.getByRole('button', { name: 'Salvar o registro' }).click()
  await expect(janela).toHaveCount(0)
  await expect(transcricoes.getByRole('button', { name: /sem áudio.*Ligação · cliente.*ligação · Bruna \(exemplo\) \+ Maria Exemplo.*só registro/ })).toBeVisible()
  await expect(transcricoes.getByText('Perguntou o que levar na perícia.')).toBeVisible()
})

test('tema escuro e fonte grande na conversa', async ({ page }) => {
  await page.goto('/conversas/conversa-pedro-ligacao?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1, name: 'Pedro Exemplo · Registrar conversa' })).toBeVisible()
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
