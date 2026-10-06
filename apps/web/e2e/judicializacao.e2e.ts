import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-9 · Judicialização e vigília, grupo 1, com a API de verdade e a fonte de exemplo. O relógio da vigília também
// roda no servidor de teste: dependendo da hora, ele já pode ter trazido as publicações; por isso, aqui não se conta.
test.describe.configure({ mode: 'serial' })

test('GGVP-30 e GGVP-26 · a Sênior vê o alarme, reprocessa a rodada e trata a fila de revisão', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Vigília das publicações · Reprocessar vigília' }).first().click()
  await expect(page.getByRole('heading', { name: 'Vigília das publicações' })).toBeVisible()
  await expect(page.getByLabel('Situação do dia')).toContainText('Vigília incompleta')
  await expect(page.getByText(/Vigília falhou às \d\d:\d\d: tempo esgotado/)).toBeVisible()
  await page.getByRole('button', { name: 'Reprocessar' }).first().click()
  await expect(page.getByRole('status')).toContainText('Reprocessada')
  await expect(page.getByText(/reprocessada por Helena \(exemplo\)/)).toBeVisible()

  const fila = page.getByLabel('Fila de revisão')
  const semNumero = fila.getByRole('listitem').filter({ hasText: 'sem número do processo' })
  await semNumero.getByLabel('Número CNJ do processo').fill('0005678-75.2026.4.03.6301')
  await semNumero.getByRole('button', { name: 'Vincular ao processo' }).click()
  await expect(page.getByRole('status')).toHaveText('Publicação vinculada. A advogada recebeu para ler.')
  const deOutro = fila.getByRole('listitem').filter({ hasText: 'processo que não é do escritório' })
  await deOutro.getByRole('button', { name: 'Não é do escritório' }).click()
  await expect(page.getByRole('status')).toHaveText('Registrado: não é do escritório.')
  await expect(fila).toContainText('Nada na fila.')
  await expect(page.getByLabel('Descartes')).toContainText('repetida')
})

test('GGVP-74, GGVP-34 e GGVP-37 · a advogada lê a exigência, o prazo é contado e a tarefa nasce; reclassifica um andamento', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Otávio Lima (exemplo) · Ler publicação' }).click()
  await expect(page.getByRole('heading', { name: 'Publicações do processo' })).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Intime-se a parte autora' }).getByRole('link', { name: 'Ler' }).click()

  await page.getByLabel('Intimação ou exigência').check()
  await page.getByRole('button', { name: 'Classificar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"')
  await page.getByLabel('Prazo da publicação (dias)').fill('15')
  await page.getByRole('button', { name: 'Classificar' }).click()
  await expect(page.getByRole('status')).toContainText('Analisar exigência do juiz')
  await expect(page.getByText(/Prazo: de \d\d\/\d\d\/\d{4} até/)).toBeVisible()
  await expect(page.getByText(/pelo lado seguro \(G12\)/)).toBeVisible()

  await page.getByRole('link', { name: '← Publicações do processo' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Autos conclusos' }).getByRole('link', { name: 'Ler' }).click()
  await page.getByLabel('Só andamento').check()
  await page.getByRole('button', { name: 'Classificar' }).click()
  await expect(page.getByRole('status')).toContainText('sem tarefa')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Otávio Lima (exemplo) · Analisar exigência do juiz' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Otávio Lima (exemplo) · Ler publicação' })).toHaveCount(0)
})
