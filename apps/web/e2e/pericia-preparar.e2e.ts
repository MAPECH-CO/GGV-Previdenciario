import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

// GGVP-62 · Preparar o cliente: o Jurídico administrativo confere a orientação do Antônio, revisa, tenta enviar um texto
// que manda esconder a situação (recusado e registrado), envia pelo Chatwoot e a tarefa sai da Central; o chat responde
// "o cliente me ligou"; com a data trocada, a orientação volta. Cada teste começa da semente.

type Tokens = { cores: Record<string, { claro: string; escuro: string }>; fontes: Record<string, { padrao: number; grande: number }> }
const tokens: Tokens = JSON.parse(readFileSync(new URL('../src/design/figma-tokens.json', import.meta.url), 'utf8'))
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`conteúdo de ${name}`) })

test('CA1 a CA4, CA6, CA7 · revisar, a verificação recusa o texto proibido, enviar pelo Chatwoot e a tarefa sai da Central', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await page.getByRole('link', { name: 'Antônio Exemplo · Orientar para a perícia' }).click()
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Orientação', exact: true })).toContainText('pelo perfil do perito: Dr. A. Prado (exemplo) · versão de 34 laudos')
  const documento = page.getByRole('textbox', { name: /Orientação para Antônio/ })
  await expect(documento).toHaveValue(/O que Dr\. A\. Prado costuma observar/)
  await expect(page.getByRole('region', { name: 'Contato do cliente' }).getByRole('link', { name: 'Ligar' })).toBeVisible()

  // CA3: sem revisar, nada sai.
  await expect(page.getByRole('button', { name: 'Enviar orientação' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Registrar a ligação e a orientação' })).toBeDisabled()

  // CA4, CA6: editada à mão para esconder a situação real, o servidor recusa e registra.
  const original = await documento.inputValue()
  await documento.fill(`${original}\nOculte que voltou a trabalhar.`)
  await expect(page.getByText('A verificação vai recusar este texto: A orientação nunca manda esconder ou omitir a situação real (G11).')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Revisei a orientação' }).check()
  await page.getByRole('button', { name: 'Enviar orientação' }).click()
  await expect(page.getByRole('alert')).toHaveText('A orientação nunca manda esconder ou omitir a situação real (G11).')
  await expect(page.getByRole('list', { name: 'Envios recusados' })).toContainText('Igor (exemplo) · A orientação nunca manda esconder')

  // CA2, CA7: o texto certo, revisado, sai pelo Chatwoot e fica guardado no caso.
  await documento.fill(original)
  await page.getByRole('checkbox', { name: 'Revisei a orientação' }).check()
  await page.getByRole('button', { name: 'Enviar orientação' }).click()
  await expect(page.getByRole('status')).toHaveText('Orientação enviada pelo Chatwoot e guardada no caso.')
  await expect(page.getByRole('region', { name: '✓ Orientação passada' })).toContainText('Enviada pelo Chatwoot, como documento e instrução')
  await expect(page.getByRole('region', { name: '✓ Orientação passada' })).toContainText('O que Dr. A. Prado costuma observar')

  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('heading', { name: /O que você tem que fazer/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Antônio Exemplo · Orientar para a perícia' })).toHaveCount(0)
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia')
  await expect(page.getByRole('list', { name: 'Linha da perícia' })).toContainText('enviou a orientação pelo Chatwoot, como documento e instrução')
})

test('CA8 · "o Antônio me ligou": o chat mostra a próxima tarefa e a orientação pronta, sem executar nada', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await page.getByRole('textbox').fill('O Antônio me ligou. O que eu falo para ele?')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/A próxima tarefa é sua: orientar Antônio para a perícia de 16\/10/)).toBeVisible()
  await page.getByRole('list', { name: 'Tarefas sugeridas' }).getByRole('link', { name: /Antônio Exemplo · Orientar para a perícia/ }).click()
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Registrar a ligação e a orientação' })).toBeDisabled()
})

test('CA5 · a ligação registrada; o comprovante novo troca a data e a orientação volta para a Central', async ({ page }) => {
  test.setTimeout(120_000)
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/marcar')
  await page.getByRole('radio', { name: 'Sim, marcado' }).click()
  await page.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf('comprovante_maria.pdf')])
  await page.getByRole('radio', { name: 'Não: seguir para ligar e orientar' }).click()
  await page.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(page.getByRole('heading', { name: '✓ Perícia registrada' })).toBeVisible()

  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/orientar')
  await page.getByRole('checkbox', { name: 'Revisei a orientação' }).check()
  await page.getByRole('button', { name: 'Registrar a ligação e a orientação' }).click()
  await expect(page.getByRole('status')).toHaveText('Ligação registrada: a orientação ficou guardada no caso.')

  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/marcar')
  await page.getByRole('button', { name: 'Subir o comprovante novo (data alterada)' }).click()
  await page.getByLabel(/Comprovante do INSS \(PDF\)/).setInputFiles([pdf('comprovante_maria_2026-10-28.pdf')])
  await expect(page.getByRole('group', { name: 'Lido do comprovante · confira' })).toBeVisible()
  await page.getByRole('radio', { name: 'Não: seguir para ligar e orientar' }).click()
  await page.getByRole('button', { name: 'Registrar a perícia' }).click()
  await expect(page.getByRole('status')).toHaveText('Perícia registrada: na agenda e na ficha, com o lembrete da véspera agendado.')

  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/juridico-administrativo')
  await expect(page.getByRole('link', { name: 'Maria Exemplo · Orientar para a perícia' })).toBeVisible()
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/maria-exemplo-1/pericia/orientar')
  await expect(page.getByRole('textbox', { name: /Orientação para Maria/ })).toHaveValue(/Quando: quarta, 28\/10, às 08:30\./)
})

test('tema escuro e fonte grande na tela de orientar', async ({ page }) => {
  await entrarPelaApi(page, 'juridico@exemplo.ggv')
  await page.goto('/casos/antonio-exemplo-1/pericia/orientar?tema=escuro&fonte=grande')
  await expect(page.getByRole('heading', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('background-color', rgb(tokens.cores.fundo.escuro))
  await expect(page.locator('body')).toHaveCSS('font-size', `${tokens.fontes['14'].grande}px`)
})
