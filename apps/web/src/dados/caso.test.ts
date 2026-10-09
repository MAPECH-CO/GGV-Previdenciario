import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { descreverDocumento, identificarPerito, jurimetriaDoJuizoDoCaso, obterCaso, perfilDoPeritoDoCaso } from './caso.ts'
import { configurarExemplo, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 7, 10, 0)

const ADVOGADA = { id: 'advogada', usuario: 'Dra. Paula (exemplo)' }
const ATENDIMENTO = { id: 'atendimento', usuario: 'Ana (exemplo)' }
const JURIDICO_ADM = { id: 'juridico-adm', usuario: 'Igor (exemplo)' }
const FINANCEIRO = { id: 'financeiro', usuario: 'Marcos (exemplo)' }
const SENIOR = { id: 'senior', usuario: 'Dra. Renata (exemplo)' }

beforeEach(() => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

const estados = (c: Awaited<ReturnType<typeof obterCaso>>) => Object.fromEntries(c!.etapas.map((e) => [e.id, e.estado]))

describe('GGVP-86 · navegar pelo caso numa linha só', () => {
  it('CA1 · as cinco etapas em sequência, a atual em destaque e as que não se aplicam apagadas', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(antonio!.etapas.map((e) => e.rotulo)).toEqual(['Entrevista', 'INSS', 'Justiça', 'Vigília', 'Desfecho'])
    expect(estados(antonio)).toEqual({ entrevista: 'feita', inss: 'feita', justica: 'feita', vigilia: 'atual', desfecho: 'futura' })
    // Deferido no INSS: Justiça, vigília e desfecho do mérito não se aplicam.
    expect(estados(await obterCaso('marta-exemplo-1', ADVOGADA))).toEqual({
      entrevista: 'feita',
      inss: 'atual',
      justica: 'nao-se-aplica',
      vigilia: 'nao-se-aplica',
      desfecho: 'nao-se-aplica',
    })
    expect(estados(await obterCaso('nair-exemplo-1', ATENDIMENTO)).entrevista).toBe('atual')
  })

  it('CA2 · perícia em andamento: o bloco "Em perícia" fica na etapa que pediu e leva à página da perícia', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(antonio!.emPericia).toMatchObject({ etapa: 'vigilia', href: '/casos/antonio-exemplo-1/pericia' })
    expect(antonio!.emPericia!.rotulo).toContain('pedido do juiz (D3a)')
    const maria = await obterCaso('maria-exemplo-1', ADVOGADA)
    expect(maria!.emPericia).toMatchObject({ etapa: 'inss', responsavel: 'Igor (exemplo)' })
    expect((await obterCaso('nair-exemplo-1', ADVOGADA))!.emPericia).toBeUndefined()
  })

  it('CA3 · os setores que ainda não subiram o card', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(antonio!.pendentes!.setores).toEqual(['Documentação', 'Perícia'])
    expect(antonio!.pendentes!.itens.find((l) => l.setor === 'Atendimento')!.subiu!.quem).toBe('Ana (exemplo)')
    expect((await obterCaso('maria-exemplo-1', ADVOGADA))!.pendentes).toBeNull()
  })

  it('CA4 · cada etapa feita traz quem fez, quando e os documentos daquele passo', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    const entrevista = antonio!.etapas.find((e) => e.id === 'entrevista')!
    expect(entrevista.eventos.length).toBeGreaterThan(0)
    expect(entrevista.eventos.every((e) => e.quem && e.quando)).toBe(true)
    expect(entrevista.documentos).toContain('contrato-zapsign.pdf')
  })

  it('CA5 · laudo novo não conferido: a data e o caminho até a análise do laudo', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ATENDIMENTO)
    expect(antonio!.laudoNovo).toEqual({ data: '2026-09-29', href: '/casos/antonio-exemplo-1/laudo-novo' })
    expect((await obterCaso('maria-exemplo-1', ADVOGADA))!.laudoNovo).toBeUndefined()
  })

  it('CA6 · perito e juízo identificados: a jurimetria vem do código, com o número de casos e sem amostra mínima', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(antonio!.juizo!.nome).toBe('Vara Federal de Santo Amaro (exemplo)')
    expect(antonio!.perito!.id).toBe('a-prado')
    const j = jurimetriaDoJuizoDoCaso('vf-santo-amaro')!
    expect(j.numeros.casos).toBe(24)
    expect(j.numeros.porBeneficio.find((b) => b.beneficio === 'incapacidade-permanente')!.texto).toMatch(/^58% · 7 de 12 casos · base de \d\d\/\d\d$/)
    // Quatro casos também mostram número: não há amostra mínima (Lucas, 06/10).
    expect(j.numeros.porBeneficio.find((b) => b.beneficio === 'loas-deficiente')!.texto).toMatch(/^25% · 1 de 4 casos · base de \d\d\/\d\d$/)
    expect(j.processos.map((p) => p.cliente)).toContain('Antônio Exemplo')
    expect(perfilDoPeritoDoCaso('r-menezes')!.jurimetria.laudos).toBe(6)
  })

  it('CA7 · perito não conhecido: a pergunta de um clique, e nada trava', async () => {
    const pedro = await obterCaso('pedro-exemplo-1', JURIDICO_ADM)
    expect(pedro!.perito).toBeUndefined()
    expect(pedro!.peritoParaIdentificar!.opcoes.map((p) => p.id)).toContain('l-assis')
    const ligado = await identificarPerito('pedro-exemplo-1', 'l-assis', JURIDICO_ADM)
    expect(ligado!.perito!.id).toBe('l-assis')
    expect(ligado!.peritoParaIdentificar).toBeUndefined()
  })

  it('CA8 · esperando alguém de fora: quem, desde quando e o prazo ou o lembrete', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(antonio!.esperas[0]).toMatchObject({ quem: 'cliente', desde: '2026-09-26', prazo: '2026-10-09' })
    expect(antonio!.esperas.some((e) => e.quem === 'justica' && e.lembrete)).toBe(true)
    const pedro = await obterCaso('pedro-exemplo-1', ADVOGADA)
    expect(pedro!.esperas.map((e) => e.quem)).toContain('inss')
  })

  it('CA9 · as tarefas por setor, inclusive as paralelas, e a perícia aberta com responsável e prazo', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    const setores = antonio!.tarefas.map((t) => t.setor)
    expect(setores).toEqual(expect.arrayContaining(['Documentação', 'Jurídico', 'Jurídico administrativo']))
    expect(antonio!.tarefas.every((t) => t.responsavel)).toBe(true)
    expect(antonio!.tarefas.filter((t) => t.paralela).length).toBeGreaterThan(1)
    const pericia = antonio!.tarefas.find((t) => t.href === '/casos/antonio-exemplo-1/pericia')!
    expect(pericia.prazoFalado).toBeDefined()
  })

  it('CA10 · a linha traz data, quem fez (pessoa, sistema ou IA), a descrição e o passo, em ordem', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    const linha = antonio!.linha
    expect(linha.map((e) => e.quando)).toEqual([...linha.map((e) => e.quando)].sort())
    expect(new Set(linha.map((e) => e.tipo))).toEqual(new Set(['pessoa', 'sistema', 'ia']))
    expect(linha.every((e) => e.passo && e.oQue)).toBe(true)
    // A perícia entra na mesma linha.
    expect(linha.some((e) => e.passo === 'DP.01')).toBe(true)
  })

  it('CA11 · o documento aberto pelo caso mostra a origem e a data; o laudo, sem conteúdo para o Atendimento', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ATENDIMENTO)
    const laudo = antonio!.documentos.find((d) => d.tipo === 'laudo')!
    const visto = descreverDocumento(laudo, 'atendimento', '2026-10-07')
    expect(visto.linhas).toEqual(expect.arrayContaining(['Origem: Chat', 'Data: 28/09']))
    expect(visto.aviso).toContain('só do Jurídico')
    expect(descreverDocumento(laudo, 'juridico', '2026-10-07').aviso).toBeUndefined()
  })

  it('CA12 · só os prazos da fase', async () => {
    const antonio = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(antonio!.prazos.map((p) => p.tipo)).not.toContain('vigilia-meu-inss')
    expect(antonio!.prazos.map((p) => p.tipo)).toContain('vigilia-publicacoes')
    const pedro = await obterCaso('pedro-exemplo-1', ADVOGADA)
    expect(pedro!.prazos.map((p) => p.tipo)).toContain('vigilia-meu-inss')
    expect(pedro!.prazos.map((p) => p.tipo)).not.toContain('vigilia-publicacoes')
  })

  it('CA13 · NB ou protocolo na fase administrativa, CNJ com processo judicial', async () => {
    expect((await obterCaso('pedro-exemplo-1', ADVOGADA))!.identificacao).toEqual({ rotulo: 'NB', valor: '456.123.789-6' })
    expect((await obterCaso('maria-exemplo-1', ADVOGADA))!.identificacao).toEqual({ rotulo: 'Protocolo', valor: '1.802.334.556 (exemplo)' })
    expect((await obterCaso('lucia-exemplo-1', ADVOGADA))!.identificacao).toEqual({ rotulo: 'Processo (CNJ)', valor: '0000002-70.2026.4.03.6100' })
    expect((await obterCaso('antonio-exemplo-1', ADVOGADA))!.identificacao.rotulo).toBe('Processo (CNJ)')
  })

  it('Permissão · o Atendimento vê o caso sem petição, estratégia, valores nem dado de saúde', async () => {
    const juridico = await obterCaso('antonio-exemplo-1', ADVOGADA)
    expect(juridico!.valores.map((v) => v.tipo)).toEqual(['causa'])
    expect(juridico!.estrategia).toBeDefined()
    expect(juridico!.saude).toBeDefined()
    expect(juridico!.linha.some((e) => e.restrito)).toBe(true)
    expect(juridico!.documentos.some((d) => d.tipo === 'peticao')).toBe(true)

    const atendimento = await obterCaso('antonio-exemplo-1', ATENDIMENTO)
    expect(atendimento!.valores).toEqual([])
    expect(atendimento!.estrategia).toBeUndefined()
    expect(atendimento!.saude).toBeUndefined()
    expect(atendimento!.linha.some((e) => e.restrito)).toBe(false)
    expect(atendimento!.documentos.some((d) => d.tipo === 'peticao')).toBe(false)
    expect(JSON.stringify(atendimento)).not.toMatch(/peti[cç][aã]o inicial|R\$/i)

    const financeiro = await obterCaso('lucia-exemplo-1', FINANCEIRO)
    expect(financeiro!.valores.map((v) => v.tipo)).toEqual(['causa', 'prestacao-de-contas'])
    expect(financeiro!.estrategia).toBeUndefined()
  })

  it('Valores · a advogada vê a causa, a renda por pessoa do LOAS e a prestação de contas do caso dela; a sênior não vê', async () => {
    expect((await obterCaso('lucia-exemplo-1', ADVOGADA))!.valores.map((v) => v.tipo)).toEqual(['causa', 'prestacao-de-contas'])
    expect((await obterCaso('lucia-exemplo-1', { id: 'advogada', usuario: 'Outra advogada' }))!.valores.map((v) => v.tipo)).toEqual(['causa'])
    expect((await obterCaso('pedro-exemplo-1', ADVOGADA))!.valores.map((v) => v.tipo)).toEqual(['renda-por-pessoa'])
    expect((await obterCaso('lucia-exemplo-1', SENIOR))!.valores).toEqual([])
    expect((await obterCaso('lucia-exemplo-1', JURIDICO_ADM))!.valores).toEqual([])
  })

  it('Processo que não existe: nada', async () => {
    expect(await obterCaso('nao-existe', ADVOGADA)).toBeNull()
  })
})

describe('GGVP-78 · o caso do servidor aberto direto pela lista de Processos', () => {
  const CASO = '8b3e4c0a-5d6f-4e70-8b82-93a415c6d7e8'
  const CLIENTE = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
  const ficha = {
    id: CLIENTE,
    situacao: 'cliente',
    desde: '10/2026',
    nome: 'Renato Dias (exemplo)',
    telefone: '',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [{ id: CASO, beneficio: 'loas-deficiente', etapa: 'Judicial' }],
    agendamentos: [],
    contatos: [],
    documentos: [],
    arquivos: [],
    transcricoes: 0,
    historico: [],
  }
  function servidor(rotas: Record<string, unknown>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url in rotas ? new Response(JSON.stringify(rotas[url]), { status: 200 }) : new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 }))),
    )
    configurarExemplo({ servidor: true })
  }
  afterEach(() => {
    configurarExemplo({ servidor: false })
    vi.unstubAllGlobals()
  })

  it('sem a ficha na cópia daqui, acha o cliente pelo caso, traz a ficha e monta o processo', async () => {
    servidor({ [`/api/processos?caso=${CASO}`]: { processos: [{ id: CASO, clienteId: CLIENTE }] }, [`/api/fichas/${CLIENTE}`]: ficha })
    expect((await obterCaso(CASO, ADVOGADA))?.ficha.nome).toBe('Renato Dias (exemplo)')
  })

  it('caso que o servidor não tem: nada', async () => {
    servidor({ [`/api/processos?caso=${CASO}`]: { processos: [] } })
    expect(await obterCaso(CASO, ADVOGADA)).toBeNull()
  })
})
