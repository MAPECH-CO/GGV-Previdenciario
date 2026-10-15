import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-86 CA14 (Pedro, 14/10): a tarefa do caso traz os dados do processo no topo, sem ir ao processo e voltar. Só lê a Maria
// (de exemplo), que nenhum teste de tela mexe: o banco do Playwright é um só para todos.
test('a advogada decide a perícia vendo o cliente e os números do caso; o Financeiro não recebe o resumo', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  const tarefas: { casoId: string; cliente: { nome: string } }[] = await (await page.request.get('/api/tarefas')).json()
  const casoId = tarefas.find((t) => t.cliente.nome === 'Maria Souza (exemplo)')!.casoId
  await page.goto(`/casos/${casoId}/pericia/decidir`)
  const bloco = page.getByRole('region', { name: 'Dados do processo' })
  await expect(bloco).toContainText('ClienteMaria Souza (exemplo)')
  await expect(bloco.getByRole('link', { name: 'Abrir o processo' })).toHaveAttribute('href', `/casos/${casoId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Precisa de perícia?' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('decidir-pericia.png'), fullPage: true })

  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  expect((await page.request.get(`/api/casos/${casoId}/resumo`)).status()).toBe(403)
})
