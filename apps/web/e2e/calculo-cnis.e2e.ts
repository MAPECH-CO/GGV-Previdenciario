import { expect, test } from '@playwright/test'
// Dados criados por este teste; sem importar código de navegador no projeto Node.
const ID_FICTICIO = '11111111-1111-4111-8111-111111111111'
const ENTREVISTA_FICTICIA = ID_FICTICIO + '-ag-teste'
const fichaInventada = () => ({ id: ID_FICTICIO, nome: 'Pessoa CNIS Inventada Teste', agendamentos: [{ id: ENTREVISTA_FICTICIA }] })

test('CNIS: digita vínculos, elimina sobreposição e avisa que não grava o rascunho', async ({ page }) => {
  let gravacoes = 0
  await page.route('**/api/fichas/' + ID_FICTICIO, r => r.fulfill({ json: { ...fichaInventada(), nascimento: '1970-01-01' } }))
  await page.route('**/api/entrevistas/' + ENTREVISTA_FICTICIA + '/calculo', r => { gravacoes++; return r.fulfill({ status: 500, json: { erro: 'Esta rota não deve receber o rascunho.' } }) })
  await page.goto('/entrevista/' + ENTREVISTA_FICTICIA + '/calculo')
  await expect(page.getByRole('heading', { name: 'Digitar vínculos do CNIS' })).toBeVisible()
  await page.getByLabel('Início do vínculo 1').fill('01/01/2018')
  await page.getByLabel('Fim do vínculo 1').fill('20/01/2018')
  await page.getByLabel('Tempo do vínculo 1').selectOption('conferido')
  await page.getByLabel('Carência do vínculo 1').selectOption('conferido')
  await page.getByRole('button', { name: 'Adicionar vínculo', exact: true }).click()
  await page.getByLabel('Início do vínculo 2').fill('10/01/2018')
  await page.getByLabel('Fim do vínculo 2').fill('31/01/2018')
  await page.getByLabel('Tempo do vínculo 2').selectOption('conferido')
  await page.getByLabel('Carência do vínculo 2').selectOption('conferido')
  await page.getByRole('button', { name: 'Calcular prévia' }).click()
  await expect(page.getByRole('status')).toContainText('31 dias, sem duplicar sobreposições')
  await expect(page.getByRole('button', { name: /Salvar cálculo no caso/ })).toBeDisabled()
  expect(gravacoes).toBe(0)
  await page.reload()
  await expect(page.getByLabel('Início do vínculo 1')).toHaveValue('')
})
