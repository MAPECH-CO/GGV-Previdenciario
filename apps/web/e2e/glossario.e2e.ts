import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// Glossário do escritório (GGVP-143). Usuários de exemplo do banco local; nenhum é real. O glossário nasce com a semente
// da migração (benefícios do catálogo e siglas).

test('GGVP-143 · a Sênior acrescenta, corrige e tira um termo do glossário; cada mudança vai ao histórico da configuração', async ({ page }) => {
  await entrarPelaApi(page, 'senior@exemplo.ggv')
  await page.goto('/configuracao')
  const glossario = page.getByRole('region', { name: 'Glossário do escritório' })
  await expect(glossario.getByRole('list', { name: 'Glossário: Sigla' })).toContainText('LOAS · Lei Orgânica da Assistência Social')
  await expect(glossario.getByRole('list', { name: 'Glossário: Benefício' })).toContainText('BPC/LOAS Idoso')

  const novo = glossario.getByRole('group', { name: 'Acrescentar ao glossário' })
  await novo.getByLabel('Termo').fill('DCB')
  await novo.getByLabel('Tipo').selectOption('sigla')
  await novo.getByLabel('Significado (opcional)').fill('Data da Cessação')
  await novo.getByRole('button', { name: 'Acrescentar ao glossário' }).click()
  await expect(page.getByRole('status')).toHaveText('Termo acrescentado ao glossário.')
  await expect(glossario.getByRole('list', { name: 'Glossário: Sigla' })).toContainText('DCB · Data da Cessação')

  await glossario.getByRole('button', { name: 'Corrigir DCB' }).click()
  const correcao = glossario.getByRole('group', { name: 'Salvar a correção' })
  await correcao.getByLabel('Significado (opcional)').fill('Data de Cessação do Benefício')
  await correcao.getByRole('button', { name: 'Salvar a correção' }).click()
  await expect(page.getByRole('status')).toHaveText('Termo corrigido.')
  await expect(glossario.getByRole('list', { name: 'Glossário: Sigla' })).toContainText('DCB · Data de Cessação do Benefício')

  await glossario.getByRole('button', { name: 'Tirar DCB' }).click()
  await expect(page.getByRole('status')).toHaveText('Termo tirado do glossário.')
  await expect(glossario.getByRole('list', { name: 'Glossário: Sigla' })).not.toContainText('DCB')

  const historico = page.getByRole('region', { name: 'Histórico da configuração' })
  await expect(historico).toContainText('Helena (exemplo) · Glossário: "DCB" acrescentado')
  await expect(historico).toContainText('Helena (exemplo) · Glossário: "DCB" corrigido')
  await expect(historico).toContainText('Helena (exemplo) · Glossário: "DCB" tirado')
})

test('GGVP-143 · o Sócio vê o glossário, mas quem muda é a Sênior', async ({ page }) => {
  await entrarPelaApi(page, 'socio@exemplo.ggv')
  await page.goto('/configuracao')
  const glossario = page.getByRole('region', { name: 'Glossário do escritório' })
  await expect(glossario).toContainText('Quem muda é a Sênior.')
  await expect(glossario.getByRole('list', { name: 'Glossário: Sigla' })).toContainText('CNIS · Cadastro Nacional de Informações Sociais')
  await expect(glossario.getByRole('button')).toHaveCount(0)
})
