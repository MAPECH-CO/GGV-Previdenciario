import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-111 · Terceiro não se passa pelo cliente. Telefone, e-mail e dados bancários só mudam com o cliente verificado
// (chamada de vídeo ou no escritório) e em contrato novo; a conta da Lúcia Exemplo é de mentira, para o repasse da pensão.

const NUNCA_PEDIMOS = 'O escritório nunca pede a sua senha do gov.br por mensagem.'

test('CA1 · mudar o telefone na ficha pede como confirmou que é o cliente e o contrato novo; o antigo e o novo ficam no histórico', async ({ page }) => {
  await page.goto('/clientes/antonio-exemplo')
  const telefone = page.getByLabel('Telefone / WhatsApp *')
  const antes = await telefone.inputValue()
  await telefone.fill('(11) 90000-0044')
  const verificacao = page.getByRole('group', { name: 'Mudou o telefone: como você confirmou que é o cliente?' })
  await expect(verificacao).toContainText('Pedido por telefone ou mensagem, sem a verificação: não mude.')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.')).toBeVisible()
  await verificacao.getByRole('radio', { name: 'Chamada de vídeo com o cliente' }).check()
  await verificacao.getByRole('checkbox', { name: 'A alteração vai em contrato novo' }).check()
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Alterações salvas. Ficaram no histórico.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText(`Mudou o telefone (chamada de vídeo com o cliente; em contrato novo): «${antes}» → «(11) 90000-0044»`)
})

test('CA2 e CA5 · a conta da Lúcia muda com a segunda confirmação de outra pessoa; o contato anterior é avisado; a advogada recebe o alerta', async ({ page }) => {
  // Fluxo longo, de várias telas: o triplo do tempo padrão, para a máquina carregada.
  test.slow()
  await page.goto('/clientes/lucia-exemplo')
  const cartao = page.getByRole('region', { name: 'Dados bancários para o repasse' })
  await expect(cartao).toContainText('Banco Exemplo · agência 0001 · conta 12345-6 · Pix: o telefone cadastrado')
  await cartao.getByRole('button', { name: 'Mudar dados bancários' }).click()
  await cartao.getByLabel('Banco *').fill('Banco Exemplo Dois')
  await cartao.getByLabel('Agência *').fill('0002')
  await cartao.getByLabel('Conta com dígito *').fill('65432-1')
  await expect(cartao.getByRole('button', { name: 'Pedir a mudança' })).toBeDisabled()
  await cartao.getByRole('radio', { name: 'Cliente no escritório' }).check()
  await cartao.getByRole('checkbox', { name: 'A alteração vai em contrato novo' }).check()
  await cartao.getByRole('button', { name: 'Pedir a mudança' }).click()
  await expect(cartao.getByRole('status')).toHaveText('Mudança pedida: espera a segunda confirmação.')
  await cartao.getByRole('button', { name: 'Confirmar a mudança (segunda pessoa)' }).click()
  await expect(cartao.getByRole('alert')).toHaveText('A segunda confirmação é de outra pessoa, não de quem pediu.')

  // A segunda confirmação é de outra pessoa: a Eva, líder do Atendimento, entra pela API.
  await entrarPelaApi(page, 'lider@exemplo.ggv')
  await page.goto('/clientes/lucia-exemplo')
  await cartao.getByRole('button', { name: 'Confirmar a mudança (segunda pessoa)' }).click()
  await expect(cartao.getByRole('status')).toHaveText('Dados bancários mudados. O contato anterior recebeu o aviso pelo Chatwoot.')
  await expect(cartao).toContainText('Banco Exemplo Dois · agência 0002 · conta 65432-1')
  await expect(page.getByRole('list', { name: 'Últimos contatos' })).toContainText('Se não foi você, ligue para o escritório agora.')
  await expect(page.getByRole('list', { name: 'Histórico' })).toContainText(
    '«Banco Exemplo · agência 0001 · conta 12345-6 · Pix: o telefone cadastrado» → «Banco Exemplo Dois · agência 0002 · conta 65432-1»',
  )

  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/advogada')
  await expect(page.getByRole('link', { name: 'Lúcia Exemplo · Dados bancários mudaram' })).toBeVisible()
})

test('CA3 e CA7 · na ligação, o roteiro de segurança; no chat, a próxima tarefa vem com o lembrete da identidade', async ({ page }) => {
  await page.goto('/conversas/conversa-pedro-ligacao')
  const roteiro = page.getByRole('region', { name: 'Roteiro de segurança · quem está falando?' })
  await expect(roteiro).toContainText('Antes de passar dado do caso, confirme que é o cliente')
  await expect(roteiro).toContainText('"Vou retornar pelo contato cadastrado"')

  await page.goto('/')
  await page.getByLabel('✦ Pergunte ou peça').fill('A Maria Exemplo me ligou, qual é a próxima tarefa?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  const conversa = page.getByRole('list', { name: 'Conversa' })
  await expect(conversa).toContainText('A próxima tarefa de Maria (Administrativo · perícia em 02/10) é cobrar o laudo que a perícia pede')
  await expect(conversa).toContainText('Antes de passar dado do caso, confirme que é o cliente')
})

test('CA4 · a mensagem ao cliente termina dizendo que o escritório nunca pede a senha do gov.br', async ({ page }) => {
  await page.goto('/clientes/maria-exemplo')
  await page.getByRole('button', { name: 'Mensagem ao cliente' }).click()
  const janela = page.getByRole('dialog', { name: 'Mensagem ao cliente · Maria Exemplo' })
  await janela.getByLabel('Modelo').selectOption('pericia-orientacao')
  await expect(janela.getByRole('textbox')).toHaveValue(new RegExp(`${NUNCA_PEDIMOS.replace(/\./g, '\\.')}$`))
})
