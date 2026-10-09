import { expect, test, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-111 · Terceiro não se passa pelo cliente, no servidor (GGVP-138): telefone, e-mail e dados bancários só mudam com o
// cliente verificado (chamada de vídeo ou no escritório) e em contrato novo. Cada teste cadastra o seu lead no banco; a
// conta bancária é de mentira.

const NUNCA_PEDIMOS = 'O escritório nunca pede a sua senha do gov.br por mensagem.'

/** O lead do balcão, no banco, pela API, com a sessão da Ana; a tela abre na ficha dele. Devolve o endereço. */
async function fichaDoLead(page: Page, nome: string, telefone: string) {
  await page.goto('/')
  const r = await page.request.post('/api/fichas', { data: { nome, idade: 66, pretende: 'Quer saber do BPC do idoso.', telefone, beneficioInteresse: 'loas-idoso', outraPessoa: false } })
  expect(r.ok()).toBe(true)
  const ficha = `/clientes/${(await r.json()).id}`
  await page.goto(ficha)
  return ficha
}

// O cliente com contrato precisa da verificação (testes da tela e do servidor); o lead, ainda sem contrato, troca livre
// (Pedro, 08/10). O banco de teste não tem cliente com telefone para o navegador.
test('CA1 · o lead, ainda sem contrato, muda o telefone sem a verificação, e a mudança fica no histórico', async ({ page }) => {
  await fichaDoLead(page, 'Rosa Telefone Teste', '11922221111')
  await page.getByLabel('Telefone / WhatsApp *').fill('(11) 90000-0044')
  await expect(page.getByRole('group', { name: 'Mudou o telefone: como você confirmou que é o cliente?' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas. Ficaram no histórico.')).toBeVisible()
})

test('CA5 · a conta muda só com a segunda confirmação de outra pessoa, a Eva, em outro computador; o contato anterior é avisado', async ({ page, browser }) => {
  test.slow()
  const ficha = await fichaDoLead(page, 'Rosa Conta Teste', '11922220000')
  const cartao = page.getByRole('region', { name: 'Dados bancários para o repasse' })
  await cartao.getByRole('button', { name: 'Mudar dados bancários' }).click()
  await cartao.getByLabel('Banco *').fill('Banco Exemplo Dois')
  await cartao.getByLabel('Agência *').fill('0002')
  await cartao.getByLabel('Conta com dígito *').fill('65432-1')
  await expect(cartao.getByRole('button', { name: 'Pedir a mudança' })).toBeDisabled()
  await cartao.getByRole('radio', { name: 'Cliente no escritório' }).check()
  await cartao.getByRole('checkbox', { name: 'A alteração vai em contrato novo' }).check()
  await cartao.getByRole('button', { name: 'Pedir a mudança' }).click()
  await expect(cartao.getByRole('status')).toHaveText('Mudança pedida: espera a segunda confirmação.')

  // A segunda confirmação é de outra pessoa: a Eva, líder do Atendimento, no computador dela.
  const contexto = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const eva = await contexto.newPage()
  await entrarPelaApi(eva, 'lider@exemplo.ggv')
  await eva.goto(ficha)
  const doCartao = eva.getByRole('region', { name: 'Dados bancários para o repasse' })
  await doCartao.getByRole('button', { name: 'Confirmar a mudança (segunda pessoa)' }).click()
  await expect(doCartao.getByRole('status')).toHaveText('Dados bancários mudados. O contato anterior recebeu o aviso pelo Chatwoot.')
  await expect(doCartao).toContainText('Banco Exemplo Dois · agência 0002 · conta 65432-1')
  await expect(eva.getByRole('list', { name: 'Últimos contatos' })).toContainText('Se não foi você, ligue para o escritório agora.')
  await expect(eva.getByRole('list', { name: 'Histórico' })).toContainText('«—» → «Banco Exemplo Dois · agência 0002 · conta 65432-1»')
  await contexto.close()
})

test('CA3 e CA7 · na ligação, o roteiro de segurança; no chat, a próxima tarefa vem com o lembrete da identidade', async ({ page }) => {
  const ficha = await fichaDoLead(page, 'Rosa Roteiro Teste', '11922229999')
  const r = await page.request.post('/api/conversas', { data: { fichaId: ficha.split('/').at(-1), canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' } })
  await page.goto(`/conversas/${(await r.json()).conversa.id}`)
  const roteiro = page.getByRole('region', { name: 'Roteiro de segurança · quem está falando?' })
  await expect(roteiro).toContainText('Antes de passar dado do caso, confirme que é o cliente')
  await expect(roteiro).toContainText('"Vou retornar pelo contato cadastrado"')

  await page.goto('/')
  await page.getByLabel('✦ Pergunte ou peça').fill('A Maria Exemplo me ligou, qual é a próxima tarefa?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  const conversa = page.getByRole('list', { name: 'Conversa' })
  await expect(conversa).toContainText(/Maria está em perícia \(.+\): a próxima tarefa é do Jurídico administrativo/)
  await expect(conversa).toContainText('Antes de passar dado do caso, confirme que é o cliente')
})

test('CA4 · a mensagem ao cliente termina dizendo que o escritório nunca pede a senha do gov.br', async ({ page }) => {
  await fichaDoLead(page, 'Rosa Senha Teste', '11922228888')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Rosa Senha Teste' })
  await janela.getByLabel('Modelo').selectOption('boas-vindas')
  await expect(janela.getByRole('textbox')).toHaveValue(new RegExp(`${NUNCA_PEDIMOS.replace(/\./g, '\\.')}$`))
})
