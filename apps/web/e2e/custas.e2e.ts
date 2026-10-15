import { expect, test } from '@playwright/test'
import { entrarPelaApi, trocarDeUsuario } from './entrar.ts'

// GGVP-157 · custas do processo, com os usuários de exemplo do banco: a Sênior lança no card do processo, o Financeiro
// aprova na visão dele e abre o detalhe sem abrir o processo, e o sócio vai da visão ao card na página do processo.

test('a Sênior lança um custo com comprovante, o Financeiro aprova na visão de custas e o sócio chega ao card do processo', async ({ page }) => {
  // O caso da Vera Lúcia do banco de exemplo, pelo painel Financeiro (o Financeiro não abre o processo).
  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  const painel = await (await page.request.get('/api/financeiro')).json()
  const casoId: string = painel.lancamentos.find((l: { cliente: string }) => l.cliente.startsWith('Vera Lúcia')).casoId
  const descricao = `Uber para a perícia ${Date.now()}`

  await trocarDeUsuario(page, 'senior@exemplo.ggv')
  await page.goto(`/casos/${casoId}`)
  const card = page.getByRole('region', { name: 'Custas do processo' })
  await expect(card).toContainText('Só sócios, Financeiro e Sênior')
  await card.getByRole('button', { name: 'Enviar ao Financeiro' }).click()
  await expect(card).toContainText('Anexe o comprovante (foto ou PDF) para enviar.')
  await card.getByLabel('Descrição').fill(descricao)
  await card.getByLabel('Valor (R$)').fill('45,90')
  await card.getByLabel(/Anexar comprovante/).setInputFiles({ name: 'recibo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 comprovante de teste') })
  await card.getByRole('button', { name: 'Enviar ao Financeiro' }).click()
  await expect(card.getByRole('status')).toHaveText('Enviado ao Financeiro. Conta no lucro depois que ele aprovar.')
  await expect(card.getByRole('row', { name: new RegExp(descricao) })).toContainText('Esperando o Financeiro')

  await trocarDeUsuario(page, 'financeiro@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Custas' }).click()
  await expect(page).toHaveURL('/custas')
  const linha = page.getByRole('table', { name: 'Custos para aprovar' }).getByRole('row', { name: new RegExp(descricao) })
  await expect(linha).toContainText('comprovante anexado')
  await linha.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByText('Custo aprovado: passa a contar no lucro.')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Custos para aprovar' }).getByRole('row', { name: new RegExp(descricao) })).toHaveCount(0)

  await page.getByRole('table', { name: /, por processo$/ }).getByRole('link', { name: /^Vera Lúcia/ }).click()
  await expect(page).toHaveURL(`/custas/${casoId}`)
  await expect(page.getByRole('region', { name: 'Custas do processo' }).getByRole('row', { name: new RegExp(descricao) })).toContainText('Aprovado')

  await trocarDeUsuario(page, 'socio@exemplo.ggv')
  await page.goto('/custas')
  await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0)
  await page.getByRole('table', { name: /, por processo$/ }).getByRole('link', { name: /^Vera Lúcia/ }).click()
  await expect(page).toHaveURL(`/casos/${casoId}#custas`)
  await expect(page.getByRole('region', { name: 'Custas do processo' })).toContainText(descricao)
})

test('a advogada não vê o card de custas e o servidor recusa as rotas de custas', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  expect((await page.request.get('/api/custas')).status()).toBe(403)
  await page.goto('/custas')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sem permissão')
})
