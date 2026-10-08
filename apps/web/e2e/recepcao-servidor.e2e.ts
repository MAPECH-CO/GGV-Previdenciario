import { expect, test, type Page } from '@playwright/test'
import { entrarPelaApi } from './entrar.ts'

/** O convite sai pela conversa do cliente no Chatwoot: espera a conversa aparecer antes de enviar. */
async function enviarConvite(page: Page, nome: string) {
  const chatwoot = page.getByRole('dialog', { name: `Chatwoot · conversa com ${nome}` })
  await expect(chatwoot.getByRole('radiogroup', { name: 'Conversas do cliente' })).toBeVisible()
  await chatwoot.getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByText(/O convite foi enviado pelo Chatwoot/)).toBeVisible()
}

// GGVP-125, bloco 1 · o lead do balcão fica no banco do portal: outra pessoa, em outro computador, acha e abre a ficha.

test('o lead que a Atendimento cadastra no balcão, a advogada acha e abre no computador dela', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Servidor Teste')
  await page.getByLabel('Idade *').fill('63')
  await page.getByLabel('Telefone / WhatsApp *').fill('11977776666')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar apenas' }).click()
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/)
  const ficha = new URL(page.url()).pathname

  // Outro computador: outra sessão e nada guardado no navegador.
  const outro = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await outro.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto('/balcao')
  await advogada.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }).fill('lia servidor')
  await expect(advogada.getByRole('list', { name: 'Pessoas encontradas' }).getByRole('button', { name: /Lia Servidor Teste/ })).toBeVisible()

  await advogada.goto(ficha)
  await expect(advogada.getByRole('heading', { level: 2, name: 'Lia Servidor Teste' })).toBeVisible()
  await expect(advogada.getByRole('list', { name: 'Últimos contatos' })).toContainText('Quer saber do BPC do idoso.')
  const historico = advogada.getByRole('list', { name: 'Histórico' })
  await expect(historico).toContainText('Criou a ficha no balcão (lead)')
  await expect(historico).toContainText('Ana (exemplo)')
  await outro.close()
})

// GGVP-125, bloco 2 · a agenda e a confirmação no banco: a tarefa que a confirmação abre chega à advogada em outro computador.
test('a Atendimento marca e confirma a entrevista; a advogada vê "Preparar entrevista" e a entrevista na agenda dela', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Agenda Teste')
  await page.getByLabel('Idade *').fill('64')
  await page.getByLabel('Telefone / WhatsApp *').fill('11966665555')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marcar a entrevista com Lia Agenda Teste')

  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '14:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await enviarConvite(page, 'Lia Agenda Teste')

  await page.goto('/')
  await page.getByRole('link', { name: 'Lia Agenda Teste · Confirmar agendamento' }).click()
  await page.getByRole('button', { name: 'Ligar' }).click()
  await page.getByRole('radio', { name: 'Confirmou a entrevista' }).click()
  await page.getByRole('radio', { name: 'Sim, a doutora prepara a conversa' }).click()
  await page.getByRole('button', { name: 'Confirmar entrevista' }).click()
  await expect(page.getByRole('heading', { name: /✓ Entrevista confirmada/ })).toBeVisible()

  const outro = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await outro.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto('/')
  await expect(advogada.getByRole('link', { name: /Lia Agenda Teste · Preparar entrevista/ })).toBeVisible()
  await advogada.goto('/agenda')
  await advogada.getByRole('tab', { name: 'Lista' }).click()
  await expect(advogada.getByRole('button', { name: /Lia Agenda Teste · Fazer entrevista/ }).filter({ hasText: 'agendado' })).toBeVisible()
  await outro.close()
})

// GGVP-125, bloco 3a · a entrevista gravada no banco: outra sessão do Jurídico recebe "Cadastrar lead"; a gravação, que
// tem dado de saúde, não vai à cópia da Atendimento.
test('a advogada grava e encerra a entrevista de um lead do balcão; a gravação fica só com o Jurídico', async ({ page, browser }) => {
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Entrevista Teste')
  await page.getByLabel('Idade *').fill('61')
  await page.getByLabel('Telefone / WhatsApp *').fill('11955554411')
  await page.getByLabel('O que a pessoa pretende *').fill('Afastada do trabalho, sem receber.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '09:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await enviarConvite(page, 'Lia Entrevista Teste')
  const entrevista = await page.evaluate(
    () => (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { nome: string; agendamentos: { id: string }[] }[] }).fichas.find((f) => f.nome === 'Lia Entrevista Teste')!.agendamentos[0].id,
  )

  const origem = new URL(page.url()).origin
  const juridico = await browser.newContext({ baseURL: origem })
  const advogada = await juridico.newPage()
  await advogada.clock.install()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/entrevista/${entrevista}/gravacao`)
  await expect(advogada.getByRole('heading', { level: 1 })).toHaveText('Entrevista com Lia Entrevista Teste')
  await advogada.getByRole('button', { name: 'Gravar' }).click()
  await advogada.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await advogada.getByRole('button', { name: 'Começar a gravar' }).click()
  await advogada.clock.runFor(70_000)
  await advogada.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(advogada.getByRole('heading', { name: /✓ Entrevista encerrada/ })).toBeVisible()
  await expect(advogada.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()

  // Outra sessão do Jurídico, em outro computador.
  const outro = await browser.newContext({ baseURL: origem })
  const outraAdvogada = await outro.newPage()
  await entrarPelaApi(outraAdvogada, 'advogada@exemplo.ggv')
  await outraAdvogada.goto('/advogada')
  await expect(outraAdvogada.getByRole('link', { name: 'Lia Entrevista Teste · Cadastrar lead' })).toBeVisible()

  // A Atendimento abre uma tela: a cópia dela não traz a transcrição.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'O que você tem que fazer' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('ggv.exemplo.v5'))).not.toContain('Lia Entrevista Teste: ')
  expect(await advogada.evaluate(() => sessionStorage.getItem('ggv.exemplo.v5'))).toContain('Lia Entrevista Teste: ')
  await juridico.close()
  await outro.close()
})

// GGVP-125, bloco 3b · as decisões depois da entrevista no banco: a senha vai ao cofre do portal (G9), a advogada define
// o benefício (G3) e a Atendimento, em outro computador, arquiva o lead com o motivo (G16).
test('a advogada guarda a senha no cofre e define o benefício; a Atendimento arquiva o lead com o motivo', async ({ page, browser }) => {
  // Duas sessões, a gravação, o cofre e o benefício: mais que os 30 s de um teste comum.
  test.setTimeout(90_000)
  const SENHA = 'Teste#Recepcao-3b-5521'
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Decisao Teste')
  await page.getByLabel('Idade *').fill('66')
  await page.getByLabel('Telefone / WhatsApp *').fill('11944443322')
  await page.getByLabel('O que a pessoa pretende *').fill('Quer saber do BPC do idoso.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '10:30' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await enviarConvite(page, 'Lia Decisao Teste')
  const { fichaId, entrevista } = await page.evaluate(() => {
    const f = (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { id: string; nome: string; agendamentos: { id: string }[] }[] }).fichas.find(
      (x) => x.nome === 'Lia Decisao Teste',
    )!
    return { fichaId: f.id, entrevista: f.agendamentos[0].id }
  })

  const juridico = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await juridico.newPage()
  await advogada.clock.install()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/entrevista/${entrevista}/gravacao`)
  await advogada.getByRole('button', { name: 'Gravar' }).click()
  await advogada.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await advogada.getByRole('button', { name: 'Começar a gravar' }).click()
  await advogada.clock.runFor(30_000)
  await advogada.getByRole('button', { name: /Abrir o cofre/ }).click()
  await advogada.getByLabel('Digite a senha (vai direto ao cofre)').fill(SENHA)
  await advogada.getByRole('button', { name: 'Guardar no cofre' }).click()
  await expect(advogada.getByText(/● Gravando/)).toBeVisible()
  await advogada.clock.runFor(40_000)
  await advogada.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(advogada.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()

  await advogada.getByRole('link', { name: 'Definir o benefício (D1.12)' }).click()
  await expect(advogada.getByRole('heading', { level: 1 })).toHaveText('Lia Decisao Teste · Definir benefício')
  // A conversa simulada fala de afastamento: a IA sugere o auxílio por incapacidade, e a advogada aceita (G3).
  await advogada.getByRole('radio', { name: 'Aceitar: Auxílio por Incapacidade Temporária' }).click()
  await advogada.getByRole('checkbox', { name: 'Conferi a recomendação com a entrevista' }).check()
  await advogada.getByRole('button', { name: 'Confirmar benefício' }).click()
  await expect(advogada.getByRole('heading', { name: '✓ Benefício definido: Auxílio por Incapacidade Temporária' })).toBeVisible()
  expect(await advogada.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(SENHA)

  await page.goto('/')
  await page.getByRole('link', { name: 'Lia Decisao Teste · Registrar fechamento' }).click()
  await page.getByRole('radio', { name: 'Não fechou' }).click()
  await page.getByLabel('Motivo *').selectOption('preco')
  await page.getByRole('radio', { name: 'Não, arquivar o lead' }).click()
  await page.getByRole('button', { name: 'Registrar e arquivar o lead' }).click()
  await expect(page.getByRole('heading', { name: '✓ Lead arquivado com o motivo' })).toBeVisible()

  const ficha = await (await page.request.get(`/api/fichas/${fichaId}`)).json()
  expect(ficha).toMatchObject({ fechamento: { situacao: 'arquivado', motivo: 'preco' }, beneficioDefinido: { beneficio: 'incapacidade-temporaria' }, senhaGov: { situacao: 'no-cofre' } })
  expect(JSON.stringify(ficha)).not.toContain(SENHA)
  await juridico.close()
})

// GGVP-125, bloco 3c · a segunda ficha no banco: a seção médica fica com o Jurídico, buscada só pela tela dele (LGPD).
test('a advogada pede a segunda ficha; a Atendimento salva do papel; a seção médica só aparece na tela da advogada', async ({ page, browser }) => {
  test.setTimeout(90_000)
  const MEDICO = 'dor e perda de força na mão'
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Acidente Teste')
  await page.getByLabel('Idade *').fill('52')
  await page.getByLabel('Telefone / WhatsApp *').fill('11933331177')
  await page.getByLabel('O que a pessoa pretende *').fill('Acidente no trabalho, afastada.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').first().click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '16:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await enviarConvite(page, 'Lia Acidente Teste')
  const entrevista = await page.evaluate(
    () => (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { nome: string; agendamentos: { id: string }[] }[] }).fichas.find((f) => f.nome === 'Lia Acidente Teste')!.agendamentos[0].id,
  )

  const juridico = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await juridico.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/entrevista/${entrevista}/preparar`)
  await advogada.getByRole('link', { name: 'Analisar a ficha' }).click()
  await advogada.getByRole('radio', { name: 'Sim — abrir 2ª ficha' }).click()
  await advogada.getByRole('button', { name: 'Confirmar' }).click()
  await expect(advogada.getByText(/O Atendimento recebeu: "Preencher segunda ficha"/)).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Lia Acidente Teste · Preencher segunda ficha' }).click()
  await page.getByRole('button', { name: 'Digitalizar a segunda ficha (scanner simulado)' }).click()
  await expect(page.getByLabel('Empresa')).toHaveValue('Exemplo Indústria Ltda')
  await expect(page.getByRole('region', { name: '5. Dados médicos' })).toContainText('Só o Jurídico vê')
  await page.getByRole('button', { name: 'Enviar segunda ficha' }).click()
  await expect(page.getByRole('heading', { name: /✓ Segunda ficha salva/ })).toBeVisible()
  await page.goto('/')
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(MEDICO)

  await advogada.goto(`/entrevista/${entrevista}/preparar`)
  await expect(advogada.getByRole('region', { name: 'Segunda ficha (auxílio acidentário)' })).toContainText(MEDICO)
  expect(await advogada.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(MEDICO)
  await juridico.close()
})

// GGVP-125, bloco 4a · o "fechou" vira caso no banco do portal: outra sessão recebe "Preparar contrato".
test('a Atendimento registra que o lead fechou; o caso nasce no banco e outra sessão recebe "Preparar contrato"', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await page.goto('/clientes/novo')
  await page.getByLabel('Nome completo *').fill('Lia Fechou Teste')
  await page.getByLabel('Idade *').fill('47')
  await page.getByLabel('Telefone / WhatsApp *').fill('11922221100')
  await page.getByLabel('O que a pessoa pretende *').fill('Afastada do trabalho, sem receber.')
  await page.getByRole('button', { name: 'Salvar e marcar a entrevista' }).click()
  // O primeiro dia já tem os quatro horários com entrevistas dos outros testes: o segundo dia oferecido.
  await page.getByRole('radiogroup', { name: 'Data' }).getByRole('radio').nth(1).click()
  await page.getByRole('radiogroup', { name: 'Horário' }).getByRole('radio', { name: '09:00' }).click()
  await page.getByRole('button', { name: /^Marcar/ }).click()
  await enviarConvite(page, 'Lia Fechou Teste')
  const { fichaId, entrevista } = await page.evaluate(() => {
    const f = (JSON.parse(sessionStorage.getItem('ggv.exemplo.v5')!) as { fichas: { id: string; nome: string; agendamentos: { id: string }[] }[] }).fichas.find(
      (x) => x.nome === 'Lia Fechou Teste',
    )!
    return { fichaId: f.id, entrevista: f.agendamentos[0].id }
  })

  const origem = new URL(page.url()).origin
  const juridico = await browser.newContext({ baseURL: origem })
  const advogada = await juridico.newPage()
  await advogada.clock.install()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  await advogada.goto(`/entrevista/${entrevista}/gravacao`)
  await advogada.getByRole('button', { name: 'Gravar' }).click()
  await advogada.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }).check()
  await advogada.getByRole('button', { name: 'Começar a gravar' }).click()
  // O relógio só conta depois que o servidor abriu a gravação: sem esperar, a conversa sai vazia e a IA não sugere nada.
  await expect(advogada.getByText(/● Gravando/)).toBeVisible()
  await advogada.clock.runFor(70_000)
  await advogada.getByRole('button', { name: 'Encerrar e gerar resumo' }).click()
  await expect(advogada.getByText(/Transcrição pronta \(D1.11\)/)).toBeVisible()
  await advogada.getByRole('link', { name: 'Definir o benefício (D1.12)' }).click()
  await advogada.getByRole('radio', { name: 'Aceitar: Auxílio por Incapacidade Temporária' }).click()
  await advogada.getByRole('checkbox', { name: 'Conferi a recomendação com a entrevista' }).check()
  await advogada.getByRole('button', { name: 'Confirmar benefício' }).click()
  await expect(advogada.getByRole('heading', { name: '✓ Benefício definido: Auxílio por Incapacidade Temporária' })).toBeVisible()
  await juridico.close()

  await page.goto('/')
  await page.getByRole('link', { name: 'Lia Fechou Teste · Registrar fechamento' }).click()
  await page.getByRole('radio', { name: 'Sim, fechou' }).click()
  await page.getByRole('button', { name: 'Registrar fechamento' }).click()
  await expect(page.getByText('✓ Fechou com o escritório: Lia é cliente')).toBeVisible()

  const ficha = await (await page.request.get(`/api/fichas/${fichaId}`)).json()
  expect(ficha).toMatchObject({ situacao: 'cliente', processos: [{ beneficio: 'incapacidade-temporaria', etapa: 'Contrato · preparar' }] })
  expect(ficha.processos[0].id).toMatch(/^[0-9a-f-]{36}$/)

  // Outro computador do Atendimento: a tarefa do contrato chega pela cópia das telas.
  const atendimento = await browser.newContext({ baseURL: origem })
  const outra = await atendimento.newPage()
  await entrarPelaApi(outra)
  await outra.goto('/')
  await expect(outra.getByRole('link', { name: 'Lia Fechou Teste · Preparar contrato' })).toBeVisible()
  await atendimento.close()
})

// GGVP-125, bloco 4b · a assinatura no banco: pelo ZapSign (simulado) e em papel na hora; outra sessão vê os dois assinados.
test('a Atendimento colhe a assinatura pelo ZapSign e em papel; o contrato assinado fica no banco', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const conferencias = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
  /** Um cliente do balcão com o contrato gerado, pelas rotas do bloco 4a. */
  async function contratoGerado(nome: string, telefone: string, cpf: string): Promise<string> {
    const api = page.request
    const novo = { nome, idade: 66, pretende: 'Quer o BPC do idoso.', telefone, beneficioInteresse: 'loas-idoso', outraPessoa: false }
    const { id } = await (await api.post('/api/fichas', { data: novo })).json()
    const { processo } = await (await api.post(`/api/fichas/${id}/processos`, { data: { beneficio: 'loas-idoso' } })).json()
    const gerar = `/api/processos/${processo.id}/contrato/gerar`
    const { campos } = await (await api.post(gerar, { data: { aprovados: true, conferencias, correcoes: {} } })).json()
    const validos: Record<string, string> = { cpf, rg: '12.345.678-9', estadoCivil: 'Viúvo(a)', profissao: 'Do lar', endereco: 'Rua das Flores, 10, Centro, Osasco/SP' }
    const correcoes = Object.fromEntries((campos as string[]).map((c) => [c, validos[c]]))
    const gerado = await (await api.post(gerar, { data: { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias, correcoes } })).json()
    expect(gerado.resultado).toBe('gerado')
    return processo.id
  }

  // Pelo ZapSign: o documento, o link pelo WhatsApp e o retorno do assinado (simulado).
  const digital = await contratoGerado('Lia Zapsign Teste', '11933331188', '48271365991')
  await page.goto(`/contrato/${digital}/assinatura`)
  await page.getByRole('radio', { name: 'ZapSign (digital)' }).first().click()
  await page.getByRole('button', { name: 'Enviar para assinatura' }).click()
  await page.getByRole('dialog', { name: 'Chatwoot · conversa com Lia Zapsign Teste' }).getByRole('button', { name: 'Enviar' }).click()
  await expect(page.getByRole('list', { name: 'Tentativas de contato' })).toContainText('WhatsApp · link enviado')
  await page.getByRole('button', { name: 'Simular o retorno do ZapSign (assinado)' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato assinado pelo ZapSign' })).toBeVisible()

  // Em papel na hora (sem entrevista registrada, vale a presencial): imprimir, digitalizar e concluir.
  const papel = await contratoGerado('Lia Papel Teste', '11933331199', '57382914682')
  await page.goto(`/contrato/${papel}/assinatura`)
  await page.getByRole('radio', { name: 'Em papel na hora' }).click()
  await page.getByRole('button', { name: 'Imprimir o kit' }).click()
  await page.getByRole('button', { name: 'Digitalizar o contrato assinado (scanner simulado)' }).click()
  await page.getByRole('button', { name: 'Concluir a assinatura' }).click()
  await expect(page.getByRole('heading', { name: '✓ Contrato assinado em papel' })).toBeVisible()

  // Outro computador: os dois contratos assinados vêm do banco.
  const outro = await browser.newContext({ baseURL: new URL(page.url()).origin })
  const advogada = await outro.newPage()
  await entrarPelaApi(advogada, 'advogada@exemplo.ggv')
  const { contratos } = await (await advogada.request.get('/api/recepcao')).json()
  const assinados = Object.fromEntries(
    (contratos as { processoId: string; etapa: string; assinatura?: { forma: string } }[])
      .filter((c) => c.processoId === digital || c.processoId === papel)
      .map((c) => [c.processoId, `${c.etapa} · ${c.assinatura?.forma}`]),
  )
  expect(assinados).toEqual({ [digital]: 'leitura · digital', [papel]: 'leitura · papel' })
  await advogada.goto(`/contrato/${digital}/assinatura`)
  await expect(advogada.getByRole('heading', { name: '✓ Contrato assinado pelo ZapSign' })).toBeVisible()
  await outro.close()
})
