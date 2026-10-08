import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-125, bloco 1 · o lead do balcão fica no banco do portal: outra pessoa, em outro computador, acha e abre a ficha.

test('o lead que a Atendimento cadastra no balcão, a advogada acha e abre no computador dela', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Servidor Teste')
  await page.getByLabel('Idade *').fill('63')
  await page.getByLabel('Telefone / WhatsApp *').fill('11977776666')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar apenas' }).click()
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
  const ficha = new URL(page.url()).pathname

  // Outro computador: outra sessão e nada guardado no navegador.
  const outro = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await outro.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto('/balcao')
  await advogada.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('lia servidor')
  await expect(advogada.getByRole('list', { name: 'Pessoas encontradas' }).getByRole('button', { name: /Lia Servidor Teste/ })).toBeVisible()

  await advogada.goto(ficha)
  await expect(advogada.getByRole('heading', { level: 2, name: 'Lia Servidor Teste' })).toBeVisible()
  await expect(advogada.getByRole('list', { name: 'Últimos contatos' })).toContainText('Quer saber do BPC do idoso.')
  const historico = advogada.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Criou a ficha no balcão (lead)')
  await expect(historico).toContainText('Ana (exemplo)')
  await outro.close()
})
