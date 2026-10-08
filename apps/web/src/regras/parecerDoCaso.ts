// O parecer do caso (GGVP-20, GGVP-33): a análise dos documentos médicos com o roteiro em vigor, o registro da pessoa do
// Jurídico, a comparação do laudo novo e o que cada perfil vê. Regra pura: o servidor de exemplo e o servidor de verdade
// (GGVP-132) usam a mesma. A IA ainda é simulada (pistas no nome do arquivo); a de verdade é da GGVP-134.
import { isoParaData } from '../campos.ts'
import { nomeBeneficio, nomeTipo } from '../dados/catalogos.ts'
import type { Ficha, Processo, Tarefa } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'
import { dataCurta, hojeIso } from './datas.ts'
import { precisaDeParecer, type Parecer } from './liberacao.ts'
import {
  abaixoDe24Meses,
  abordarSugerido,
  analisar,
  NOMES_DO_PARECER,
  motivoParaNaoRegistrar,
  mudancas,
  situacaoFinal,
  type Conferidos,
  type Dispensa,
  type ItemAnalisado,
  type LeituraMedica,
  type SituacaoDoItem,
  type SituacaoDoParecer,
  type Sugestao,
} from './parecer.ts'
import { emVigor, type ItemDoRoteiro, type Roteiro } from './roteiro.ts'

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

export type ParecerDoCaso = {
  processoId: string
  fichaId: string
  analises: AnaliseDaIA[]
  registros: RegistroDoParecer[]
  /** Os pedidos de dispensa do parecer, do primeiro ao último (GGVP-33). */
  dispensas?: Dispensa[]
}

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

/** As linhas e o resumo prontos de um laudo da semente (o do Antônio, no Figma 2087:2). */
export type ModeloDeComparacao = Pick<Comparacao, 'linhas' | 'resumo'> & { documentoId: string }

export type Visao = 'juridico' | 'atendimento'

export type SituacaoNaTela = SituacaoDoParecer | 'pendente' | 'sem-documentos' | 'dispensado'

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
  /** O último pedido de dispensa (GGVP-33): a justificativa e as duas sêniores aparecem no card (CA2). */
  dispensa?: Dispensa
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

// A IA simulada (até a GGVP-134).

export type Lido = { pagina: number; trecho: string }

/** Um documento médico com o que a IA leu nele. */
export type DocumentoLido = Omit<DocumentoAnalisado, 'cobre'> & { cobre: Record<string, Lido>; contradiz?: Record<string, Lido>; datas?: { inicio: string; cessacao?: string } }

export const lido = (pagina: number, trecho: string): Lido => ({ pagina, trecho: `(exemplo) ${trecho}` })

/** O laudo da pilha da Rita (GGVP-81): cobre três dos cinco itens do LOAS; o início é de 03/2019, sem cessação prevista. */
const LAUDO_DA_RITA = 'laudo medico rita exemplo'
const LEITURA_DO_LAUDO_DA_RITA: Pick<DocumentoLido, 'cobre' | 'datas' | 'resumo'> = {
  resumo: 'impedimento físico de longo prazo',
  cobre: {
    natureza: lido(1, 'Impedimento físico de longo prazo, com sequela motora.'),
    inicio: lido(1, 'Quadro iniciado em 03/2019; persiste até hoje.'),
    limitacoes: lido(2, 'Dificuldade para caminhar e para cuidar de si sem ajuda.'),
  },
  datas: { inicio: '2019-03' },
}

/** Os que cobrem os itens obrigatórios quando sobem pelo card; atestado, exame e os outros não cobrem (roteiro de laudos). */
export const COBREM = ['laudo', 'relatorio-medico', 'prontuario']

/** ponytail: a contradição sai de pistas no nome do arquivo, como o tipo na GGVP-17; a IA de verdade lê o documento. */
const PISTAS_DE_CONTRADICAO: [string, string][] = [
  ['incapacidade total', 'incapacidade-total'],
  ['nao consolidada', 'nao-consolidada'],
  ['sem reducao', 'sem-reducao'],
  ['temporaria', 'temporaria'],
]

/** O que a IA simulada lê de um documento médico do card ou do scanner. */
export function lerDocumentoSimulado(doc: { tipo: string; arquivo: string }, itens: ItemDoRoteiro[]): Pick<DocumentoLido, 'cobre' | 'contradiz' | 'datas' | 'resumo'> {
  const nome = semAcento(doc.arquivo.replace(/[_.-]+/g, ' ')).replace(/\s+/g, ' ')
  if (nome.startsWith(LAUDO_DA_RITA)) return LEITURA_DO_LAUDO_DA_RITA
  const cobre: Record<string, Lido> = {}
  if (COBREM.includes(doc.tipo) && !nome.includes('incompleto')) {
    for (const i of itens.filter((x) => x.tipo === 'obrigatorio')) cobre[i.id] = lido(1, `${nomeTipo(doc.tipo)} aborda: ${i.texto.toLowerCase()}.`)
  }
  const contradiz: Record<string, Lido> = {}
  for (const [pista, id] of PISTAS_DE_CONTRADICAO) {
    const item = itens.find((i) => i.id === id && i.tipo === 'contradicao')
    if (item && nome.includes(pista)) contradiz[id] = lido(1, `${nomeTipo(doc.tipo)} afirma o que contradiz o requisito: ${item.texto.toLowerCase()}.`)
  }
  return { cobre, contradiz, resumo: nomeTipo(doc.tipo).toLowerCase() }
}

export const comoCitar = (d: Pick<DocumentoAnalisado, 'tipo' | 'data'>) => `${nomeTipo(d.tipo)} · ${isoParaData(d.data) ?? d.data}`

const assinaturaDe = (docs: Pick<DocumentoAnalisado, 'id' | 'tipo'>[]) =>
  docs
    .map((d) => `${d.id}:${d.tipo}`)
    .sort()
    .join('|')

/** O roteiro com laudo; a régua documental (sem laudo) não entra no parecer médico: null. Sem roteiro: undefined. */
export const comLaudo = (r: Roteiro | undefined): Roteiro | undefined | null => (!r ? undefined : r.laudo ? r : null)

/** A análise dos documentos com o roteiro em vigor; a mesma de antes se os documentos não mudaram (CA4). */
export function montarAnalise(roteiro: Roteiro | undefined | null, lidos: DocumentoLido[], anterior: AnaliseDaIA | undefined, quando: string): AnaliseDaIA | undefined {
  if (roteiro === null) return undefined
  const versao = roteiro && emVigor(roteiro)
  const itensDoRoteiro = versao?.itens ?? []
  const docs = lidos.map((d) =>
    d.datas && itensDoRoteiro.some((i) => i.id === 'menos-de-24-meses') && abaixoDe24Meses(d.datas.inicio, d.datas.cessacao)
      ? { ...d, contradiz: { ...d.contradiz, 'menos-de-24-meses': lido(1, 'Início e cessação prevista com menos de 24 meses entre eles.') } }
      : d,
  )
  if (docs.length === 0) return undefined
  const documentos: DocumentoAnalisado[] = docs.map(({ id, tipo, data, emitente, resumo, cobre }) => ({ id, tipo, data, ...(emitente && { emitente }), ...(resumo && { resumo }), cobre: Object.keys(cobre) }))
  const assinatura = assinaturaDe(documentos)
  if (anterior?.assinatura === assinatura) return anterior
  const leituras: LeituraMedica[] = docs.map((d) => ({ documentoId: d.id, documento: comoCitar(d), data: d.data, cobre: d.cobre, contradiz: d.contradiz ?? {} }))
  const { itens, sugestao } = analisar(itensDoRoteiro, leituras)
  const novos = anterior ? documentos.filter((d) => !anterior.documentos.some((a) => a.id === d.id)).map(comoCitar) : []
  return {
    quando,
    ...(roteiro && versao && { roteiro: { id: roteiro.id, nome: roteiro.nome, versao: versao.versao } }),
    documentos,
    itens,
    complementares: itensDoRoteiro.filter((i) => i.tipo === 'complementar').map((i) => i.texto),
    sugestao: roteiro ? sugestao : 'sem-roteiro',
    mudou: mudancas(anterior?.itens, itens, novos),
    assinatura,
  }
}

/** O registro que confirma a análise como a IA sugeriu (a semente usa). */
export const registrar = (a: AnaliseDaIA, quem: string, quando: string, situacao: SituacaoDoParecer): RegistroDoParecer => ({
  situacao,
  quem,
  quando,
  ...(a.roteiro && { roteiro: a.roteiro }),
  itens: a.itens.map(({ id, tipo, texto, pergunta, situacao: s }) => ({ id, tipo, texto, ...(pergunta && { pergunta }), situacao: s, corrigido: false })),
  analise: a.quando,
})

/** "Registrar parecer": confere de novo e monta o registro da pessoa; o motivo quando não pode (CA3, CA8, G17, G18, G20). */
export function registroDoPedido(
  analise: AnaliseDaIA | undefined,
  pedido: PedidoDeParecer,
  quem: string,
  quando: string,
  laudoNovoEm?: string,
): { motivo: string } | { registro: RegistroDoParecer } {
  if (!analise) return { motivo: 'Não há documento médico para analisar.' }
  if (analise.quando !== pedido.analise) return { motivo: 'Chegou documento novo e a análise mudou: abra a tela de novo.' }
  const semRoteiro = analise.sugestao === 'sem-roteiro'
  const abordar = pedido.abordar?.trim() ?? ''
  const conferenciaManual = pedido.conferenciaManual?.trim() ?? ''
  const motivo = motivoParaNaoRegistrar({ itens: analise.itens, conferidos: pedido.conferidos, decisao: pedido.decisao, abordar, semRoteiro, conferenciaManual })
  if (motivo) return { motivo }
  const situacao = situacaoFinal(analise.itens, pedido.conferidos, pedido.decisao)
  return {
    registro: {
      ...registrar(analise, quem, quando, situacao),
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
    },
  }
}

/** As perguntas ao médico dos itens obrigatórios que ficaram faltando no registro (GGVP-29, CA1). */
export const perguntasQueFaltam = (r: RegistroDoParecer) => r.itens.filter((i) => i.tipo === 'obrigatorio' && i.situacao !== 'presente').map((i) => i.pergunta ?? i.texto)

/** A comparação do laudo novo com o último laudo antes dele (CA6, CA7). */
export function comparar(p: ParecerDoCaso, laudoNovoEm: string, hoje: string, modelo?: ModeloDeComparacao): Comparacao | undefined {
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
  const pronto = modelo?.documentoId === novo.id ? modelo : undefined
  const cobertos = (doc?: DocumentoAnalisado) => (doc ? `${doc.cobre?.length ?? 0} de ${obrigatorios.length}` : '—')
  return {
    ...(anterior && { anterior }),
    novo,
    linhas: pronto?.linhas ?? [
      { rotulo: 'Emitido por', anterior: anterior?.emitente ?? '—', novo: novo.emitente ?? 'não lido', mudou: false },
      { rotulo: 'Data do documento', anterior: anterior ? (isoParaData(anterior.data) ?? '') : '—', novo: isoParaData(novo.data) ?? '', mudou: false },
      { rotulo: 'Itens obrigatórios do roteiro que aborda', anterior: cobertos(anterior), novo: cobertos(novo), mudou: passaACobrir.length > 0 },
    ],
    resumo: pronto?.resumo ?? [
      anterior ? `É mais recente que o último laudo (${dataCurta(anterior.data, hoje)}).` : 'É o primeiro laudo do caso.',
      passaACobrir.length > 0 ? `Passa a cobrir: ${passaACobrir.join('; ')}.` : 'Não cobre item do roteiro que os documentos anteriores não cobriam.',
      aindaFalta.length > 0 ? `Ainda falta: ${aindaFalta.join('; ')}.` : 'Com ele, todos os itens obrigatórios do roteiro estão cobertos.',
      'A IA só compara o que está nos documentos: não sugere CID, grau nem conclusão.',
    ],
    passaACobrir,
    aindaFalta,
  }
}

/** A dispensa aprovada mais nova que o último registro: vale até um parecer registrado depois dela (GGVP-33, CA5). */
export function dispensaEmVigor(p: ParecerDoCaso): Dispensa | undefined {
  const d = p.dispensas?.at(-1)
  const registro = p.registros.at(-1)
  return d?.aprovadaEm && (!registro || d.aprovadaEm > registro.quando) ? d : undefined
}

/** O parecer na visão do perfil: sem `juridico`, nenhum conteúdo clínico (GGVP-96 CA12). */
export function naTela(d: {
  ficha: Pick<Ficha, 'id' | 'nome'>
  processo: Processo
  p: ParecerDoCaso
  visao: Visao
  semRoteiro: boolean
  laudoNovoEm?: string
  hoje: string
  modelo?: ModeloDeComparacao
}): ParecerNaTela {
  const { ficha, processo, p, laudoNovoEm } = d
  const analise = p.analises.at(-1)
  const registro = p.registros.at(-1)
  const roteiro = registro?.roteiro ?? analise?.roteiro
  const situacao: SituacaoNaTela = dispensaEmVigor(p) ? 'dispensado' : (registro?.situacao ?? (analise ? 'pendente' : 'sem-documentos'))
  const dispensa = p.dispensas?.at(-1)
  const comFalta = registro && registro.situacao !== 'suficiente'
  const tela: ParecerNaTela = {
    ficha: { id: ficha.id, nome: ficha.nome },
    processo,
    beneficio: nomeBeneficio(processo.beneficio),
    precisaParecer: precisaDeParecer(processo.beneficio),
    ...(roteiro && { roteiro }),
    semRoteiro: d.semRoteiro,
    situacao,
    ...((registro || analise) && { sugeridoEm: registro ? registro.analise : analise!.quando }),
    ...(registro && { confirmado: { quem: registro.quem, quando: registro.quando } }),
    ...(laudoNovoEm && { laudoNovoEm }),
    documentos: (analise?.documentos ?? []).map(({ id, tipo, data, emitente }) => ({ id, tipo, data, ...(emitente && { emitente }) })),
    faltaPedir: comFalta ? perguntasQueFaltam(registro) : [],
    ...(comFalta && registro.abordar && { abordar: registro.abordar }),
    historico: p.registros.map(({ situacao: s, quem, quando, roteiro: r }) => ({ situacao: s, quem, quando, ...(r && { roteiro: r }) })),
    ...(dispensa && { dispensa }),
  }
  if (d.visao !== 'juridico') return tela
  const comparacao = laudoNovoEm ? comparar(p, laudoNovoEm, d.hoje, d.modelo) : undefined
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

/** O que a IA viu no documento novo que chegou depois do pedido de complemento, em perguntas (GGVP-29; resposta do Lucas, Q4). */
export type PreviaDoComplemento = { documentos: string[]; respondidas: string[]; faltam: string[] }

/**
 * A prévia para o Atendimento: os documentos novos (tipo e data) e quais perguntas do pedido eles já respondem. Sem conteúdo
 * clínico. A palavra final continua da advogada (G17).
 */
export function previaDoComplemento(p: ParecerDoCaso): PreviaDoComplemento | undefined {
  const pedido = [...p.registros].reverse().find((r) => r.situacao !== 'suficiente')
  const analise = p.analises.at(-1)
  if (!pedido || !analise || analise.quando === pedido.analise) return undefined
  const usada = p.analises.find((a) => a.quando === pedido.analise)
  const documentos = analise.documentos.filter((d) => !usada?.documentos.some((x) => x.id === d.id)).map(comoCitar)
  if (documentos.length === 0) return undefined
  const pedidos = pedido.itens.filter((i) => i.tipo === 'obrigatorio' && i.situacao !== 'presente')
  const situacaoAgora = new Map(analise.itens.map((i) => [i.id, i.situacao]))
  const pergunta = (i: ItemRegistrado) => i.pergunta ?? i.texto
  return {
    documentos,
    respondidas: pedidos.filter((i) => situacaoAgora.get(i.id) === 'presente').map(pergunta),
    faltam: pedidos.filter((i) => situacaoAgora.get(i.id) !== 'presente').map(pergunta),
  }
}

/** O parecer para o portão (G17): o último registro; com análise e sem registro, "pendente" (sem confirmação humana). */
export function parecerDoPortao(p: ParecerDoCaso): Parecer | undefined {
  const registro = p.registros.at(-1)
  // G18: a contradição da análise que ninguém do Jurídico conferiu ainda trava (GGVP-47, CA4); conferida, vale o registro.
  const analise = p.analises.at(-1)
  const contradicoes = analise && analise.quando !== registro?.analise ? analise.itens.filter((i) => i.situacao === 'contraditorio').map(({ id, texto }) => ({ id, texto })) : []
  const g18 = contradicoes.length > 0 ? { contradicoes } : {}
  const dispensa = dispensaEmVigor(p)
  const dia = (iso: string) => hojeIso(new Date(iso))
  if (dispensa) return { situacao: 'dispensado', quem: `${dispensa.pedidaPor} e ${dispensa.aprovadaPor}`, data: dia(dispensa.aprovadaEm!), justificativa: dispensa.justificativa, ...g18 }
  if (registro) return { situacao: registro.situacao, quem: registro.quem, data: dia(registro.quando), ...g18 }
  return analise ? { situacao: 'pendente', ...g18 } : undefined
}

/**
 * As tarefas que o parecer do caso abre: "Aprovar dispensa do parecer" para a segunda sênior, "Analisar laudo novo" e
 * "Dar parecer médico" para a advogada. `cardJaAbriu`: a tarefa do laudo novo que o envio pelo card já criou (GGVP-17).
 */
export function tarefasDoCaso(d: {
  ficha: Pick<Ficha, 'id' | 'nome'>
  processo: Processo
  p: ParecerDoCaso
  laudoNovoEm?: string
  hoje: string
  cardJaAbriu?: boolean
}): Tarefa[] {
  const { ficha, processo, p, laudoNovoEm, hoje } = d
  const beneficio = nomeBeneficio(processo.beneficio)
  const cliente = { id: ficha.id, nome: ficha.nome }
  const doCaso: Tarefa[] = []
  // A dispensa da sênior esperando a segunda aprovação (GGVP-33): vale também para o caso ainda sem documento médico.
  const dispensa = p.dispensas?.at(-1)
  const esperandoDispensa = dispensa !== undefined && !dispensa.aprovadaPor && !dispensa.recusadaPor
  if (esperandoDispensa) {
    doCaso.push({
      id: `dispensa-${processo.id}`,
      codigo: 'D1.24',
      cliente,
      acao: 'Aprovar dispensa do parecer',
      detalhe: `${beneficio} · pedida por ${dispensa.pedidaPor} · a segunda aprovação é de outra sênior (G17)`,
      prazo: 'hoje',
      urgente: true,
      href: `/casos/${processo.id}/parecer/dispensa`,
      processoId: processo.id,
    })
  }
  const analise = p.analises.at(-1)
  if (!analise) return doCaso
  if (laudoNovoEm) {
    if (d.cardJaAbriu) return doCaso
    return [
      ...doCaso,
      {
        id: `laudo-novo-${processo.id}`,
        codigo: 'D1.21M',
        cliente,
        acao: 'Analisar laudo novo',
        detalhe: `${beneficio} · enviado pelo Atendimento em ${dataCurta(laudoNovoEm, hoje)} · resumo e comparação da IA prontos`,
        prazo: 'hoje',
        urgente: true,
        href: `/casos/${processo.id}/laudo-novo`,
        processoId: processo.id,
      },
    ]
  }
  if (esperandoDispensa || dispensaEmVigor(p) || p.registros.at(-1)?.analise === analise.quando) return doCaso
  return [
    {
      id: `parecer-${processo.id}`,
      codigo: 'D1.21M',
      cliente,
      acao: 'Dar parecer médico',
      detalhe: `${beneficio} · ${analise.sugestao === 'sem-roteiro' ? 'benefício sem roteiro: conferência manual' : `a IA sugere ${NOMES_DO_PARECER[analise.sugestao]}`} · confira item a item (G17)`,
      prazo: 'hoje',
      href: `/casos/${processo.id}/parecer`,
      processoId: processo.id,
    },
  ]
}

