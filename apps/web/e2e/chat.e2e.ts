import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-82 · Conversar com o portal: o chat abaixo da busca da Central e na aba Suporte das outras telas, sobre o motor único.
// Consulta (o caso e o passo, o valor que o perfil não vê, a jurimetria) e ação (o cartão com Responsável e Trocar, o portão,
// o fora do perfil). Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

async function perguntar(page: import('@playwright/test').Page, texto: string) {
  await page.getByLabel('✦ Pergunte ou peça').fill(texto)
  await page.getByRole('button', { name: 'Enviar' }).click()
}

test('CA1, CA3, CA5, CA7, CA9 · a advogada consulta o caso e cria uma tarefa pelo chat, com o responsável trocado', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/advogada')
  await perguntar(page, 'O que falta no caso do Antônio Exemplo?')
  await expect(page.getByText(/está em Vigília · exigência do juiz/)).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tarefas sugeridas' }).getByRole('link')).toHaveAttribute('href', '/casos/antonio-exemplo-1')

  await perguntar(page, 'Cria uma tarefa para a Documentação cobrar o laudo que falta do Antônio Exemplo até amanhã')
  await page.getByRole('group', { name: 'Escolha' }).getByRole('button', { name: 'Jéssica (exemplo)' }).click()
  const cartao = page.getByRole('group', { name: 'Ação para confirmar · Antônio Exemplo · Cobrar documento' })
  await expect(cartao).toContainText('Responsável: Jéssica (exemplo)')
  await cartao.getByRole('button', { name: 'Trocar' }).click()
  await cartao.getByLabel('Quem fica com a tarefa').selectOption('Ana (exemplo)')
  await cartao.getByRole('button', { name: 'Confirmar e criar a tarefa' }).click()
  await expect(page.getByText(/✓ Feito: tarefa «Antônio Exemplo · Cobrar documento» criada para Ana/)).toBeVisible()

  // A ação aparece no histórico do caso: o nome, a hora e "feito pelo chat" (CA5).
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1')
  await expect(page.getByRole('list', { name: 'Linha · Vigília' })).toContainText('Criou a tarefa «Antônio Exemplo · Cobrar documento» para Ana (exemplo) · feito pelo chat')
})

test('CA2, CA4, CA8 · o Atendimento: o valor que não vê, o portão e a petição fora do perfil', async ({ page }) => {
  await entrarPelaApi(page)
  await page.goto('/')
  await perguntar(page, 'Qual o valor da prestação de contas da Lúcia Exemplo?')
  await expect(page.getByText(/não tem acesso a esse valor/)).toBeVisible()
  await expect(page.locator('main')).not.toContainText('R$')

  await perguntar(page, 'Protocola o pedido da Nair Exemplo no INSS')
  await expect(page.getByText('Portão G2')).toBeVisible()

  await perguntar(page, 'Faz a petição do BPC da Rita Exemplo.')
  const cartao = page.getByRole('group', { name: 'Fora do seu perfil · Rita Exemplo · Pedir petição' })
  await cartao.getByRole('button', { name: 'Criar tarefa para a Dra. Paula' }).click()
  await expect(page.getByText(/criada para Dra\. Paula/)).toBeVisible()
})

test('CA6, CA10 · o Suporte na página do processo responde sobre o caso; a jurimetria vem do sistema', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/pedro-exemplo-1')
  await page.getByRole('button', { name: '✦ Suporte' }).click()
  const suporte = page.getByRole('dialog', { name: 'Suporte interno' })
  await suporte.getByLabel('✦ Pergunte ou peça').fill('O que falta aqui?')
  await suporte.getByRole('button', { name: 'Enviar' }).click()
  await expect(suporte.getByText(/Pedro Exemplo \(loas idoso\) está em INSS/)).toBeVisible()
  await suporte.getByLabel('✦ Pergunte ou peça').fill('Como o Dr. A. Prado avalia?')
  await suporte.getByRole('button', { name: 'Enviar' }).click()
  await expect(suporte.getByText(/laudos favoráveis 71% · 24 de 34 laudos/)).toBeVisible()
})

test('tema escuro e fonte grande no chat da Central', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/advogada?tema=escuro&fonte=grande')
  await perguntar(page, 'Protocola o pedido da Nair Exemplo no INSS')
  await expect(page.getByText('Portão G2')).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})

test('GGVP-142 · o caso do servidor vai ao servidor: a trava do G17 sem modelo e, sem a chave da IA, o motivo com o link do caso', async ({ page }) => {
  await entrarPelaApi(page)
  await page.goto('/')
  await perguntar(page, 'Dá para liberar o José Ramos (exemplo) sem o parecer?')
  await expect(page.getByText(/^Não posso pular o parecer médico/)).toBeVisible()
  await perguntar(page, 'O que falta no caso do José Ramos (exemplo)?')
  await expect(page.getByText('O chat não respondeu: a IA está desligada neste ambiente (falta a chave do serviço).')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tarefas sugeridas' }).getByRole('link', { name: /Abrir o caso/ }).last()).toHaveAttribute('href', /^\/casos\/[0-9a-f-]{36}$/)
})
