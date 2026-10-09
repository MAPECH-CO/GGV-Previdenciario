import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-132 · a documentação médica no banco do portal, com login de verdade e uma pessoa em cada computador. O laudo da
// Lúcia (semente do servidor) já foi lido: a advogada dá o parecer, a Atendimento pede o complemento ao médico e a
// Documentação vê o resultado, sem o conteúdo clínico. Nada passa pelo navegador de uma pessoa para a outra.

test('o laudo da Lúcia vai ao parecer da advogada, ao pedido da Atendimento e ao resultado que a Documentação vê', async ({ page, browser }) => {
  test.slow()
  await page.goto('/')
  const origem = new URL(page.url()).origin

  // A advogada, no computador dela: a tarefa nasce do caso do servidor.
  const juridico = await browser.newContext({ baseURL: origem })
  const advogada = await juridico.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto('/advogada')
  await advogada.getByRole('link', { name: 'Lúcia Prado (exemplo) · Dar parecer médico' }).click()
  await expect(advogada).toHaveURL(/\/casos\/[0-9a-f-]{36}\/parecer$/)
  const casoId = new URL(advogada.url()).pathname.split('/')[2]
  const obrigatorios = advogada.getByRole('list', { name: 'Itens obrigatórios' })
  await expect(obrigatorios.getByRole('listitem').first()).toContainText('ausente')
  const selects = advogada.getByRole('combobox', { name: /^Conferência:/ })
  await expect(selects.first()).toBeVisible()
  for (let i = 0; i < (await selects.count()); i++) await selects.nth(i).selectOption('confere')
  await advogada.getByRole('radio', { name: 'Insuficiente — pedir complemento' }).click()
  await expect(advogada.getByRole('textbox', { name: /O que o documento deve abordar/ })).toHaveValue(/Qual é a natureza do impedimento do paciente\?/)
  await advogada.getByRole('button', { name: 'Registrar parecer' }).click()
  await expect(advogada.getByRole('heading', { name: '✓ Parecer registrado: Insuficiente' })).toBeVisible()

  // A Atendimento, no computador dela: o pedido ao médico chegou pela sincronização, e a ligação fica no banco.
  await page.goto('/')
  await page.getByRole('link', { name: 'Lúcia Prado (exemplo) · Pedir complemento ao médico' }).click()
  await expect(page).toHaveURL(`/casos/${casoId}/complemento`)
  await expect(page.getByRole('list', { name: 'Perguntas ao médico' })).toContainText('1. Qual é a natureza do impedimento do paciente?')
  await expect(page.getByText(/pág\. \d/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByRole('radio', { name: 'Não atendeu (caixa postal ou sem resposta)' }).click()
  await page.getByRole('button', { name: 'Registrar ligação' }).click()
  await expect(page.getByRole('list', { name: 'Tentativas do pedido' })).toContainText(/1ª · \d{2}\/\d{2} · Ligação · sem resposta/)

  // A Documentação, em outro computador: o resultado e quem confirmou, sem o conteúdo dos laudos.
  const documentacao = await browser.newContext({ baseURL: origem })
  const fabio = await documentacao.newPage()
  await entrarPelaApi(fabio, 'documentacao@exemplo.ggv')
  await fabio.goto(`/casos/${casoId}/parecer`)
  await expect(fabio.getByText(/dado de saúde só aparece para a advogada/)).toBeVisible()
  await expect(fabio.getByRole('list', { name: 'Itens obrigatórios' })).toHaveCount(0)
  await expect(fabio.getByText('Insuficiente').first()).toBeVisible()

  // A advogada vê a tentativa da Atendimento no histórico da ficha, sem nada guardado no navegador dela.
  const ficha = await advogada.request.get('/api/documentacao-medica')
  const pessoa = (await ficha.json()).fichas.find((f: { nome: string }) => f.nome === 'Lúcia Prado (exemplo)').id
  await advogada.goto(`/clientes/${pessoa}`)
  const historico = advogada.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Registrou o parecer médico do LOAS Deficiente: Insuficiente (G17)')
  await expect(historico).toContainText('Complemento ao médico: 1ª tentativa por Ligação (sem resposta)')
  await juridico.close()
  await documentacao.close()
})
