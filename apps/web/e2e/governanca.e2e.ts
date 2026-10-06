import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// Garantia e governança (GGVP-13). Usuários e casos de exemplo do banco local; nenhum é real.

test('GGVP-109 · a ação fora do perfil, chamada direto pela API, é recusada e aparece para a Sênior em "Tentativas bloqueadas"', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  const tarefas = (await (await page.request.get('/api/tarefas')).json()) as { casoId: string | null; cliente: { nome: string } | null }[]
  const doCaso = tarefas.find((t) => t.casoId && t.cliente)!
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  const recusa = await page.request.post(`/api/casos/${doCaso.casoId}/peticao/pedido`, { data: {} })
  expect(recusa.status()).toBe(403)

  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Tentativas bloqueadas' }).click()
  await expect(page.getByRole('heading', { name: 'Tentativas bloqueadas' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tentativas bloqueadas' }).getByRole('listitem').first()).toContainText(
    `Ana (exemplo) (Atendimento) · ${doCaso.cliente!.nome} · Ação fora do perfil (peticao.pedir)`,
  )
})
