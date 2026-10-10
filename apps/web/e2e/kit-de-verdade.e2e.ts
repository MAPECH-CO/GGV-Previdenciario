import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { docxDeTeste, textoDoDocx, TIPO_DO_DOCX } from './docx-de-teste.ts'
import { ADVOGADA, entrarPelaApi } from './entrar.ts'
import { SENIOR, completarCadastro, modeloDeTeste } from './kit.ts'

// GGVP-136 · o kit de verdade, do modelo que a Sênior sobe na Configuração ao kit impresso. O teste usa o Auxílio por Incapacidade
// (o modelo dele só é mexido aqui), para não pisar nos modelos dos outros testes: o banco é o mesmo. O texto dos modelos é inventado.

const NOME_DO_MODELO = 'Contrato Completo de auxílio incapacidade'
const ID_DO_MODELO = 'contrato-completo-auxilio-incapacidade'
const CPF = '39053344705'

test('a Sênior sobe e troca o modelo; a Atendimento vê o que falta na ficha, gera o kit pela versão em vigor, imprime e assina em papel; outra sessão vê o registro', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)

  // CA1 · A Sênior sobe o modelo (versão 1) e o troca (versão 2) pela Configuração.
  const doSenior = await browser.newContext({ baseURL })
  const senior = await doSenior.newPage()
  await entrarPelaApi(senior, SENIOR)
  await senior.goto('/configuracao')
  const linha = senior.getByRole('region', { name: 'Modelos do kit' }).getByRole('listitem').filter({ hasText: NOME_DO_MODELO })
  await expect(linha).toContainText('sem arquivo: o kit avisa que falta o modelo')
  for (const versao of [1, 2]) {
    await linha.getByLabel(`Arquivo do ${NOME_DO_MODELO} (.docx)`).setInputFiles({ name: 'modelo.docx', mimeType: TIPO_DO_DOCX, buffer: docxDeTeste(modeloDeTeste(`versão ${versao}`)) })
    await linha.getByRole('button', { name: `Subir a versão ${versao} do ${NOME_DO_MODELO}` }).click()
    await expect(senior.getByText(`Modelo publicado: a versão ${versao} vale para os kits novos.`)).toBeVisible()
    await expect(linha).toContainText(`versão ${versao}, desde`)
  }
  await doSenior.close()

  // CA2 e CA4 · A Atendimento prepara o contrato do benefício pelo modelo da linha; a ficha não tem o endereço: o kit não é
  // gerado, a lista do que falta vem com o atalho para completar a ficha.
  const api = page.request
  const novo = { nome: 'Lia Kit Teste', idade: 52, pretende: 'Quer o auxílio por incapacidade.', telefone: '11933334455', beneficioInteresse: 'incapacidade-temporaria', outraPessoa: false }
  const { id: fichaId } = await (await api.post('/api/fichas', { data: novo })).json()
  const { processo } = await (await api.post(`/api/fichas/${fichaId}/processos`, { data: { beneficio: 'incapacidade-temporaria' } })).json()
  await page.goto(`/contrato/${processo.id}/preparar`)
  await expect(page.getByText(new RegExp(`pelo ${NOME_DO_MODELO}`)).first()).toBeVisible()
  await page.getByRole('radio', { name: 'Não, corrigir campos' }).click()
  await page.getByLabel('Nacionalidade *').fill('brasileiro')
  await page.getByLabel('Estado civil *').fill('Viúvo(a)')
  await page.getByLabel('Profissão *').fill('Do lar')
  await page.getByLabel('CPF *').fill('390.533.447-05')
  await page.getByLabel('RG *').fill('12.345.678-9')
  await page.getByLabel('Endereço *').fill('Rua das Flores, 10')
  await page.getByLabel('O que corrigir *').fill('faltavam os dados pessoais')
  for (const nome of [
    'Campos certos e completos',
    'Datas feitas à mão serão preenchidas na assinatura',
    'Ficha LOAS: cliente ou representante legal (se aplicável)',
    'A página do Código Penal não tem assinatura',
  ]) {
    await page.getByRole('checkbox', { name: nome }).check()
  }
  await page.getByRole('button', { name: 'Gerar contrato' }).click()
  const aviso = page.getByRole('alert').filter({ hasText: 'O kit não foi gerado.' })
  await expect(aviso).toContainText('Falta na ficha: Bairro, Cidade, Estado (UF), CEP.')
  await expect(aviso.getByRole('link', { name: 'Completar a ficha' })).toHaveAttribute('href', `/clientes/${fichaId}`)

  // CA3 e CA6 · O Jurídico completa o cadastro, e o kit sai pela versão 2 do modelo, que ficou em vigor.
  await completarCadastro(baseURL!, fichaId, CPF)
  await page.getByRole('button', { name: 'Gerar contrato' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato gerado · versão 1' })).toBeVisible()
  await expect(page.getByText(`O kit foi gerado pelo ${NOME_DO_MODELO} e segue para colher a assinatura do cliente.`)).toBeVisible()

  // CA8 · Sem o ZapSign contratado, a opção do celular não aparece. O servidor do teste tem o ZapSign de mentira ligado (os outros
  // testes usam); aqui a tela recebe "não contratado" e "sem conversor de PDF", como na homologação sem as duas variáveis.
  await page.route('**/api/contrato/servicos', (rota) => rota.fulfill({ json: { zapsign: false, pdf: false } }))
  await page.getByRole('link', { name: 'Colher assinatura' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lia Kit Teste · Colher assinatura')
  await expect(page.getByRole('radio', { name: 'ZapSign (digital)' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Enviar para assinatura' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Como o cliente vai assinar?' }).getByRole('radio', { name: 'Em papel' })).toBeChecked()

  // CA5 · "Imprimir o kit": sem conversor, o Word preenchido é baixado para imprimir. A 1ª data (a do contrato de honorários)
  // sai preenchida; as outras, em branco, para preencher à mão.
  const [baixado] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Imprimir o kit' }).click()])
  expect(baixado.suggestedFilename()).toBe('Kit do contrato - versão 1.docx')
  const kit = textoDoDocx(readFileSync(await baixado.path()))
  const linhas = kit.split('\n')
  expect(linhas[0]).toContain('CONTRATO DE TESTE (versão 2)')
  for (const parte of ['Lia Kit Teste', 'viúvo(a)', 'brasileiro', 'CPF 390.533.447-05', 'Rua das Flores nº 10', 'Centro', 'Osasco/SP', 'CEP 06010-000']) expect(linhas[0]).toContain(parte)
  expect(kit).not.toContain('{{')
  expect(linhas[1]).toMatch(/^São Paulo, \d{1,2}º? de \p{L}+ de \d{4}\.$/u)
  expect(linhas[3]).toMatch(/^Osasco, dia _+ de _+ de \d{4}\.$/)
  await expect(page.getByText('O kit saiu em Word: abra o arquivo e imprima por ele.')).toBeVisible()
  await expect(page.getByText(/^Impresso em .*\.$/)).toBeVisible()

  // CA7 · O assinado volta digitalizado e segue o caminho de sempre.
  await page.getByRole('button', { name: 'Digitalizar o contrato assinado (scanner simulado)' }).click()
  await page.getByRole('button', { name: 'Concluir a assinatura' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato assinado em papel' })).toBeVisible()

  // CA6 · Outro computador: o histórico da ficha diz o modelo e a versão usados e que o kit foi para a pasta do cliente.
  const outro = await browser.newContext({ baseURL })
  const advogada = await outro.newPage()
  await entrarPelaApi(advogada, ADVOGADA)
  const registro = `pelo modelo ${ID_DO_MODELO}-v2 (versão 1), guardado na pasta do cliente`
  const ficha = await (await advogada.request.get(`/api/fichas/${fichaId}`)).json()
  expect(ficha.historico.map((e: { oQue: string }) => e.oQue).some((oQue: string) => oQue.includes(registro))).toBe(true)
  await advogada.goto(`/clientes/${fichaId}`)
  await expect(advogada.getByRole('list', { name: 'Histórico' })).toContainText(registro)
  await outro.close()
})

test('a líder do Atendimento vê os modelos do kit, sem poder subir: só a Sênior sobe', async ({ browser, baseURL }) => {
  const contexto = await browser.newContext({ baseURL })
  const lider = await contexto.newPage()
  await entrarPelaApi(lider, 'lider@exemplo.ggv')
  await lider.goto('/configuracao')
  const modelos = lider.getByRole('region', { name: 'Modelos do kit' })
  await expect(modelos.getByText(/Quem sobe é a Sênior\./)).toBeVisible()
  await expect(modelos.getByRole('listitem')).toHaveCount(9)
  await expect(modelos.getByRole('button')).toHaveCount(0)
  await contexto.close()
})
