import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-123 · Marcar a entrevista e a agenda. Cada teste abre um navegador novo, então começa da semente de exemplo.ts;
// as datas da semente seguem o relógio da máquina, por isso o teste escolhe o primeiro dia que a tela oferece.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

async function marcar(page: Page, hora: string) {
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: hora }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
}

test('CA1, CA4 e CA5 · do balcão a marcar a entrevista, mandar o convite no Chatwoot e ver na agenda', async ({ page }) => {
  await page.goto('/balcao')
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('natali')
  await page.getByRole('button', { name: /Natália Exemplo/ }).click()
  await page.getByRole('radio', { name: 'Entrevista agendada' }).click()
  await page.getByRole('link', { name: 'Marcar a entrevista' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marcar a entrevista com Natália Exemplo')

  await marcar(page, '10:30')
  const chatwoot = page.getByRole('dialog', { name: 'Chatwoot · conversa com Natália Exemplo' })
  await expect(chatwoot.getByLabel(/Mensagem do convite/)).toHaveValue(/ficha de atendimento em papel/)
  await chatwoot.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/O convite foi enviado pelo Chatwoot/)).toBeVisible()

  await page.getByRole('link', { name: 'Ver na agenda' }).click()
  await page.getByRole('tab', { name: 'Lista' }).click()
  await expect(page.getByRole('button', { name: /Natália Exemplo · Fazer entrevista/ }).filter({ hasText: 'agendado' })).toBeVisible()
})

test('CA3 · horário ocupado avisa e deixa marcar mesmo assim', async ({ page }) => {
  await page.goto('/agenda/marcar/josefa-exemplo')
  await page.getByLabel(/Enviar convite e lembrete/).uncheck()
  await marcar(page, '14:00')
  await expect(page.getByRole('heading', { name: /✓ Entrevista marcada/ })).toBeVisible()

  await page.goto('/agenda/marcar/antonio-exemplo')
  await page.getByLabel(/Enviar convite e lembrete/).uncheck()
  await marcar(page, '14:00')
  await expect(page.getByRole('alert')).toContainText('Este horário já tem Josefa Exemplo')
  await page.getByRole('button', { name: 'Marcar mesmo assim' }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista marcada/ })).toBeVisible()
})

test('CA5 · compromisso interno, sem cliente, entra na agenda', async ({ page }) => {
  const hoje = new Date()
  const data = [hoje.getDate(), hoje.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('/') + `/${hoje.getFullYear()}`
  await page.goto('/agenda?ver=lista')
  await page.getByRole('button', { name: '+ Novo evento' }).click()
  const janela = page.getByRole('dialog', { name: 'Novo evento' })
  await janela.getByRole('radio', { name: 'Compromisso interno' }).click()
  await janela.getByLabel('Título *').fill('Gravação do vídeo do escritório')
  await janela.getByLabel('Data * (dd/mm/aaaa)').fill(data)
  await janela.getByLabel('Hora *').fill('23:00')
  await janela.getByRole('button', { name: 'Pôr na agenda' }).click()
  await expect(page.getByRole('button', { name: /Gravação do vídeo do escritório · Compromisso interno/ })).toContainText('Ana (exemplo) · interno')
})

test('CA7, CA8 e CA9 · o que passou sem registro: "Faltou", remarcar com motivo, e o motivo em "Últimos contatos"', async ({ page }) => {
  await page.goto('/agenda?ver=lista')
  await page.getByRole('region', { name: 'Para confirmar se aconteceu' }).getByRole('button', { name: /Natália Exemplo/ }).click()
  const detalhe = page.getByRole('dialog', { name: /Natália Exemplo · Fazer entrevista/ })
  await expect(detalhe).toContainText('Passou sem registro: confirme se aconteceu.')
  await detalhe.getByRole('button', { name: 'Faltou' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Remarcar a entrevista com Natália Exemplo')
  await page.getByLabel(/Enviar convite e lembrete/).uncheck()
  await page.getByLabel('Motivo da remarcação *').fill('Ficou sem internet na hora')
  await marcar(page, '16:00')
  await expect(page.getByRole('heading', { name: /✓ Entrevista remarcada/ })).toBeVisible()
  await page.getByRole('link', { name: 'Abrir a ficha' }).click()
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText('Ficou sem internet na hora')
})

test('CA6 · "Marcar como realizado" na agenda', async ({ page }) => {
  await page.goto('/agenda?ver=lista')
  await page.getByRole('button', { name: /Josefa Exemplo · Fazer entrevista/ }).click()
  await page.getByRole('dialog', { name: /Josefa Exemplo/ }).getByRole('button', { name: 'Marcar como realizado' }).click()
  await expect(page.getByRole('button', { name: /Josefa Exemplo · Fazer entrevista/ })).toContainText('realizado')
})

for (const caminho of ['/agenda', '/agenda/marcar/josefa-exemplo']) {
  test(`tema escuro e fonte grande em ${caminho}`, async ({ page }) => {
    await page.goto(`${caminho}?tema=escuro&fonte=grande`)
    const corpo = page.locator('body')
    await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
    await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  })
}
