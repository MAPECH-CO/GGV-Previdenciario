import { expect, test } from '@playwright/test'
import { SENHA_DE_EXEMPLO, entrarPelaApi } from './entrar.ts'

// GGVP-8 · Via administrativa no INSS, grupo 1, com a API de verdade e os casos de exemplo (já aprovados pela Sênior).
test.describe.configure({ mode: 'serial' })

test('GGVP-27 · o Jurídico administrativo protocola um caso: senha do cofre, número, DER, comprovante e conferência', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Central · Jurídico administrativo' })).toBeVisible()
  const protocolos = page.getByRole('link', { name: /· Protocolar no Meu INSS$/ })
  await expect(protocolos).toHaveCount(3)
  await protocolos.first().click()

  await expect(page.getByRole('heading', { name: 'Protocolar no Meu INSS' })).toBeVisible()
  await expect(page.getByText(/OK recebido · Helena \(exemplo\)/)).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(5)

  await page.getByRole('button', { name: 'Ver a senha do gov.br' }).click()
  await page.getByLabel('Confirme com a sua senha do portal').fill(SENHA_DE_EXEMPLO)
  await page.getByRole('button', { name: 'Mostrar por 60 segundos' }).click()
  await expect(page.getByRole('status')).toContainText('Senha do gov.br:')

  await page.getByLabel('Número do requerimento').fill('2026123456')
  await page.getByLabel('Data de entrada do requerimento (DER)').fill('05102026')
  await page.getByLabel('Comprovante do protocolo').setInputFiles({ name: 'comprovante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 exemplo') })
  await page.getByRole('button', { name: 'Registrar protocolo' }).click()
  await expect(page.getByRole('alert')).toHaveText('Marque "Revisei o requerimento antes de enviar"')
  await page.getByLabel('Revisei o requerimento antes de enviar').check()
  await page.getByRole('button', { name: 'Registrar protocolo' }).click()
  await expect(page.getByText('Protocolo registrado. O caso agora espera o INSS.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: /· Protocolar no Meu INSS$/ })).toHaveCount(2)
})

test('GGVP-31 · a advogada decide a perícia e a tarefa aparece sozinha para o Jurídico administrativo', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: /· Decidir perícia$/ }).first().click()
  await expect(page.getByRole('button', { name: 'Definir' })).toBeDisabled()
  await page.getByLabel('Sim, o sistema abre a tarefa de perícia').check()
  await page.getByLabel('Perícia médica').check()
  await page.getByRole('button', { name: 'Definir' }).click()
  await expect(page.getByRole('status')).toContainText('abriu a tarefa de perícia')

  await context.clearCookies()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: /· Marcar perícia médica$/ })).toBeVisible()
})

test('GGVP-96 CA11 · o Atendimento não abre a tela de protocolo', async ({ page }) => {
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  await page.goto('/casos/6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6/protocolo')
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
})
