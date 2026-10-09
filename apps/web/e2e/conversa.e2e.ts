import { readFileSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-12 · a conversa com o lead ou o cliente (fluxo D5), no servidor (GGVP-138): cada teste cadastra o seu lead no
// banco e cada pessoa entra com o login dela, num navegador só dela. GGVP-133: o servidor não transcreve conversa de
// exemplo e o Playwright sobe a API sem a chave do serviço, então aqui não há o que a IA leu: o que ela sugere e a
// conferência item a item ficam nos testes do servidor (conversa.test.ts, com serviço falso). O navegador do Playwright
// não tem microfone; a ligação anexada sem a chave está em transcricao-ligacao.e2e.ts.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
/** O lead do balcão, no banco, pela API, com a sessão da Ana. Devolve o endereço da ficha. */
async function novoLead(page: Page, nome: string, telefone: string) {
  const r = await page.request.post('/api/fichas', { data: { nome, idade: 66, pretende: 'Quer saber do BPC do idoso.', telefone, beneficioInteresse: 'loas-idoso', outraPessoa: false } })
  expect(r.ok()).toBe(true)
  return `/clientes/${(await r.json()).id}`
}

/** Outra pessoa, em outro computador: outra sessão e nada guardado no navegador. */
async function outraPessoa(browser: Browser, page: Page, email: string) {
  const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const pagina = await contexto.newPage()
  await entrarPelaApi(pagina, email)
  return { pagina, fechar: () => contexto.close() }
}

test('GGVP-138 CA7 · a conversa registrada pela Ana: ela confere, a pendência vai para a Central da Eva e a Eva dá por cumprida', async ({ page, browser }) => {
  // Fluxo longo, de várias telas e duas pessoas: o triplo do tempo padrão, para a máquina carregada.
  test.slow()
  await page.goto('/')
  const ficha = await novoLead(page, 'Rosa Conversa Teste', '11944443333')
  const fichaId = ficha.split('/').at(-1)
  const r = await page.request.post('/api/conversas', {
    data: { fichaId, canal: 'ligacao', comQuem: 'cliente', modo: 'escrito', registro: 'Mudou de casa; vai mandar o comprovante do endereço novo.' },
  })
  expect(r.ok()).toBe(true)
  const conversa = `/conversas/${(await r.json()).conversa.id}`

  // GGVP-76 CA8: registrada, falta a conferência de quem conversou; a tarefa está na Central da Ana.
  await page.goto('/')
  const registrar = page.getByRole('link', { name: 'Rosa Conversa Teste · Registrar conversa' })
  await expect(registrar.locator('xpath=ancestor::li')).toContainText('conferir a conversa (D5.04)')

  // GGVP-84: a Ana confere; só registro, nada muda na ficha.
  await page.goto(`${conversa}/conferir`)
  await expect(page.getByRole('heading', { level: 1, name: 'Rosa Conversa Teste · Conferir conversa' })).toBeVisible()
  await expect(page.getByText('Conversa sem áudio: só registro, nada muda na ficha.')).toBeVisible()
  // GGVP-88: surgiu pendência; o combinado cita o setor, e o servidor diz quem é do setor.
  await page.getByRole('radio', { name: 'Sim — criar a tarefa no card (D5.05)' }).click()
  await page.getByLabel('O que ficou combinado *').fill('Atendimento: pedir o comprovante do endereço novo.')
  await page.getByRole('group', { name: 'Escolha o responsável' }).getByRole('radio', { name: 'Eva (exemplo, líder e atendimento)' }).click()
  await page.getByLabel('Prazo *').fill('31/12/2026')
  await page.getByRole('group', { name: 'Concluir a conferência' }).getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('heading', { name: '✓ Conversa conferida por Ana (exemplo)' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Rosa Conversa Teste · Registrar conversa' })).toHaveCount(0)

  // Outra pessoa, outro computador: a pendência está na Central da Eva, que dá por cumprida.
  const eva = await outraPessoa(browser, page, 'lider@exemplo.ggv')
  await eva.pagina.goto('/')
  const cumprir = eva.pagina.getByRole('link', { name: 'Rosa Conversa Teste · Cumprir pendência' })
  await expect(cumprir.locator('xpath=ancestor::li')).toContainText('Atendimento: pedir o comprovante do endereço novo.')
  await eva.pagina.goto((await cumprir.getAttribute('href'))!)
  await eva.pagina.getByRole('group', { name: 'Pendência da conversa' }).getByRole('button', { name: 'Marcar como cumprida' }).click()
  await expect(eva.pagina.getByText(/✓ Cumprida por Eva \(exemplo, líder e atendimento\) em/)).toBeVisible()
  await eva.fechar()
})

test('GGVP-76 CA1, CA5 e GGVP-133 · presencial com o aviso; sem microfone, a tela avisa, não inventa falas e a conversa fica registrada sem áudio', async ({ page }) => {
  test.slow()
  await page.goto('/')
  const ficha = await novoLead(page, 'Rosa Presencial Teste', '11944442222')
  await page.goto(ficha)
  await page.getByRole('button', { name: 'Iniciar conversa' }).click()
  const janela = page.getByRole('dialog', { name: /Registrar conversa com o cliente/ })
  await expect(janela.getByRole('radio', { name: /WhatsApp|Vídeo/ })).toHaveCount(0)
  await janela.getByRole('radio', { name: 'Presencial', exact: true }).click()
  await expect(janela.getByRole('radio', { name: 'Transcrição em tempo real · avise o cliente antes de gravar (G10)' })).toBeChecked()
  await janela.getByRole('button', { name: 'Iniciar conversa' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Rosa Presencial Teste · Registrar conversa' })).toBeVisible()
  await page.getByRole('button', { name: 'Gravar' }).click()
  await expect(page.getByRole('button', { name: 'Começar a gravar' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Avisei que a conversa será gravada' }).check()
  await page.getByRole('button', { name: 'Começar a gravar' }).click()
  // Sem microfone, nada de falas de exemplo: as saídas são subir o áudio gravado fora ou registrar sem áudio.
  await expect(page.getByRole('heading', { name: /^Sem microfone: / })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Falas' })).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('Rua Exemplo das Acácias')
  await expect(page.getByText('Subir o áudio gravado fora')).toBeVisible()
  await page.getByRole('button', { name: 'Registrar como sem áudio' }).click()
  await page.getByLabel('O que foi conversado *').fill('Contou que mudou de casa; traz o comprovante na semana que vem.')
  await page.getByRole('button', { name: 'Registrar sem áudio' }).click()
  await expect(page.getByRole('heading', { name: '✓ Conversa registrada sem áudio' })).toBeVisible()
  await expect(page.getByText('O registro ficou no card, como "só registro".')).toBeVisible()
})

test('GGVP-76 CA7 · pelas Transcrições, o registro escrito aparece como "só registro", com quem registrou', async ({ page }) => {
  await page.goto('/')
  const ficha = await novoLead(page, 'Rosa Registro Teste', '11944441111')
  await page.goto(ficha)
  await page.getByRole('button', { name: /Transcrições/ }).click()
  const transcricoes = page.getByRole('dialog', { name: 'Transcrições do caso' })
  await transcricoes.getByRole('button', { name: 'Registrar nova conversa' }).click()
  const janela = page.getByRole('dialog', { name: /Registrar conversa com o cliente/ })
  await janela.getByRole('radio', { name: 'Ligação', exact: true }).click()
  await janela.getByRole('radio', { name: 'Sem áudio · só o registro escrito' }).check()
  await janela.getByLabel('Resumo da conversa *').fill('Perguntou o que levar na entrevista.')
  await janela.getByRole('button', { name: 'Salvar o registro' }).click()
  await expect(janela).toHaveCount(0)
  await expect(transcricoes.getByRole('button', { name: /sem áudio.*Ligação · cliente.*ligação · Ana \(exemplo\) \+ Rosa Registro Teste.*só registro/ })).toBeVisible()
  await expect(transcricoes.getByText('Perguntou o que levar na entrevista.')).toBeVisible()
})

test('tema escuro e fonte grande na conversa', async ({ page }) => {
  await page.goto('/')
  const ficha = await novoLead(page, 'Rosa Tema Teste', '11944440000')
  const id = ficha.split('/').at(-1)
  const r = await page.request.post('/api/conversas', { data: { fichaId: id, canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' } })
  await page.goto(`/conversas/${(await r.json()).conversa.id}?tema=escuro&fonte=grande`)
  await expect(page.getByRole('heading', { level: 1, name: 'Rosa Tema Teste · Registrar conversa' })).toBeVisible()
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
