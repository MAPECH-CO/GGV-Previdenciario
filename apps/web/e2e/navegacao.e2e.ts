import { expect, test, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-135 · Toda tela alcançável por clique, por perfil: cada teste entra com o login de exemplo, começa na tela inicial e
// chega à tela por clique, sem digitar o endereço (P11 a P14 do roteiro do teste de 09/10).

/** A busca da tela inicial: escreve e aperta Enter. */
async function buscar(page: Page, termo: string) {
  const campo = page.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })
  await campo.fill(termo)
  await campo.press('Enter')
  return page.getByRole('region', { name: 'Resultado da busca' })
}

test('P12 · a Sênior acha a Rita pela busca e pede a dispensa do parecer pela ficha', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  const resultado = await buscar(page, 'Rita')
  await resultado.getByRole('link', { name: 'Rita Exemplo' }).click()
  await page.getByRole('link', { name: 'Dispensar o parecer' }).click()
  await expect(page).toHaveURL('/casos/rita-exemplo-1/parecer/dispensa')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rita Exemplo · Dispensar o parecer médico')
})

test('P13 · a Sênior abre os roteiros de laudos pelo topo e o histórico de um caso do servidor pela ficha', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: /Roteiros de laudos/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Roteiros de laudos')

  await page.goto('/')
  const resultado = await buscar(page, 'Ulisses')
  await resultado.getByRole('link', { name: 'Ulisses Rocha (exemplo)' }).click()
  await page.getByRole('link', { name: 'Histórico do processo' }).click()
  await expect(page).toHaveURL(/\/casos\/[0-9a-f-]{36}\/historico$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Histórico do processo')
})

test('P13 · a advogada acha a Cleide pela busca e abre a linha do tempo da deficiência pela ficha', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  const resultado = await buscar(page, 'Cleide')
  await resultado.getByRole('link', { name: 'Cleide Exemplo' }).click()
  await page.getByRole('link', { name: 'Linha do tempo da deficiência' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cleide Exemplo · Linha do tempo da deficiência')
})

test('P14 · o líder do Atendimento chega aos prazos pela Gestão no topo', async ({ page }) => {
  await entrarPelaApi(page, 'lider@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: /Prazos/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prazos cumpridos e perdidos')
})

test('P11 · o Financeiro tem a busca e o chat; a busca dele não acha cliente, que ele não vê', async ({ page }) => {
  await entrarPelaApi(page, 'financeiro@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByLabel('✦ Pergunte ou peça')).toBeVisible()
  const resultado = await buscar(page, 'Marta')
  await expect(resultado).toContainText('A busca de clientes e processos é de quem vê o caso: aqui, só as suas tarefas.')
  await expect(resultado.getByRole('list', { name: 'Clientes encontrados' })).toHaveCount(0)
})
