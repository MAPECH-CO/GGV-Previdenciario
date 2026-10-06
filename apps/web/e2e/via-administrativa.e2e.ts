import { expect, test } from '@playwright/test'
import { SENHA_DE_EXEMPLO, entrarPelaApi } from './entrar.ts'

// GGVP-8 · Via administrativa no INSS, grupo 1, com a API de verdade e os casos de exemplo (já aprovados pela Sênior).
test.describe.configure({ mode: 'serial' })

test('GGVP-27 · o Jurídico administrativo protocola um caso: senha do cofre, número, DER, comprovante e conferência', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Central · Jurídico administrativo' })).toBeVisible()
  const protocolos = page.getByRole('link', { name: /· Protocolar no Meu INSS$/ })
  await expect(protocolos).toHaveCount(3)
  await protocolos.first().click()

  await expect(page.getByRole('heading', { name: 'Protocolar no Meu INSS' })).toBeVisible()
  await expect(page.getByText(/OK recebido · Helena \(exemplo\)/)).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(5)

  await page.getByRole('button', { name: 'Ver a senha do gov.br' }).click()
  await page.getByLabel('Confirme com a sua senha do portal').fill(SENHA_DE_EXEMPLO)
  await page.getByRole('button', { name: 'Mostrar por 60 segundos' }).click()
  await expect(page.getByRole('status')).toContainText('Senha do gov.br:')

  await page.getByLabel('Número do requerimento').fill('2026123456')
  await page.getByLabel('Data de entrada do requerimento (DER)').fill('2026-10-05')
  await page.getByLabel('Comprovante do protocolo').setInputFiles({ name: 'comprovante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 exemplo') })
  await page.getByRole('button', { name: 'Registrar protocolo' }).click()
  await expect(page.getByRole('alert')).toHaveText('Marque "Revisei o requerimento antes de enviar"')
  await page.getByLabel('Revisei o requerimento antes de enviar').check()
  await page.getByRole('button', { name: 'Registrar protocolo' }).click()
  await expect(page.getByText('Protocolo registrado. O caso agora espera o INSS.')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('link', { name: /· Protocolar no Meu INSS$/ })).toHaveCount(2)
})

test('GGVP-31 · a advogada decide a perícia e a tarefa aparece sozinha para o Jurídico administrativo', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: /· Decidir perícia$/ }).first().click()
  await expect(page.getByRole('button', { name: 'Definir' })).toBeDisabled()
  await page.getByLabel('Sim, o sistema abre a tarefa de perícia').check()
  await page.getByLabel('Perícia médica').check()
  await page.getByRole('button', { name: 'Definir' }).click()
  await expect(page.getByRole('status')).toContainText('abriu a tarefa de perícia')

  await context.clearCookies()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: /· Marcar perícia médica$/ })).toBeVisible()
})

test('GGVP-96 CA11 · o Atendimento não abre a tela de protocolo', async ({ page }) => {
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  await page.goto('/casos/6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6/protocolo')
  await expect(page.getByRole('heading', { name: 'Sem permissão' })).toBeVisible()
})

// Antes das decisões: depois delas, a fila da Sênior fica vazia.
test('GGVP-23 CA4 · o Atendimento abre a conferência só para leitura', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  const href = await page.getByRole('link', { name: /· Conferir antes do INSS$/ }).first().getAttribute('href')
  await page.context().clearCookies()
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  await page.goto(href!)
  await expect(page.getByText(/Só leitura/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0)
})

test('GGVP-23 · a Sênior aprova um caso e as tarefas de protocolo e de perícia aparecem', async ({ page, context }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: /· Conferir antes do INSS$/ })).toHaveCount(2)
  await page.getByRole('link', { name: 'Antônia Lima (exemplo) · Conferir antes do INSS' }).click()
  await expect(page.getByRole('heading', { name: 'Conferência antes do INSS' })).toBeVisible()
  await expect(page.getByText('Suficiente')).toBeVisible()
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByRole('status')).toContainText('protocolo e a decisão de perícia foram abertos')

  await context.clearCookies()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Antônia Lima (exemplo) · Protocolar no Meu INSS' })).toBeVisible()
  await context.clearCookies()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Antônia Lima (exemplo) · Decidir perícia' })).toBeVisible()
})

test('GGVP-23 · sem parecer, Aprovar fica desligado; reprovar sem motivo não passa; com motivo volta ao Atendimento', async ({ page, context }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Benedito Alves (exemplo) · Conferir antes do INSS' }).click()
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeDisabled()
  await page.getByRole('button', { name: 'Reprovar, volta ao Atendimento' }).click()
  await page.getByLabel('Não').check()
  await page.getByRole('button', { name: 'Confirmar reprovação' }).click()
  await expect(page.getByRole('alert')).toHaveText('Escreva o que o Atendimento precisa ajustar')
  await page.getByLabel('O que o Atendimento precisa ajustar').fill('Falta o laudo do ortopedista')
  await page.getByRole('button', { name: 'Confirmar reprovação' }).click()
  await expect(page.getByRole('status')).toContainText('voltou para o Atendimento')

  await context.clearCookies()
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Benedito Alves (exemplo) · Ajustar o caso: Falta o laudo do ortopedista' })).toBeVisible()
})

// Grupo 2: casos de exemplo em vigília (Rita, Sebastião e Teresa), esperando o INSS.
const PDF = { name: 'comunicacao.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 exemplo') }

test('GGVP-35 · a advogada registra um deferido e uma exigência; o Atendimento só vê', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Rita Gomes (exemplo) · Trazer a resposta do INSS' }).click()
  await expect(page.getByText(/Esperando: INSS decidir · desde/)).toBeVisible()
  const daRita = page.url()
  await page.getByLabel('Deferido', { exact: true }).check()
  await page.getByLabel('Texto da comunicação do INSS').fill('Benefício concedido.')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Anexe a comunicação do INSS (PDF ou imagem, até 25 MB).')
  await page.getByLabel('Comunicação do INSS', { exact: true }).setInputFiles(PDF)
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('status')).toContainText('Prestar contas')
  await expect(page.getByRole('list', { name: 'Registros' })).toContainText('Deferido · Gabi (exemplo)')

  await page.goto('/')
  await page.getByRole('link', { name: 'Teresa Dias (exemplo) · Trazer a resposta do INSS' }).click()
  await page.getByLabel('Exigência').check()
  await page.getByLabel('Texto da exigência').fill('Apresentar inscrição no CadÚnico atualizada.')
  await page.getByLabel('Data da exigência').fill('2026-10-03')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('status')).toContainText('o caso continua vigiado')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Teresa Dias (exemplo) · Tratar exigência do INSS' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Teresa Dias (exemplo) · Trazer a resposta do INSS' })).toBeVisible()

  await context.clearCookies()
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  await page.goto(daRita)
  await expect(page.getByRole('list', { name: 'Registros' })).toContainText('Deferido')
  await expect(page.getByRole('button', { name: 'Registrar' })).toHaveCount(0)
})

test('GGVP-48 · indeferido com a carta vai para a Justiça; a Sênior pode encerrar sem judicializar', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Sebastião Cruz (exemplo) · Trazer a resposta do INSS' }).click()
  const vigilia = page.url()
  await page.getByLabel('Indeferido').check()
  await page.getByLabel('Texto da comunicação do INSS').fill('Benefício indeferido.')
  await page.getByLabel('Motivo que consta no sistema do INSS').fill('Renda per capita acima do limite')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).')
  await page.getByLabel('Carta de indeferimento').setInputFiles(PDF)
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('status')).toContainText('Registrar indeferimento')
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Sebastião Cruz (exemplo) · Registrar indeferimento' })).toBeVisible()

  await context.clearCookies()
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto(vigilia)
  await page.getByLabel('Por que o caso é encerrado').fill('Cliente decidiu não entrar na Justiça.')
  await page.getByRole('button', { name: 'Encerrar o caso' }).click()
  await expect(page.getByRole('status')).toHaveText('Caso encerrado sem judicializar.')
})

// Grupo 3: exigência do INSS (Ulisses, de exemplo, esperando a advogada decidir).
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10)

test('GGVP-39 · a advogada decide "Documentos"; a Documentação cobra, junta a prova e responde; o caso volta para a vigília', async ({ page, context }) => {
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Ulisses Rocha (exemplo) · Tratar exigência do INSS' }).click()
  await expect(page.getByText(/Apresentar a inscrição no CadÚnico/)).toBeVisible()
  await page.getByLabel('Documentos', { exact: true }).check()
  await page.getByLabel('Prazo que o INSS deu (dias)').fill('30')
  await expect(page.getByText(/Prazo do INSS: \d{2}\/\d{2}\/\d{4} \(30 dias\)/)).toBeVisible()
  await page.getByLabel('Documentos pedidos (um por linha)').fill('CadÚnico atualizado\nComprovante de renda')
  await page.getByLabel('Prazo de entrega da Documentação').fill(emDias(7))
  await page.getByRole('button', { name: 'Criar a tarefa' }).click()
  await expect(page.getByRole('status')).toContainText('A Documentação recebeu o card')

  await context.clearCookies()
  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Ulisses Rocha (exemplo) · Cumprir exigência do INSS' }).click()
  await expect(page.getByRole('button', { name: 'Anexar e responder' })).toBeDisabled()
  await page.getByLabel('Canal').selectOption('whatsapp')
  await page.getByLabel('Resultado').selectOption('vai_entregar')
  await page.getByRole('button', { name: 'Registrar cobrança' }).click()
  await expect(page.getByText(/Cobranças: 1 de 3/)).toBeVisible()
  for (const item of ['CadÚnico atualizado', 'Comprovante de renda']) {
    await page.getByLabel(`Documento de “${item}”`).setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
    await page.getByRole('listitem').filter({ hasText: item }).getByRole('button', { name: 'Anexar' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: item })).toContainText('Cumprido')
  }
  await page.getByLabel('Comprovante da resposta').setInputFiles({ name: 'resposta.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') })
  await page.getByRole('button', { name: 'Anexar e responder' }).click()
  await expect(page.getByRole('status')).toContainText('voltou para a vigília')

  await context.clearCookies()
  await entrarPelaApi(page, 'advogada@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Ulisses Rocha (exemplo) · Trazer a resposta do INSS' }).click()
  await expect(page.getByText(/Esperando: INSS analisar a resposta/)).toBeVisible()
})
