import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-146, parte 3 · a Sênior mantém os feriados e as suspensões dos tribunais na Configuração, com histórico. O
// teste acrescenta e tira um dia do TJSP em 2027 e não roda a carga da lei: o banco é o mesmo dos outros testes, e os
// feriados mudariam os prazos que eles contam. A carga tem o teste dela, na API.

test('a Sênior acrescenta e tira uma suspensão do TJSP; a Financeira vê a lista e o histórico, sem mudar', async ({ browser, baseURL }) => {
  const contexto = await browser.newContext({ baseURL })
  const senior = await contexto.newPage()
  await entrarPelaApi(senior, 'senior@exemplo.ggv')
  await senior.goto('/configuracao')
  const secao = senior.getByRole('region', { name: 'Feriados e suspensões dos tribunais' })
  await expect(secao.getByRole('button', { name: 'Carregar os feriados da lei de 2026 e 2027' })).toBeVisible()

  const form = secao.getByRole('form', { name: 'Acrescentar feriado ou suspensão' })
  await form.getByLabel('Dia (dd/mm/aaaa)').fill('17032027')
  await expect(form.getByLabel('Dia (dd/mm/aaaa)')).toHaveValue('17/03/2027')
  await form.getByLabel('Vale para').selectOption({ label: 'TJSP' })
  await form.getByLabel('O que é').fill('Suspensão de teste: sistema fora do ar')
  await form.getByRole('button', { name: 'Acrescentar' }).click()
  await expect(secao.getByRole('status')).toHaveText('Acrescentado: 17/03/2027.')

  await secao.getByLabel('Tribunal').selectOption({ label: 'TJSP' })
  await secao.getByLabel('Ano').selectOption('2027')
  const lista = secao.getByRole('list', { name: 'Feriados de TJSP em 2027' })
  await expect(lista).toContainText('17/03/2027 · Suspensão de teste: sistema fora do ar')
  await expect(secao.getByRole('list', { name: 'Histórico dos feriados' })).toContainText('Helena (exemplo) · Acrescentou 17/03/2027 · TJSP · Suspensão de teste')

  // A Financeira, da gestão, vê no computador dela, sem botão de mudar.
  const outro = await browser.newContext({ baseURL })
  const financeiro = await outro.newPage()
  await entrarPelaApi(financeiro, 'financeiro@exemplo.ggv')
  await financeiro.goto('/configuracao')
  const vista = financeiro.getByRole('region', { name: 'Feriados e suspensões dos tribunais' })
  await vista.getByLabel('Tribunal').selectOption({ label: 'TJSP' })
  await vista.getByLabel('Ano').selectOption('2027')
  await expect(vista.getByRole('list', { name: 'Feriados de TJSP em 2027' })).toContainText('17/03/2027')
  await expect(vista.getByRole('button')).toHaveCount(0)
  await outro.close()

  await lista.getByRole('button', { name: 'Tirar 17/03/2027 · Suspensão de teste: sistema fora do ar' }).click()
  await expect(secao.getByRole('status')).toHaveText('Tirado: 17/03/2027.')
  await expect(secao.getByText('Nenhum dia de TJSP em 2027.')).toBeVisible()
  await expect(secao.getByRole('list', { name: 'Histórico dos feriados' })).toContainText('Helena (exemplo) · Tirou 17/03/2027 · TJSP · Suspensão de teste')
  await contexto.close()
})
