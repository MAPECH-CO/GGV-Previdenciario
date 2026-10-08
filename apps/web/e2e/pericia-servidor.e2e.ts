import { expect, test, type Browser, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-137 · a Perícia no banco do portal, com login de verdade e uma pessoa por computador: a advogada decide a perícia
// no INSS; o Jurídico administrativo marca com o comprovante e registra o comparecimento; a advogada confere o resultado
// com o laudo; a Documentação abre a mesma perícia sem ver o laudo (dado de saúde, só o Jurídico).

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 ${name}`) })
const hojeIso = () => new Date().toLocaleDateString('sv-SE')

/** Outra pessoa, em outro computador: outra sessão e nada guardado no navegador. */
async function computadorDe(browser: Browser, origem: string, email: string): Promise<Page> {
  const contexto = await browser.newContext({ baseURL: origem })
  const page = await contexto.newPage()
  await entrarPelaApi(page, email)
  return page
}

test('da perícia marcada ao resultado, no servidor, trocando de pessoa a cada passo', async ({ page, browser }) => {
  test.setTimeout(180_000)
  // A advogada decide a perícia médica no D2.03: o sistema abre a perícia, que espera o INSS liberar o agendamento.
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  // O José: nenhum outro teste de tela mexe no caso dele (o banco do Playwright é um só para todos).
  await page.getByRole('link', { name: 'José Ramos (exemplo) · Decidir perícia' }).click()
  const casoId = new URL(page.url()).pathname.split('/')[2]
  await page.getByLabel('Sim, o sistema abre a tarefa de perícia').check()
  await page.getByLabel('Perícia médica').check()
  await page.getByRole('button', { name: 'Definir' }).click()
  await expect(page.getByRole('status')).toContainText('abriu a tarefa de perícia')
  const origem = new URL(page.url()).origin
  const cliente: string = (await (await page.request.get(`/api/processos/${casoId}/pericia`)).json()).ficha.nome

  // O Jurídico administrativo: o INSS liberou o agendamento (a vigília, ainda pela API) e a tarefa entra na Central dele.
  const igor = await computadorDe(browser, origem, 'juridico@exemplo.ggv')
  expect((await igor.request.post(`/api/processos/${casoId}/pericia/liberacao`)).ok()).toBe(true)
  await igor.goto('/juridico-administrativo')
  await igor.getByRole('link', { name: `${cliente} · Marcar perícia`, exact: true }).click()
  await expect(igor).toHaveURL(`/casos/${casoId}/pericia/marcar`)
  await igor.getByRole('radio', { name: 'Sim, marcado' }).click()
  await igor.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf(`comprovante-${hojeIso()}.pdf`)])
  const lido = igor.getByRole('group', { name: 'Lido do comprovante · confira' })
  await expect(lido).toContainText('perito não consta no comprovante')
  // O Playwright roda sem chave de IA: a leitura volta vazia, com o motivo, e a pessoa preenche olhando o PDF. A perícia é
  // hoje cedo, e o comparecimento já abre.
  await expect(lido).toContainText('A IA não leu o comprovante agora')
  await lido.getByLabel(/Data/).fill(new Date().toLocaleDateString('pt-BR'))
  await lido.getByLabel('Hora').fill('00:01')
  await lido.getByLabel('Local').fill('Agência INSS Santo Amaro')
  await igor.getByRole('radio', { name: 'Não: seguir para ligar e orientar' }).click()
  await igor.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(igor.getByRole('heading', { name: '✓ Perícia registrada' })).toBeVisible()

  await igor.goto(`/casos/${casoId}/pericia/comparecimento`)
  await igor.getByRole('radio', { name: 'Compareceu' }).click()
  await igor.getByRole('button', { name: 'Registrar' }).click()
  await expect(igor.getByRole('heading', { name: '✓ Comparecimento registrado' })).toBeVisible()

  // A advogada, no computador dela: a tarefa do resultado, o laudo lido, as conferências e o resultado favorável.
  const gabi = await computadorDe(browser, origem, 'advogada@exemplo.ggv')
  await gabi.goto('/advogada')
  await gabi.getByRole('link', { name: `${cliente} · Conferir resultado da perícia`, exact: true }).click()
  await expect(gabi).toHaveURL(`/casos/${casoId}/pericia/resultado`)
  await gabi.getByLabel(/Laudo ou registro do GERID/).setInputFiles([pdf('laudo_pericia.pdf')])
  await expect(gabi.getByText(/A IA não leu o laudo agora/)).toBeVisible()
  await gabi.getByRole('radio', { name: 'Favorável — seguir' }).click()
  for (const caixa of await gabi.getByRole('region', { name: 'Conferência (você decide; a IA só resume)' }).getByRole('checkbox').all()) await caixa.check()
  await gabi.getByRole('button', { name: 'Registrar resultado' }).click()
  await expect(gabi.getByRole('heading', { name: '✓ Resultado registrado: favorável' })).toBeVisible()

  // A Documentação abre a mesma perícia, no banco, sem o laudo nem o resultado: dado de saúde, só o Jurídico.
  const fabio = await computadorDe(browser, origem, 'documentacao@exemplo.ggv')
  const daDocumentacao = await (await fabio.request.get(`/api/processos/${casoId}/pericia`)).json()
  expect([daDocumentacao.situacao, daDocumentacao.pericia.resultado?.laudo]).toEqual(['concluida', undefined])
  expect(JSON.stringify(daDocumentacao)).not.toContain('laudo_pericia.pdf')
})
