import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-90 · confirmar o desfecho de mérito (D4.02), com as duas sentenças de exemplo já classificadas pela vigília. A
// improcedente vai à Sênior, que escreve e protocola o recurso (Lucas, 09/10); a procedente por RPV abre "Acompanhar pagamento".

test('improcedente: a advogada confirma, e a Sênior recebe "Decidir recurso"', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Marina Souza (exemplo) · Confirmar desfecho' }).click()
  await expect(page.getByRole('region', { name: 'Decisão de mérito' })).toContainText('JULGO IMPROCEDENTE')
  await page.getByRole('radio', { name: 'Improcedente' }).click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Desfecho confirmado. Nasceu "Decidir recurso" para a Sênior, com o prazo do recurso.')

  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Marina Souza (exemplo) · Decidir recurso' })).toBeVisible()
})

test('procedente por RPV: a advogada confirma, e nasce "Acompanhar pagamento"', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Caio Ferreira (exemplo) · Confirmar desfecho' }).click()
  await page.getByRole('radio', { name: 'Procedente total' }).click()
  await page.getByRole('radio', { name: 'RPV' }).click()
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Desfecho confirmado. Nasceu "Acompanhar pagamento".')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Caio Ferreira (exemplo) · Acompanhar pagamento' })).toBeVisible()
})
