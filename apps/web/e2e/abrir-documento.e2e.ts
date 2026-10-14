import { createHash } from 'node:crypto'
import { expect, test, type Locator } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-81 CA17 e GGVP-18 CA8 (Pedro, 14/10): o "Abrir" de cada documento abre o próprio arquivo numa janela do navegador,
// na conferência e na liberação ao Jurídico; nunca a ficha. O laudo continua só com o Jurídico.

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')

test('a Documentação abre o RG na conferência e na liberação; o laudo fica com o Jurídico', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const novo = { nome: 'Lia Abrir Documento', idade: 66, pretende: 'Quer o BPC do idoso.', telefone: '11933331188', cpf: '61427395837', beneficioInteresse: 'loas-idoso', outraPessoa: false }
  const { id } = await (await page.request.post('/api/fichas', { data: novo })).json()
  const { processo } = await (await page.request.post(`/api/fichas/${id}/processos`, { data: { beneficio: 'loas-idoso' } })).json()
  const rg = Buffer.from('%PDF-1.4 o RG da Lia, para abrir na janela')
  const laudo = Buffer.from('%PDF-1.4 o laudo da Lia, só para o Jurídico')

  // A Atendimento envia o RG e o laudo pelo card.
  await page.goto(`/clientes/${id}`)
  await page.getByRole('button', { name: /Solte os documentos do cliente aqui/ }).click()
  const card = page.getByRole('dialog', { name: 'Conferir e enviar' })
  await card.getByLabel(/Solte mais arquivos aqui/).setInputFiles([
    { name: 'RG Lia.pdf', mimeType: 'application/pdf', buffer: rg },
    { name: 'Laudo Lia.pdf', mimeType: 'application/pdf', buffer: laudo },
  ])
  await card.getByRole('combobox', { name: /Tipo de RG Lia/ }).selectOption('rg')
  await card.getByRole('combobox', { name: /Tipo de Laudo Lia/ }).selectOption('laudo')
  await card.getByRole('button', { name: 'Enviar para a pasta do cliente' }).click()
  await expect(card).toBeHidden()

  // Outro computador: a Documentação abre o RG na conferência, numa janela, e o arquivo é o que a Atendimento mandou.
  const outro = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const documentacao = await outro.newPage()
  await entrarPelaApi(documentacao, 'documentacao@exemplo.ggv')
  await documentacao.goto(`/clientes/${id}/conferir-documentos`)
  const lidos = documentacao.getByRole('list', { name: 'Documentos lidos pela IA' })
  const doRg = `/api/pessoas/${id}/documentos/${sha256(rg)}`
  // Abre a janela e pede o arquivo nela. Sem tela, o Chromium baixa o PDF em vez de mostrar: confere-se o pedido da janela.
  const abrirNaJanela = (link: Locator) =>
    Promise.all([documentacao.waitForEvent('popup'), outro.waitForEvent('response', (r) => new URL(r.url()).pathname === doRg), link.click()])
  const [janela, resposta] = await abrirNaJanela(lidos.getByRole('link', { name: 'Abrir Documento pessoal (RG)' }))
  expect(resposta.status()).toBe(200)
  await janela.close()
  const arquivo = await documentacao.request.get(doRg)
  expect([arquivo.status(), arquivo.headers()['content-type'], await arquivo.text()]).toEqual([200, 'application/pdf', rg.toString()])
  // O laudo: a tela não oferece o "Abrir", e o servidor recusa à Documentação.
  await expect(lidos).toContainText('o conteúdo fica com o Jurídico')
  expect((await documentacao.request.get(`/api/pessoas/${id}/documentos/${sha256(laudo)}`)).status()).toBe(403)
  await documentacao.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }).check()
  await documentacao.getByRole('button', { name: 'Arquivar' }).click()
  await expect(documentacao.getByRole('heading', { name: /✓ Arquivado às/ })).toBeVisible()

  // Na liberação ao Jurídico, o RG abre o mesmo arquivo; a entrevista não tem botão sem ação.
  await documentacao.goto(`/casos/${processo.id}/liberar`)
  const recebidos = documentacao.getByRole('list', { name: 'Documentos recebidos' })
  const [, outraResposta] = await abrirNaJanela(recebidos.getByRole('link', { name: /^Abrir .*RG/ }))
  expect(outraResposta.status()).toBe(200)
  await expect(documentacao.getByRole('button', { name: 'Abrir a entrevista' })).toHaveCount(0)
  await outro.close()
})
