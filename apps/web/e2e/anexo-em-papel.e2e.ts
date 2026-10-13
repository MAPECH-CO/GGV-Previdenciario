import { expect, test } from '@playwright/test'

test('a ficha em papel avisa quando os bytes falham e só confirma depois de guardar o arquivo', async ({ page }) => {
  await page.goto('/')
  const criada = await page.request.post('/api/fichas', { data: {
    nome: 'Pessoa Papel Inventada Teste', idade: 63, telefone: '11933332209',
    pretende: 'Preencher a ficha de atendimento.', beneficioInteresse: 'loas-idoso', outraPessoa: false,
  } })
  expect(criada.ok()).toBe(true)
  const ficha = await criada.json()
  await page.goto('/clientes/' + ficha.id + '/ficha-de-atendimento')
  const conteudo = '**/api/fichas/' + ficha.id + '/arquivos/conteudo'
  await page.route(conteudo, r => r.fulfill({ status: 503, json: { erro: 'Falha inventada no teste ao guardar o arquivo.' } }))
  await page.getByLabel('PDF ou foto da ficha em papel').setInputFiles({
    name: 'ficha-teste.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ficha inventada no teste'),
  })
  await page.getByRole('button', { name: 'Guardar arquivo', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Falha inventada no teste')
  await expect(page.getByText('Arquivo guardado no servidor.')).toHaveCount(0)
  await page.unroute(conteudo)
  await page.getByRole('button', { name: 'Guardar arquivo', exact: true }).click()
  await expect(page.getByText('Arquivo guardado no servidor.')).toBeVisible()
  await expect(page.getByText('O preenchimento automático a partir deste arquivo ainda não está disponível.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir a ficha', exact: true })).toBeVisible()
})
