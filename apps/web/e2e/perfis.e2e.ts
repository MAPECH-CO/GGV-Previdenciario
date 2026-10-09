import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-96 · Perfis e permissões, com a API de verdade e os usuários de exemplo.

test('CA10 · "Entrar como…" mostra só os perfis da pessoa e troca de Central', async ({ page }) => {
  await entrarPelaApi(page, 'lider@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('button', { name: 'Atendimento · líder' }).click()
  await expect(page.getByRole('menuitemradio')).toHaveText(['Atendimento · líder', 'Atendimento'])
  await page.getByRole('menuitemradio', { name: 'Atendimento', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Atendimento', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
})

test('CA10 · o servidor recusa trocar para um perfil que não é da pessoa', async ({ page }) => {
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  const r = await page.request.post('/api/sessao/perfil', { data: { perfil: 'senior' } })
  expect(r.status()).toBe(403)
  expect(await r.json()).toEqual({ erro: 'Esse perfil não é seu.' })
})

test('cada perfil cai na sua Central: a da Sênior ainda não foi construída', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Central · Sênior' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sênior' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL('/entrar')
  // GGVP-117: sair limpa a cópia do navegador.
  expect(await page.evaluate(() => sessionStorage.getItem('ggv.exemplo.v5'))).toBeNull()
})

test('GGVP-96 · o Financeiro vê só os Resultados da Gestão; o Sócio acha o cliente pela busca e lê a ficha', async ({ page }) => {
  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  await page.goto('/')
  const topo = page.getByRole('navigation', { name: 'Principal' })
  await expect(topo.getByRole('link', { name: /Resultados/ })).toBeVisible()
  await expect(topo.getByRole('link', { name: /Prazos/ })).toHaveCount(0)
  await page.goto('/gestao/prazos')
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible()
  expect((await page.request.get('/api/gestao/prazos')).status()).toBe(403)

  await entrarPelaApi(page, 'socio@exemplo.ggv')
  await page.goto('/')
  const busca = page.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })
  await busca.fill('Rita')
  await busca.press('Enter')
  await page.getByRole('region', { name: 'Resultado da busca' }).getByRole('link', { name: 'Rita Exemplo' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Rita Exemplo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dados bancários para o repasse' })).toHaveCount(0)
})

test('GGVP-96 · a Documentação não abre o contrato; o Jurídico administrativo não abre a entrevista', async ({ page }) => {
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/contrato/cleide-exemplo-1/preparar')
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/entrevista/josefa-entrevista')
  await expect(page.getByRole('heading', { level: 1, name: 'Sem permissão' })).toBeVisible()
})
