import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-133 · a gravação da ligação do Chatwoot sobe numa caixa de enviar arquivo, vai para a pasta do cliente e para a
// transcrição. O Playwright sobe a API sem a chave da OpenAI: a transcrição fica desligada, diz o motivo e o áudio fica.

test('a advogada sobe a gravação da ligação na entrevista; sem a chave do serviço, a tela diz o motivo e oferece "Tentar de novo"', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Ligacao Teste')
  await page.getByLabel('Idade *').fill('62')
  await page.getByLabel('Telefone / WhatsApp *').fill('11944443322')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '16:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await page.getByRole('dialog', { name: 'Chatwoot · conversa com Lia Ligacao Teste' }).getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/O convite foi enviado pelo Chatwoot/)).toBeVisible()
  const entrevista = await page.evaluate(
    () => (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { nome: string; agendamentos: { id: string }[] }[] }).fichas.find((f) => f.nome === 'Lia Ligacao Teste')!.agendamentos[0].id,
  )

  const juridico = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await juridico.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/entrevista/${entrevista}`)
  const caixa = advogada.getByRole('region', { name: 'Áudio gravado fora do portal' })
  await expect(caixa).toContainText('A gravação fica na conversa do cliente, como mensagem privada')
  await caixa.getByLabel('Escolher o áudio').setInputFiles({ name: 'ligacao-chatwoot.ogg', mimeType: 'audio/ogg', buffer: Buffer.from('OggS gravação da ligação') })
  await expect(caixa.getByRole('status')).toContainText('✓ Áudio recebido: ligacao-chatwoot.ogg')

  await caixa.getByRole('link', { name: 'Abrir a entrevista' }).click()
  await expect(advogada.getByText('A transcrição falhou: a transcrição está desligada (falta a chave do serviço).')).toBeVisible()
  await expect(advogada.getByText('O áudio ficou guardado no caso, para sempre: ligacao-chatwoot.ogg.')).toBeVisible()
  await expect(advogada.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
  await juridico.close()
})
