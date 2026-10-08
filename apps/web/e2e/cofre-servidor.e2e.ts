import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-146, parte 1 · a senha do gov.br de um lead do balcão vai ao cofre do servidor. Nada fica no navegador, e outra
// pessoa, em outro computador, vê só a situação e o histórico. A gestão vê o uso, sem o valor.

/** Senhas de teste: não podem aparecer na tela nem no armazenamento do navegador (G9). */
const SENHA_DE_TESTE = 'Teste#Cofre-Servidor-7310'
const SENHA_TROCADA = 'Teste#Cofre-Trocada-2264'
const naoGuardou = (texto: string) => {
  expect(texto).not.toContain(SENHA_DE_TESTE)
  expect(texto).not.toContain(SENHA_TROCADA)
}

test('a Atendimento renova a senha antes da entrevista e depois troca na ficha; só o cofre do servidor guarda', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Cofre Teste')
  await page.getByLabel('Idade *').fill('62')
  await page.getByLabel('Telefone / WhatsApp *').fill('11944443322')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '16:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await page.getByRole('dialog', { name: 'Chatwoot · conversa com Lia Cofre Teste' }).getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/O convite foi enviado pelo Chatwoot/)).toBeVisible()
  const { ficha, entrevista } = await page.evaluate(() => {
    const f = (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { id: string; nome: string; agendamentos: { id: string }[] }[] }).fichas.find(
      (x) => x.nome === 'Lia Cofre Teste',
    )!
    return { ficha: f.id, entrevista: f.agendamentos[0].id }
  })

  await page.goto(`/entrevista/${entrevista}/renovar-senha`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lia Cofre Teste · Renovar senha do gov.br')
  await page.getByRole('radio', { name: 'Sim' }).click()
  await page.getByLabel('Nova senha do gov.br (vai direto ao cofre, G9)').fill(SENHA_DE_TESTE)
  await page.getByRole('checkbox', { name: 'Conferi que o Meu INSS abre e que o CNIS aparece' }).check()
  await page.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(page.getByRole('heading', { name: /✓ senha no cofre · atualizada em .* por Ana \(exemplo\)/ })).toBeVisible()
  naoGuardou(await page.content())
  naoGuardou(await page.evaluate(() => JSON.stringify(sessionStorage) + JSON.stringify(localStorage)))

  // Depois, na ficha de atendimento, a caixa do cofre troca a senha.
  await page.goto(`/clientes/${ficha}/ficha-de-atendimento`)
  const cofre = page.getByRole('form', { name: 'Cofre da senha do gov.br' })
  await cofre.getByLabel('Trocar a senha (vai direto ao cofre)').fill(SENHA_TROCADA)
  await cofre.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(cofre.getByLabel('Trocar a senha (vai direto ao cofre)')).toHaveValue('')
  await expect(cofre).toContainText(/gov.br: senha no cofre · atualizada em .* por Ana \(exemplo\)/)
  naoGuardou(await page.evaluate(() => JSON.stringify(sessionStorage) + JSON.stringify(localStorage)))

  // Outro computador: a advogada abre a ficha e vê a situação e o histórico, nunca a senha.
  const origem = new URL(page.url()).origin
  const juridico = await browser.newContext({ baseURL: origem })
  const advogada = await juridico.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/clientes/${ficha}`)
  await expect(advogada.getByText(/gov.br: senha no cofre · atualizada em .* por Ana \(exemplo\) \(G9\)/)).toBeVisible()
  const historico = advogada.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Renovou a senha do gov.br e guardou no cofre')
  await expect(historico).toContainText('Guardou a senha do gov.br no cofre')
  naoGuardou(await advogada.content())
  naoGuardou(await advogada.evaluate(() => JSON.stringify(sessionStorage)))

  // A gestão vê o uso do cofre por pessoa: as duas entradas da Ana, sem o valor.
  const gestao = await browser.newContext({ baseURL: origem })
  const financeiro = await gestao.newPage()
  await entrarPelaApi(financeiro, 'financeiro@exemplo.ggv')
  await financeiro.goto('/gestao/cofre')
  await expect(financeiro.getByRole('list', { name: 'Uso do cofre por pessoa' })).toContainText(/Ana \(exemplo\) · leituras 0 · cadastros e trocas 2/)
  naoGuardou(await financeiro.content())
  await juridico.close()
  await gestao.close()
})
