// EXEMPLO. Servidor de exemplo do parecer de suficiência da documentação médica (GGVP-20), sobre o mesmo banco de
// servidor.ts. A análise é calculada dos documentos médicos do caso (os que a leitura da GGVP-95 classificou e os da semente
// do Sebastião e do Antônio); quando eles mudam, nasce uma análise nova com o roteiro em vigor (GGVP-93). A IA é simulada.
// A análise, o registro e a visão de cada perfil são regra pura (regras/parecerDoCaso.ts), a mesma do servidor de verdade.
// O parecer só vale com o registro de uma pessoa do Jurídico (G17). Ligar no servidor: trocar o corpo de cada função por
// fetch no endpoint da design (seção GGVP-20); o perfil e o nome vêm da sessão.
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { ehMedico } from '../regras/leitura.ts'
import type { Parecer } from '../regras/liberacao.ts'
import { NOMES_DO_PARECER, motivoParaNaoAprovarDispensa, motivoParaNaoPedirDispensa } from '../regras/parecer.ts'
import {
  comLaudo,
  dispensaEmVigor,
  doJuridico,
  lerDocumentoSimulado,
  lido,
  montarAnalise as analisarDocumentos,
  naTela as naTelaDoPerfil,
  parecerDoPortao,
  perguntasQueFaltam,
  previaDoComplemento as previaDoParecer,
  registrar,
  registroDoPedido,
  tarefasDoCaso,
  type AnaliseDaIA,
  type DocumentoLido,
  type ModeloDeComparacao,
  type ParecerDoCaso,
  type ParecerNaTela,
  type PedidoDeParecer,
  type PreviaDoComplemento,
  type QuemRegistra,
  type Visao,
} from '../regras/parecerDoCaso.ts'
import { menorDe16 } from '../regras/infantil.ts'
import { nomeBeneficio } from './catalogos.ts'
import { abrirComplemento, encerrarComplemento } from './complemento.ts'
import { leiturasDo } from './leitura.ts'
import { roteiroDoCaso } from './roteiro.ts'
import { chamarApi } from '../api.ts'
import { agora, doServidor, espelhar, esperar, evento, gravar, ler, noBanco, servidorLigado, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

export {
  doJuridico,
  type AnaliseDaIA,
  type Comparacao,
  type DocumentoAnalisado,
  type ItemRegistrado,
  type ParecerDoCaso,
  type ParecerNaTela,
  type PedidoDeParecer,
  type PreviaDoComplemento,
  type QuemRegistra,
  type RegistroDoParecer,
  type RoteiroUsado,
  type SituacaoNaTela,
  type Visao,
} from '../regras/parecerDoCaso.ts'

// A semente da IA simulada.

/** Os documentos médicos da semente, que não passaram pela leitura do portal: o Sebastião do Figma 1654:2 e o Antônio do 2087:2. */
const DOCUMENTOS_DA_SEMENTE: Record<string, DocumentoLido[]> = {
  'sebastiao-exemplo-1': [
    {
      id: 'semente/sebastiao/cat-2024-03',
      tipo: 'cat',
      data: '2024-03-15',
      emitente: 'Empresa Exemplo Ltda',
      resumo: 'comunicação do acidente de trabalho',
      cobre: { acidente: lido(1, 'Acidente de trabalho em 15/03/2024: queda na linha de produção.'), nexo: lido(1, 'Acidente durante a função, no local de trabalho.') },
    },
    { id: 'semente/sebastiao/exames', tipo: 'exame-pos-alta', data: '2025-02-10', emitente: 'Laboratório Exemplo', resumo: 'exames de imagem · tornozelo direito', cobre: {} },
    {
      id: 'semente/sebastiao/laudo-2025-05',
      tipo: 'laudo',
      data: '2025-05-06',
      emitente: 'Dr. Ortopedista Exemplo',
      resumo: 'pós-cirúrgico',
      cobre: { tratamentos: lido(1, 'Cirurgia em 04/2024; afastado por 120 dias, com fisioterapia.') },
    },
    {
      id: 'semente/sebastiao/laudo-2025-07',
      tipo: 'laudo',
      data: '2025-07-08',
      emitente: 'Dr. Ortopedista Exemplo',
      resumo: 'consolidação da lesão',
      cobre: { consolidacao: lido(1, 'Lesão consolidada em 07/2025, sem tratamento em curso.') },
    },
    {
      id: 'semente/sebastiao/laudo-2025-09',
      tipo: 'laudo',
      data: '2025-09-10',
      emitente: 'Dr. Ortopedista Exemplo',
      resumo: 'sequela consolidada, redução da capacidade',
      cobre: {
        sequela: lido(1, 'Sequela definitiva: limitação do movimento do tornozelo direito.'),
        repercussao: lido(2, 'Redução da capacidade para a função habitual de auxiliar de produção.'),
        lesao: lido(1, 'Fratura do tornozelo direito; acidente em 15/03/2024.'),
      },
    },
  ],
  // GGVP-50: o laudo da neuropediatria do Davi cobre a natureza, o início e o prognóstico; a participação e os cuidados, não.
  'davi-exemplo-1': [
    {
      id: 'semente/davi/laudo-2026-08',
      tipo: 'laudo',
      data: '2026-08-20',
      emitente: 'Dra. Exemplo Neuropediatra',
      resumo: 'acompanhamento neurológico',
      cobre: {
        natureza: lido(1, 'Impedimento de natureza física e neurológica, de longo prazo.'),
        inicio: lido(1, 'Quadro presente desde o nascimento; persiste.'),
        prognostico: lido(1, 'Quadro permanente, com acompanhamento contínuo.'),
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
      cobre: { tratamentos: lido(1, 'Fisioterapia e medicação desde 2024, sem melhora.') },
    },
    {
      id: 'semente/antonio/laudo-2026-04',
      tipo: 'laudo',
      data: '2026-04-15',
      emitente: 'Dr. Almeida Exemplo · ortopedia',
      resumo: 'piora do quadro',
      cobre: { prognostico: lido(1, 'Quadro crônico e progressivo.') },
    },
    {
      id: 'semente/antonio/laudo-2026-09-18',
      tipo: 'laudo',
      data: '2026-09-18',
      emitente: 'Dr. Almeida Exemplo · ortopedia',
      resumo: 'incapacidade para o trabalho rural',
      cobre: {
        total: lido(1, 'Sem condições para atividade que garanta o sustento.'),
        reabilitacao: lido(2, 'Sem possibilidade de reabilitação para outra atividade.'),
        condicoes: lido(2, '62 anos, trabalhador rural, ensino fundamental incompleto.'),
      },
    },
    {
      id: 'semente/antonio/laudo-2026-09-29',
      tipo: 'laudo',
      data: '2026-09-29',
      emitente: 'Dr. Prado Exemplo · ortopedia',
      resumo: 'ressonância magnética de 22/09; limitação para dirigir',
      cobre: {
        total: lido(1, 'Mantém: sem condições para atividade que garanta o sustento.'),
        prognostico: lido(1, 'Quadro degenerativo, sem expectativa de melhora; ressonância de 22/09.'),
        condicoes: lido(2, 'Trabalhador rural de 62 anos; não dirige mais.'),
      },
    },
  ],
}

/** A comparação do laudo novo do Antônio, como no Figma 2087:2 (dados de exemplo). */
const COMPARACAO_DO_ANTONIO: ModeloDeComparacao = {
  documentoId: 'semente/antonio/laudo-2026-09-29',
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

/** Os documentos médicos do caso e o que a IA leu de cada um: os da semente e os que a leitura (GGVP-95) classificou. */
function documentosMedicos(banco: Banco, ficha: Ficha, processoId: string, roteiro: ReturnType<typeof comLaudo>, daSemente: DocumentoLido[], comLeituras: boolean): DocumentoLido[] {
  const itens = roteiro ? roteiro.versoes.at(-1)!.itens : []
  const lidos = leiturasDo(banco).filter((l) => {
    if (!comLeituras) return false
    if (l.fichaId !== ficha.id || !ehMedico(l.tipo) || (l.situacao !== 'a-conferir' && l.situacao !== 'arquivado')) return false
    const local = ficha.arquivos.find((a) => a.nome === l.arquivo)?.local
    return local === processoId || local === 'pessoais'
  })
  return [...daSemente, ...lidos.map((l) => ({ id: l.id, tipo: l.tipo, data: l.data, ...(l.emitente && { emitente: l.emitente }), ...lerDocumentoSimulado({ tipo: l.tipo, arquivo: l.arquivo }, itens) }))]
}

function montarAnalise(
  banco: Banco,
  ficha: Ficha,
  processo: Processo,
  anterior: AnaliseDaIA | undefined,
  quando: string,
  daSemente = DOCUMENTOS_DA_SEMENTE[processo.id] ?? [],
  /** A semente analisa só os documentos dela: o que chegou à pasta depois vira análise nova (GGVP-47). */
  comLeituras = true,
): AnaliseDaIA | undefined {
  // Menor de 16 anos no dia da análise, pela data de nascimento: o roteiro infantil (GGVP-50, CA1).
  const roteiro = comLaudo(roteiroDoCaso(banco, processo.beneficio, menorDe16(ficha.nascimento, hojeIso(new Date(quando)))))
  if (roteiro === null) return undefined
  return analisarDocumentos(roteiro, documentosMedicos(banco, ficha, processo.id, roteiro, daSemente, comLeituras), anterior, quando)
}

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
    const analise = montarAnalise(banco, sebastiao.ficha, sebastiao.processo, undefined, new Date('2026-07-14T10:00:00').toISOString(), undefined, false)!
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
    const antes = montarAnalise(banco, antonio.ficha, antonio.processo, undefined, new Date('2026-09-19T09:00:00').toISOString(), tresLaudos, false)!
    const depois = montarAnalise(banco, antonio.ficha, antonio.processo, antes, new Date('2026-09-29T16:00:00').toISOString(), undefined, false)!
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

const quandoCurto = (iso: string) => hojeIso(new Date(iso))

function naTela(banco: Banco, ficha: Ficha, processo: Processo, p: ParecerDoCaso, visao: Visao): ParecerNaTela {
  const laudoNovoEm = laudoNovoDo(ficha, processo)
  const semRoteiro = comLaudo(roteiroDoCaso(banco, processo.beneficio)) === undefined
  return naTelaDoPerfil({ ficha, processo, p, visao, semRoteiro, ...(laudoNovoEm && { laudoNovoEm }), hoje: hojeIso(agora()), modelo: COMPARACAO_DO_ANTONIO })
}

/** GET /api/processos/:id/parecer, na visão do perfil da sessão. */
export async function obterParecer(processoId: string, visao: Visao): Promise<ParecerNaTela | null> {
  // Caso do servidor (GGVP-132): a visão vem do perfil da sessão, lá.
  if (doServidor(processoId)) return doBancoOuNulo<ParecerNaTela>(`/processos/${processoId}/parecer`)
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) return null
  const p = emDia(banco, caso.ficha, caso.processo)
  gravar(banco)
  return naTela(banco, caso.ficha, caso.processo, p, visao)
}

/** POST /api/processos/:id/parecer. Só o Jurídico; valida de novo; a IA nunca registra (CA3, CA8, G17, G18, G20). */
export async function registrarParecer(processoId: string, pedido: PedidoDeParecer, quem: QuemRegistra): Promise<ParecerNaTela> {
  if (doServidor(processoId)) return noBanco<ParecerNaTela>(`/processos/${processoId}/parecer`, { method: 'POST', corpo: pedido })
  await esperar()
  if (!doJuridico(quem.perfil)) throw new Error('Só o Jurídico registra o parecer médico.')
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const { ficha, processo } = caso
  const p = emDia(banco, ficha, processo)
  const laudoNovoEm = laudoNovoDo(ficha, processo)
  const anterior = p.registros.at(-1)
  const quando = agora().toISOString()
  const r = registroDoPedido(p.analises.at(-1), pedido, quem.nome, quando, laudoNovoEm)
  if ('motivo' in r) throw new Error(r.motivo)
  const { registro } = r
  const situacao = registro.situacao
  const abordar = registro.abordar ?? ''
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
      perguntas: perguntasQueFaltam(registro),
      quem: quem.nome,
    })
  gravar(banco)
  return naTela(banco, ficha, processo, p, 'juridico')
}

/** O parecer para o portão (G17): o último registro; com análise e sem registro, "pendente" (sem confirmação humana). */
export function parecerParaOPortao(banco: Banco, processoId: string): Parecer | undefined {
  if (doServidor(processoId)) return banco.documentacaoMedica?.portoes[processoId]
  const caso = acharCaso(banco, processoId)
  return caso ? parecerDoPortao(emDia(banco, caso.ficha, caso.processo)) : undefined
}

/** Os tipos dos documentos médicos da semente do caso (a CAT, os exames e os laudos do Sebastião), para o checklist (GGVP-47). */
export const tiposDaSemente = (processoId: string): string[] => (DOCUMENTOS_DA_SEMENTE[processoId] ?? []).map((d) => d.tipo)

const ehSenior = (perfil: string | undefined) => perfil?.startsWith('senior') === true

/** POST /api/processos/:id/parecer/dispensa. A primeira sênior pede, com a justificativa (GGVP-33, CA2). */
export async function pedirDispensa(processoId: string, justificativa: string, quem: QuemRegistra): Promise<ParecerNaTela> {
  if (doServidor(processoId)) return noBanco<ParecerNaTela>(`/processos/${processoId}/parecer/dispensa`, { method: 'POST', corpo: { justificativa } })
  await esperar()
  if (!ehSenior(quem.perfil)) throw new Error('Só a sênior dispensa o parecer médico.')
  const motivo = motivoParaNaoPedirDispensa(justificativa)
  if (motivo) throw new Error(motivo)
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const p = emDia(banco, caso.ficha, caso.processo)
  if (p.registros.at(-1)?.situacao === 'suficiente') throw new Error('O parecer já está Suficiente: não há o que dispensar.')
  if (dispensaEmVigor(p)) throw new Error('O parecer já foi dispensado.')
  const ultima = p.dispensas?.at(-1)
  if (ultima && !ultima.aprovadaPor && !ultima.recusadaPor) throw new Error('Já há um pedido de dispensa esperando a segunda sênior.')
  p.dispensas = [...(p.dispensas ?? []), { justificativa: justificativa.trim(), pedidaPor: quem.nome, pedidaEm: agora().toISOString() }]
  caso.ficha.historico.push(evento(`Pediu a dispensa do parecer médico (1ª aprovação da sênior, G17). Justificativa: ${justificativa.trim()}`, quem.nome))
  gravar(banco)
  return naTela(banco, caso.ficha, caso.processo, p, 'juridico')
}

/** POST /api/processos/:id/parecer/dispensa/aprovacao. A segunda sênior, outra pessoa, aprova ou recusa (Q14). */
export async function responderDispensa(processoId: string, aprova: boolean, quem: QuemRegistra): Promise<ParecerNaTela> {
  if (doServidor(processoId)) return noBanco<ParecerNaTela>(`/processos/${processoId}/parecer/dispensa/aprovacao`, { method: 'POST', corpo: { aprova } })
  await esperar()
  if (!ehSenior(quem.perfil)) throw new Error('Só a sênior dispensa o parecer médico.')
  const banco = ler()
  const caso = acharCaso(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const p = emDia(banco, caso.ficha, caso.processo)
  const dispensa = p.dispensas?.at(-1)
  const motivo = motivoParaNaoAprovarDispensa(dispensa, quem.nome)
  if (motivo) throw new Error(motivo)
  const quando = agora().toISOString()
  if (aprova) Object.assign(dispensa!, { aprovadaPor: quem.nome, aprovadaEm: quando })
  else Object.assign(dispensa!, { recusadaPor: quem.nome, recusadaEm: quando })
  caso.ficha.historico.push(
    evento(
      aprova
        ? `Aprovou a dispensa do parecer médico (2ª aprovação da sênior): dispensado por ${dispensa!.pedidaPor} e ${quem.nome} (G17)`
        : `Recusou a dispensa do parecer médico pedida por ${dispensa!.pedidaPor}: o caso continua esperando o parecer (G17)`,
      quem.nome,
    ),
  )
  gravar(banco)
  return naTela(banco, caso.ficha, caso.processo, p, 'juridico')
}

/** A documentação médica na ficha do Atendimento: o resultado e quem confirmou, nunca o conteúdo. */
export function resumoParaAFicha(fichaId: string): string | undefined {
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) return undefined
  const partes = ficha.processos.flatMap((processo) => {
    if (doServidor(processo.id)) return []
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
/** A dispensa espera a segunda sênior (G17): vai para a tela inicial da Sênior; o resto do parecer é da advogada. */
export const daSenior = (t: Tarefa) => t.id.startsWith('dispensa-')

export function tarefasDoParecer(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = banco.fichas.flatMap((ficha) =>
    ficha.processos.flatMap((processo): Tarefa[] => {
      if (doServidor(processo.id)) return []
      const laudoNovoEm = laudoNovoDo(ficha, processo)
      // A tarefa que o envio pelo card já criou (GGVP-17) vale; a da semente nasce aqui.
      const cardJaAbriu = banco.tarefas.some((x) => x.processoId === processo.id && x.acao === 'Analisar laudo novo' && !x.concluida)
      return tarefasDoCaso({ ficha, processo, p: emDia(banco, ficha, processo), ...(laudoNovoEm && { laudoNovoEm }), hoje, cardJaAbriu })
    }),
  )
  gravar(banco)
  return [...tarefas, ...doServidorAs(banco, /^(dispensa|laudo-novo|parecer)-/)]
}

/** As tarefas dos casos do servidor, da última sincronização, pelo começo do id (GGVP-132). */
export const doServidorAs = (banco: Banco, ids: RegExp): Tarefa[] => (banco.documentacaoMedica?.tarefas ?? []).filter((t) => ids.test(t.id))

/** GET de um caso do servidor: o que veio, ou null quando o caso não existe lá. */
export async function doBancoOuNulo<T>(caminho: string): Promise<T | null> {
  const r = await chamarApi<T>(caminho)
  if (r.ok) return r.dados
  if (r.status === 404) return null
  throw new Error(r.erro)
}

/**
 * GET /api/documentacao-medica. Ao abrir cada tela, depois da Recepção: as Centrais recebem as tarefas do parecer e do
 * complemento dos casos do servidor, e o portão (G17) das telas ainda não ligadas recebe o parecer de cada caso.
 */
export async function sincronizarDocumentacaoMedica() {
  if (!servidorLigado()) return
  const r = await noBanco<{ fichas: Ficha[]; tarefas: Tarefa[]; portoes: Record<string, Parecer> }>('/documentacao-medica')
  for (const f of r.fichas) espelhar(f)
  const banco = ler()
  banco.documentacaoMedica = { tarefas: r.tarefas, portoes: r.portoes }
  gravar(banco)
}

/** A prévia do complemento (GGVP-29), sobre o parecer do caso em dia. */
export function previaDoComplemento(banco: Banco, processoId: string): PreviaDoComplemento | undefined {
  const caso = acharCaso(banco, processoId)
  return caso ? previaDoParecer(emDia(banco, caso.ficha, caso.processo)) : undefined
}
