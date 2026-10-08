import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-146, parte 2 · a Sênior importa a planilha do escritório: simula, confere o relatório e grava. O cliente
// importado aparece no balcão da Atendimento. Planilha inventada: nenhum dado real.

const PLANILHA = [
  'Nome;CPF;Nascimento;Telefone;Benefício;Fase;NB;CNJ',
  'Lia Importada Teste;246.813.579-28;10/04/1957;11933332211;BPC/LOAS Idoso;;;',
  'Lia Importada Teste;24681357928;;;Pensão por Morte;judicial;;0005678-57.2026.4.03.0002',
  'Rui Importado Teste;13579246828;;;;;;',
  'R0bson;111;;;;;;',
].join('\r\n')

test('a Sênior simula, confere e grava a planilha; o cliente importado aparece no balcão, sem duplicar', async ({ page, browser }) => {
  // A Atendimento não importa.
  await page.goto('/gestao/importar')
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()

  const gestao = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const senior = await gestao.newPage()
  await entrarPelaApi(senior, 'senior@exemplo.ggv')
  await senior.goto('/')
  await senior.getByRole('link', { name: /Importar planilha/ }).click()
  await expect(senior.getByRole('heading', { level: 1 })).toHaveText('Importar a planilha do escritório')
  const escolher = () => senior.getByLabel('Planilha (CSV)').setInputFiles({ name: 'clientes.csv', mimeType: 'text/csv', buffer: Buffer.from(PLANILHA) })
  await escolher()
  await senior.getByRole('button', { name: 'Simular a importação' }).click()

  const relatorio = senior.getByRole('region', { name: 'Relatório da simulação · clientes.csv' })
  await expect(relatorio).toContainText('Clientes: 2 novos · 0 já cadastrados')
  await expect(relatorio).toContainText('Processos: 2 novos · 0 já cadastrados')
  await expect(relatorio.getByRole('list', { name: 'Linhas com erro' })).toHaveText('Linha 5: nome inválido; CPF inválido.')
  await expect(relatorio.getByRole('list', { name: 'O que cada linha vira' })).toContainText('Linha 3 · Lia Importada Teste · cliente novo · processo novo: Pensão por Morte, judicial')
  const gravar = relatorio.getByRole('button', { name: 'Gravar no portal' })
  await expect(gravar).toBeDisabled()
  await relatorio.getByRole('checkbox', { name: /Conferi o relatório/ }).check()
  await gravar.click()
  await expect(senior.getByRole('status')).toHaveText('✓ Gravados: 2 clientes novos e 2 processos novos. A linha com erro ficou de fora.')

  // A mesma planilha de novo: nada novo, nada a gravar.
  await escolher()
  await senior.getByRole('button', { name: 'Simular a importação' }).click()
  await expect(relatorio).toContainText('Clientes: 0 novos · 2 já cadastrados')
  await expect(relatorio).toContainText('Nada a gravar: nenhum cliente ou processo novo.')
  await gestao.close()

  // No balcão da Atendimento, a cliente importada aparece uma vez.
  await page.goto('/balcao')
  await page.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('246.813.579-28')
  await expect(page.getByRole('list', { name: 'Pessoas encontradas' }).getByRole('button', { name: /Lia Importada Teste/ })).toHaveCount(1)
})
