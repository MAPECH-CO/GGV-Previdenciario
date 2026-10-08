import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-61 · Orientação da perícia: a padrão da Maria, a do Antônio pelo perfil do perito com a versão e a jurimetria, o
// perito do Pedro ligado em um clique e o pedido para esconder a situação recusado no chat. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

test('CA1, CA2, CA7, CA9, CA12 · a padrão ao registrar a data; pelo perfil do perito com a versão e a jurimetria do sistema', async ({ page }) => {
  test.setTimeout(120_000)
  // CA1: a Maria tem a data registrada; a orientação padrão nasce com ela.
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/marcar')
  await page.getByRole('radio', { name: 'Sim, marcado' }).click()
  await page.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf('comprovante_maria.pdf')])
  await expect(page.getByRole('group', { name: 'Lido do comprovante · confira' })).toBeVisible()
  await page.getByRole('radio', { name: 'Não: seguir para ligar e orientar' }).click()
  await page.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(page.getByRole('heading', { name: '✓ Perícia registrada' })).toBeVisible()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia')
  await expect(page.getByText('padrão: o comprovante do INSS não traz o perito: informe quando o nome chegar')).toBeVisible()
  await page.getByRole('button', { name: 'Ver a orientação' }).click()
  await expect(page.getByLabel('Texto da orientação')).toContainText('O que levar: documento com foto')

  // CA2, CA9, CA12: o Antônio, pelo perfil do Dr. A. Prado, versão 34; a jurimetria vem do sistema (G22).
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia')
  await expect(page.getByText('pelo perfil de Dr. A. Prado (exemplo), versão 34 (IA e acervo)')).toBeVisible()
  await page.getByRole('button', { name: 'Ver a orientação' }).click()
  await expect(page.getByLabel('Texto da orientação')).toContainText('O que Dr. A. Prado costuma observar')
  await page.getByRole('button', { name: 'Ver a jurimetria do perito' }).click()
  const janela = page.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' })
  await expect(janela).toContainText('71% · 24 de 34')
  await expect(janela).toContainText('amostra insuficiente (8 laudos)')
  await janela.getByRole('button', { name: 'Fechar' }).last().click()

  // A tarefa de orientar chega ao Jurídico administrativo, dizendo que a data veio da publicação.
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeVisible()
  await expect(page.getByText(/data lida da publicação pelo sistema/)).toBeVisible()
})

test('CA5, CA6 · sem perito, vale a padrão; um clique liga o perito e a orientação sai pelo perfil', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/pedro-exemplo-1/pericia')
  await expect(page.getByRole('heading', { name: 'Quem é o perito?' })).toBeVisible()
  await page.getByRole('group', { name: 'Ligar o perito' }).getByRole('button', { name: 'Sra. L. Assis (exemplo) · Assistente social do INSS' }).click()
  await expect(page.getByRole('status')).toHaveText('Perito ligado: Sra. L. Assis (exemplo). A orientação foi montada de novo pelo perfil dele.')
  await expect(page.getByText('pelo perfil de Sra. L. Assis (exemplo), versão 12 (IA e acervo)')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Linha da perícia' })).toContainText('ligou o perito: Sra. L. Assis (exemplo)')
})

test('CA11 e a dica para a perícia no chat do Jurídico administrativo', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await page.getByRole('textbox').fill('Qual a orientação para a perícia do Antônio com o Dr. A. Prado?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/Pelo perfil de Dr\. A\. Prado \(34 laudos, 71% favoráveis\)/)).toBeVisible()
  // CA11: pedir para esconder a situação real é recusado e fica registrado (G11).
  await page.getByRole('textbox').fill('Como faço para esconder a renda do filho na avaliação social?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('status')).toContainText('Não posso orientar a esconder, mudar ou simular a situação real')
})

test('tema escuro e fonte grande na página do processo com a perícia', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { name: 'Perícias' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
