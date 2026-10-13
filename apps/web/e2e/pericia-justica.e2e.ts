import { expect, test } from '@playwright/test'
import { ADVOGADA, entrarPelaApi } from './entrar.ts'
const CASO = '11111111-1111-4111-8111-111111111111'

test('cadastro de peritos lê a API e avisa que a gravação ainda não está disponível', async ({ page }) => {
  await entrarPelaApi(page, ADVOGADA)
  await page.route('**/api/peritos', r => r.fulfill({ json: [{ id: 'perito-inventado-pelo-teste', nome: 'Perito Fictício Teste', especialidade: 'Área Inventada', tipo: 'medica' }] }))
  await page.goto('/peritos')
  await expect(page.getByRole('heading', { name: 'Peritos', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cadastrar perito' })).toBeDisabled()
  await page.getByText('Perito Fictício Teste', { exact: true }).click()
  await expect(page.getByText('Área Inventada · Perícia médica')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Buscar perito por nome ou especialidade' }).fill('não consta')
  await expect(page.getByText('Nenhum perito encontrado.')).toBeVisible()
})

test('item sem documento leva à dilação antes da justificativa e não chama a rota antiga', async ({ page }) => {
  await entrarPelaApi(page, ADVOGADA)
  let encerramentos = 0
  await page.route('**/api/casos/' + CASO + '/manifestacao', r => r.fulfill({ json: {
    casoId: CASO, cliente: 'Pessoa Inventada Teste', prazo: { fim: '2030-10-27', regra: 'Prazo fictício' },
    faltam: ['Documentação'], pendentes: [{ alvo: 'item', id: CASO, setor: 'Documentação', descricao: 'Documento fictício', prazoInterno: null }],
    semProva: [], versoes: [], dilacaoAutorizada: false, protocolo: null, podeAnexar: true,
    podeProtocolar: false, podeAutorizarDilacao: false, podeEncerrarSemProva: true,
  } }))
  await page.route('**/api/casos/' + CASO + '/manifestacao/sem-prova', r => { encerramentos++; return r.fulfill({ status: 500 }) })
  await page.goto('/casos/' + CASO + '/manifestacao')
  await expect(page.getByRole('button', { name: 'Encerrar sem a prova' })).toBeDisabled()
  await page.getByRole('link', { name: 'Preparar pedido de dilação' }).click()
  await expect(page.getByLabel('Peça', { exact: true })).toHaveValue('dilacao')
  expect(encerramentos).toBe(0)
})
