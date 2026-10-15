import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'
const id = '11111111-1111-4111-8111-111111111111'
test('a prestação mantém valores editáveis antes do OK e sinaliza o contrato ainda indisponível', async ({ page }) => {
  // GGVP-44 CA13 (Mateus, 14/10): a prestação é da Sênior.
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  let enviados = 0
  await page.route('**/api/casos/' + id + '/prestacao', r => {
    if (r.request().method() === 'POST') { enviados++; return r.fulfill({ json: { ok: true, versao: 1 } }) }
    return r.fulfill({ json: { casoId: id, cliente: 'Pessoa Inventada Teste', beneficio: 'bpc_loas_idoso', carta: { id, nome: 'Carta fictícia.pdf' }, percentualContrato: '25.00', versoes: [], agendamento: null, podeEditar: true, podeReceber: false } })
  })
  await page.goto('/casos/' + id + '/prestacao')
  await expect(page.getByLabel('Entrada do contrato', { exact: true })).toBeDisabled()
  await expect(page.getByLabel('Parcelas do contrato', { exact: true })).toBeDisabled()
  await page.getByLabel('Valor recebido (atrasados)', { exact: true }).fill('1000,00')
  await expect(page.getByLabel('Valores calculados', { exact: true })).toContainText('Honorários R$ 250,00')
  await page.getByLabel('Forma de pagamento (opcional)', { exact: true }).selectOption('boleto')
  await page.getByLabel('Prazo de pagamento', { exact: true }).fill('2030-10-30')
  await expect(page.getByRole('button', { name: 'Concluir a prestação' })).toBeDisabled()
  expect(enviados).toBe(0)
  await page.getByLabel('Conferi os valores com a carta de concessão', { exact: true }).check()
  await page.getByRole('button', { name: 'Concluir a prestação' }).click()
  await expect(page.getByRole('status')).toContainText('Prestação concluída.')
  expect(enviados).toBe(1)
})
