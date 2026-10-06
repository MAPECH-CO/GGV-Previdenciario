import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-9 · Judicialização e vigília, grupo 1, com a API de verdade e a fonte de exemplo. O relógio da vigília também
// roda no servidor de teste: dependendo da hora, ele já pode ter trazido as publicações; por isso, aqui não se conta.
test.describe.configure({ mode: 'serial' })

test('GGVP-30 e GGVP-26 · a Sênior vê o alarme, reprocessa a rodada e trata a fila de revisão', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Vigília das publicações · Reprocessar vigília' }).first().click()
  await expect(page.getByRole('heading', { name: 'Vigília das publicações' })).toBeVisible()
  await expect(page.getByLabel('Situação do dia')).toContainText('Vigília incompleta')
  await expect(page.getByText(/Vigília falhou às \d\d:\d\d: tempo esgotado/)).toBeVisible()
  await page.getByRole('button', { name: 'Reprocessar' }).first().click()
  await expect(page.getByRole('status')).toContainText('Reprocessada')
  await expect(page.getByText(/reprocessada por Helena \(exemplo\)/)).toBeVisible()

  const fila = page.getByLabel('Fila de revisão')
  const semNumero = fila.getByRole('listitem').filter({ hasText: 'sem número do processo' })
  await semNumero.getByLabel('Número CNJ do processo').fill('0005678-75.2026.4.03.6301')
  await semNumero.getByRole('button', { name: 'Vincular ao processo' }).click()
  await expect(page.getByRole('status')).toHaveText('Publicação vinculada. A advogada recebeu para ler.')
  const deOutro = fila.getByRole('listitem').filter({ hasText: 'processo que não é do escritório' })
  await deOutro.getByRole('button', { name: 'Não é do escritório' }).click()
  await expect(page.getByRole('status')).toHaveText('Registrado: não é do escritório.')
  await expect(fila).toContainText('Nada na fila.')
  await expect(page.getByLabel('Descartes')).toContainText('repetida')
})

test('GGVP-74, GGVP-34 e GGVP-37 · a advogada lê a exigência, o prazo é contado e a tarefa nasce; reclassifica um andamento', async ({ page }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Otávio Lima (exemplo) · Ler publicação' }).click()
  await expect(page.getByRole('heading', { name: 'Publicações do processo' })).toBeVisible()
  await page.getByRole('listitem').filter({ hasText: 'Intime-se a parte autora' }).getByRole('link', { name: 'Ler' }).click()

  await page.getByLabel('Intimação ou exigência').check()
  await page.getByRole('button', { name: 'Classificar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"')
  await page.getByLabel('Prazo da publicação (dias)').fill('15')
  await page.getByRole('button', { name: 'Classificar' }).click()
  await expect(page.getByRole('status')).toContainText('Analisar exigência do juiz')
  await expect(page.getByText(/Prazo: de \d\d\/\d\d\/\d{4} até/)).toBeVisible()
  await expect(page.getByText(/pelo lado seguro \(G12\)/)).toBeVisible()

  await page.getByRole('link', { name: '← Publicações do processo' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Autos conclusos' }).getByRole('link', { name: 'Ler' }).click()
  await page.getByLabel('Só andamento').check()
  await page.getByRole('button', { name: 'Classificar' }).click()
  await expect(page.getByRole('status')).toContainText('sem tarefa')

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Otávio Lima (exemplo) · Analisar exigência do juiz' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Otávio Lima (exemplo) · Ler publicação' })).toHaveCount(0)
})

// Grupo 2: exigência do juiz (Paulo Reis, de exemplo, já lida e classificada).
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const PDF = (nome: string) => ({ name: nome, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 exemplo') })

test('GGVP-79, GGVP-83 e GGVP-87 · a advogada distribui; Documentação e Atendimento sobem a prova; a advogada aprova e protocola', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Paulo Reis (exemplo) · Analisar exigência do juiz' }).click()
  await expect(page.getByText(/juntar laudo médico atualizado/)).toBeVisible()
  await page.getByLabel('Precisa cumprir').check()
  await page.getByLabel('Setor').selectOption('documentacao')
  await page.getByLabel('O que cumprir').fill('Trazer laudo médico atualizado')
  await page.getByLabel('Prazo interno').fill(emDias(5))
  await page.getByRole('button', { name: 'Incluir item' }).click()
  await page.getByLabel('Setor').nth(1).selectOption('atendimento')
  await page.getByLabel('O que cumprir').nth(1).fill('Pedir a carteira de trabalho ao cliente')
  await page.getByLabel('Prazo interno').nth(1).fill(emDias(5))
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByRole('status')).toContainText('Cumprir exigência do juiz')
  await expect(page.getByText('Falta: Atendimento, Documentação.')).toBeVisible()

  for (const [email, nome] of [
    ['documentacao@exemplo.ggv', 'laudo.pdf'],
    ['atendimento@exemplo.ggv', 'ctps.pdf'],
  ] as const) {
    await context.clearCookies()
    await entrarPelaApi(page, email)
    await page.goto('/')
    await page.getByRole('link', { name: 'Paulo Reis (exemplo) · Cumprir exigência do juiz' }).click()
    await expect(page.getByText(/prazo do processo/)).toBeVisible()
    await page.getByLabel('Documento', { exact: true }).setInputFiles(PDF(nome))
    await page.getByRole('button', { name: 'Enviar documento e concluir' }).click()
    await expect(page.getByRole('status')).toHaveText('Documento enviado. O item está cumprido.')
  }

  await context.clearCookies()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Paulo Reis (exemplo) · Manifestar no processo' }).click()
  await expect(page.getByText('Todos os setores subiram a prova. Pode manifestar.')).toBeVisible()
  await page.getByLabel('Arquivo da versão').setInputFiles(PDF('manifestacao.pdf'))
  await page.getByRole('button', { name: 'Anexar versão' }).click()
  await expect(page.getByRole('status')).toContainText('Versão 1 anexada')
  await expect(page.getByRole('button', { name: 'Manifestar e protocolar' })).toBeDisabled()
  await page.getByLabel('Aprovei a versão da manifestação (G6)').check()
  await page.getByRole('button', { name: 'Aprovar a versão 1' }).click()
  await page.getByLabel('Comprovante do protocolo').setInputFiles(PDF('comprovante.pdf'))
  await page.getByRole('button', { name: 'Manifestar e protocolar' }).click()
  await expect(page.getByRole('status')).toHaveText('Manifestação protocolada. O processo voltou para a vigília.')
  await expect(page.getByLabel('Protocolo', { exact: true })).toContainText('versão 1 · por Gabi (exemplo)')
})
