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

// GGVP-125, bloco 2 · a agenda e a confirmação no banco: a tarefa que a confirmação abre chega à advogada em outro computador.
test('a Atendimento marca e confirma a entrevista; a advogada vê "Preparar entrevista" e a entrevista na agenda dela', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Agenda Teste')
  await page.getByLabel('Idade *').fill('64')
  await page.getByLabel('Telefone / WhatsApp *').fill('11966665555')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marcar a entrevista com Lia Agenda Teste')

  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '14:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  const chatwoot = page.getByRole('dialog', { name: 'Chatwoot · conversa com Lia Agenda Teste' })
  await chatwoot.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/O convite foi enviado pelo Chatwoot/)).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Lia Agenda Teste · Confirmar agendamento' }).click()
  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByRole('radio', { name: 'Confirmou a entrevista' }).click()
  await page.getByRole('radio', { name: 'Sim, a doutora prepara a conversa' }).click()
  await page.getByRole('button', { name: 'Confirmar entrevista' }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista confirmada/ })).toBeVisible()

  const outro = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await outro.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto('/')
  await expect(advogada.getByRole('link', { name: /Lia Agenda Teste · Preparar entrevista/ })).toBeVisible()
  await advogada.goto('/agenda')
  await advogada.getByRole('tab', { name: 'Lista' }).click()
  await expect(advogada.getByRole('button', { name: /Lia Agenda Teste · Fazer entrevista/ }).filter({ hasText: 'agendado' })).toBeVisible()
  await outro.close()
})

// GGVP-125, bloco 3a · a entrevista gravada no banco: outra sessão do Jurídico recebe "Cadastrar lead"; a gravação, que
// tem dado de saúde, não vai à cópia da Atendimento.
test('a advogada grava e encerra a entrevista de um lead do balcão; a gravação fica só com o Jurídico', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Entrevista Teste')
  await page.getByLabel('Idade *').fill('61')
  await page.getByLabel('Telefone / WhatsApp *').fill('11955554411')
  await page.getByLabel('O que a pessoa pretende *').fill('Afastada do trabalho, sem receber.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '09:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await page.getByRole('dialog', { name: 'Chatwoot · conversa com Lia Entrevista Teste' }).getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/O convite foi enviado pelo Chatwoot/)).toBeVisible()
  const entrevista = await page.evaluate(
    () => (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { nome: string; agendamentos: { id: string }[] }[] }).fichas.find((f) => f.nome === 'Lia Entrevista Teste')!.agendamentos[0].id,
  )

  const origem = new URL(page.url()).origin
  const juridico = await browser.newContext({ baseURL: origem })
  const advogada = await juridico.newPage()
  await advogada.clock.install()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/entrevista/${entrevista}/gravacao`)
  await expect(advogada.getByRole('heading', { level: 1 })).toHaveText('Entrevista com Lia Entrevista Teste')
  await advogada.getByRole('button', { name: 'Gravar' }).click()
  await advogada.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await advogada.getByRole('button', { name: 'Começar a gravar' }).click()
  await advogada.clock.runFor(70_000)
  await advogada.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(advogada.getByRole('heading', { name: /✓ Entrevista encerrada/ })).toBeVisible()
  await expect(advogada.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()

  // Outra sessão do Jurídico, em outro computador.
  const outro = await browser.newContext({ baseURL: origem })
  const outraAdvogada = await outro.newPage()
  await entrarPelaApi(outraAdvogada, 'advogada@exemplo.ggv')
  await outraAdvogada.goto('/advogada')
  await expect(outraAdvogada.getByRole('link', { name: 'Lia Entrevista Teste · Cadastrar lead' })).toBeVisible()

  // A Atendimento abre uma tela: a cópia dela não traz a transcrição.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('ggv.exemplo.v5'))).not.toContain('Lia Entrevista Teste: ')
  expect(await advogada.evaluate(() => sessionStorage.getItem('ggv.exemplo.v5'))).toContain('Lia Entrevista Teste: ')
  await juridico.close()
  await outro.close()
})
