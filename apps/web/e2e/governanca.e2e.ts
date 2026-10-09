import { expect, test } from '@playwright/test'
import { SENHA_DE_EXEMPLO, entrarPelaApi } from './entrar.ts'

// Garantia e governança (GGVP-13). Usuários e casos de exemplo do banco local; nenhum é real.

test('GGVP-109 · a ação fora do perfil, chamada direto pela API, é recusada e aparece para a Sênior em "Tentativas bloqueadas"', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  const tarefas = (await (await page.request.get('/api/tarefas')).json()) as { casoId: string | null; cliente: { nome: string } | null }[]
  const doCaso = tarefas.find((t) => t.casoId && t.cliente)!
  await entrarPelaApi(page, 'atendimento@exemplo.ggv')
  const recusa = await page.request.post(`/api/casos/${doCaso.casoId}/peticao/pedido`, { data: {} })
  expect(recusa.status()).toBe(403)

  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Tentativas bloqueadas' }).click()
  await expect(page.getByRole('heading', { name: 'Tentativas bloqueadas' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Tentativas bloqueadas' }).getByRole('listitem').first()).toContainText(
    `Ana (exemplo) (Atendimento) · ${doCaso.cliente!.nome} · Ação fora do perfil (peticao.pedir)`,
  )
})

test('GGVP-94 · a cobrança passou do limite: a Sênior vê o laço, devolve à Documentação com o que fazer, e a Documentação vê a decisão e o próximo lembrete', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Wagner Costa (exemplo) · Cobrança sem retorno: exigência do INSS' }).click()
  const laco = page.getByLabel('Cobrança sem retorno')
  await expect(laco.getByRole('listitem')).toHaveCount(3)
  await expect(laco.getByRole('button', { name: 'Devolver ao setor' })).toBeDisabled()
  await laco.getByLabel('O que o setor deve fazer').fill('Ligar para a filha e pedir o CadÚnico por foto')
  await laco.getByRole('button', { name: 'Devolver ao setor' }).click()
  await expect(page.getByRole('status')).toContainText('Decisão registrada. A tarefa voltou ao setor, com o próximo lembrete em')

  await entrarPelaApi(page, 'documentacao@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Wagner Costa (exemplo) · Cumprir exigência do INSS' }).click()
  await expect(page.getByRole('list', { name: 'Cobranças' })).toContainText('Decisão da Sênior · Ligar para a filha e pedir o CadÚnico por foto · Helena (exemplo)')
  await expect(page.getByText(/Próximo lembrete em/)).toContainText('para Documentação · pela Central de tarefas · “Cumprir exigência do INSS”')
})

test('GGVP-103 · o Jurídico administrativo guarda a senha do gov.br pelo cofre e revela; a gestão vê o uso, sem a senha', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Lúcia Prado (exemplo) · Protocolar no Meu INSS' }).click()
  await expect(page.getByText('Este cliente não tem senha do gov.br no cofre.')).toBeVisible()
  await page.getByText('Cadastrar a senha do gov.br no cofre').click()
  await page.getByLabel('Senha do gov.br').fill('gov-lucia-e2e')
  await page.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(page.getByText('Senha guardada no cofre.')).toBeVisible()
  await page.getByRole('button', { name: 'Ver a senha do gov.br' }).click()
  await page.getByLabel('Confirme com a sua senha do portal').fill(SENHA_DE_EXEMPLO)
  await page.getByRole('button', { name: 'Mostrar por 60 segundos' }).click()
  await expect(page.getByText(/Senha do gov.br: gov-lucia-e2e/)).toBeVisible()

  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  // Nome exato: depois das 20h, a leitura acima gera o alerta "Uso do cofre fora do padrão" na Central, outro link.
  await page.getByRole('link', { name: 'Uso do cofre', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Uso do cofre por pessoa' })).toContainText('Igor (exemplo) · leituras 1 · cadastros e trocas 1 · recusas 0')
  await expect(page.locator('body')).not.toContainText('gov-lucia-e2e')
})

test('GGVP-104 · a Sênior muda um parâmetro e publica o kit de um benefício; a mudança fica no histórico da configuração', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/')
  await page.getByRole('link', { name: 'Configuração' }).click()
  await expect(page.getByRole('heading', { name: 'Configuração do escritório' })).toBeVisible()
  const janela = page.getByLabel('Cliente sumido: dias para as tentativas de contato (de 1 a 60)')
  await expect(janela).toHaveValue('10')
  await janela.fill('12')
  await page.getByRole('button', { name: 'Salvar: Cliente sumido: dias para as tentativas de contato' }).click()
  await expect(page.getByRole('status')).toHaveText('Parâmetro salvo.')

  await page.getByLabel('Benefício', { exact: true }).selectOption('salario_maternidade')
  const kit = page.getByRole('region', { name: 'Kit de Salário-Maternidade' })
  await kit.getByLabel('Acrescentar documento').fill('certidao_de_nascimento')
  await kit.getByRole('button', { name: 'Acrescentar' }).click()
  await kit.getByRole('button', { name: 'Publicar a versão 1' }).click()
  await expect(page.getByRole('status')).toHaveText('Kit publicado: a versão 1 vale para os casos novos.')
  const historico = page.getByRole('region', { name: 'Histórico da configuração' })
  await expect(historico).toContainText('Kit de Salário-Maternidade: versão 1 publicada, com 1 documento(s)')
  await expect(historico).toContainText('Cliente sumido: dias para as tentativas de contato: 10 → 12')
})

