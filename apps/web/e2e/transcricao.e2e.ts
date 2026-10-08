import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-46 · Transcrever a entrevista. Cada teste abre um navegador novo, então começa da semente de exemplo.ts: a
// entrevista da Josefa é hoje e o Antônio já tem as conversas do Figma 1626:2.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

async function gravarEEncerrar(page: Page, caminho = '/entrevista/josefa-entrevista/gravacao') {
  await page.clock.install()
  await page.goto(caminho)
  await page.getByRole('button', { name: 'Gravar' }).click()
  await page.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await page.getByRole('button', { name: 'Começar a gravar' }).click()
  await expect(page.getByText(/● Gravando/)).toBeVisible()
  await page.clock.runFor(140_000)
  await page.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
}

test('CA1, CA2, CA6, CA7 e CA8 · da entrevista encerrada à transcrição: buscar, prova, conferir e levar à ficha, documentos ao checklist', async ({ page }) => {
  await gravarEEncerrar(page)
  await expect(page.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Ver a transcrição' }).click()
  const janela = page.getByRole('dialog', { name: 'Transcrições do caso' })
  await expect(janela.getByRole('heading', { name: /^Entrevista com a advogada · \d\d\/\d\d\/\d{4} · 2 min$/ })).toBeVisible()
  await expect(janela.getByText('Resumo pela IA')).toBeVisible()
  const trechos = janela.getByRole('list', { name: 'Trechos' })
  await expect(trechos.getByText('Dra. Paula').first()).toBeVisible()
  await expect(trechos.getByText('Josefa').first()).toBeVisible()

  await janela.getByLabel('Buscar na transcrição').fill('laudo')
  await expect(trechos.getByRole('listitem')).toHaveCount(3)
  await expect(trechos.locator('mark').first()).toHaveText('laudo')
  await janela.getByLabel('Buscar na transcrição').fill('')
  await janela.getByRole('button', { name: 'Marcar como prova do trecho de 00:24' }).click()
  await expect(janela.getByText('1 trecho marcado como prova')).toBeVisible()

  await expect(janela.getByRole('button', { name: 'Conferir e levar' })).toBeDisabled()
  await janela.getByRole('checkbox', { name: 'Conferi: telefone' }).check()
  await janela.getByRole('button', { name: 'Conferir e levar' }).click()
  await expect(janela.getByText('✓ conferida')).toHaveCount(1)
  await janela.getByRole('checkbox', { name: 'Conferi a lista com a entrevista' }).check()
  await janela.getByRole('button', { name: 'Enviar ao checklist do benefício' }).click()
  await expect(janela.getByText(/✓ Conferida e enviada ao checklist do benefício/)).toBeVisible()
  await janela.getByRole('button', { name: 'Fechar' }).click()

  await page.goto('/clientes/josefa-exemplo')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText('telefone: «(11) 90000-0002» → «(11) 90000-0021»')
})

test('CA3 · a transcrição falha: o aviso e "Tentar de novo"', async ({ page }) => {
  await gravarEEncerrar(page, '/entrevista/josefa-entrevista/gravacao?simular=falha-da-transcricao')
  await expect(page.getByText('A transcrição falhou: o serviço de transcrição não respondeu.')).toBeVisible()
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
})

test('CA4 · pela ficha do cliente, a lista do caso com a data, quem participou e a duração; o Atendimento não abre a entrevista', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo')
  await page.getByRole('button', { name: 'Transcrições (2)' }).click()
  const janela = page.getByRole('dialog', { name: 'Transcrições do caso' })
  await expect(janela.getByText('2 gravações · 1 registro sem áudio')).toBeVisible()
  const lista = janela.getByRole('navigation', { name: 'Gravações e registros' })
  await expect(lista.getByRole('button')).toHaveCount(3)
  await expect(lista.getByRole('button', { name: /10\/07 · 38 min.*Dra\. Paula \+ Atendimento \+ Antônio Exemplo/ })).toBeVisible()
  await lista.getByRole('button', { name: /Entrevista com a advogada/ }).click()
  await expect(janela.getByText(/Só o Jurídico abre o resumo, a transcrição e o áudio/)).toBeVisible()
  await lista.getByRole('button', { name: /Telefone: indeferimento/ }).click()
  await expect(janela.getByText(/o cliente concordou em ajuizar/)).toBeVisible()
})

test('tema escuro e fonte grande com a janela aberta', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo?tema=escuro&fonte=grande')
  await page.getByRole('button', { name: 'Transcrições (2)' }).click()
  await expect(page.getByRole('dialog', { name: 'Transcrições do caso' })).toBeVisible()
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
