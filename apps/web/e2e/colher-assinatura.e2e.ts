import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-72 · Assinatura digital pelo ZapSign. Cada teste abre um navegador novo, então começa da semente: a Nair recebeu o link
// do ZapSign há 9 dias e ainda não assinou. O ZapSign e o Chatwoot são simulados.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

test('GGVP-72 CA2, CA4, CA5, CA11 e CA12 · da Central ao lembrete pelo WhatsApp; a segunda tentativa sobe para a sênior', async ({ page }) => {
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura' })
  const linha = page.getByRole('listitem').filter({ has: tarefa })
  await expect(linha).toContainText(/Aposentadoria por Idade · ZapSign enviado \d\d\/\d\d · tentativa 1 de 2/)
  await expect(linha).toContainText('tentar contato hoje')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nair Exemplo · Colher assinatura')
  await expect(page.getByText('zapsign-exemplo-nair-exemplo-1', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Lembrar pelo WhatsApp' }).click()
  const janela = page.getByRole('dialog', { name: 'Chatwoot · conversa com Nair Exemplo' })
  await expect(janela.getByLabel('Lembrete com o mesmo link do ZapSign (confira antes de enviar)')).toHaveValue(/O link é o mesmo: https:\/\/zapsign\.exemplo\/assinar\/zapsign-exemplo-nair-exemplo-1/)
  await janela.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/Limite de 2 tentativas atingido \(G15\): o caso subiu para a advogada sênior/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tentativas de contato' }).getByRole('listitem')).toHaveCount(2)

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura' })).toHaveCount(0)
  await page.goto('/advogada')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura · limite de tentativas' })).toBeVisible()
})

test('GGVP-72 CA3, CA6 e CA10 · o ZapSign devolve assinado: o arquivo final vai para a pasta do caso e a tarefa sai da Central', async ({ page }) => {
  await page.goto('/contrato/nair-exemplo-1/assinatura')
  await page.getByRole('button', { name: 'Simular o retorno do ZapSign (assinado)' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato assinado pelo ZapSign' })).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Colher assinatura' })).toHaveCount(0)
  await page.goto('/clientes/nair-exemplo')
  await expect(page.getByText(/Contrato assinado - Nair Exemplo - .* \(ZapSign, com evidências\)\.pdf/)).toBeVisible()
})

/**
 * O Antônio fecha a Aposentadoria por Idade. Quem fecha é a definição do benefício na entrevista (outra história): o teste
 * chama o servidor de exemplo pelo navegador e segue pela tela de preparar o contrato.
 */
async function antonioFecha(page: Page): Promise<string> {
  await page.goto('/')
  return page.evaluate(async () => {
    const modulo = '/src/dados/contrato.ts'
    const { fecharContrato } = await import(/* @vite-ignore */ modulo)
    const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    return processo.id as string
  })
}

test('GGVP-77 CA1, CA2 e CA3 · do contrato gerado ao papel na hora: imprimir, digitalizar e só então concluir', async ({ page }) => {
  const id = await antonioFecha(page)
  await page.goto(`/contrato/${id}/preparar`)
  await page.getByRole('radio', { name: 'Não, corrigir campos' }).click()
  await page.getByLabel('RG *').fill('12.345.678-X')
  await page.getByLabel('Endereço *').fill('Rua Exemplo, 1 · São Paulo/SP')
  await page.getByLabel('O que corrigir *').fill('faltavam o RG e o endereço')
  for (const nome of [
    'Campos certos e completos',
    'Datas feitas à mão serão preenchidas na assinatura',
    'Ficha LOAS: cliente ou representante legal (se aplicável)',
    'A página do Código Penal não tem assinatura',
  ]) {
    await page.getByRole('checkbox', { name: nome }).check()
  }
  await page.getByRole('button', { name: 'Gerar contrato' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato gerado · versão 1' })).toBeVisible()
  await page.getByRole('link', { name: 'Colher assinatura' }).click()

  await page.getByRole('region', { name: 'Como o cliente vai assinar?' }).getByRole('radio', { name: 'Em papel na hora' }).click()
  await page.getByRole('button', { name: 'Imprimir o kit' }).click()
  const datas = page.getByRole('list', { name: 'Datas do kit impresso' }).getByRole('listitem')
  await expect(datas.first()).toHaveText(/Contrato de honorários · \d\d\/\d\d\/\d{4}/)
  await expect(datas.nth(1)).toHaveText('Procuração · em branco, à mão na assinatura')
  await expect(page.getByRole('button', { name: 'Concluir a assinatura' })).toBeDisabled()
  await page.getByRole('button', { name: 'Digitalizar o contrato assinado (scanner simulado)' }).click()
  await page.getByRole('button', { name: 'Concluir a assinatura' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato assinado em papel' })).toBeVisible()
  await page.goto('/clientes/antonio-exemplo')
  await expect(page.getByText(/Contrato assinado - Antônio Exemplo - .* \(papel, PDF pesquisável\)\.pdf/)).toBeVisible()
})

test('tema escuro e fonte grande no colher assinatura', async ({ page }) => {
  await page.goto('/contrato/nair-exemplo-1/assinatura?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nair Exemplo · Colher assinatura')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'Assinatura pelo ZapSign' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
