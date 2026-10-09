// Perícia (épico GGVP-10): a perícia do caso, da tarefa aberta pelo sistema ao perfil do perito. Funções puras sobre os
// dados da perícia, da ficha e dos peritos, com a hora vinda de fora: o servidor de exemplo (dados/pericia.ts) e o de
// verdade (apps/api, rotas/pericia.ts) rodam as mesmas (GGVP-137). A IA aqui é simulada (o texto sai do dado); a de
// verdade é da GGVP-139.
import type { Arquivo, Ficha, Processo, Tarefa } from '../dados/tipos.ts'
import { acrescentarLaudo, perfilDoPerito, peritosDo, reconhecerPerito, type ComPeritos, type PerfilDoPerito } from '../dados/peritos.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { diaDaSemana, diaFalado, somarDias } from './agenda.ts'
import { dataCurta, hojeIso } from './datas.ts'
import { problemaG20 } from './parecer.ts'
import {
  COMO_SEGUE,
  CONFERENCIAS_DO_RESULTADO,
  DIAS_PARA_MANIFESTAR,
  HORA_DA_CONFIRMACAO,
  LIMITE_DE_REMARCACOES_DA_PERICIA,
  MINIMO_DA_FALTA,
  NOMES_DA_INSTANCIA,
  NOMES_DO_TIPO,
  ORIGENS,
  O_QUE_LEVAR,
  cobrarHoje,
  confirmacaoDaPresenca,
  escolherOrientacao,
  esperaOInss,
  etapaEmPericia,
  motivoDaDataDaPericia,
  motivoParaNaoConcluirDocumentos,
  motivoParaNaoRegistrarMarcacao,
  motivoParaNaoRegistrarResultado,
  motivoParaNaoRegistrarTentativa,
  passouDoLimite,
  passouDoLimiteDosDocumentos,
  periciaJaPassou,
  problemaDaOrientacao,
  prazoFalado,
  prazoParaManifestar,
  prazosDaPericia,
  proximaTentativa,
  situacaoDaPericia,
  type Instancia,
  type Jurimetria,
  type LidoDoComprovante,
  type ModoDaOrientacao,
  type OrigemDaPericia,
  type SituacaoDaPericia,
  type TipoDePericia,
} from './pericia.ts'

/** Um passo da perícia: quem fez, quando e o passo do BPMN. O que o sistema faz sozinho grava "Sistema" (GGVP-49, CA4). */
export type EventoDaPericia = { quando: string; quem: string; oQue: string; passo: string }

/** O que a GGVP-31 (D2.03), o despacho da sênior (D3) e o pedido do juiz (D3a) mandam para abrir a perícia. */
export type PedidoDePericia = {
  origem: OrigemDaPericia
  tipo: TipoDePericia
  instancia: Instancia
  /** Quem decidiu: a advogada, a sênior ou o juízo. */
  pedidaPor: string
  /** O que a perícia pede, quando se sabe (GGVP-49, CA3). */
  oQuePede?: string
  /** D3 e D3a: a data e o local que vêm do juízo, lidos da publicação (resposta do Lucas, 02/10, GGVP-53). */
  dataDoJuizo?: { data: string; hora: string; local: string }
  /** O nome do perito na publicação ou no processo, quando há (GGVP-61, CA2, CA6). */
  peritoLido?: string
}

/** A orientação para o cliente, montada pela IA quando a data é registrada (GGVP-61, DP.05). */
export type OrientacaoDaPericia = {
  modo: ModoDaOrientacao
  /** Por que saiu a padrão (CA5, CA6). */
  motivo?: string
  peritoId?: string
  /** A versão do perfil usada: quantos laudos formavam o perfil (CA9). */
  versaoDoPerfil?: number
  /** Os números do sistema, quando a amostra é suficiente (CA12, G22). */
  jurimetria?: Jurimetria
  texto: string
  geradaEm: string
  /** A verificação achou instrução proibida: bloqueada, pede revisão (CA8). */
  bloqueio?: string
}

/** A perícia marcada: o que o comprovante disse (conferido) ou o que veio do juízo. */
export type MarcacaoDaPericia = LidoDoComprovante & {
  /** O nome do PDF do INSS; sem ele, a data veio do juízo. */
  comprovante?: string
  origem: 'comprovante' | 'juizo'
  registradaEm: string
  registradaPor: string
  /** A confirmação de presença da véspera (GGVP-66, CA7): confirmou ou não, quem, quando e a observação. */
  confirmacao?: { quando: string; quem: string; confirmou: boolean; observacao?: string }
  /** Depois do dia e da hora (GGVP-66, CA1): compareceu ou faltou, com a justificativa, se houver (CA4). */
  comparecimento?: { quando: string; quem: string; compareceu: boolean; justificativa?: string }
}

/** Um item do que levar à perícia: os tipos de documento que valem e se é laudo (o pedido ao médico, G20). */
export type ItemDaPericia = { id: string; nome: string; tipos: string[]; laudo?: boolean }

/**
 * O kit da perícia, por tipo: configuração do escritório (Lucas, 02/10: "os kits são exatamente os docs que estão prontos
 * por tipo de processo"). As declarações valem para a avaliação social (Lucas, 02/10, Q3). ponytail: vir da configuração,
 * como a lista de cada benefício (GGVP-91).
 */
export const KIT_DA_PERICIA: Record<TipoDePericia, ItemDaPericia[]> = {
  medica: [
    { id: 'laudo-recente', nome: 'Laudo médico recente (até 30 dias)', tipos: ['laudo', 'relatorio-medico'], laudo: true },
    { id: 'exames', nome: 'Exames', tipos: ['exame', 'exame-imagem-epoca', 'exame-pos-alta'] },
    { id: 'receitas', nome: 'Receitas', tipos: ['receita'] },
    { id: 'atestados', nome: 'Atestados de afastamento', tipos: ['atestado'] },
  ],
  social: [
    { id: 'cadunico', nome: 'CadÚnico atualizado', tipos: ['cadunico'] },
    { id: 'grupo-familiar', nome: 'Composição do grupo familiar', tipos: ['grupo-familiar'] },
    { id: 'moradia', nome: 'Declaração de moradia', tipos: ['declaracao-moradia'] },
    { id: 'uniao-separacao', nome: 'Declaração de união estável ou de separação de fato, quando houver', tipos: ['declaracao-uniao-estavel', 'declaracao-separacao'] },
  ],
}

/** As conferências antes de concluir (Figma 10:522) e a da leitura da IA do que chegou (GGVP-56, CA4). */
export const CONFERENCIAS_DA_PERICIA: Record<TipoDePericia, { id: string; rotulo: string }[]> = {
  medica: [
    { id: 'laudos-exames', rotulo: 'Laudos e exames' },
    { id: 'leitura', rotulo: 'Conferi a leitura da IA do que chegou (papel digitalizado ou pelo card)' },
  ],
  social: [
    { id: 'cadunico', rotulo: 'CadÚnico (se BPC/social)' },
    { id: 'grupo-familiar', rotulo: 'Composição do grupo familiar' },
    { id: 'leitura', rotulo: 'Conferi a leitura da IA do que chegou (papel digitalizado ou pelo card)' },
  ],
}

/** A tarefa da Documentação na perícia (DP.03): nasce só com "Sim" no documento novo (GGVP-56, CA3). */
export type DocumentosDaPericia = {
  abertaEm: string
  /** Id do item → por que falta (CA5). */
  faltas: Record<string, string>
  /** A cobrança diária, pela Documentação (Lucas, 02/10). */
  cobrancas: { dia: string; quando: string; quem: string; como: 'chatwoot' | 'adiada'; mensagem?: string }[]
  /** O que o laudo deve abordar, para o médico (CA7, G20). */
  pedidosAoMedico: { quando: string; quem: string; abordar: string }[]
  /** Passou do limite (10 dias antes): o que a advogada responsável decidiu (G15). */
  decisaoDaAdvogada?: { quando: string; quem: string; texto: string }
  concluida?: { quando: string; quem: string; conferidas: string[] }
}

export type Pericia = {
  id: string
  processoId: string
  fichaId: string
  tipo: TipoDePericia
  instancia: Instancia
  origem: OrigemDaPericia
  pedidaPor: string
  /** Data e hora ISO da decisão de origem. */
  pedidaEm: string
  /** Data e hora ISO em que o sistema abriu a tarefa (DP.01). */
  abertaEm: string
  oQuePede?: string
  /** D2: quando o INSS liberou o agendamento (D2.E1). D3 e D3a nascem liberados. */
  liberadaEm?: string
  tentativas: { dia: string; oQueAconteceu: string; quem: string; quando: string }[]
  remarcacoes: number
  /** Data e hora ISO da última remarcação: a tentativa diária recomeça dali. */
  remarcadaEm?: string
  /** Remarcações a mais que a advogada responsável autorizou depois do limite (G15). */
  autorizadas?: number
  /** Marcada no Meu INSS, mas o comprovante ainda não saiu (espera DP.E1, GGVP-53 CA6). */
  esperaComprovante?: { desde: string }
  marcacao?: MarcacaoDaPericia
  /** As datas que a perícia já teve: a troca fica no histórico (GGVP-53, CA8). */
  marcacoesAnteriores?: MarcacaoDaPericia[]
  /** "A perícia pede documento novo?" (GGVP-53, CA4). */
  pedeDocumentoNovo?: boolean
  /** O lembrete da véspera (GGVP-53, CA7): o dia e, depois de enviado, quando, por quem e o texto. */
  lembrete?: { para: string; enviadoEm?: string; por?: string; mensagem?: string }
  /** O que a Documentação reúne quando a perícia pede documento novo (GGVP-56). */
  documentos?: DocumentosDaPericia
  /** O perito reconhecido na base (GGVP-61). Sem ele, a orientação padrão. */
  peritoId?: string
  /** O nome lido que o sistema não reconheceu: a pergunta de um clique (CA6). */
  peritoLido?: string
  orientacao?: OrientacaoDaPericia
  /** A orientação passada ao cliente (GGVP-62, DP.06): o canal, quem, quando e o texto enviado (CA2, CA7). */
  preparacao?: PreparacaoDaPericia
  /** Os envios que a verificação do servidor recusou (GGVP-62, CA6): quem, quando, o motivo e o texto. */
  enviosRecusados?: { quando: string; quem: string; motivo: string; texto: string }[]
  /** O resultado (GGVP-70): disponível no GERID ou no processo, o laudo lido pela IA e o que a advogada registrou. */
  resultado?: ResultadoDaPericia
  historico: EventoDaPericia[]
}

/** O que a IA leu do laudo (GGVP-70): o resumo e, no desfavorável, por que e se vale nova perícia. A advogada decide. */
export type LeituraDoLaudo = {
  favoravel: boolean
  resumo: string
  conclusao: string
  coerencia: string
  pontoDeAtencao: string
  /** No desfavorável: por que foi desfavorável (Lucas, 02/10). */
  porque?: string
  /** No desfavorável: a indicação da IA de pedir nova perícia. Quem decide é a advogada. */
  valeNovaPericia?: boolean
  /** O assunto do laudo, para os números por assunto do perfil (GGVP-73, G22). */
  assunto: string
  /** O que o perito observou, perguntou e pediu, para o perfil dele (GGVP-73). */
  observou: string[]
  perguntou: string[]
  pediu: string[]
}

export type ResultadoDaPericia = {
  /** O resultado apareceu no GERID ou no processo (DP.E4): a tarefa da advogada fica urgente (CA1). */
  disponivelEm?: string
  /** A leitura é conteúdo médico: fora do Jurídico, o servidor manda o laudo sem ela (saúde simples, 08/10). */
  laudo?: { nome: string; anexadoEm: string; leitura?: LeituraDoLaudo }
  /** O que a advogada registrou (CA2 a CA5); no judicial, até quando manifestar (G12). */
  registrado?: { quando: string; quem: string; favoravel: boolean; novaPericia?: boolean; conferidas: string[]; manifestarAte?: string }
  /** O laudo no perfil do perito (GGVP-73): entrou, ou espera a pergunta de um clique, fora das contas (CA6). */
  noPerfil?: 'atualizado' | 'aguardando-perito'
}

/** Chatwoot (documento e instrução, Lucas 02/10 Q5) ou a ligação. */
export type CanalDaOrientacao = 'chatwoot' | 'ligacao'
export type PreparacaoDaPericia = { quando: string; quem: string; canal: CanalDaOrientacao; texto: string }

/** Quem faz sozinho. */
export const SISTEMA = 'Sistema'

/** A perícia na tela: com a ficha, o processo e onde ela está. */
export type PericiaNaTela = {
  pericia: Pericia
  ficha: Ficha
  processo: Processo
  beneficio: string
  situacao: SituacaoDaPericia
  /** "Em perícia · pedido ao INSS (D2) · perícia médica" (CA1). */
  etapa: string
  /** O dia da próxima tentativa de marcar (tentativa diária). */
  proximaTentativa?: string
  /** Com a data: documentos até 10 dias antes, preparação até 3 dias antes, véspera e dia seguinte. */
  prazos?: ReturnType<typeof prazosDaPericia>
  /** É a véspera (ou o dia) e o lembrete ainda não saiu (GGVP-53, CA7). */
  lembreteHoje: boolean
  /** O que a perícia pede, item a item, anexado ou com a falta justificada (GGVP-56). */
  documentos?: {
    itens: { item: ItemDaPericia; arquivo?: Arquivo; falta?: string }[]
    faltando: ItemDaPericia[]
    /** Hoje ainda não cobrou e não passou dos 10 dias antes. */
    cobrarHoje: boolean
    /** Passou dos 10 dias antes com documento faltando: a advogada responsável decide (G15). */
    passouDoLimite: boolean
  }
  /** O perito reconhecido e o perfil dele (GGVP-61). */
  perfil?: PerfilDoPerito
  /** Passou o dia e a hora da perícia marcada: o comparecimento pode ser registrado (GGVP-66, CA1). */
  jaPassou: boolean
  /** A confirmação de presença da véspera, enquanto a perícia não passou e ninguém confirmou (GGVP-66, CA7, CA8). */
  presenca?: 'ainda-nao' | 'fazer' | 'atrasada'
  /** As perícias que o processo já teve antes desta, com o resultado de cada uma (GGVP-70). */
  anteriores: Pericia[]
}

/** O que a perícia precisa ler e mudar: as fichas (com os processos e os arquivos), as perícias e os peritos. */
export type MundoDaPericia = ComPeritos & { fichas: Ficha[]; pericias?: Pericia[] }

/** O comprovante ou o laudo que entrou: o nome, o hash do conteúdo e, para subir ao servidor, o próprio PDF. */
export type ArquivoEnviado = { nome: string; hash?: string; arquivo?: Blob }

export function fichaDoProcesso(mundo: MundoDaPericia, processoId: string): { ficha: Ficha; processo: Processo } | null {
  for (const ficha of mundo.fichas) {
    const processo = ficha.processos.find((p) => p.id === processoId)
    if (processo) return { ficha, processo }
  }
  return null
}

/** A perícia em andamento do processo (a mais nova). */
export const periciaDo = (mundo: MundoDaPericia, processoId: string) => mundo.pericias?.filter((p) => p.processoId === processoId).at(-1)

/** A perícia do resultado: a que espera o resultado ou a última já conferida. */
export function periciaDoResultado(mundo: MundoDaPericia, processoId: string): Pericia | undefined {
  return mundo.pericias?.filter((p) => p.processoId === processoId && ['aguardando-resultado', 'concluida'].includes(situacaoDaPericia(p))).at(-1)
}

export const podeMarcar = (p: Pericia) => ['marcar', 'aguardando-comprovante'].includes(situacaoDaPericia(p))

/** Cada item do kit: anexado é o documento do tipo dele que entrou na pasta depois do pedido (GGVP-56, CA1, CA2, CA4). */
function documentosNaTela(ficha: Ficha, pericia: Pericia, hoje: string, ate?: string): PericiaNaTela['documentos'] {
  const d = pericia.documentos
  if (!d) return undefined
  const desde = hojeIso(new Date(d.abertaEm))
  const itens = KIT_DA_PERICIA[pericia.tipo].map((item) => ({
    item,
    arquivo: ficha.arquivos.filter((a) => item.tipos.includes(a.tipo) && a.data >= desde).at(-1),
    falta: d.faltas[item.id],
  }))
  const faltando = itens.filter((i) => !i.arquivo && !i.falta).map((i) => i.item)
  const aberta = !d.concluida && faltando.length > 0
  return {
    itens,
    faltando,
    cobrarHoje: aberta && cobrarHoje(d.cobrancas, hoje, ate),
    passouDoLimite: aberta && passouDoLimiteDosDocumentos(hoje, ate),
  }
}

/** "Sim" no documento novo abre a tarefa da Documentação, uma só por perícia (GGVP-56, CA1 a CA3). */
function abrirDocumentos(pericia: Pericia, quando: string) {
  pericia.documentos ??= { abertaEm: quando, faltas: {}, cobrancas: [], pedidosAoMedico: [] }
}

/**
 * Abre a perícia e o primeiro passo dela: o sistema abre a tarefa para o Jurídico administrativo (DP.01). O id vem de
 * fora no servidor (o da linha da tabela `pericia`); no exemplo, sai do processo.
 */
export function criarPericia(mundo: MundoDaPericia, processoId: string, pedido: PedidoDePericia, quando: Date, liberadaEm?: Date, id?: string): Pericia {
  const achado = fichaDoProcesso(mundo, processoId)
  if (!achado) throw new Error('Processo não encontrado')
  const origem = ORIGENS[pedido.origem]
  const iso = quando.toISOString()
  const pericias = (mundo.pericias ??= [])
  const liberada = esperaOInss(pedido.origem) ? liberadaEm?.toISOString() : iso
  const pericia: Pericia = {
    id: id ?? `pericia-${processoId}-${pericias.filter((p) => p.processoId === processoId).length + 1}`,
    processoId,
    fichaId: achado.ficha.id,
    tipo: pedido.tipo,
    instancia: pedido.instancia,
    origem: pedido.origem,
    pedidaPor: pedido.pedidaPor,
    pedidaEm: iso,
    abertaEm: iso,
    oQuePede: pedido.oQuePede,
    liberadaEm: liberada,
    tentativas: [],
    remarcacoes: 0,
    historico: [
      { quando: iso, quem: pedido.pedidaPor, oQue: `Pediu a ${NOMES_DO_TIPO[pedido.tipo]} (${origem.rotulo})`, passo: origem.passo },
      {
        quando: iso,
        quem: SISTEMA,
        oQue: `Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de ${pedido.pedidaPor} (${origem.rotulo})`,
        passo: 'DP.01',
      },
    ],
  }
  if (esperaOInss(pedido.origem)) {
    pericia.historico.push(
      liberada
        ? { quando: liberada, quem: SISTEMA, oQue: 'O INSS liberou o agendamento; a tarefa entrou na Central do Jurídico administrativo', passo: 'D2.E1' }
        : { quando: iso, quem: SISTEMA, oQue: 'Esperando o INSS liberar o agendamento', passo: 'D2.E1' },
    )
  }
  // Judicial (resposta do Lucas, 02/10, GGVP-53): a data do juízo é lida da publicação e posta na agenda sozinha.
  if (pedido.dataDoJuizo) naAgendaPeloJuizo(pericia, pedido.dataDoJuizo, SISTEMA, quando)
  if (pedido.peritoLido) {
    const perito = reconhecerPerito(mundo, pedido.peritoLido)
    if (perito) pericia.peritoId = perito.id
    else pericia.peritoLido = pedido.peritoLido
  }
  if (pericia.marcacao) montarOrientacao(mundo, pericia, quando)
  pericias.push(pericia)
  return pericia
}

/**
 * A data do juízo na agenda e na ficha, com o lembrete da véspera (DP.04): lida da publicação pelo sistema ou, quando a
 * publicação não a trouxe num formato que ele lê, registrada pelo Jurídico administrativo (GGVP-137).
 */
function naAgendaPeloJuizo(pericia: Pericia, d: { data: string; hora: string; local: string }, quem: string, quando: Date) {
  const iso = quando.toISOString()
  const hoje = hojeIso(quando)
  const { data, hora, local } = d
  pericia.marcacao = { data, hora, local, modalidade: 'presencial', tipo: pericia.tipo, origem: 'juizo', registradaEm: iso, registradaPor: quem }
  pericia.lembrete = { para: prazosDaPericia(data).vespera }
  const dataFalada = `${dataCurta(data, hoje)}, ${hora}, ${local}`
  pericia.historico.push(
    quem === SISTEMA
      ? { quando: iso, quem, oQue: `Leu a data na publicação e pôs na agenda e na ficha: ${dataFalada}`, passo: 'DP.04' }
      : { quando: iso, quem, oQue: `Registrou a data que o juízo designou e pôs na agenda e na ficha: ${dataFalada}`, passo: 'DP.04' },
    { quando: iso, quem: SISTEMA, oQue: `Agendou o lembrete da véspera para ${dataCurta(pericia.lembrete.para, hoje)}`, passo: 'DP.04' },
  )
}

/** O que a IA leu do comprovante da semente: o local de cada caso. Outro PDF cai numa agência de exemplo. */
const LOCAIS_DOS_COMPROVANTES: Record<string, string> = {
  'maria-exemplo-1': 'Agência INSS Santo Amaro (exemplo)',
  'pedro-exemplo-1': 'visita domiciliar · Agência INSS Penha (exemplo)',
}

/** O primeiro dia útil a partir de `iso`. */
export function diaUtil(iso: string): string {
  let dia = iso
  while (diaDaSemana(dia) === 0 || diaDaSemana(dia) === 6) dia = somarDias(dia, 1)
  return dia
}

/**
 * IA simulada (CA2): o que o comprovante do INSS diz. A data vem do nome do arquivo quando ele traz uma (aaaa-mm-dd);
 * senão, duas semanas adiante (uma a mais a cada data trocada), num dia útil, às 08:30. O perito nunca vem.
 */
export function leituraDoComprovante(pericia: Pericia, nome: string, hoje: string): LidoDoComprovante {
  const doNome = /(\d{4}-\d{2}-\d{2})/.exec(nome)?.[1]
  const data = doNome ?? diaUtil(somarDias(hoje, 14 + 7 * (pericia.marcacoesAnteriores?.length ?? 0)))
  return {
    data,
    hora: '08:30',
    local: LOCAIS_DOS_COMPROVANTES[pericia.processoId] ?? 'Agência INSS (exemplo)',
    modalidade: pericia.tipo === 'social' ? 'visita domiciliar' : 'presencial',
    tipo: pericia.tipo,
  }
}

/** O nome na pasta: com "(2)" quando ele já existe (CA13 da GGVP-17). */
const nomeNaPasta = (ficha: Ficha, nome: string) => (ficha.arquivos.some((a) => a.nome === nome) ? nome.replace(/(\.pdf)$/i, ' (2)$1') : nome)

/** Grava a marcação conferida: pasta, agenda, ficha, lembrete e a decisão do documento novo (CA2, CA4, CA8). */
export function marcar(
  mundo: MundoDaPericia,
  pericia: Pericia,
  m: { comprovante: ArquivoEnviado; lido: LidoDoComprovante; pedeDocumentoNovo: boolean },
  quem: string,
  agora: Date,
) {
  const { ficha } = fichaDoProcesso(mundo, pericia.processoId)!
  const quando = agora.toISOString()
  const hoje = hojeIso(agora)
  const nome = nomeNaPasta(ficha, m.comprovante.nome)
  const arquivo: Arquivo = { nome, tipo: 'comprovante-pericia', local: pericia.processoId, data: hoje, origem: 'card', repetido: false, aguardaLeitura: false, hash: m.comprovante.hash }
  ficha.arquivos.push(arquivo)
  const anterior = pericia.marcacao ?? (pericia.remarcadaEm ? pericia.marcacoesAnteriores?.at(-1) : undefined)
  if (pericia.marcacao) (pericia.marcacoesAnteriores ??= []).push(pericia.marcacao)
  pericia.marcacao = { ...m.lido, comprovante: nome, origem: 'comprovante', registradaEm: quando, registradaPor: quem }
  pericia.lembrete = { para: prazosDaPericia(m.lido.data).vespera }
  pericia.pedeDocumentoNovo = m.pedeDocumentoNovo
  if (m.pedeDocumentoNovo) abrirDocumentos(pericia, quando)
  delete pericia.esperaComprovante
  const novaData = `${dataCurta(m.lido.data, hoje)}, ${m.lido.hora}`
  pericia.historico.push(
    { quando, quem, oQue: `Marcou a ${NOMES_DO_TIPO[pericia.tipo]} no Meu INSS e subiu o comprovante (${nome})`, passo: 'DP.02' },
    { quando, quem: SISTEMA, oQue: `Leu o comprovante (${novaData}, ${m.lido.local}) e pôs na agenda e na ficha`, passo: 'DP.04' },
  )
  pericia.historico.push(
    anterior && (anterior.data !== m.lido.data || anterior.hora !== m.lido.hora)
      ? {
          quando,
          quem: SISTEMA,
          oQue: `Data trocada: ${dataCurta(anterior.data, hoje)}, ${anterior.hora} → ${novaData}; lembrete reprogramado para ${dataCurta(pericia.lembrete.para, hoje)}`,
          passo: 'DP.04',
        }
      : { quando, quem: SISTEMA, oQue: `Agendou o lembrete da véspera para ${dataCurta(pericia.lembrete.para, hoje)}`, passo: 'DP.04' },
  )
  pericia.historico.push(
    m.pedeDocumentoNovo
      ? { quando, quem, oQue: 'A perícia pede documento novo: atribuiu à Documentação (DP.03)', passo: 'DP.02' }
      : { quando, quem, oQue: 'A perícia não pede documento novo: segue para ligar e orientar (DP.06)', passo: 'DP.02' },
  )
  montarOrientacao(mundo, pericia, agora)
  // Data ou local mudados (GGVP-62, CA5): a orientação saiu de novo e a preparação de antes deixa de valer.
  if (pericia.preparacao && anterior && (anterior.data !== m.lido.data || anterior.hora !== m.lido.hora || anterior.local !== m.lido.local)) {
    delete pericia.preparacao
    pericia.historico.push({ quando, quem: SISTEMA, oQue: 'A data ou o local mudou: a orientação passada antes deixou de valer; ligar e orientar de novo', passo: 'DP.06' })
  }
}

/** A perícia como a tela mostra, no momento `agora`. */
export function naTela(mundo: MundoDaPericia, pericia: Pericia, agora: Date): PericiaNaTela {
  const { ficha, processo } = fichaDoProcesso(mundo, pericia.processoId)!
  const hoje = hojeIso(agora)
  const situacao = situacaoDaPericia(pericia)
  const { marcacao, lembrete } = pericia
  // Depois de uma remarcação, a tentativa diária recomeça do dia dela.
  const desde = hojeIso(new Date(pericia.remarcadaEm ?? pericia.liberadaEm ?? pericia.abertaEm))
  const jaPassou = situacao === 'agendada' && periciaJaPassou(marcacao!, agora)
  const pericias = mundo.pericias ?? []
  return {
    pericia,
    ficha,
    processo,
    beneficio: nomeBeneficio(processo.beneficio),
    situacao,
    etapa: etapaEmPericia(pericia, hoje),
    ...(situacao === 'marcar' && { proximaTentativa: proximaTentativa(pericia.tentativas.filter((x) => x.dia >= desde), desde) }),
    ...(marcacao && { prazos: prazosDaPericia(marcacao.data) }),
    lembreteHoje: situacao === 'agendada' && !jaPassou && !!lembrete && !lembrete.enviadoEm && hoje >= lembrete.para && hoje <= marcacao!.data,
    documentos: documentosNaTela(ficha, pericia, hoje, marcacao && prazosDaPericia(marcacao.data).documentosAte),
    perfil: pericia.peritoId ? perfilDoPerito(peritosDo(mundo).find((p) => p.id === pericia.peritoId)!) : undefined,
    jaPassou,
    anteriores: pericias.slice(0, pericias.indexOf(pericia)).filter((p) => p.processoId === pericia.processoId),
    ...(situacao === 'agendada' && !jaPassou && !marcacao!.confirmacao?.confirmou && { presenca: confirmacaoDaPresenca(marcacao!.data, agora) }),
  }
}

const nomeCurto = (nome: string) => nome.replace(/\s*\(exemplo\)$/, '')

/**
 * DP.05: a IA monta a orientação quando a data é registrada (CA1, CA2, CA7), padrão ou pelo perfil do perito (regra
 * unificada, Lucas 02/10). IA simulada: o texto sai do dado da perícia, do acervo do benefício e do perfil. Antes de chegar
 * ao Jurídico administrativo, a verificação barra instrução proibida (CA4, CA8). `pedido` simula um pedido feito à IA,
 * que ela segue sem filtro: é o teste dos pedidos maliciosos (CA10).
 */
export function montarOrientacao(mundo: MundoDaPericia, pericia: Pericia, quando: Date, pedido?: string): OrientacaoDaPericia {
  const m = pericia.marcacao
  if (!m) throw new Error('A perícia ainda não tem data')
  const { ficha } = fichaDoProcesso(mundo, pericia.processoId)!
  const perito = pericia.peritoId ? peritosDo(mundo).find((p) => p.id === pericia.peritoId) : undefined
  const perfil = perito && perito.laudos.length > 0 ? perfilDoPerito(perito) : undefined
  const escolha = escolherOrientacao({ instancia: pericia.instancia, peritoId: pericia.peritoId, peritoLido: pericia.peritoLido, temPerfil: !!perfil })
  const primeiro = ficha.nome.split(' ')[0]
  const social = pericia.tipo === 'social'
  const linhas = [
    `Orientação para a ${NOMES_DO_TIPO[pericia.tipo]} de ${primeiro}`,
    `Quando: ${diaFalado(m.data)}, às ${m.hora}.`,
    `Onde: ${m.local}.${social ? ' A visita é na sua casa.' : ''}`,
    `O que levar: ${O_QUE_LEVAR[pericia.tipo]}.`,
    social
      ? 'Como é a visita: a assistente social vai até a casa, conversa com quem mora ali e vê como a família vive. Mostre a casa como ela é no dia a dia e responda com calma.'
      : 'Como é a perícia: o médico perito conversa sobre a sua saúde e o seu trabalho e examina você. Conte como é o seu dia, com calma e com sinceridade.',
  ]
  if (escolha.modo === 'perfil' && perfil) {
    linhas.push(
      `O que ${nomeCurto(perfil.perito.nome)} costuma observar: ${perfil.observou.join('; ')}.`,
      `O que costuma perguntar: ${perfil.perguntou.join('; ')}.`,
      `O que costuma pedir: ${perfil.pediu.join('; ')}.`,
    )
  } else {
    linhas.push(
      social
        ? 'Pelo acervo do benefício: tenha à mão o CadÚnico e os comprovantes de renda e de despesas da casa.'
        : 'Pelo acervo do benefício: leve os documentos em ordem e a lista dos remédios que usa.',
    )
  }
  linhas.push('Fale sempre a verdade sobre a sua situação: esta orientação só prepara você para o dia.')
  const texto = [...linhas, ...(pedido ? [pedido] : [])].join('\n')
  const bloqueio = problemaDaOrientacao(texto) ?? undefined
  const iso = quando.toISOString()
  pericia.orientacao = {
    modo: escolha.modo,
    ...(escolha.motivo && { motivo: escolha.motivo }),
    ...(perfil && { peritoId: perfil.perito.id, versaoDoPerfil: perfil.versao }),
    // A jurimetria entra quando o perito tem laudo no acervo; sem amostra mínima (CA12, G22).
    ...(perfil?.jurimetria.laudos && { jurimetria: perfil.jurimetria }),
    texto,
    geradaEm: iso,
    ...(bloqueio && { bloqueio }),
  }
  pericia.historico.push({
    quando: iso,
    quem: SISTEMA,
    oQue: bloqueio
      ? `A verificação bloqueou a orientação montada pela IA e pede revisão: ${bloqueio}`
      : perfil && escolha.modo === 'perfil'
        ? `Montou a orientação pelo perfil de ${perfil.perito.nome} (versão ${perfil.versao}, IA e acervo)`
        : `Montou a orientação padrão (IA e acervo): ${escolha.motivo}`,
    passo: 'DP.05',
  })
  return pericia.orientacao
}

/**
 * IA simulada: o que o laudo (ou o registro do GERID) diz. "desfavoravel" no nome do arquivo faz o laudo desfavorável; no
 * desfavorável, a IA diz por que e indica se vale pedir nova perícia (Lucas, 02/10). A advogada decide.
 */
export function leituraDoLaudo(pericia: Pericia, beneficio: string, nome: string): LeituraDoLaudo {
  const social = pericia.tipo === 'social'
  const conteudo = social
    ? { assunto: 'renda familiar', observou: ['quem mora na casa e a renda de cada um', 'as condições da moradia'], perguntou: ['quem ajuda nas despesas da casa'], pediu: ['comprovantes de renda e de despesas'] }
    : { assunto: 'coluna', observou: ['como a pessoa senta, levanta e anda'], perguntou: ['quanto tempo a pessoa aguenta sentada e em pé'], pediu: ['laudos e receitas dos últimos 12 meses'] }
  if (!/desfavor/i.test(nome)) {
    return {
      favoravel: true,
      resumo: social
        ? 'A assistente social constatou a vulnerabilidade: a renda da casa não cobre as despesas básicas e a família depende de ajuda.'
        : 'O perito concluiu incapacidade para o trabalho habitual, coerente com os laudos e os exames do escritório.',
      conclusao: social ? 'Favorável · vulnerabilidade constatada na visita' : 'Favorável · incapacidade para o trabalho habitual',
      coerencia: `${beneficio}: atende. Nada contradiz o benefício pedido (G18).`,
      pontoDeAtencao: social ? 'O laudo não cita a renda de todos que moram na casa; conferir o grupo familiar' : 'O laudo não cita a data do último vínculo; considerar quesito complementar',
      ...conteudo,
    }
  }
  return {
    favoravel: false,
    resumo: social
      ? 'A assistente social não constatou a vulnerabilidade: considerou a renda declarada sem as despesas com saúde.'
      : 'O perito não viu incapacidade atual: baseou-se no exame físico do dia.',
    conclusao: social ? 'Desfavorável · vulnerabilidade não constatada' : 'Desfavorável · sem incapacidade atual',
    coerencia: `${beneficio}: o laudo não reconhece o requisito do benefício pedido (G18).`,
    pontoDeAtencao: 'O laudo não comenta os documentos que o escritório levou',
    porque: social
      ? 'A avaliação não considerou as despesas com saúde, que estão nos comprovantes do escritório.'
      : 'O perito não comentou os laudos e os exames do escritório, que mostram a limitação há mais de um ano.',
    valeNovaPericia: true,
    ...conteudo,
  }
}

const DIA = 24 * 60 * 60 * 1000

/**
 * DP.09: a IA grava no perfil do perito o que ele observou, perguntou e pediu, com a referência do caso e sem dado pessoal
 * do cliente (CA1, CA2, CA4); um registro por laudo, sem sobrescrever nem duplicar (CA3, CA5). Sem perito reconhecido, o
 * laudo fica fora das contas até a pergunta de um clique (CA6). Os números do perfil são código (CA7).
 */
export function laudoNoPerfil(mundo: MundoDaPericia, pericia: Pericia, quando: string) {
  const r = pericia.resultado!
  if (!pericia.peritoId) {
    r.noPerfil = 'aguardando-perito'
    pericia.historico.push({ quando, quem: SISTEMA, oQue: 'O laudo não tem perito reconhecido: fica fora das contas até alguém ligar o perito (um clique)', passo: 'DP.09' })
    return
  }
  const { processo } = fichaDoProcesso(mundo, pericia.processoId)!
  const { anexadoEm } = r.laudo!
  const leitura = r.laudo!.leitura!
  const data = hojeIso(new Date(anexadoEm))
  const caso = processo.numero ?? `caso-${mundo.pericias!.indexOf(pericia) + 1}`
  const entrou = acrescentarLaudo(mundo, pericia.peritoId, {
    id: `laudo-${pericia.id}`,
    caso,
    data,
    tipo: pericia.tipo,
    assunto: leitura.assunto,
    resultado: r.registrado!.favoravel ? 'favoravel' : 'desfavoravel',
    dias: Math.max(0, Math.round((Date.parse(data) - Date.parse(pericia.marcacao!.data)) / DIA)),
    observou: leitura.observou,
    perguntou: leitura.perguntou,
    pediu: leitura.pediu,
  })
  r.noPerfil = 'atualizado'
  const perito = peritosDo(mundo).find((p) => p.id === pericia.peritoId)!
  pericia.historico.push({
    quando,
    quem: SISTEMA,
    oQue: entrou
      ? `A IA atualizou o perfil de ${perito.nome}: versão ${perito.laudos.length}, com o que o perito observou, perguntou e pediu (referência do caso: ${caso}, sem dado pessoal)`
      : `O laudo já estava no perfil de ${perito.nome}: nada se duplicou`,
    passo: 'DP.09',
  })
}

/** A data sai e volta "Remarcar perícia", contando no limite; passou dele, sobe para a advogada responsável (G15). */
function remarcar(pericia: Pericia, motivo: string, quem: string, agora: Date) {
  const quando = agora.toISOString()
  if (pericia.marcacao) (pericia.marcacoesAnteriores ??= []).push(pericia.marcacao)
  delete pericia.marcacao
  delete pericia.esperaComprovante
  delete pericia.lembrete
  pericia.remarcacoes += 1
  pericia.remarcadaEm = quando
  pericia.historico.push({ quando, quem, oQue: `Remarcação ${pericia.remarcacoes}: ${motivo}`, passo: 'DP.02' })
  if (passouDoLimite(pericia)) {
    pericia.historico.push({
      quando,
      quem: SISTEMA,
      oQue: `Passou do limite de ${LIMITE_DE_REMARCACOES_DA_PERICIA} remarcações: a perícia subiu para a advogada responsável (G15)`,
      passo: 'DP.02',
    })
  }
}

function comDocumentos(pericia: Pericia): DocumentosDaPericia {
  if (!pericia.documentos) throw new Error('Esta perícia não pede documento novo.')
  if (pericia.documentos.concluida) throw new Error('Os documentos desta perícia já foram concluídos.')
  return pericia.documentos
}

export const MINIMO_DO_MOTIVO = 3
export const MINIMO_DA_JUSTIFICATIVA = 10

/** Onde a mudança acontece: a perícia, o mundo em volta dela e a hora. */
export type NaPericia = { mundo: MundoDaPericia; pericia: Pericia; agora: Date }

/**
 * As mudanças da perícia, uma por ação das telas. Cada uma confere a regra e lança o motivo quando não pode; quem chama
 * grava. O servidor de exemplo e o de verdade usam as mesmas.
 */
export const mudancas = {
  /** A tentativa sem sucesso: o dia e o que aconteceu; a tarefa continua (GGVP-53, CA1). */
  tentativa({ pericia, agora }: NaPericia, t: { dia: string; oQueAconteceu: string }, quem: string) {
    const hoje = hojeIso(agora)
    const motivo = motivoParaNaoRegistrarTentativa(t, hoje)
    if (motivo) throw new Error(motivo)
    if (!podeMarcar(pericia)) throw new Error('Esta perícia não está para marcar.')
    const quando = agora.toISOString()
    pericia.tentativas.push({ dia: t.dia, oQueAconteceu: t.oQueAconteceu.trim(), quem, quando })
    pericia.historico.push({ quando, quem, oQue: `Tentativa sem sucesso em ${dataCurta(t.dia, hoje)}: ${t.oQueAconteceu.trim()}`, passo: 'DP.02' })
  },

  /** Registra a perícia conferida (GGVP-53, CA2, CA3, CA4); de novo, troca a data (CA8). */
  marcacao({ mundo, pericia, agora }: NaPericia, m: { comprovante: ArquivoEnviado; lido: LidoDoComprovante; pedeDocumentoNovo: boolean }, quem: string) {
    const motivo = motivoParaNaoRegistrarMarcacao({ comprovante: m.comprovante.nome, lido: m.lido, pedeDocumentoNovo: m.pedeDocumentoNovo }, hojeIso(agora))
    if (motivo) throw new Error(motivo)
    if (!podeMarcar(pericia) && situacaoDaPericia(pericia) !== 'agendada') throw new Error('Esta perícia não está para marcar.')
    marcar(mundo, pericia, m, quem, agora)
  },

  /**
   * A data do juízo registrada pelo Jurídico administrativo (GGVP-137): a publicação não a trouxe num formato que o sistema
   * lê, ou a perícia veio do despacho. Sem comprovante do INSS: vai à agenda e à ficha como a lida, com o lembrete e a orientação.
   */
  dataDoJuizo({ mundo, pericia, agora }: NaPericia, d: { data: string; hora: string; local: string }, quem: string) {
    if (pericia.instancia !== 'juizo') throw new Error('A data desta perícia vem do comprovante do INSS.')
    if (!podeMarcar(pericia)) throw new Error('Esta perícia não está para marcar.')
    const motivo = motivoDaDataDaPericia(d, hojeIso(agora))
    if (motivo) throw new Error(motivo)
    naAgendaPeloJuizo(pericia, { ...d, local: d.local.trim() }, quem, agora)
    montarOrientacao(mundo, pericia, agora)
  },

  /** Marcada no Meu INSS sem o comprovante ainda (DP.E1): a tarefa espera, com lembrete diário (GGVP-53, CA6). */
  esperarComprovante({ pericia, agora }: NaPericia, d: { pedeDocumentoNovo: boolean }, quem: string) {
    if (!podeMarcar(pericia)) throw new Error('Esta perícia não está para marcar.')
    const quando = agora.toISOString()
    pericia.esperaComprovante = { desde: quando }
    pericia.pedeDocumentoNovo = d.pedeDocumentoNovo
    if (d.pedeDocumentoNovo) abrirDocumentos(pericia, quando)
    pericia.historico.push(
      { quando, quem, oQue: 'Marcou no Meu INSS; o comprovante ainda não saiu: a tarefa espera, com lembrete diário', passo: 'DP.E1' },
      d.pedeDocumentoNovo
        ? { quando, quem, oQue: 'A perícia pede documento novo: atribuiu à Documentação (DP.03)', passo: 'DP.02' }
        : { quando, quem, oQue: 'A perícia não pede documento novo', passo: 'DP.02' },
    )
  },

  /** Remarcar (GGVP-53, CA8, CA9): a data sai, a tentativa de marcar recomeça e a remarcação conta no limite (G15). */
  remarcacao({ pericia, agora }: NaPericia, motivo: string, quem: string) {
    if (motivo.trim().length < MINIMO_DO_MOTIVO) throw new Error('Diga o motivo da remarcação.')
    if (!pericia.marcacao && !pericia.esperaComprovante) throw new Error('Esta perícia ainda não foi marcada.')
    if (situacaoDaPericia(pericia) === 'aguardando-resultado') throw new Error('A perícia já foi feita: o cliente compareceu.')
    remarcar(pericia, motivo.trim(), quem, agora)
  },

  /** A advogada responsável, no limite (G15), autoriza mais uma remarcação, com justificativa: volta ao Jurídico administrativo. */
  autorizacao({ pericia, agora }: NaPericia, justificativa: string, quem: string) {
    if (situacaoDaPericia(pericia) !== 'na-advogada') throw new Error('Esta perícia não está com a advogada.')
    if (justificativa.trim().length < MINIMO_DA_JUSTIFICATIVA) throw new Error('Escreva a justificativa (pelo menos 10 letras).')
    pericia.autorizadas = (pericia.autorizadas ?? 0) + 1
    pericia.historico.push({ quando: agora.toISOString(), quem, oQue: `Autorizou mais uma remarcação (G15): ${justificativa.trim()}`, passo: 'DP.02' })
  },

  /** O lembrete da véspera, enviado pelo Chatwoot depois de revisado pelo Jurídico (GGVP-53, CA7, Q5). */
  lembrete({ pericia, agora }: NaPericia, mensagem: string, quem: string) {
    if (!pericia.marcacao || !pericia.lembrete) throw new Error('A perícia ainda não tem data')
    const quando = agora.toISOString()
    pericia.lembrete = { ...pericia.lembrete, enviadoEm: quando, por: quem, mensagem }
    pericia.historico.push({ quando, quem, oQue: 'Enviou o lembrete da véspera pelo Chatwoot: data, hora, local e o que levar', passo: 'DP.04' })
  },

  /** O INSS liberou o agendamento (D2.E1): a tarefa entra na Central do Jurídico administrativo (GGVP-49, CA2). */
  liberacao({ pericia, agora }: NaPericia) {
    if (pericia.liberadaEm) return
    pericia.liberadaEm = agora.toISOString()
    pericia.historico.push({ quando: pericia.liberadaEm, quem: SISTEMA, oQue: 'O INSS liberou o agendamento; a tarefa entrou na Central do Jurídico administrativo', passo: 'D2.E1' })
  },

  /** A falta de um item, com justificativa (GGVP-56, CA5). */
  falta({ pericia, agora }: NaPericia, itemId: string, justificativa: string, quem: string) {
    const d = comDocumentos(pericia)
    const item = KIT_DA_PERICIA[pericia.tipo].find((i) => i.id === itemId)
    if (!item) throw new Error('Item da perícia não encontrado.')
    if (justificativa.trim().length < MINIMO_DA_FALTA) throw new Error('Diga por que o documento falta.')
    d.faltas[itemId] = justificativa.trim()
    pericia.historico.push({ quando: agora.toISOString(), quem, oQue: `Registrou a falta de ${item.nome.toLowerCase()}: ${justificativa.trim()}`, passo: 'DP.03' })
  },

  /**
   * "Anexar" um item (GGVP-56, CA2, CA4): o documento entra na pasta do cliente com o tipo do item e o item fica anexado.
   * O histórico diz o item, sem o nome do arquivo (pode trazer dado de saúde).
   */
  anexo({ mundo, pericia, agora }: NaPericia, a: { itemId: string; arquivo: ArquivoEnviado }, quem: string) {
    comDocumentos(pericia)
    const item = KIT_DA_PERICIA[pericia.tipo].find((i) => i.id === a.itemId)
    if (!item) throw new Error('Item da perícia não encontrado.')
    const { ficha } = fichaDoProcesso(mundo, pericia.processoId)!
    const nome = nomeNaPasta(ficha, a.arquivo.nome)
    ficha.arquivos.push({ nome, tipo: item.tipos[0], local: pericia.processoId, data: hojeIso(agora), origem: 'card', repetido: false, aguardaLeitura: false, hash: a.arquivo.hash })
    pericia.historico.push({ quando: agora.toISOString(), quem, oQue: `Anexou ${item.nome.toLowerCase()} na pasta do cliente`, passo: 'DP.03' })
  },

  /** Concluir (GGVP-56, CA5, CA6): cada item anexado ou justificado e as conferências; volta ao Jurídico administrativo. */
  conclusaoDosDocumentos({ mundo, pericia, agora }: NaPericia, c: { conferidas: string[] }, quem: string) {
    const d = comDocumentos(pericia)
    const { ficha } = fichaDoProcesso(mundo, pericia.processoId)!
    const ate = pericia.marcacao && prazosDaPericia(pericia.marcacao.data).documentosAte
    const na = documentosNaTela(ficha, pericia, hojeIso(agora), ate)!
    const exigidas = CONFERENCIAS_DA_PERICIA[pericia.tipo].map((x) => x.id)
    const motivo = motivoParaNaoConcluirDocumentos({ faltando: na.faltando.length, conferidas: c.conferidas, exigidas })
    if (motivo) throw new Error(motivo)
    const quando = agora.toISOString()
    d.concluida = { quando, quem, conferidas: c.conferidas }
    const anexados = na.itens.filter((i) => i.arquivo).length
    const faltas = na.itens.length - anexados
    const volta = pericia.marcacao ? 'ligar e orientar o cliente (DP.06)' : 'subir o comprovante do INSS (DP.02)'
    pericia.historico.push(
      { quando, quem, oQue: `Concluiu os documentos da perícia: ${anexados} anexado${anexados === 1 ? '' : 's'}${faltas ? `, ${faltas} com a falta justificada` : ''}`, passo: 'DP.03' },
      { quando, quem: SISTEMA, oQue: `O fluxo voltou ao Jurídico administrativo: ${volta}`, passo: 'DP.03' },
    )
  },

  /** O pedido ao médico (GGVP-56, CA7): só o que o documento deve abordar; recusa diagnóstico, CID, grau, conclusão e frase pronta (G20). */
  pedidoAoMedico({ pericia, agora }: NaPericia, abordar: string, quem: string) {
    const d = comDocumentos(pericia)
    if (!abordar.trim()) throw new Error('Escreva o que o documento deve abordar.')
    const problema = problemaG20(abordar)
    if (problema) throw new Error(problema)
    const quando = agora.toISOString()
    d.pedidosAoMedico.push({ quando, quem, abordar: abordar.trim() })
    pericia.historico.push({ quando, quem, oQue: 'Preparou o pedido ao médico do laudo da perícia (o que o documento deve abordar, G20)', passo: 'DP.03' })
  },

  /** A cobrança do dia, enviada pelo Chatwoot depois de conferida (Lucas, 02/10: a Documentação cobra, todo dia). */
  cobranca({ pericia, agora }: NaPericia, mensagem: string, quem: string) {
    const d = comDocumentos(pericia)
    const quando = agora.toISOString()
    d.cobrancas.push({ dia: hojeIso(agora), quando, quem, como: 'chatwoot', mensagem })
    pericia.historico.push({ quando, quem, oQue: 'Cobrou pelo Chatwoot o que a perícia pede e ainda falta', passo: 'DP.03' })
  },

  /** "Adiar": a cobrança de hoje fica para amanhã. */
  adiamentoDaCobranca({ pericia, agora }: NaPericia, quem: string) {
    const d = comDocumentos(pericia)
    const quando = agora.toISOString()
    d.cobrancas.push({ dia: hojeIso(agora), quando, quem, como: 'adiada' })
    pericia.historico.push({ quando, quem, oQue: 'Adiou a cobrança dos documentos da perícia para amanhã', passo: 'DP.03' })
  },

  /** Passou dos 10 dias antes com documento faltando: a advogada responsável registra o que decidiu (G15). */
  decisaoDaFalta({ pericia, agora }: NaPericia, texto: string, quem: string) {
    const d = comDocumentos(pericia)
    if (texto.trim().length < MINIMO_DA_JUSTIFICATIVA) throw new Error('Escreva a decisão (pelo menos 10 letras).')
    const quando = agora.toISOString()
    d.decisaoDaAdvogada = { quando, quem, texto: texto.trim() }
    pericia.historico.push({ quando, quem, oQue: `Decidiu sobre o documento que falta (G15): ${texto.trim()}`, passo: 'DP.03' })
  },

  /** A pergunta de um clique (GGVP-61, CA6): liga o perito; a orientação sai de novo pelo perfil. */
  perito({ mundo, pericia, agora }: NaPericia, peritoId: string, quem: string) {
    const perito = peritosDo(mundo).find((p) => p.id === peritoId)
    if (!perito) throw new Error('Perito não encontrado.')
    pericia.peritoId = perito.id
    delete pericia.peritoLido
    pericia.historico.push({ quando: agora.toISOString(), quem, oQue: `Ligou o perito: ${perito.nome}`, passo: 'DP.05' })
    if (pericia.marcacao) montarOrientacao(mundo, pericia, agora)
  },

  /**
   * A orientação passada ao cliente (GGVP-62): só com "Revisei a orientação" (CA3); o texto, editado ou não, é verificado
   * de novo (CA4). Com instrução proibida, guarda a tentativa recusada e devolve o motivo (CA6): quem chama grava e recusa.
   */
  orientacao({ mundo, pericia, agora }: NaPericia, o: { texto: string; canal: CanalDaOrientacao; revisei: boolean }, quem: string): string | null {
    if (!pericia.marcacao || !pericia.orientacao) throw new Error('A orientação ainda não está pronta.')
    if (!o.revisei) throw new Error('Marque "Revisei a orientação" antes de enviar.')
    const texto = o.texto.trim()
    if (!texto) throw new Error('Escreva a orientação.')
    if (o.canal === 'chatwoot' && !fichaDoProcesso(mundo, pericia.processoId)!.ficha.telefone) throw new Error('Sem telefone: complete na ficha antes de enviar.')
    const quando = agora.toISOString()
    const motivo = problemaDaOrientacao(texto)
    if (motivo) {
      ;(pericia.enviosRecusados ??= []).push({ quando, quem, motivo, texto })
      pericia.historico.push({ quando, quem: SISTEMA, oQue: `Recusou o envio da orientação por ${quem}: ${motivo}`, passo: 'DP.06' })
      return motivo
    }
    pericia.preparacao = { quando, quem, canal: o.canal, texto }
    pericia.historico.push({
      quando,
      quem,
      oQue: o.canal === 'chatwoot' ? 'Enviou a orientação pelo Chatwoot, como documento e instrução' : 'Ligou para o cliente e passou a orientação',
      passo: 'DP.06',
    })
    return null
  },

  /** A confirmação de presença (GGVP-66, CA7): confirmou ou não, com a observação. Não pode ir: é remarcar (CA9). */
  presenca({ pericia, agora }: NaPericia, c: { confirmou: boolean; observacao?: string }, quem: string) {
    const m = pericia.marcacao
    if (!m || situacaoDaPericia(pericia) !== 'agendada' || periciaJaPassou(m, agora)) throw new Error('Não há perícia por vir para confirmar.')
    const observacao = c.observacao?.trim() || undefined
    if (!c.confirmou && !observacao) throw new Error('Diga o que aconteceu na tentativa (não atendeu, caixa postal…).')
    const quando = agora.toISOString()
    m.confirmacao = { quando, quem, confirmou: c.confirmou, ...(observacao && { observacao }) }
    pericia.historico.push({
      quando,
      quem,
      oQue: c.confirmou ? `Confirmou a presença do cliente na perícia${observacao ? ` (${observacao})` : ''}` : `Não conseguiu confirmar a presença: ${observacao}`,
      passo: 'DP.07',
    })
  },

  /**
   * Depois do dia e da hora (GGVP-66, CA1): compareceu, o caso espera o resultado com a advogada responsável (CA5); faltou,
   * a data sai e volta "Remarcar perícia", contando no limite (CA2), que, passado, sobe para a advogada (CA3, G15).
   */
  comparecimento({ mundo, pericia, agora }: NaPericia, r: { compareceu: boolean; justificativa?: string }, quem: string) {
    const m = pericia.marcacao
    if (!m || situacaoDaPericia(pericia) !== 'agendada') throw new Error('Esta perícia não está agendada.')
    if (!periciaJaPassou(m, agora)) throw new Error(`A perícia ainda não aconteceu: o comparecimento abre depois de ${dataCurta(m.data, hojeIso(agora))}, ${m.hora}.`)
    const quando = agora.toISOString()
    const justificativa = r.justificativa?.trim() || undefined
    m.comparecimento = { quando, quem, compareceu: r.compareceu, ...(justificativa && { justificativa }) }
    const primeiro = fichaDoProcesso(mundo, pericia.processoId)!.ficha.nome.split(' ')[0]
    const porque = justificativa ? ` (${justificativa})` : ''
    if (r.compareceu) {
      pericia.historico.push(
        { quando, quem, oQue: `Registrou que ${primeiro} compareceu à ${NOMES_DO_TIPO[pericia.tipo]}${porque}`, passo: 'DP.07' },
        {
          quando,
          quem: SISTEMA,
          oQue: `Esperando o perito e o resultado (DP.E3, DP.E4): a advogada responsável acompanha ${pericia.instancia === 'inss' ? 'no GERID' : 'no processo'}`,
          passo: 'DP.E4',
        },
      )
      return
    }
    pericia.historico.push({ quando, quem, oQue: `Registrou que ${primeiro} não compareceu${porque || ' (sem justificativa)'}`, passo: 'DP.07' })
    remarcar(pericia, `${primeiro} não compareceu${porque}`, quem, agora)
  },

  /** A vigília do GERID (ou a publicação do laudo) viu o resultado (DP.E4): a tarefa da advogada fica urgente (GGVP-70, CA1). */
  resultadoDisponivel({ pericia, agora }: NaPericia) {
    if (situacaoDaPericia(pericia) !== 'aguardando-resultado') throw new Error('Esta perícia não espera resultado.')
    if (pericia.resultado?.disponivelEm) return
    const quando = agora.toISOString()
    pericia.resultado = { ...pericia.resultado, disponivelEm: quando }
    pericia.historico.push({
      quando,
      quem: SISTEMA,
      oQue: `O resultado apareceu ${pericia.instancia === 'inss' ? 'no GERID' : 'no processo'}: a tarefa da advogada ficou urgente`,
      passo: 'DP.E4',
    })
  },

  /**
   * O resultado (GGVP-70, CA2 a CA6). O laudo vai para a pasta; favorável, ou desfavorável sem nova perícia, o resultado
   * sobe no card e volta para quem pediu; desfavorável com nova perícia, o Jurídico administrativo marca de novo, sem contar
   * como remarcação. No desfavorável, a indicação da IA fica no histórico (Lucas, 02/10). Devolve a nova perícia, se abriu.
   * `novaId` é o id da nova perícia no servidor.
   */
  resultado(
    { mundo, pericia, agora }: NaPericia,
    r: { laudo: ArquivoEnviado; favoravel?: boolean; novaPericia?: boolean; conferidas: string[]; leitura?: LeituraDoLaudo },
    quem: string,
    novaId?: string,
  ): Pericia | undefined {
    if (situacaoDaPericia(pericia) !== 'aguardando-resultado') throw new Error('Esta perícia não espera resultado.')
    const exigidas = CONFERENCIAS_DO_RESULTADO[pericia.tipo].map((c) => c.id)
    const motivo = motivoParaNaoRegistrarResultado({ laudo: !!r.laudo.nome.trim(), favoravel: r.favoravel, novaPericia: r.novaPericia, conferidas: r.conferidas }, exigidas)
    if (motivo) throw new Error(motivo)
    const { ficha, processo } = fichaDoProcesso(mundo, pericia.processoId)!
    const hoje = hojeIso(agora)
    const quando = agora.toISOString()
    const nome = nomeNaPasta(ficha, r.laudo.nome)
    ficha.arquivos.push({ nome, tipo: 'laudo-pericia', local: pericia.processoId, data: hoje, origem: 'card', repetido: false, aguardaLeitura: false, hash: r.laudo.hash })
    // A leitura da IA de verdade, conferida pela advogada (GGVP-139), vem do servidor; na semente, a simulada.
    const leitura = r.leitura ?? leituraDoLaudo(pericia, nomeBeneficio(processo.beneficio), nome)
    const favoravel = r.favoravel!
    const nova = !favoravel && r.novaPericia === true
    const manifestarAte = pericia.instancia === 'juizo' && !nova ? prazoParaManifestar(hoje) : undefined
    pericia.resultado = {
      ...pericia.resultado,
      laudo: { nome, anexadoEm: quando, leitura },
      registrado: { quando, quem, favoravel, ...(!favoravel && { novaPericia: nova }), conferidas: r.conferidas, ...(manifestarAte && { manifestarAte }) },
    }
    pericia.historico.push({ quando, quem, oQue: `Registrou o resultado: ${favoravel ? 'favorável' : 'desfavorável'} (laudo ${nome})`, passo: 'DP.08' })
    if (!favoravel) {
      // O porquê é do laudo (conteúdo médico): fica no resumo, com o Jurídico; o histórico, todo mundo do caso vê. Sem a
      // leitura da IA (a advogada registrou pela dela), não há indicação a contar.
      if (leitura.valeNovaPericia !== undefined) {
        pericia.historico.push({ quando, quem: SISTEMA, oQue: `A IA indicou se vale pedir nova perícia: ${leitura.valeNovaPericia ? 'sim' : 'não'} (o porquê está no resumo do laudo)`, passo: 'DP.10' })
      }
      pericia.historico.push({ quando, quem, oQue: nova ? 'Decidiu pedir nova perícia' : 'Decidiu não pedir nova perícia: o caso volta à origem marcado como desfavorável', passo: 'DP.10' })
    }
    let outra: Pericia | undefined
    if (nova) {
      const m = pericia.marcacao!
      outra = criarPericia(
        mundo,
        pericia.processoId,
        { origem: pericia.origem, tipo: pericia.tipo, instancia: pericia.instancia, pedidaPor: quem, oQuePede: `nova ${NOMES_DO_TIPO[pericia.tipo]}, depois do resultado desfavorável de ${dataCurta(m.data, hoje)}` },
        agora,
        agora,
        novaId,
      )
      pericia.historico.push({ quando, quem: SISTEMA, oQue: `Abriu a nova perícia para o Jurídico administrativo marcar (não conta como remarcação): ${outra.id}`, passo: 'DP.10' })
    } else {
      pericia.historico.push({
        quando,
        quem: SISTEMA,
        oQue:
          `O resultado subiu no card e voltou para quem pediu (${ORIGENS[pericia.origem].rotulo}): ${COMO_SEGUE[pericia.origem]}` +
          (manifestarAte ? `, até ${dataCurta(manifestarAte, hoje)} (${DIAS_PARA_MANIFESTAR} dias, G12)` : ''),
        passo: 'DP.08',
      })
    }
    // O laudo segue para o perfil do perito, na médica e na social (CA7; GGVP-73).
    laudoNoPerfil(mundo, pericia, quando)
    return outra
  },

  /** A IA roda de novo sobre o laudo registrado: o mesmo laudo não se duplica no perfil (GGVP-73, CA5). */
  perfilComOLaudo({ mundo, pericia, agora }: NaPericia) {
    if (!pericia.resultado?.registrado) throw new Error('O resultado ainda não foi registrado.')
    laudoNoPerfil(mundo, pericia, agora.toISOString())
  },

  /** A pergunta de um clique (GGVP-73, CA6): ligado o perito, o laudo sai da espera e entra no perfil dele. */
  peritoDoLaudo({ mundo, pericia, agora }: NaPericia, peritoId: string, quem: string) {
    if (pericia.resultado?.noPerfil !== 'aguardando-perito') throw new Error('Este laudo não espera o perito.')
    const perito = peritosDo(mundo).find((p) => p.id === peritoId)
    if (!perito) throw new Error('Perito não encontrado.')
    pericia.peritoId = perito.id
    delete pericia.peritoLido
    const quando = agora.toISOString()
    pericia.historico.push({ quando, quem, oQue: `Ligou o laudo ao perito: ${perito.nome}`, passo: 'DP.09' })
    laudoNoPerfil(mundo, pericia, quando)
  },
}

/** O detalhe da linha da tarefa, como no Figma (2051:173). */
function detalheDaTarefa(t: PericiaNaTela): string {
  const { pericia } = t
  const onde = pericia.instancia === 'inss' ? 'no Meu INSS (senha no cofre); subir o comprovante' : `no ${NOMES_DA_INSTANCIA[pericia.instancia].toLowerCase()}`
  const deOnde = esperaOInss(pericia.origem) ? 'o INSS já liberou o agendamento' : ORIGENS[pericia.origem].rotulo
  return [t.beneficio, NOMES_DO_TIPO[pericia.tipo], deOnde, onde].join(' · ')
}

/** A orientação pronta e ainda não passada ao cliente; com documento novo, só depois da Documentação (GGVP-61, GGVP-62). */
export const paraOrientar = ({ situacao, jaPassou, pericia: p }: PericiaNaTela) =>
  situacao === 'agendada' && !jaPassou && !!p.orientacao && !p.preparacao && (!p.pedeDocumentoNovo || !!p.documentos?.concluida)

/** Para onde "Ver a perícia" leva: a tela do passo em que a perícia está. */
export function hrefDoPasso(t: PericiaNaTela): string {
  const base = `/casos/${t.processo.id}/pericia`
  if (t.situacao === 'aguardando-inss') return `${base}/aberta`
  if (t.situacao === 'aguardando-resultado' || t.situacao === 'concluida') return `${base}/resultado`
  if (paraOrientar(t)) return `${base}/orientar`
  if (t.jaPassou || (t.presenca && t.presenca !== 'ainda-nao')) return `${base}/comparecimento`
  if (t.situacao === 'marcar' || t.situacao === 'aguardando-comprovante' || t.situacao === 'agendada') return `${base}/marcar`
  return base
}

const todasNaTela = (mundo: MundoDaPericia, agora: Date) => (mundo.pericias ?? []).map((p) => naTela(mundo, p, agora))

/** As tarefas da perícia na Central do Jurídico administrativo (GGVP-49, CA2): "<nome> · Marcar perícia", liberadas. */
export function tarefasDoJuridicoAdmEm(mundo: MundoDaPericia, agora: Date): Tarefa[] {
  const hoje = hojeIso(agora)
  const tarefas: Tarefa[] = []
  for (const t of todasNaTela(mundo, agora)) {
    const { pericia, ficha, processo } = t
    const base = { cliente: { id: ficha.id, nome: ficha.nome }, processoId: processo.id, href: `/casos/${processo.id}/pericia/marcar` }
    if (t.situacao === 'marcar') {
      const prazo = prazoFalado(t.proximaTentativa!, hoje)
      const acao = pericia.remarcacoes > 0 ? 'Remarcar perícia' : 'Marcar perícia'
      tarefas.push({ ...base, id: `pericia-marcar-${pericia.id}`, codigo: 'DP.02', acao, detalhe: detalheDaTarefa(t), prazo: prazo.texto, urgente: prazo.urgente })
    }
    // A espera do comprovante (DP.E1, CA6): lembrete diário até ele sair.
    if (t.situacao === 'aguardando-comprovante') {
      const prazo = prazoFalado(somarDias(hojeIso(new Date(pericia.esperaComprovante!.desde)), 1), hoje)
      tarefas.push({
        ...base,
        id: `pericia-comprovante-${pericia.id}`,
        codigo: 'DP.02',
        acao: 'Subir o comprovante do INSS',
        detalhe: [t.beneficio, NOMES_DO_TIPO[pericia.tipo], 'marcada no Meu INSS; o comprovante ainda não saiu (DP.E1)', 'lembrete diário'].join(' · '),
        prazo: prazo.texto,
        urgente: prazo.urgente,
      })
    }
    // A orientação pronta (GGVP-61): depois dos documentos, quando a perícia pede, o Jurídico administrativo liga e orienta (DP.06).
    if (paraOrientar(t) && t.prazos) {
      const prazo = prazoFalado(t.prazos.preparoAte, hoje)
      const m = pericia.marcacao!
      const como = pericia.orientacao!.bloqueio
        ? 'orientação bloqueada pela verificação: revisar'
        : `orientação da IA pronta (${pericia.orientacao!.modo === 'perfil' ? 'pelo perfil do perito' : 'padrão'})`
      tarefas.push({
        ...base,
        href: `/casos/${processo.id}/pericia/orientar`,
        id: `pericia-orientar-${pericia.id}`,
        codigo: 'DP.06',
        acao: 'Orientar para a perícia',
        detalhe: [t.beneficio, `${NOMES_DO_TIPO[pericia.tipo]} em ${dataCurta(m.data, hoje)}${m.origem !== 'juizo' ? '' : m.registradaPor === SISTEMA ? ' (data lida da publicação pelo sistema)' : ' (data do juízo)'}`, como, 'ligar para o cliente'].join(' · '),
        prazo: prazo.texto,
        urgente: prazo.urgente,
      })
    }
    const comparecimento = `/casos/${processo.id}/pericia/comparecimento`
    // A confirmação de presença da véspera (GGVP-66, CA7); passou das 16h sem confirmar, o alerta para contatar o cliente (CA8).
    if (t.presenca && t.presenca !== 'ainda-nao') {
      const m = pericia.marcacao!
      const tentou = m.confirmacao ? [`não confirmou: ${m.confirmacao.observacao}`] : []
      tarefas.push({
        ...base,
        href: comparecimento,
        id: `pericia-presenca-${pericia.id}`,
        codigo: 'DP.07',
        acao: 'Confirmar presença na perícia',
        detalhe: [
          t.beneficio,
          `${NOMES_DO_TIPO[pericia.tipo]} ${m.data === hoje ? 'hoje' : 'amanhã'}, ${m.hora}`,
          ...tentou,
          t.presenca === 'atrasada' ? `presença não confirmada até ${HORA_DA_CONFIRMACAO}h: contatar o cliente` : `confirmar até ${HORA_DA_CONFIRMACAO}h`,
        ].join(' · '),
        prazo: 'hoje',
        urgente: true,
      })
    }
    // Passou o dia e a hora (CA1); no dia seguinte, sem registro, vira alerta (CA6).
    if (t.jaPassou) {
      const m = pericia.marcacao!
      tarefas.push({
        ...base,
        href: comparecimento,
        id: `pericia-comparecimento-${pericia.id}`,
        codigo: 'DP.07',
        acao: 'Registrar comparecimento',
        detalhe: [
          t.beneficio,
          `${NOMES_DO_TIPO[pericia.tipo]} em ${dataCurta(m.data, hoje)}, ${m.hora}`,
          m.local,
          ...(hoje >= t.prazos!.diaSeguinte ? ['alerta: o comparecimento não foi registrado'] : []),
        ].join(' · '),
        prazo: prazoFalado(m.data, hoje).texto,
        urgente: true,
      })
    }
    // O lembrete da véspera (CA7): o Jurídico confere a mensagem e envia pelo Chatwoot (Q5).
    if (t.lembreteHoje) {
      const m = pericia.marcacao!
      tarefas.push({
        ...base,
        id: `pericia-lembrete-${pericia.id}`,
        codigo: 'DP.04',
        acao: 'Enviar o lembrete da véspera',
        detalhe: [t.beneficio, `${NOMES_DO_TIPO[pericia.tipo]} em ${dataCurta(m.data, hoje)}, ${m.hora}`, m.local].join(' · '),
        prazo: 'hoje',
        urgente: true,
      })
    }
  }
  return tarefas
}

/** As da advogada responsável: o limite de remarcações (GGVP-53, CA9, G15) e o resultado (GGVP-70). Nunca a sênior. */
export function tarefasDaAdvogadaEm(mundo: MundoDaPericia, agora: Date): Tarefa[] {
  return todasNaTela(mundo, agora).flatMap((t): Tarefa[] => {
    const comum = { cliente: { id: t.ficha.id, nome: t.ficha.nome }, href: `/casos/${t.processo.id}/pericia`, processoId: t.processo.id }
    if (t.situacao === 'na-advogada') {
      return [
        {
          ...comum,
          id: `pericia-limite-${t.pericia.id}`,
          codigo: 'DP.02',
          acao: 'Decidir a perícia',
          detalhe: [t.beneficio, NOMES_DO_TIPO[t.pericia.tipo], `${t.pericia.remarcacoes} remarcações: passou do limite (G15)`].join(' · '),
          prazo: 'hoje',
          urgente: true,
        },
      ]
    }
    // Compareceu (GGVP-66, CA5): a advogada responsável acompanha o resultado no GERID ou no processo (GGVP-70).
    if (t.situacao === 'aguardando-resultado') {
      const m = t.pericia.marcacao!
      const onde = t.pericia.instancia === 'inss' ? 'no GERID' : 'no processo'
      // O resultado no GERID ou no processo deixa a tarefa urgente (GGVP-70, CA1).
      const saiu = !!t.pericia.resultado?.disponivelEm
      return [
        {
          ...comum,
          href: `/casos/${t.processo.id}/pericia/resultado`,
          id: `pericia-resultado-${t.pericia.id}`,
          codigo: 'DP.08',
          acao: 'Conferir resultado da perícia',
          detalhe: [t.beneficio, `${NOMES_DO_TIPO[t.pericia.tipo]} feita em ${dataCurta(m.data, hojeIso(agora))}`, saiu ? `resultado ${onde}` : `esperando o resultado ${onde}`].join(' · '),
          prazo: saiu ? 'hoje' : 'esperando o resultado',
          urgente: saiu,
        },
      ]
    }
    return []
  })
}

/** As tarefas da Documentação na Central do Atendimento: reunir e, quando é dia, cobrar (GGVP-56, CA1, CA2, CA3). */
export function tarefasDaDocumentacaoEm(mundo: MundoDaPericia, agora: Date): Tarefa[] {
  const hoje = hojeIso(agora)
  const tarefas: Tarefa[] = []
  for (const t of todasNaTela(mundo, agora)) {
    const { pericia, ficha, processo, documentos } = t
    if (!documentos || pericia.documentos!.concluida) continue
    const cliente = { id: ficha.id, nome: ficha.nome }
    const quando = `${NOMES_DO_TIPO[pericia.tipo]}${pericia.marcacao ? ` em ${dataCurta(pericia.marcacao.data, hoje)}` : ''}`
    const prazo = t.prazos ? prazoFalado(t.prazos.documentosAte, hoje) : { texto: 'sem data ainda', urgente: false }
    const quantos = documentos.faltando.length
    tarefas.push({
      id: `pericia-documentos-${pericia.id}`,
      codigo: 'DP.03',
      cliente,
      acao: 'Reunir documentos da perícia',
      detalhe: [t.beneficio, quando, quantos ? `falta${quantos === 1 ? '' : 'm'} ${quantos}` : 'tudo anexado: conferir e concluir'].join(' · '),
      prazo: prazo.texto,
      urgente: prazo.urgente,
      href: `/casos/${processo.id}/pericia/documentos`,
      processoId: processo.id,
    })
    if (documentos.cobrarHoje) {
      tarefas.push({
        id: `pericia-cobrar-${pericia.id}`,
        codigo: 'DP.03',
        cliente,
        acao: 'Cobrar documento da perícia',
        detalhe: [t.beneficio, documentos.faltando.map((i) => i.nome.toLowerCase()).join(', '), 'cobrança diária'].join(' · '),
        prazo: 'hoje',
        urgente: true,
        href: `/casos/${processo.id}/pericia/cobranca`,
        processoId: processo.id,
      })
    }
  }
  return tarefas
}

/** Passou dos 10 dias antes com documento faltando e sem decisão: a advogada responsável decide (G15). */
export function tarefasDeDecidirDocumentoEm(mundo: MundoDaPericia, agora: Date): Tarefa[] {
  const hoje = hojeIso(agora)
  return todasNaTela(mundo, agora)
    .filter((t) => t.documentos?.passouDoLimite && !t.pericia.documentos!.decisaoDaAdvogada)
    .map((t) => ({
      id: `pericia-falta-${t.pericia.id}`,
      codigo: 'DP.03',
      cliente: { id: t.ficha.id, nome: t.ficha.nome },
      acao: 'Decidir documento da perícia',
      detalhe: [t.beneficio, `falta ${t.documentos!.faltando.map((i) => i.nome.toLowerCase()).join(', ')}`, `perícia em ${dataCurta(t.pericia.marcacao!.data, hoje)} (G15)`].join(' · '),
      prazo: 'hoje',
      urgente: true,
      href: `/casos/${t.processo.id}/pericia`,
      processoId: t.processo.id,
    }))
}
