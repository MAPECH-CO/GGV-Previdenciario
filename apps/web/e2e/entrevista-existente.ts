import { expect, type Page } from '@playwright/test'
import { proximosDiasUteis } from '../src/regras/agenda.ts'
import { hojeIso } from '../src/regras/datas.ts'

/** Prepara uma entrevista já existente para testar os passos posteriores. A tela não oferece
 * a equipe fixa do servidor: a rota de listar advogadas ainda depende do Mateus. */
export async function prepararEntrevistaExistente(page: Page, hora: string, dia = 0) {
  await expect(page.getByText('A lista de advogadas ainda não está disponível no servidor.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Marcar/ }).first()).toBeDisabled()
  const fichaId = new URL(page.url()).pathname.split('/').at(-1)!
  const resposta = await page.request.post('/api/fichas/' + fichaId + '/agendamentos', {
    data: { tipo: 'video', data: proximosDiasUteis(hojeIso(new Date()))[dia], hora, duracao: 45,
      com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: true },
  })
  expect(resposta.ok()).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Marcar a entrevista')
}
