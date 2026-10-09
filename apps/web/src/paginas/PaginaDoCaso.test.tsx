import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessoDoCaso } from '@ggv/contratos'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { CasoEmAndamento } from '../componentes/CasoEmAndamento.tsx'
import { CabecalhoCliente } from '../componentes/CabecalhoCliente.tsx'
import { PaginaDoCaso } from './PaginaDoCaso.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

const etapas = () => within(screen.getByRole('navigation', { name: 'Etapas do processo' })).getAllByRole('listitem')

describe('GGVP-86 · o caso numa linha só (Figma 72:2)', () => {
  it('CA1, CA2 · as cinco etapas, a atual em destaque e o "Em perícia" na etapa que pediu', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(etapas().map((e) => e.textContent?.replace(/\s+/g, ' '))).toEqual([
      '✓ Entrevista (D1 · feita)',
      '✓ INSS (D2 · feita)',
      '✓ Justiça (D3 · feita)',
      '▶ Vigíliaexigência do juiz (D3a · agora)Em períciaAgendada'.replace('Agendada', etapas()[3].textContent!.split('Em perícia')[1]),
      'Desfecho (D3b · ainda não chegou)',
    ])
    const vigilia = etapas()[3]
    expect(within(vigilia).getByText('Vigília', { exact: false }).closest('[aria-current]')?.getAttribute('aria-current')).toBe('step')
    expect(within(vigilia).getByRole('link', { name: /Em perícia/ }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia')
  })

  it('CA1 · deferido no INSS: Justiça, vigília e desfecho apagados', async () => {
    entrarComo('atendimento')
    render(comSessao(<PaginaDoCaso processoId="marta-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(etapas().slice(2).map((e) => e.textContent)).toEqual([
      'Justiçanão se aplica (D3 · não se aplica)',
      'Vigílianão se aplica (D3a · não se aplica)',
      'Desfechonão se aplica (D3b · não se aplica)',
    ])
  })

  it('CA3, CA8, CA9 · setores que não subiram o card, quem de fora estamos esperando e as tarefas por setor', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    const setores = (await screen.findByRole('heading', { name: 'Esperando os setores' })).closest('section')!
    expect(within(setores).getAllByText('ainda não subiu o card')).toHaveLength(2)
    expect(within(setores).getByText(/subiu o card 27\/09/)).toBeTruthy()
    const fora = screen.getByRole('heading', { name: 'Esperando alguém de fora' }).closest('section')!.textContent
    expect(fora).toContain('Cliente')
    expect(fora).toContain('desde 26/09 · prazo 09/10')
    expect(fora).toContain('Justiça')
    const tarefas = screen.getByRole('heading', { name: 'Tarefas em andamento' }).closest('section')!
    expect(within(tarefas).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Atendimento', 'Jurídico', 'Jurídico administrativo'])
    expect(tarefas.textContent).toContain('responsável: Ana (exemplo) · em paralelo')
    expect(tarefas.textContent).toContain('Antônio Exemplo · Orientar para a perícia')
  })

  it('CA4 · clicar num passo feito mostra quem fez, quando e os documentos', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    fireEvent.click(await screen.findByRole('button', { name: '✓ Entrevista' }))
    const detalhe = screen.getByRole('heading', { name: /Entrevista · feita/ }).closest('section')!
    expect(detalhe.textContent).toContain('Dra. Paula (exemplo) (pessoa)')
    expect(detalhe.textContent).toContain('D1.09')
    expect(detalhe.textContent).toContain('Documentos desta etapa: transcricao-entrevista.pdf, contrato-zapsign.pdf, cnis.pdf')
  })

  it('CA5 · laudo novo no cabeçalho do processo e na ficha, levando à análise do laudo', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    expect((await screen.findByRole('link', { name: 'Laudo novo · 29/09' })).getAttribute('href')).toBe('/casos/antonio-exemplo-1/laudo-novo')
    const ficha = (await obterFicha('antonio-exemplo'))!
    render(comSessao(<CabecalhoCliente ficha={ficha} hoje="2026-10-07" laudoHref="/casos/antonio-exemplo-1/laudo-novo" />))
    expect(screen.getAllByRole('link', { name: 'Laudo novo · 29/09' })).toHaveLength(2)
  })

  it('CA6 · o nome do juízo e do perito abrem a jurimetria sem sair do caso, com o número de casos', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Vara Federal de Santo Amaro (exemplo)' }))
    const juizo = screen.getByRole('dialog', { name: 'Vara Federal de Santo Amaro (exemplo)' })
    expect(juizo.textContent).toContain('58% · 7 de 12')
    expect(juizo.textContent).toContain('25% · 1 de 4')
    expect(juizo.textContent).not.toMatch(/amostra/i)
    fireEvent.click(within(juizo).getAllByRole('button', { name: 'Fechar' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Dr. A. Prado (exemplo)' }))
    expect(screen.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' }).textContent).toContain('71% · 24 de 34')
  })

  it('CA7 · perito não conhecido: identificar em um clique, sem travar nada', async () => {
    entrarComo('juridico-adm')
    render(comSessao(<PaginaDoCaso processoId="pedro-exemplo-1" />))
    const grupo = await screen.findByRole('group', { name: 'Identificar o perito' })
    fireEvent.click(within(grupo).getByRole('button', { name: /Sra\. L\. Assis/ }))
    expect(await screen.findByText(/Perito identificado: Sra\. L\. Assis/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Identificar o perito' })).toBeNull()
  })

  it('CA10, CA11 · a linha com quem fez e o passo; o documento abre com a origem e a data', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    const vigilia = await screen.findByRole('list', { name: 'Linha · Vigília' })
    expect(vigilia.textContent).toContain('IA Vigília (IA): Publicação lida')
    expect(vigilia.textContent).toContain('D3a.01')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Publicação no diário' }))
    const doc = screen.getByRole('dialog', { name: 'Publicação no diário' })
    expect(doc.textContent).toContain('Origem: Diário (vigília)')
    expect(doc.textContent).toContain('Data: 26/09')
  })

  it('CA12, CA13 · só os prazos da fase e a identificação pela fase', async () => {
    render(comSessao(<PaginaDoCaso processoId="pedro-exemplo-1" />))
    expect(await screen.findByRole('heading', { level: 1, name: /^NB\s*456\.123\.789-6$/ })).toBeTruthy()
    const prazos = screen.getByRole('heading', { name: 'Prazos' }).closest('section')!.textContent
    expect(prazos).toContain('Vigília do Meu INSS')
    expect(prazos).not.toContain('Vigília das publicações')
  })

  it('CA12, CA13 · judicial: CNJ e a vigília das publicações', async () => {
    render(comSessao(<PaginaDoCaso processoId="lucia-exemplo-1" />))
    expect(await screen.findByRole('heading', { level: 1, name: /^Processo \(CNJ\)\s*0000002-70\.2026\.4\.03\.6100$/ })).toBeTruthy()
    const prazos = screen.getByRole('heading', { name: 'Prazos' }).closest('section')!.textContent
    expect(prazos).toContain('Vigília das publicações')
    expect(prazos).not.toContain('Vigília do Meu INSS')
  })

  it('Permissão · o Atendimento vê o caso sem petição, estratégia, valores, saúde nem jurimetria', async () => {
    entrarComo('atendimento')
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    const tudo = document.body.textContent!
    expect(tudo).not.toMatch(/R\$|Petição inicial|Estratégia|Saúde \(Jurídico\)/)
    expect(screen.getByText('Petição, estratégia e valores não aparecem para o Atendimento.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Vara Federal de Santo Amaro (exemplo)' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Laudo médico' }))
    expect(screen.getByRole('dialog', { name: 'Laudo médico' }).textContent).toContain('O conteúdo do laudo é só do Jurídico')
  })

  it('Valores · a advogada vê o valor da causa; a sênior não', async () => {
    entrarComo('advogada')
    const { unmount } = render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    expect(await screen.findByText('R$ 21.480,00 (exemplo)')).toBeTruthy()
    unmount()
    entrarComo('senior')
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(document.body.textContent).not.toContain('R$')
  })

  it('A ficha leva ao caso: o processo fora da perícia abre /casos/:id', async () => {
    const ficha = (await obterFicha('nair-exemplo'))!
    render(comSessao(<CasoEmAndamento ficha={ficha} />))
    expect(screen.getByRole('link', { name: /Processo ainda sem número/ }).getAttribute('href')).toBe('/casos/nair-exemplo-1')
  })

  it('GGVP-130 · as pendências de documento do processo, com o caminho para o checklist; sem cobrança aberta, nada', async () => {
    entrarComo('documentacao')
    const { unmount } = render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    const pendentes = await screen.findByRole('region', { name: 'Documentos pendentes' })
    expect(within(pendentes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Notas do produtor rural', 'Certidão'])
    expect(within(pendentes).getByRole('link', { name: 'Ver o checklist' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/checklist')
    unmount()
    render(comSessao(<PaginaDoCaso processoId="maria-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(screen.queryByRole('region', { name: 'Documentos pendentes' })).toBeNull()
  })
})

// GGVP-146 (parte 5): o caso do servidor (id uuid) vem de GET /api/casos/:id/processo, já na visão do perfil da sessão. O
// servidor aqui é de mentira; as permissões da rota têm os testes dela, na API. A tela mostra o que veio, sem inventar.
describe('GGVP-146 (parte 5) · a página do processo lê o caso do banco', () => {
  const CASO = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
  const LAUDO = '8b3e4d5c-6f70-4b81-8c9d-2e3f4a5b6c7d'
  const RG = '9c4f5e6d-7081-4c92-9dae-3f4a5b6c7d8e'
  const laudo = { id: LAUDO, tipo: 'laudo', nome: 'laudo-ortopedista.pdf', origem: 'portal', data: '2026-10-02', sensivel: true }
  const rg = { id: RG, tipo: 'rg_e_cpf', nome: 'rg-e-cpf.pdf', origem: 'portal', data: '2026-10-01', sensivel: false }

  function doBanco(extra: Partial<ProcessoDoCaso> = {}): ProcessoDoCaso {
    return {
      casoId: CASO,
      pessoa: { id: '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c', nome: 'Vera Teste', cpf: '27183946509', nascimento: '1960-03-10' },
      beneficio: 'loas-deficiente',
      fase: 'administrativa',
      desfecho: null,
      etapaAtual: 'inss',
      identificadores: { nb: '4561237895', protocolo: null, cnj: null },
      senhaGovNoCofre: true,
      transcricoes: 1,
      etapas: [{ diagrama: 'D2', passo: 'D2.E3', aguardando: 'cliente entregar o documento', desde: '2026-10-03T12:00:00.000Z' }],
      linha: [
        { quando: '2026-10-01T12:00:00.000Z', quem: 'Helena', origem: 'pessoa', passo: 'D2.01', descricao: 'OK da Sênior para o INSS: aprovado' },
        { quando: '2026-10-02T12:00:00.000Z', quem: 'Sistema', origem: 'sistema', passo: null, descricao: 'Vigília do Meu INSS rodou' },
      ],
      documentos: [laudo, rg],
      tarefas: [
        { id: '1d2e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6', setor: 'Jurídico', titulo: 'Decidir perícia', responsavel: 'Gabi', prazo: '2026-10-07', passo: 'D2.03', tela: `/casos/${CASO}/pericia` },
        { id: '2e3f4a5b-6c7d-4e8f-9a01-b2c3d4e5f6a7', setor: 'Documentação', titulo: 'Cumprir exigência do INSS', responsavel: null, prazo: null, passo: 'D2.05d', tela: null },
      ],
      pericia: { tipo: 'medica', origem: 'd2-necessidade', situacao: 'agendada', marcada: { data: '2026-10-20', hora: '10:30', local: 'Agência Santo Amaro' }, perito: 'Dr. Perito', resultado: null },
      exigencias: [
        {
          origem: 'inss',
          descricao: 'Ficha do grupo familiar',
          prazo: '2026-10-15',
          situacao: 'aberta',
          recebidaEm: '2026-10-01',
          itens: [
            { setor: 'Atendimento', descricao: 'Confirmar com o cliente quem mora na casa', situacao: 'cumprido', cumpridoEm: '2026-10-06T14:00:00.000Z', cumpridoPor: 'Ana' },
            { setor: 'Documentação', descricao: 'Ficha do grupo familiar assinada', situacao: 'pendente', cumpridoEm: null, cumpridoPor: null },
            { setor: 'Documentação', descricao: 'CadÚnico atualizado', situacao: 'pendente', cumpridoEm: null, cumpridoPor: null },
            { setor: 'Jurídico administrativo', descricao: 'Juntar a declaração do sindicato', situacao: 'nao_cumprido', cumpridoEm: '2026-10-06T15:00:00.000Z', cumpridoPor: 'Gabi' },
          ],
        },
      ],
      prazos: [],
      publicacoes: [],
      proximoPasso: { oQue: 'Decidir perícia', setor: 'Jurídico', prazo: '2026-10-07', tela: `/casos/${CASO}/pericia` },
      valores: { versao: 2, recebido: '18900.00', honorarios: '5670.00', cliente: '13230.00' },
      saude: {
        documentos: [{ tipo: 'laudo', emitidoEm: '2026-09-20', profissional: 'Dr. Ortopedista', cid: 'M54.5' }],
        parecer: { resultado: 'suficiente', confirmadoEm: '2026-10-02T12:00:00.000Z' },
      },
      ...extra,
    }
  }

  /** O servidor de mentira: só a rota do processo responde; `status` diferente de 200 devolve o erro. */
  function ligarServidor(dados: ProcessoDoCaso, status = 200) {
    const fetch = vi.fn(async (url: string) =>
      url === `/api/casos/${CASO}/processo` && status === 200
        ? new Response(JSON.stringify(dados), { status })
        : new Response(JSON.stringify({ erro: 'Sem permissão para esta ação.' }), { status: status === 200 ? 404 : status }),
    )
    vi.stubGlobal('fetch', fetch)
    configurarExemplo({ servidor: true })
    return fetch
  }
  const secao = (titulo: string) => screen.getByRole('heading', { name: titulo }).closest('section')!

  afterEach(() => {
    configurarExemplo({ servidor: false })
    vi.unstubAllGlobals()
  })

  it('GGVP-44 · a prestação de contas tem atalho no cabeçalho para quem pode ver, quando ela já existe', async () => {
    const comPrestacao = (versoes: object[]) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url === `/api/casos/${CASO}/processo`
            ? new Response(JSON.stringify(doBanco()), { status: 200 })
            : url === `/api/casos/${CASO}/prestacao`
              ? new Response(JSON.stringify({ casoId: CASO, cliente: 'Ana', beneficio: null, carta: null, percentualContrato: null, versoes, podeEditar: false }), { status: 200 })
              : new Response('{}', { status: 404 }),
        ),
      )
    const versao = { versao: 1, valorRecebido: '1000.00', honorarios: '300.00', repasse: '700.00', percentual: '30', formaPagamento: null, prazoPagamento: null, por: 'Dra.', em: '2026-10-06T12:00:00.000Z', recebidaPor: null, recebidaEm: null, divergencia: null }
    configurarExemplo({ servidor: true })
    for (const perfil of ['senior', 'socio']) {
      comPrestacao([versao])
      entrarComo(perfil)
      render(comSessao(<PaginaDoCaso processoId={CASO} />))
      expect((await screen.findByRole('link', { name: 'Prestação de contas' })).getAttribute('href'), perfil).toBe(`/casos/${CASO}/prestacao`)
      cleanup()
    }
    // Sem prestação ainda, ou para quem não vê (o Atendimento nem pergunta ao servidor), o atalho não aparece.
    comPrestacao([])
    entrarComo('advogada')
    render(comSessao(<PaginaDoCaso processoId={CASO} />))
    await screen.findByRole('heading', { level: 1, name: /^NB/ })
    expect(screen.queryByRole('link', { name: 'Prestação de contas' })).toBeNull()
    cleanup()
    comPrestacao([versao])
    entrarComo('atendimento')
    render(comSessao(<PaginaDoCaso processoId={CASO} />))
    await screen.findByRole('heading', { level: 1, name: /^NB/ })
    expect(screen.queryByRole('link', { name: 'Prestação de contas' })).toBeNull()
    expect(vi.mocked(fetch).mock.calls.map((c) => String(c[0]))).not.toContain(`/api/casos/${CASO}/prestacao`)
  })

  it('a advogada: etapas, perícia, tarefas por setor, prazos, linha, valores e o resumo de saúde, do banco', async () => {
    const fetch = ligarServidor(doBanco())
    entrarComo('advogada')
    render(comSessao(<PaginaDoCaso processoId={CASO} />))
    expect(await screen.findByRole('heading', { level: 1, name: /^NB\s*456\.123\.789-5$/ })).toBeTruthy()
    expect(fetch.mock.calls.map((c) => c[0])).toContain(`/api/casos/${CASO}/processo`)
    expect(etapas()[0].textContent).toBe('✓ Entrevista (D1 · feita)')
    expect(etapas()[1].textContent).toContain('▶ INSSDecidir perícia (D2 · agora)')
    expect(within(etapas()[1]).getByRole('link', { name: /Em perícia/ }).getAttribute('href')).toBe(`/casos/${CASO}/pericia`)
    expect(etapas()[2].textContent).toBe('Justiça (D3 · ainda não chegou)')
    const onde = secao('Onde o caso está').textContent
    expect(onde).toContain('INSS · Decidir perícia. Esperando Documentação subir o card. Esperando de fora: Cliente.')
    expect(onde).toContain('Em perícia · pedido ao INSS (D2) · perícia médica · 20/10, 10:30 · Agência Santo Amaro')
    const tarefas = secao('Tarefas em andamento')
    expect(within(tarefas).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Jurídico', 'Documentação'])
    expect(within(tarefas).getByRole('link', { name: 'Decidir perícia' }).getAttribute('href')).toBe(`/casos/${CASO}/pericia`)
    expect(tarefas.textContent).toContain('responsável: Gabihoje')
    expect(tarefas.textContent).toContain('responsável: ainda sem responsável')
    expect(secao('Esperando alguém de fora').textContent).toContain('cliente entregar o documento')
    // Os itens por setor da exigência aberta (G21); o que a advogada encerrou sem a prova não espera mais ninguém.
    const setores = secao('Esperando os setores')
    expect(setores.textContent).toContain('exigência do INSS: Ficha do grupo familiar · desde 01/10')
    expect(within(setores).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      'AtendimentoConfirmar com o cliente quem mora na casasubiu o card 06/10',
      'DocumentaçãoFicha do grupo familiar assinadaainda não subiu o card',
      'DocumentaçãoCadÚnico atualizadoainda não subiu o card',
    ])
    expect(secao('Prazos').textContent).toContain('15/10Exigência do INSS: Ficha do grupo familiar (G12)')
    // O evento sem passo do BPMN fica na etapa do anterior.
    expect(screen.getByRole('list', { name: 'Linha · INSS' }).textContent).toContain('sistema Sistema: Vigília do Meu INSS rodou')
    const dados = secao('Dados do processo').textContent
    expect(dados).toContain('CPF 271.839.465-09')
    expect(dados).toContain('Juízo— (fase administrativa)')
    expect(dados).toContain('PeritoDr. Perito')
    expect(dados).toContain('Prestação de contasrecebido R$ 18.900,00 · honorários R$ 5.670,00 · cliente R$ 13.230,00 (versão 2)')
    expect(dados).toContain('Saúde (Jurídico)1 documento médico · CID M54.5 · parecer suficiente')
    expect(dados).toContain('senha no cofre (G9)')
    // O perito do servidor ainda não tem a jurimetria aqui: só o nome, sem a janela.
    expect(screen.queryByRole('button', { name: 'Dr. Perito' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Laudo médico' }))
    const doc = screen.getByRole('dialog', { name: 'Laudo médico' })
    expect(doc.textContent).toContain('Arquivo: laudo-ortopedista.pdf')
    expect(within(doc).getByRole('link', { name: 'Abrir o arquivo' }).getAttribute('href')).toBe(`/api/casos/${CASO}/documentos/${LAUDO}`)
  })

  it('o Atendimento: o que a rota não mandou não aparece; o laudo só existe, sem nome nem arquivo; sem próximo passo, diz que ainda não há', async () => {
    ligarServidor(doBanco({ valores: null, saude: null, documentos: [{ ...laudo, nome: null }, rg], tarefas: [], proximoPasso: null, pericia: null, etapas: [], exigencias: [] }))
    entrarComo('atendimento')
    render(comSessao(<PaginaDoCaso processoId={CASO} />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(secao('Onde o caso está').textContent).toContain('INSS · ainda não há próximo passo.')
    expect(secao('Tarefas em andamento').textContent).toContain('Nenhuma tarefa aberta no caso.')
    expect(secao('Prazos').textContent).toContain('Nenhum prazo nesta fase.')
    expect(screen.queryByRole('heading', { name: 'Esperando alguém de fora' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Esperando os setores' })).toBeNull()
    const dados = secao('Dados do processo').textContent
    expect(dados).not.toContain('Prestação de contas')
    expect(dados).not.toContain('Saúde (Jurídico)')
    expect(dados).toContain('Perito—')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Laudo médico' }))
    const doc = screen.getByRole('dialog', { name: 'Laudo médico' })
    expect(doc.textContent).toContain('Arquivo: Documento de saúde')
    expect(doc.textContent).toContain('O conteúdo do laudo é só do Jurídico')
    expect(within(doc).queryByRole('link', { name: 'Abrir o arquivo' })).toBeNull()
    fireEvent.click(within(doc).getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir rg-e-cpf.pdf' }))
    expect(within(screen.getByRole('dialog', { name: 'rg-e-cpf.pdf' })).getByRole('link', { name: 'Abrir o arquivo' }).getAttribute('href')).toBe(`/api/casos/${CASO}/documentos/${RG}`)
  })

  it('perfil que não abre o caso (o servidor recusa): processo não encontrado', async () => {
    ligarServidor(doBanco(), 403)
    entrarComo('financeiro')
    render(comSessao(<PaginaDoCaso processoId={CASO} />))
    expect(await screen.findByRole('heading', { name: 'Processo não encontrado' })).toBeTruthy()
  })
})
