import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// GGVP-85 · Verificar o contrato assinado. A leitura pela IA é da GGVP-81 (grupo documentos): aqui o botão "Simular a leitura
// da IA" faz o papel dela. Cada teste abre um navegador novo, então começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

/**
 * O Antônio fecha a Aposentadoria por Idade, o contrato é gerado e ele assina em papel; a IA aponta a página cortada. O
 * fechamento é de outra história: o teste chama o servidor de exemplo pelo navegador.
 */
async function antonioParaConferir(page: Page): Promise<string> {
  await page.goto('/')
  return page.evaluate(async () => {
    const modulo = '/src/dados/contrato.ts'
    const c = await import(/* @vite-ignore */ modulo)
    const { processo } = await c.fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    const todas = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
    await c.gerarContrato(processo.id, { aprovados: false, oQueCorrigir: 'faltavam o RG e o endereço', conferencias: todas, correcoes: { rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' } })
    await c.imprimirKit(processo.id)
    await c.digitalizarContratoAssinado(processo.id)
    await c.concluirAssinaturaEmPapel(processo.id)
    await c.simularLeituraDoContrato(processo.id)
    return processo.id as string
  })
}

test('GGVP-85 CA1 e CA7 · a IA reconhece o contrato da Nair: nenhuma tarefa de conferir, segue para a cópia', async ({ page }) => {
  await page.goto('/contrato/nair-exemplo-1/assinatura')
  await page.getByRole('button', { name: 'Simular o retorno do ZapSign (assinado)' }).click()
  await page.getByRole('button', { name: 'Simular a leitura da IA (D1.18)' }).click()
  await expect(page.getByText('A IA leu o contrato assinado e reconheceu: tudo certo. Segue para a cópia do contrato.')).toBeVisible()
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Nair Exemplo · Conferir contrato' })).toHaveCount(0)
})

test('GGVP-85 CA2 a CA6 · a IA aponta a página cortada: conferir, corrigir com o motivo e voltar ao preparo', async ({ page }) => {
  const id = await antonioParaConferir(page)
  await page.goto('/')
  const tarefa = page.getByRole('link', { name: 'Antônio Exemplo · Conferir contrato' })
  await expect(page.getByRole('listitem').filter({ has: tarefa })).toContainText('Aposentadoria por Idade · a IA apontou 1 pendência')
  await tarefa.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Antônio Exemplo · Conferir contrato')
  const ia = page.getByRole('region', { name: 'A IA sugere · você confere' })
  await expect(ia).toContainText('A IA apontou 1 pendência: a página da assinatura veio cortada.')
  await expect(ia).toContainText('reconhecida (nome e CPF conferem)')
  await expect(ia).toContainText('falta pág. 4 (rubrica)')
  await expect(page.getByRole('button', { name: 'Está certo — seguir' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Não, corrigir e reenviar' }).click()
  await page.getByLabel('O que corrigir *').fill('pedir a pág. 4 rubricada')
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await expect(page.getByRole('heading', { name: '✓ Volta para corrigir e reenviar' })).toBeVisible()
  await page.getByRole('link', { name: 'Preparar contrato' }).click()
  await expect(page).toHaveURL(new RegExp(`/contrato/${id}/preparar$`))
  await expect(page.getByText(/Voltou da conferência para corrigir: pedir a pág\. 4 rubricada\. A versão 1 assinada ficou/)).toBeVisible()
})

test('tema escuro e fonte grande no conferir contrato', async ({ page }) => {
  const id = await antonioParaConferir(page)
  await page.goto(`/contrato/${id}/conferir?tema=escuro&fonte=grande`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Antônio Exemplo · Conferir contrato')
  const corpo = page.locator('body')
  await expect(corpo).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(corpo).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
  await expect(page.getByRole('region', { name: 'A IA sugere · você confere' })).toHaveCSS('background-color', rgb(tokens.cores.superficie.escuro))
})
