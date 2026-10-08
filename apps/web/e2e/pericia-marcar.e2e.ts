import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-53 · Marcar a perícia com o cliente: o Igor (Jurídico administrativo) tenta, marca no Meu INSS, sobe o comprovante,
// confere a leitura e decide o documento novo; a perícia vai para a agenda e a ficha. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })
const hoje = () => new Date().toLocaleDateString('pt-BR')

/** Na tela do passo: "Sim, marcado", o comprovante, a decisão do documento novo e "Registrar a perícia". */
async function registrar(page: Page, arquivo: string, documentoNovo: 'Sim: atribuir à Documentação' | 'Não: seguir para ligar e orientar') {
  await page.getByRole('radio', { name: 'Sim, marcado' }).click()
  await page.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf(arquivo)])
  await expect(page.getByRole('group', { name: 'Lido do comprovante · confira' })).toBeVisible()
  await page.getByRole('radio', { name: documentoNovo }).click()
  await page.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(page.getByRole('heading', { name: '✓ Perícia registrada' })).toBeVisible()
}

test('CA1 a CA4 · a tentativa, o comprovante lido e conferido, a Documentação, a agenda e a ficha', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await page.getByRole('link', { name: 'Maria Exemplo · Marcar perícia' }).click()
  await expect(page).toHaveURL('/casos/maria-exemplo-1/pericia/marcar')
  await expect(page.getByText('A marcação é pelo Meu INSS, com a senha do cofre (G9): nenhum campo de senha aqui. A IA não escolhe nem sugere o perito.')).toBeVisible()

  // CA1: não deu; a tentativa pede o dia e o que aconteceu.
  await page.getByRole('radio', { name: 'Não, tentar de novo' }).click()
  await expect(page.getByRole('button', { name: 'Registrar a tentativa' })).toBeDisabled()
  await page.getByLabel(/Dia da tentativa/).fill(hoje())
  await page.getByLabel(/O que aconteceu/).fill('Meu INSS sem vaga na agência próxima')
  await page.getByRole('button', { name: 'Registrar a tentativa' }).click()
  await expect(page.getByRole('status')).toHaveText('Tentativa registrada: a tarefa continua com você e volta amanhã.')
  await expect(page.getByRole('list', { name: 'Tentativas de marcar' })).toContainText('Meu INSS sem vaga na agência próxima')

  // CA2, CA3, CA4: deu certo; o comprovante é lido sem o perito e a pessoa confere antes de registrar.
  await page.getByRole('radio', { name: 'Sim, marcado' }).click()
  await page.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf('comprovante_maria.pdf')])
  const lido = page.getByRole('group', { name: 'Lido do comprovante · confira' })
  await expect(lido).toContainText('perito não consta no comprovante')
  await expect(lido.getByLabel('Local')).toHaveValue('Agência INSS Santo Amaro (exemplo)')
  await expect(page.getByRole('button', { name: 'Registrar a perícia' })).toBeDisabled()
  await page.getByRole('radio', { name: 'Sim: atribuir à Documentação' }).click()
  await page.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(page.getByRole('heading', { name: '✓ Perícia registrada' })).toBeVisible()
  await expect(page.getByText(/A perícia pede documento novo: a Documentação reúne até/)).toBeVisible()
  await expect(page.getByText(/Lembrete da véspera: .*, pelo Chatwoot, revisado pelo Jurídico/)).toBeVisible()

  // A ficha mostra a data; a página do processo, o comprovante lido pelo sistema.
  await page.goto('/clientes/maria-exemplo')
  await expect(page.getByRole('link', { name: /Em perícia · pedido ao INSS \(D2\) · perícia médica em/ })).toBeVisible()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia')
  await expect(page.getByText('comprovante lido pelo sistema')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Linha da perícia' })).toContainText('a perícia pede documento novo: atribuiu à Documentação (DP.03)')
})

test('CA5 · o comprovante pelo chat: a IA lê e identifica; nada acontece antes de confirmar', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await page.getByLabel('+ Anexar arquivo').setInputFiles([pdf('comprovante_pericia_maria.pdf')])
  await page.getByRole('textbox').fill('Esse aqui é o comprovante da perícia da Maria Exemplo. Marcar.')
  await page.getByRole('button', { name: 'Enviar' }).click()
  const card = page.getByRole('group', { name: 'Ação para confirmar · Marcar a perícia · Maria Exemplo' })
  await expect(card).toContainText('1 Subir comprovante_pericia_maria.pdf na pasta do cliente')
  await expect(card.getByRole('button', { name: 'Confirmar e marcar' })).toBeDisabled()
  await card.getByRole('radio', { name: 'Não' }).click()
  await card.getByRole('button', { name: 'Confirmar e marcar' }).click()
  await expect(page.getByText(/✓ Feito: a perícia de Maria Exemplo está na agenda e na ficha/)).toBeVisible()
  await page.getByRole('link', { name: 'Abrir a perícia' }).click()
  await expect(page.getByText('comprovante lido pelo sistema')).toBeVisible()
})

test('CA6, CA8, CA9 · sem comprovante, a troca de data e o limite de remarcações que sobe para a advogada', async ({ page }) => {
  // Fluxo longo (três remarcações): nesta máquina passa dos 30 s padrão.
  test.setTimeout(180_000)
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/marcar')
  // CA6: marcada no portal, sem o comprovante: a tarefa espera, com lembrete diário.
  await page.getByRole('radio', { name: 'Marcado, sem comprovante ainda' }).click()
  await page.getByRole('radio', { name: 'Não: seguir para ligar e orientar' }).click()
  await page.getByRole('button', { name: 'Esperar o comprovante' }).click()
  await expect(page.getByRole('status')).toHaveText('A tarefa espera o comprovante, com lembrete diário.')
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await page.getByRole('link', { name: 'Maria Exemplo · Subir o comprovante do INSS' }).click()

  // O comprovante sai: registra e remarca três vezes; na terceira, passa do limite (G15).
  async function remarcar(motivo: string) {
    await page.getByRole('button', { name: 'Remarcar a perícia' }).click()
    await page.getByLabel(/Motivo da remarcação/).fill(motivo)
    await page.getByRole('button', { name: 'Registrar a remarcação' }).click()
  }
  await registrar(page, 'comprovante 1.pdf', 'Não: seguir para ligar e orientar')
  await remarcar('cliente doente')
  await expect(page.getByRole('status')).toHaveText('Remarcação registrada: a tarefa de marcar volta para você.')
  // CA8: o comprovante novo troca a data e reprograma o lembrete.
  await registrar(page, 'comprovante 2.pdf', 'Não: seguir para ligar e orientar')
  await expect(page.getByRole('list', { name: 'Datas anteriores' })).toBeVisible()
  await remarcar('agência fechada')
  await registrar(page, 'comprovante 3.pdf', 'Não: seguir para ligar e orientar')
  await remarcar('cliente viajou')
  await expect(page.getByText(/Passou do limite de 2 remarcações: a advogada responsável decide/)).toBeVisible()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia')
  await expect(page.getByRole('list', { name: 'Linha da perícia' })).toContainText('lembrete reprogramado')

  // CA9: a tarefa sobe para a advogada responsável, que autoriza mais uma com justificativa.
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/advogada')
  await page.getByRole('link', { name: 'Maria Exemplo · Decidir a perícia' }).click()
  await page.getByLabel(/Justificativa/).fill('Cliente internada; o médico dá alta na semana que vem.')
  await page.getByRole('button', { name: 'Autorizar mais uma remarcação' }).click()
  await expect(page.getByRole('status')).toHaveText('Remarcação autorizada: a tarefa de marcar volta para o Jurídico administrativo.')
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('link', { name: 'Maria Exemplo · Remarcar perícia' })).toBeVisible()
})

test('tema escuro e fonte grande na tela de marcar a perícia', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/marcar?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maria Exemplo · Marcar perícia')
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
