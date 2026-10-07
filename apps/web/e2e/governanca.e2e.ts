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

test('GGVP-94 · a cobrança passou do limite: a Sênior vê o laço, devolve à Documentação com o que fazer, e a Documentação vê a decisão e o próximo lembrete', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Wagner Costa (exemplo) · Cobrança sem retorno: exigência do INSS' }).click()
  const laco = page.getByLabel('Cobrança sem retorno')
  await expect(laco.getByRole('listitem')).toHaveCount(3)
  await expect(laco.getByRole('button', { name: 'Devolver ao setor' })).toBeDisabled()
  await laco.getByLabel('O que o setor deve fazer').fill('Ligar para a filha e pedir o CadÚnico por foto')
  await laco.getByRole('button', { name: 'Devolver ao setor' }).click()
  await expect(page.getByRole('status')).toContainText('Decisão registrada. A tarefa voltou ao setor, com o próximo lembrete em')

  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Wagner Costa (exemplo) · Cumprir exigência do INSS' }).click()
  await expect(page.getByRole('list', { name: 'Cobranças' })).toContainText('Decisão da Sênior · Ligar para a filha e pedir o CadÚnico por foto · Helena (exemplo)')
  await expect(page.getByText(/Próximo lembrete em/)).toContainText('para Documentação · pela Central de tarefas · “Cumprir exigência do INSS”')
})
