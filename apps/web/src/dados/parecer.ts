// EXEMPLO. Servidor de exemplo do parecer de suficiência da documentação médica (GGVP-20), sobre o mesmo banco de
// servidor.ts. A análise é calculada dos documentos médicos do caso (os que a leitura da GGVP-95 classificou e os da semente
// do Sebastião e do Antônio); quando eles mudam, nasce uma análise nova com o roteiro em vigor (GGVP-93). A IA é simulada.
// O parecer só vale com o registro de uma pessoa do Jurídico (G17). Ligar no servidor: trocar o corpo de cada função por
// fetch no endpoint da design (seção GGVP-20); o perfil e o nome vêm da sessão.
import { isoParaData } from '../campos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { ehMedico } from '../regras/leitura.ts'
import { precisaDeParecer, type Parecer } from '../regras/liberacao.ts'
import {
  NOMES_DO_PARECER,
  abaixoDe24Meses,
  abordarSugerido,
  analisar,
  motivoParaNaoRegistrar,
  mudancas,
  situacaoFinal,
  type Conferidos,
  type ItemAnalisado,
  type LeituraMedica,
  type SituacaoDoItem,
  type SituacaoDoParecer,
  type Sugestao,
} from '../regras/parecer.ts'
import { emVigor, type ItemDoRoteiro, type Roteiro } from '../regras/roteiro.ts'
import { semAcento } from '../regras/busca.ts'
import { nomeBeneficio, nomeTipo } from './catalogos.ts'
import { abrirComplemento, encerrarComplemento } from './complemento.ts'
import { leiturasDo } from './leitura.ts'
import { roteiroDoCaso } from './roteiro.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

// Contrato (vai para packages/contratos/pareceres.ts quando o GGVP-118 existir).

/** Um documento médico que a análise leu. `resumo` é conteúdo clínico: só o Jurídico recebe. */
export type DocumentoAnalisado = {
  id: string
  tipo: string
  /** aaaa-mm-dd */
  data: string
  emitente?: string
  resumo?: string
  /** Os itens do roteiro que a IA achou neste documento. */
  cobre?: string[]
}

export type RoteiroUsado = { id: string; nome: string; versao: number }

export type AnaliseDaIA = {
  /** Data e hora ISO. */
  quando: string
  /** Sem roteiro: a conferência é manual (GGVP-93, CA3). */
  roteiro?: RoteiroUsado
  documentos: DocumentoAnalisado[]
  itens: ItemAnalisado[]
  /** Os complementares do roteiro, para o pedido ao médico na contradição. */
  complementares: string[]
  sugestao: Sugestao
  /** O que mudou desde a análise anterior (CA4). */
  mudou: string[]
  /** Os documentos lidos: quando mudam, nasce outra análise. */
  assinatura: string
}

/** O item como a advogada conferiu (CA3). */
export type ItemRegistrado = Pick<ItemAnalisado, 'id' | 'tipo' | 'texto' | 'pergunta'> & { situacao: SituacaoDoItem; corrigido: boolean }

export type RegistroDoParecer = {
  situacao: SituacaoDoParecer
  quem: string
  /** Data e hora ISO. */
  quando: string
  /** A versão do roteiro da análise conferida (GGVP-93, CA2 e CA4). */
  roteiro?: RoteiroUsado
  itens: ItemRegistrado[]
  /** O que o documento deve abordar (G20), no Insuficiente e no Contraditório. */
  abordar?: string
  /** Sem roteiro: o que a advogada conferiu (GGVP-93, CA3). */
  conferenciaManual?: string
  /** aaaa-mm-dd do laudo novo que este registro conferiu (CA6). */
  laudoNovo?: string
  /** O `quando` da análise conferida. */
  analise: string
}

export type ParecerDoCaso = { processoId: string; fichaId: string; analises: AnaliseDaIA[]; registros: RegistroDoParecer[] }

/** A comparação do laudo novo com o último laudo (Figma 2087:2). Só o Jurídico recebe. */
export type Comparacao = {
  anterior?: DocumentoAnalisado
  novo: DocumentoAnalisado
  linhas: { rotulo: string; anterior: string; novo: string; mudou: boolean }[]
  resumo: string[]
  /** Diante do roteiro (resposta do Lucas, 01/10): o que o laudo novo passa a cobrir e o que ainda falta. */
  passaACobrir: string[]
  aindaFalta: string[]
}

export type Visao = 'juridico' | 'atendimento'

export type SituacaoNaTela = SituacaoDoParecer | 'pendente' | 'sem-documentos'

/** O parecer como a tela recebe. `juridico` só vem para o Jurídico: o resto não tem conteúdo clínico. */
export type ParecerNaTela = {
  ficha: Pick<Ficha, 'id' | 'nome'>
  processo: Processo
  beneficio: string
  /** O benefício está na matriz de laudos (G17). */
  precisaParecer: boolean
  roteiro?: RoteiroUsado
  semRoteiro: boolean
  situacao: SituacaoNaTela
  /** Quando a IA sugeriu, na análise conferida ou na mais nova. */
  sugeridoEm?: string
  confirmado?: { quem: string; quando: string }
  /** aaaa-mm-dd do laudo novo que espera a conferência (CA6). */
  laudoNovoEm?: string
  /** Tipo, data e emitente: nunca o conteúdo. */
  documentos: Omit<DocumentoAnalisado, 'resumo' | 'cobre'>[]
  /** O que falta pedir ao cliente e ao médico, depois do Insuficiente ou do Contraditório. */
  faltaPedir: string[]
  abordar?: string
  historico: { situacao: SituacaoDoParecer; quem: string; quando: string; roteiro?: RoteiroUsado }[]
  juridico?: {
    analise?: AnaliseDaIA
    registro?: RegistroDoParecer
    /** A análise é mais nova que o último registro: a advogada ainda não conferiu. */
    pendente: boolean
    comparacao?: Comparacao
    abordarSugerido: string
  }
}

/** "Registrar parecer" (CA3, CA8; GGVP-93 CA3). */
export type PedidoDeParecer = {
  /** O `quando` da análise que a tela mostrou: se mudou, a tela abre de novo. */
  analise: string
  conferidos: Conferidos
  decisao: 'suficiente' | 'insuficiente'
  abordar?: string
  conferenciaManual?: string
}

export type QuemRegistra = { perfil?: string; nome: string }

/** Advogada e sênior: o Jurídico, que vê o conteúdo clínico e registra o parecer. */
export const doJuridico = (perfil: string | undefined) => perfil === 'advogada' || perfil?.startsWith('senior') === true

// A IA simulada.

type Lido = { pagina: number; trecho: string }
type DocumentoDaSemente = Omit<DocumentoAnalisado, 'cobre'> & { cobre: Record<string, Lido>; contradiz?: Record<string, Lido>; datas?: { inicio: string; cessacao?: string } }

const t = (pagina: number, trecho: string): Lido => ({ pagina, trecho: `(exemplo) ${trecho}` })

/** Os documentos médicos da semente, que não passaram pela leitura do portal: o Sebastião do Figma 1654:2 e o Antônio do 2087:2. */
const DOCUMENTOS_DA_SEMENTE: Record<string, DocumentoDaSemente[]> = {
  'sebastiao-exemplo-1': [
    {
      id: 'semente/sebastiao/cat-2024-03',
      tipo: 'cat',
      data: '2024-03-15',
      emitente: 'Empresa Exemplo Ltda',
      resumo: 'comunicação do acidente de trabalho',
      cobre: { acidente: t(1, 'Acidente de trabalho em 15/03/2024: queda na linha de produção.'), nexo: t(1, 'Acidente durante a função, no local de trabalho.') },
    },
    { id: 'semente/sebastiao/exames', tipo: 'exame', data: '2025-02-10', emitente: 'Laboratório Exemplo', resumo: 'exames de imagem · tornozelo direito', cobre: {} },
    {
      id: 'semente/sebastiao/laudo-2025-05',
      tipo: 'laudo',
      data: '2025-05-06',
      emitente: 'Dr. Ortopedista Exemplo',
      resumo: 'pós-cirúrgico',
      cobre: { tratamentos: t(1, 'Cirurgia em 04/2024; afastado por 120 dias, com fisioterapia.') },
    },
    {
      id: 'semente/sebastiao/laudo-2025-07',
      tipo: 'laudo',
      data: '2025-07-08',
      emitente: 'Dr. Ortopedista Exemplo',
      resumo: 'consolidação da lesão',
      cobre: { consolidacao: t(1, 'Lesão consolidada em 07/2025, sem tratamento em curso.') },
    },
    {
      id: 'semente/sebastiao/laudo-2025-09',
      tipo: 'laudo',
      data: '2025-09-10',
      emitente: 'Dr. Ortopedista Exemplo',
      resumo: 'sequela consolidada, redução da capacidade',
      cobre: {
        sequela: t(1, 'Sequela definitiva: limitação do movimento do tornozelo direito.'),
        repercussao: t(2, 'Redução da capacidade para a função habitual de auxiliar de produção.'),
        lesao: t(1, 'Fratura do tornozelo direito; acidente em 15/03/2024.'),
      },
    },
  ],
  'antonio-exemplo-1': [
    {
      id: 'semente/antonio/laudo-2025-11',
      tipo: 'laudo',
      data: '2025-11-12',
      emitente: 'Dr. Almeida Exemplo · ortopedia',
      resumo: 'coluna lombar',
      cobre: { tratamentos: t(1, 'Fisioterapia e medicação desde 2024, sem melhora.') },
    },
    {
      id: 'semente/antonio/laudo-2026-04',
      tipo: 'laudo',
      data: '2026-04-15',
      emitente: 'Dr. Almeida Exemplo · ortopedia',
      resumo: 'piora do quadro',
      cobre: { prognostico: t(1, 'Quadro crônico e progressivo.') },
    },
    {
      id: 'semente/antonio/laudo-2026-09-18',
      tipo: 'laudo',
      data: '2026-09-18',
      emitente: 'Dr. Almeida Exemplo · ortopedia',
      resumo: 'incapacidade para o trabalho rural',
      cobre: {
        total: t(1, 'Sem condições para atividade que garanta o sustento.'),
        reabilitacao: t(2, 'Sem possibilidade de reabilitação para outra atividade.'),
        condicoes: t(2, '62 anos, trabalhador rural, ensino fundamental incompleto.'),
      },
    },
    {
      id: 'semente/antonio/laudo-2026-09-29',
      tipo: 'laudo',
      data: '2026-09-29',
      emitente: 'Dr. Prado Exemplo · ortopedia',
      resumo: 'ressonância magnética de 22/09; limitação para dirigir',
      cobre: {
        total: t(1, 'Mantém: sem condições para atividade que garanta o sustento.'),
        prognostico: t(1, 'Quadro degenerativo, sem expectativa de melhora; ressonância de 22/09.'),
        condicoes: t(2, 'Trabalhador rural de 62 anos; não dirige mais.'),
      },
    },
  ],
}

/** A comparação do laudo novo do Antônio, como no Figma 2087:2 (dados de exemplo). */
const COMPARACAO_DO_ANTONIO: Pick<Comparacao, 'linhas' | 'resumo'> = {
  linhas: [
    { rotulo: 'Emitido por', anterior: 'Dr. Almeida Exemplo · ortopedia', novo: 'Dr. Prado Exemplo · ortopedia', mudou: false },
    { rotulo: 'Exames citados', anterior: 'Raio-X de coluna lombar', novo: 'Raio-X de coluna lombar e ressonância magnética (22/09)', mudou: true },
    { rotulo: 'CID informado', anterior: 'M54.5 · G56.0 (exemplo)', novo: 'M54.5 · G56.0 (os mesmos)', mudou: false },
    { rotulo: 'Limitações descritas', anterior: 'Carregar peso e ficar em pé por muito tempo', novo: 'Carregar peso, ficar em pé e dirigir', mudou: true },
    { rotulo: 'Conclusão do médico', anterior: 'Incapacidade permanente para o trabalho rural', novo: 'Mantém a incapacidade permanente para o trabalho rural', mudou: false },
  ],
  resumo: [
    'É mais recente que o último laudo (18/09) e traz uma ressonância magnética (22/09) que o anterior não tinha.',
    'Mantém os mesmos CIDs (M54.5 e G56.0); a IA não sugere CID novo.',
    'Cita limitação para dirigir, que o laudo anterior não citava.',
    'Não muda a conclusão do médico (incapacidade permanente).',
  ],
}

/** O laudo da pilha da Rita (GGVP-81): cobre três dos cinco itens do LOAS; o início é de 03/2019, sem cessação prevista. */
const LAUDO_DA_RITA = 'laudo medico rita exemplo'
const LEITURA_DO_LAUDO_DA_RITA: Pick<DocumentoDaSemente, 'cobre' | 'datas' | 'resumo'> = {
  resumo: 'impedimento físico de longo prazo',
  cobre: {
    natureza: t(1, 'Impedimento físico de longo prazo, com sequela motora.'),
    inicio: t(1, 'Quadro iniciado em 03/2019; persiste até hoje.'),
    limitacoes: t(2, 'Dificuldade para caminhar e para cuidar de si sem ajuda.'),
  },
  datas: { inicio: '2019-03' },
}

/** Os que cobrem os itens obrigatórios quando sobem pelo card; atestado, exame e os outros não cobrem (roteiro de laudos). */
const COBREM = ['laudo', 'relatorio-medico', 'prontuario']

/** ponytail: a contradição sai de pistas no nome do arquivo, como o tipo na GGVP-17; a IA de verdade lê o documento. */
const PISTAS_DE_CONTRADICAO: [string, string][] = [
  ['incapacidade total', 'incapacidade-total'],
  ['nao consolidada', 'nao-consolidada'],
  ['temporaria', 'temporaria'],
]

/** O que a IA simulada lê de um documento médico do card ou do scanner. */
function lerDocumento(doc: { id: string; tipo: string; arquivo: string }, itens: ItemDoRoteiro[]): Pick<DocumentoDaSemente, 'cobre' | 'contradiz' | 'datas' | 'resumo'> {
  const nome = semAcento(doc.arquivo.replace(/[_.-]+/g, ' ')).replace(/\s+/g, ' ')
  if (nome.startsWith(LAUDO_DA_RITA)) return LEITURA_DO_LAUDO_DA_RITA
  const cobre: Record<string, Lido> = {}
  if (COBREM.includes(doc.tipo) && !nome.includes('incompleto')) {
    for (const i of itens.filter((x) => x.tipo === 'obrigatorio')) cobre[i.id] = t(1, `${nomeTipo(doc.tipo)} aborda: ${i.texto.toLowerCase()}.`)
  }
  const contradiz: Record<string, Lido> = {}
  for (const [pista, id] of PISTAS_DE_CONTRADICAO) {
    const item = itens.find((i) => i.id === id && i.tipo === 'contradicao')
    if (item && nome.includes(pista)) contradiz[id] = t(1, `${nomeTipo(doc.tipo)} afirma o que contradiz o requisito: ${item.texto.toLowerCase()}.`)
  }
  return { cobre, contradiz, resumo: nomeTipo(doc.tipo).toLowerCase() }
}

const comoCitar = (d: Pick<DocumentoAnalisado, 'tipo' | 'data'>) => `${nomeTipo(d.tipo)} · ${isoParaData(d.data) ?? d.data}`

const assinaturaDe = (docs: Pick<DocumentoAnalisado, 'id' | 'tipo'>[]) =>
  docs
    .map((d) => `${d.id}:${d.tipo}`)
    .sort()
    .join('|')

/** Os documentos médicos do caso e o que a IA leu de cada um. */
function documentosMedicos(banco: Banco, ficha: Ficha, processoId: string, itens: ItemDoRoteiro[], daSemente: DocumentoDaSemente[]): { docs: DocumentoAnalisado[]; leituras: LeituraMedica[] } {
  const lidos = leiturasDo(banco).filter((l) => {
    if (l.fichaId !== ficha.id || !ehMedico(l.tipo) || (l.situacao !== 'a-conferir' && l.situacao !== 'arquivado')) return false
    const local = ficha.arquivos.find((a) => a.nome === l.arquivo)?.local
    return local === processoId || local === 'pessoais'
  })
  const docs: DocumentoDaSemente[] = [
    ...daSemente,
    ...lidos.map((l) => ({ id: l.id, tipo: l.tipo, data: l.data, ...(l.emitente && { emitente: l.emitente }), ...lerDocumento({ id: l.id, tipo: l.tipo, arquivo: l.arquivo }, itens) })),
  ].map((d) => (d.datas && itens.some((i) => i.id === 'menos-de-24-meses') && abaixoDe24Meses(d.datas.inicio, d.datas.cessacao) ? { ...d, contradiz: { ...d.contradiz, 'menos-de-24-meses': t(1, 'Início e cessação prevista com menos de 24 meses entre eles.') } } : d))
  return {
    docs: docs.map(({ id, tipo, data, emitente, resumo, cobre }) => ({ id, tipo, data, ...(emitente && { emitente }), ...(resumo && { resumo }), cobre: Object.keys(cobre) })),
    leituras: docs.map((d) => ({ documentoId: d.id, documento: comoCitar(d), data: d.data, cobre: d.cobre, contradiz: d.contradiz ?? {} })),
  }
}

/** O roteiro com laudo do benefício; régua documental (sem laudo) não entra no parecer médico. */
function roteiroComLaudo(banco: Banco, beneficio: string): Roteiro | undefined | null {
  const r = roteiroDoCaso(banco, beneficio)
  if (!r) return undefined
  return r.laudo ? r : null
}

function montarAnalise(
  banco: Banco,
  ficha: Ficha,
  processo: Processo,
  anterior: AnaliseDaIA | undefined,
  quando: string,
  daSemente = DOCUMENTOS_DA_SEMENTE[processo.id] ?? [],
): AnaliseDaIA | undefined {
  const roteiro = roteiroComLaudo(banco, processo.beneficio)
  if (roteiro === null) return undefined
  const versao = roteiro && emVigor(roteiro)
  const itensDoRoteiro = versao?.itens ?? []
  const { docs, leituras } = documentosMedicos(banco, ficha, processo.id, itensDoRoteiro, daSemente)
  if (docs.length === 0) return undefined
  const assinatura = assinaturaDe(docs)
  if (anterior?.assinatura === assinatura) return anterior
  const { itens, sugestao } = analisar(itensDoRoteiro, leituras)
  const novos = anterior ? docs.filter((d) => !anterior.documentos.some((a) => a.id === d.id)).map(comoCitar) : []
  return {
    quando,
    ...(roteiro && versao && { roteiro: { id: roteiro.id, nome: roteiro.nome, versao: versao.versao } }),
    documentos: docs,
    itens,
    complementares: itensDoRoteiro.filter((i) => i.tipo === 'complementar').map((i) => i.texto),
    sugestao: roteiro ? sugestao : 'sem-roteiro',
    mudou: mudancas(anterior?.itens, itens, novos),
    assinatura,
  }
}

const registrar = (a: AnaliseDaIA, quem: string, quando: string, situacao: SituacaoDoParecer): RegistroDoParecer => ({
  situacao,
  quem,
  quando,
  ...(a.roteiro && { roteiro: a.roteiro }),
  itens: a.itens.map(({ id, tipo, texto, pergunta, situacao: s }) => ({ id, tipo, texto, ...(pergunta && { pergunta }), situacao: s, corrigido: false })),
  analise: a.quando,
})

/** A semente: o Sebastião (Suficiente, Dra. Paula, 15/07, Figma 1654:2) e o Antônio (Suficiente em 20/09; laudo novo de 29/09). */
function semear(banco: Banco): ParecerDoCaso[] {
  const pareceres: ParecerDoCaso[] = []
  const caso = (fichaId: string, processoId: string) => {
    const ficha = banco.fichas.find((f) => f.id === fichaId)
    const processo = ficha?.processos.find((p) => p.id === processoId)
    return ficha && processo ? { ficha, processo } : undefined
  }
  const sebastiao = caso('sebastiao-exemplo', 'sebastiao-exemplo-1')
  if (sebastiao) {
    const analise = montarAnalise(banco, sebastiao.ficha, sebastiao.processo, undefined, new Date('2026-07-14T10:00:00').toISOString())!
    pareceres.push({
      processoId: 'sebastiao-exemplo-1',
      fichaId: 'sebastiao-exemplo',
      analises: [analise],
      registros: [registrar(analise, 'Dra. Paula', new Date('2026-07-15T11:00:00').toISOString(), 'suficiente')],
    })
  }
  const antonio = caso('antonio-exemplo', 'antonio-exemplo-1')
  if (antonio) {
    // A análise de 19/09 leu os três laudos; a de 29/09, o laudo novo também.
    const tresLaudos = DOCUMENTOS_DA_SEMENTE['antonio-exemplo-1'].slice(0, 3)
    const antes = montarAnalise(banco, antonio.ficha, antonio.processo, undefined, new Date('2026-09-19T09:00:00').toISOString(), tresLaudos)!
    const depois = montarAnalise(banco, antonio.ficha, antonio.processo, antes, new Date('2026-09-29T16:00:00').toISOString())!
    pareceres.push({
      processoId: 'antonio-exemplo-1',
      fichaId: 'antonio-exemplo',
      analises: [antes, depois],
      registros: [registrar(antes, 'Dra. Paula', new Date('2026-09-20T10:00:00').toISOString(), 'suficiente')],
    })
  }
  return pareceres
}

export const pareceresDo = (banco: Banco): ParecerDoCaso[] => (banco.pareceres ??= semear(banco))

function acharCaso(banco: Banco, processoId: string) {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return ficha && processo ? { ficha, processo } : null
}

/** O parecer do caso com a análise em dia: se os documentos mudaram, nasce a análise nova (CA4). */
function emDia(banco: Banco, ficha: Ficha, processo: Processo): ParecerDoCaso {
  const pareceres = pareceresDo(banco)
  let p = pareceres.find((x) => x.processoId === processo.id)
  if (!p) {
    p = { processoId: processo.id, fichaId: ficha.id, analises: [], registros: [] }
    pareceres.push(p)
  }
  const anterior = p.analises.at(-1)
  const atual = montarAnalise(banco, ficha, processo, anterior, agora().toISOString())
  if (atual && atual !== anterior) p.analises.push(atual)
  return p
}

/** O laudo novo que espera a conferência do Jurídico (GGVP-17, CA6): do processo, ou da ficha no primeiro processo. */
const laudoNovoDo = (ficha: Ficha, processo: Processo) => processo.laudoNovoEm ?? (ficha.processos[0]?.id === processo.id ? ficha.laudoNovoEm : undefined)

/** A comparação do laudo novo com o último laudo antes dele (CA6, CA7). */
function comparar(p: ParecerDoCaso, laudoNovoEm: string): Comparacao | undefined {
  const analise = p.analises.at(-1)
  if (!analise) return undefined
  const laudos = analise.documentos.filter((d) => COBREM.includes(d.tipo)).sort((a, b) => a.data.localeCompare(b.data))
  const novo = [...laudos].reverse().find((d) => d.data >= laudoNovoEm) ?? laudos.at(-1)
  if (!novo) return undefined
  const anterior = [...laudos].reverse().find((d) => d.data < novo.data)
  // O que os outros documentos do caso já cobriam: o laudo novo "passa a cobrir" só o resto (resposta do Lucas, 01/10).
  const cobria = new Set(analise.documentos.filter((d) => d.id !== novo.id).flatMap((d) => d.cobre ?? []))
  const obrigatorios = analise.itens.filter((i) => i.tipo === 'obrigatorio')
  const passaACobrir = obrigatorios.filter((i) => novo.cobre?.includes(i.id) && !cobria.has(i.id)).map((i) => i.texto)
  const aindaFalta = obrigatorios.filter((i) => i.situacao !== 'presente').map((i) => i.texto)
  const hoje = hojeIso(agora())
  const seed = p.processoId === 'antonio-exemplo-1' && novo.id === 'semente/antonio/laudo-2026-09-29' ? COMPARACAO_DO_ANTONIO : undefined
  const cobertos = (doc?: DocumentoAnalisado) => (doc ? `${doc.cobre?.length ?? 0} de ${obrigatorios.length}` : '—')
  return {
    ...(anterior && { anterior }),
    novo,
    linhas: seed?.linhas ?? [
      { rotulo: 'Emitido por', anterior: anterior?.emitente ?? '—', novo: novo.emitente ?? 'não lido', mudou: false },
      { rotulo: 'Data do documento', anterior: anterior ? (isoParaData(anterior.data) ?? '') : '—', novo: isoParaData(novo.data) ?? '', mudou: false },
      { rotulo: 'Itens obrigatórios do roteiro que aborda', anterior: cobertos(anterior), novo: cobertos(novo), mudou: passaACobrir.length > 0 },
    ],
    resumo: seed?.resumo ?? [
      anterior ? `É mais recente que o último laudo (${dataCurta(anterior.data, hoje)}).` : 'É o primeiro laudo do caso.',
      passaACobrir.length > 0 ? `Passa a cobrir: ${passaACobrir.join('; ')}.` : 'Não cobre item do roteiro que os documentos anteriores não cobriam.',
      aindaFalta.length > 0 ? `Ainda falta: ${aindaFalta.join('; ')}.` : 'Com ele, todos os itens obrigatórios do roteiro estão cobertos.',
      'A IA só compara o que está nos documentos: não sugere CID, grau nem conclusão.',
    ],
    passaACobrir,
    aindaFalta,
  }
}

const quandoCurto = (iso: string) => hojeIso(new Date(iso))

function naTela(banco: Banco, ficha: Ficha, processo: Processo, p: ParecerDoCaso, visao: Visao): ParecerNaTela {
  const analise = p.analises.at(-1)
  const registro = p.registros.at(-1)
  const laudoNovoEm = laudoNovoDo(ficha, processo)
  const roteiro = registro?.roteiro ?? analise?.roteiro
  const situacao: SituacaoNaTela = registro?.situacao ?? (analise ? 'pendente' : 'sem-documentos')
  const comFalta = registro && registro.situacao !== 'suficiente'
  const tela: ParecerNaTela = {
    ficha: { id: ficha.id, nome: ficha.nome },
    processo,
    beneficio: nomeBeneficio(processo.beneficio),
    precisaParecer: precisaDeParecer(processo.beneficio),
    ...(roteiro && { roteiro }),
    semRoteiro: roteiroComLaudo(banco, processo.beneficio) === undefined,
    situacao,
    ...((registro || analise) && { sugeridoEm: registro ? registro.analise : analise!.quando }),
    ...(registro && { confirmado: { quem: registro.quem, quando: registro.quando } }),
    ...(laudoNovoEm && { laudoNovoEm }),
    documentos: (analise?.documentos ?? []).map(({ id, tipo, data, emitente }) => ({ id, tipo, data, ...(emitente && { emitente }) })),
    faltaPedir: comFalta ? registro.itens.filter((i) => i.tipo === 'obrigatorio' && i.situacao !== 'presente').map((i) => i.pergunta ?? i.texto) : [],
    ...(comFalta && registro.abordar && { abordar: registro.abordar }),
    historico: p.registros.map(({ situacao: s, quem, quando, roteiro: r }) => ({ situacao: s, quem, quando, ...(r && { roteiro: r }) })),
  }
  if (visao !== 'juridico') return tela
  const comparacao = laudoNovoEm ? comparar(p, laudoNovoEm) : undefined
  return {
    ...tela,
    juridico: {
      ...(analise && { analise }),
      ...(registro && { registro }),
      pendente: analise !== undefined && registro?.analise !== analise.quando,
      ...(comparacao && { comparacao }),
      abordarSugerido: analise ? abordarSugerido(analise.itens, analise.complementares) : '',
    },
  }
}

/** GET /api/processos/:id/parecer, na visão do perfil da sessão. */
export async function obterParecer(processoId: string, visao: Visao): Promise<ParecerNaTela | null> {
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return null
  const p = emDia(banco, caso.ficha, caso.processo)
  gravar(banco)
  return naTela(banco, caso.ficha, caso.processo, p, visao)
}

/** POST /api/processos/:id/parecer. Só o Jurídico; valida de novo; a IA nunca registra (CA3, CA8, G17, G18, G20). */
export async function registrarParecer(processoId: string, pedido: PedidoDeParecer, quem: QuemRegistra): Promise<ParecerNaTela> {
  await esperar()
  if (!doJuridico(quem.perfil)) throw new Error('Só o Jurídico registra o parecer médico.')
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const { ficha, processo } = caso
  const p = emDia(banco, ficha, processo)
  const analise = p.analises.at(-1)
  if (!analise) throw new Error('Não há documento médico para analisar.')
  if (analise.quando !== pedido.analise) throw new Error('Chegou documento novo e a análise mudou: abra a tela de novo.')
  const semRoteiro = analise.sugestao === 'sem-roteiro'
  const abordar = pedido.abordar?.trim() ?? ''
  const conferenciaManual = pedido.conferenciaManual?.trim() ?? ''
  const motivo = motivoParaNaoRegistrar({ itens: analise.itens, conferidos: pedido.conferidos, decisao: pedido.decisao, abordar, semRoteiro, conferenciaManual })
  if (motivo) throw new Error(motivo)

  const quando = agora().toISOString()
  const situacao = situacaoFinal(analise.itens, pedido.conferidos, pedido.decisao)
  const laudoNovoEm = laudoNovoDo(ficha, processo)
  const anterior = p.registros.at(-1)
  const registro: RegistroDoParecer = {
    ...registrar(analise, quem.nome, quando, situacao),
    itens: analise.itens.map(({ id, tipo, texto, pergunta, situacao: s }) => ({
      id,
      tipo,
      texto,
      ...(pergunta && { pergunta }),
      situacao: pedido.conferidos[id]!,
      corrigido: pedido.conferidos[id] !== s,
    })),
    ...(situacao !== 'suficiente' && { abordar }),
    ...(semRoteiro && { conferenciaManual }),
    ...(laudoNovoEm && { laudoNovo: laudoNovoEm }),
  }
  p.registros.push(registro)
  const corrigidos = registro.itens.filter((i) => i.corrigido).length
  ficha.historico.push(
    evento(
      `Registrou o parecer médico do ${nomeBeneficio(processo.beneficio)}: ${NOMES_DO_PARECER[situacao]} (G17)${corrigidos > 0 ? `; corrigiu ${corrigidos} ${corrigidos === 1 ? 'item' : 'itens'} da IA` : ''}`,
      quem.nome,
    ),
  )
  // O laudo novo foi conferido: sai a marca da ficha e do processo, e a tarefa (CA6).
  if (laudoNovoEm) {
    processo.laudoNovoEm = undefined
    if (ficha.processos[0]?.id === processo.id) ficha.laudoNovoEm = undefined
    for (const tarefa of banco.tarefas.filter((x) => x.processoId === processo.id && x.acao === 'Analisar laudo novo')) tarefa.concluida = true
    const manteve = anterior?.situacao === situacao ? 'manteve' : 'refez'
    ficha.historico.push(evento(`Conferiu o laudo novo de ${dataCurta(laudoNovoEm, hojeIso(agora()))} e ${manteve} o parecer`, quem.nome))
  }
  // Insuficiente ou Contraditório abre a pendência de complemento; Suficiente encerra a que estava aberta (CA5).
  if (situacao === 'suficiente') encerrarComplemento(banco, processoId, quando)
  else
    abrirComplemento(banco, {
      processoId,
      fichaId: ficha.id,
      abertaEm: quando,
      parecer: situacao,
      abordar,
      perguntas: registro.itens.filter((i) => i.tipo === 'obrigatorio' && i.situacao !== 'presente').map((i) => i.pergunta ?? i.texto),
      quem: quem.nome,
    })
  gravar(banco)
  return naTela(banco, ficha, processo, p, 'juridico')
}

/** O parecer para o portão (G17): o último registro; com análise e sem registro, "pendente" (sem confirmação humana). */
export function parecerParaOPortao(banco: Banco, processoId: string): Parecer | undefined {
  const caso = acharCaso(banco, processoId)
  if (!caso) return undefined
  const p = emDia(banco, caso.ficha, caso.processo)
  const registro = p.registros.at(-1)
  if (registro) return { situacao: registro.situacao, quem: registro.quem, data: quandoCurto(registro.quando) }
  return p.analises.length > 0 ? { situacao: 'pendente' } : undefined
}

/** A documentação médica na ficha do Atendimento: o resultado e quem confirmou, nunca o conteúdo. */
export function resumoParaAFicha(fichaId: string): string | undefined {
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) return undefined
  const partes = ficha.processos.flatMap((processo) => {
    const p = emDia(banco, ficha, processo)
    const analise = p.analises.at(-1)
    if (!analise) return []
    const registro = p.registros.at(-1)
    const n = analise.documentos.length
    const docs = `${n} ${n === 1 ? 'documento médico' : 'documentos médicos'}`
    const parecer = registro
      ? `parecer "${NOMES_DO_PARECER[registro.situacao]}" confirmado por ${registro.quem} em ${dataCurta(quandoCurto(registro.quando), hojeIso(agora()))} (G17)`
      : 'parecer aguardando a conferência do Jurídico (G17)'
    return [`${docs} · ${parecer}`]
  })
  gravar(banco)
  return partes.length > 0 ? `${partes.join('. ')}. O conteúdo dos laudos não é exibido aqui.` : undefined
}

/** "Analisar laudo novo" e "Dar parecer médico" na Central da Advogada, nascidos do caso. */
export function tarefasDoParecer(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = banco.fichas.flatMap((ficha) =>
    ficha.processos.flatMap((processo): Tarefa[] => {
      const p = emDia(banco, ficha, processo)
      const analise = p.analises.at(-1)
      if (!analise) return []
      const beneficio = nomeBeneficio(processo.beneficio)
      const laudoNovoEm = laudoNovoDo(ficha, processo)
      if (laudoNovoEm) {
        // A tarefa que o envio pelo card já criou (GGVP-17) vale; a da semente nasce aqui.
        if (banco.tarefas.some((x) => x.processoId === processo.id && x.acao === 'Analisar laudo novo' && !x.concluida)) return []
        return [
          {
            id: `laudo-novo-${processo.id}`,
            codigo: 'D1.21M',
            cliente: { id: ficha.id, nome: ficha.nome },
            acao: 'Analisar laudo novo',
            detalhe: `${beneficio} · enviado pelo Atendimento em ${dataCurta(laudoNovoEm, hoje)} · resumo e comparação da IA prontos`,
            prazo: 'hoje',
            urgente: true,
            href: `/casos/${processo.id}/laudo-novo`,
            processoId: processo.id,
          },
        ]
      }
      if (p.registros.at(-1)?.analise === analise.quando) return []
      return [
        {
          id: `parecer-${processo.id}`,
          codigo: 'D1.21M',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Dar parecer médico',
          detalhe: `${beneficio} · ${analise.sugestao === 'sem-roteiro' ? 'benefício sem roteiro: conferência manual' : `a IA sugere ${NOMES_DO_PARECER[analise.sugestao]}`} · confira item a item (G17)`,
          prazo: 'hoje',
          href: `/casos/${processo.id}/parecer`,
          processoId: processo.id,
        },
      ]
    }),
  )
  gravar(banco)
  return tarefas
}
