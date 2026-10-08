// EXEMPLO. Servidor de exemplo da perícia (épico GGVP-10), sobre o mesmo banco de servidor.ts. A perícia nasce por
// `iniciarPericia`, com a forma da decisão D2.03 do servidor do Mateus (GGVP-31), do despacho da sênior (D3) e do pedido
// do juiz (D3a): ponta para ligar na junção com o INSS. A semente faz o papel dessas decisões para os clientes de exemplo.
// Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da design.md (change ggvp-10). IA, Meu INSS,
// GERID e Chatwoot são simulados.
import { diaDaSemana, diaFalado, somarDias } from '../regras/agenda.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import {
  COMO_SEGUE,
  CONFERENCIAS_DO_RESULTADO,
  DIAS_ANTES_DOCUMENTOS,
  DIAS_ANTES_PREPARO,
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
  mensagemDoLembrete,
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
} from '../regras/pericia.ts'
import { problemaG20 } from '../regras/parecer.ts'
import { emVigor } from '../regras/roteiro.ts'
import { nomeBeneficio } from './catalogos.ts'
import { perfilDoPerito, peritosDo, reconhecerPerito, type PerfilDoPerito } from './peritos.ts'
import { roteiroDoCaso } from './roteiro.ts'
import { agora, esperar, gravar, ler, type Banco } from './servidor.ts'
import type { Arquivo, EventoDaAgenda, Ficha, Processo, Tarefa } from './tipos.ts'

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
 * por tipo de processo"). As declarações valem para a avaliação social (Lucas, 02/10, Q3). Ligar no servidor: vem da
 * configuração, como a lista de cada benefício (GGVP-91).
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
  /** O que o perito observou, perguntou e pediu, para o perfil dele (GGVP-73). */
  observou: string[]
  perguntou: string[]
  pediu: string[]
}

export type ResultadoDaPericia = {
  /** O resultado apareceu no GERID ou no processo (DP.E4): a tarefa da advogada fica urgente (CA1). */
  disponivelEm?: string
  laudo?: { nome: string; anexadoEm: string; leitura: LeituraDoLaudo }
  /** O que a advogada registrou (CA2 a CA5); no judicial, até quando manifestar (G12). */
  registrado?: { quando: string; quem: string; favoravel: boolean; novaPericia?: boolean; conferidas: string[]; manifestarAte?: string }
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

function fichaDoProcesso(banco: Banco, processoId: string): { ficha: Ficha; processo: Processo } | null {
  for (const ficha of banco.fichas) {
    const processo = ficha.processos.find((p) => p.id === processoId)
    if (processo) return { ficha, processo }
  }
  return null
}

/** Abre a perícia e o primeiro passo dela: o sistema abre a tarefa para o Jurídico administrativo (DP.01). */
function criar(banco: Banco, processoId: string, pedido: PedidoDePericia, quando: Date, liberadaEm?: Date): Pericia {
  const achado = fichaDoProcesso(banco, processoId)
  if (!achado) throw new Error('Processo não encontrado')
  const origem = ORIGENS[pedido.origem]
  const iso = quando.toISOString()
  const pericias = (banco.pericias ??= [])
  const liberada = esperaOInss(pedido.origem) ? liberadaEm?.toISOString() : iso
  const pericia: Pericia = {
    id: `pericia-${processoId}-${pericias.filter((p) => p.processoId === processoId).length + 1}`,
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
  if (pedido.dataDoJuizo) {
    const { data, hora, local } = pedido.dataDoJuizo
    pericia.marcacao = { data, hora, local, modalidade: 'presencial', tipo: pedido.tipo, origem: 'juizo', registradaEm: iso, registradaPor: SISTEMA }
    pericia.lembrete = { para: prazosDaPericia(data).vespera }
    pericia.historico.push(
      { quando: iso, quem: SISTEMA, oQue: `Leu a data na publicação e pôs na agenda e na ficha: ${dataCurta(data, hojeIso(quando))}, ${hora}, ${local}`, passo: 'DP.04' },
      { quando: iso, quem: SISTEMA, oQue: `Agendou o lembrete da véspera para ${dataCurta(pericia.lembrete.para, hojeIso(quando))}`, passo: 'DP.04' },
    )
  }
  if (pedido.peritoLido) {
    const perito = reconhecerPerito(banco, pedido.peritoLido)
    if (perito) pericia.peritoId = perito.id
    else pericia.peritoLido = pedido.peritoLido
  }
  if (pericia.marcacao) montarOrientacao(banco, pericia, quando)
  pericias.push(pericia)
  return pericia
}

/** O que a IA leu do comprovante da semente: o local de cada caso. Outro PDF cai numa agência de exemplo. */
const LOCAIS_DOS_COMPROVANTES: Record<string, string> = {
  'maria-exemplo-1': 'Agência INSS Santo Amaro (exemplo)',
  'pedro-exemplo-1': 'visita domiciliar · Agência INSS Penha (exemplo)',
}

/** O primeiro dia útil a partir de `iso`. */
function diaUtil(iso: string): string {
  let dia = iso
  while (diaDaSemana(dia) === 0 || diaDaSemana(dia) === 6) dia = somarDias(dia, 1)
  return dia
}

/**
 * IA simulada (CA2): o que o comprovante do INSS diz. A data vem do nome do arquivo quando ele traz uma (aaaa-mm-dd);
 * senão, duas semanas adiante (uma a mais a cada data trocada), num dia útil, às 08:30. O perito nunca vem.
 */
function leitura(pericia: Pericia, nome: string, hoje: string): LidoDoComprovante {
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

/** Grava a marcação conferida: pasta, agenda, ficha, lembrete e a decisão do documento novo (CA2, CA4, CA8). */
function marcar(banco: Banco, pericia: Pericia, m: { comprovante: { nome: string; hash?: string }; lido: LidoDoComprovante; pedeDocumentoNovo: boolean }, quem: string) {
  const { ficha } = fichaDoProcesso(banco, pericia.processoId)!
  const quando = agora().toISOString()
  const hoje = hojeIso(agora())
  const nomes = ficha.arquivos.map((a) => a.nome)
  const nome = nomes.includes(m.comprovante.nome) ? m.comprovante.nome.replace(/(\.pdf)$/i, ' (2)$1') : m.comprovante.nome
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
  montarOrientacao(banco, pericia, agora())
  // Data ou local mudados (GGVP-62, CA5): a orientação saiu de novo e a preparação de antes deixa de valer.
  if (pericia.preparacao && anterior && (anterior.data !== m.lido.data || anterior.hora !== m.lido.hora || anterior.local !== m.lido.local)) {
    delete pericia.preparacao
    pericia.historico.push({ quando, quem: SISTEMA, oQue: 'A data ou o local mudou: a orientação passada antes deixou de valer; ligar e orientar de novo', passo: 'DP.06' })
  }
}

/** Hoje (ou n dias antes), à hora dada, no fuso local. */
function em(dias: number, horas: number, minutos = 0): Date {
  const hoje = agora()
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, horas, minutos)
}

const DRA_PAULA = 'Dra. Paula (exemplo)'
/** O Jurídico administrativo de exemplo (o mesmo do servidor do Mateus). */
const IGOR = 'Igor (exemplo)'

/**
 * A semente, pelo mesmo caminho do `iniciarPericia`: a Maria (perícia médica pedida pela advogada no D2.03 ontem; o INSS
 * liberou o agendamento hoje cedo), o Pedro (avaliação social pedida na exigência do INSS, já marcada pelo Igor, com
 * documento novo para a Documentação) e o Antônio (perícia médica pedida pelo juiz; a data veio da publicação).
 */
function semear(banco: Banco): Pericia[] {
  banco.pericias = []
  criar(banco, 'maria-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: DRA_PAULA }, em(-1, 16, 10), em(0, 8))
  const pedro = criar(
    banco,
    'pedro-exemplo-1',
    {
      origem: 'd2-exigencia',
      tipo: 'social',
      instancia: 'inss',
      pedidaPor: DRA_PAULA,
      oQuePede: 'avaliação social pedida pelo INSS na exigência: visita à casa e composição do grupo familiar',
    },
    em(-3, 11),
    em(-2, 9),
  )
  const hoje = hojeIso(agora())
  const lido = { ...leitura(pedro, 'comprovante.pdf', hoje), data: diaUtil(somarDias(hoje, 16)), hora: '09:00' }
  marcar(banco, pedro, { comprovante: { nome: 'comprovante_avaliacao_social_pedro.pdf' }, lido, pedeDocumentoNovo: true }, IGOR)
  // A marcação do Pedro foi ontem à tarde: o histórico guarda a hora em que aconteceu.
  for (const e of pedro.historico.slice(-5)) e.quando = em(-1, 14, 20).toISOString()
  pedro.marcacao!.registradaEm = em(-1, 14, 20).toISOString()
  pedro.documentos!.abertaEm = em(-1, 14, 20).toISOString()
  pedro.orientacao!.geradaEm = em(-1, 14, 20).toISOString()
  criar(
    banco,
    'antonio-exemplo-1',
    {
      origem: 'd3a-juiz',
      tipo: 'medica',
      instancia: 'juizo',
      pedidaPor: 'Juízo da Vara Federal de Santo Amaro (exemplo)',
      oQuePede: 'perícia médica judicial pedida pelo juiz, com o perito nomeado na publicação',
      peritoLido: 'Dr. A. Prado',
      dataDoJuizo: { data: diaUtil(somarDias(hoje, 9)), hora: '10:30', local: 'Vara Federal de Santo Amaro (exemplo) · sala de perícias' },
    },
    em(-1, 9, 40),
  )
  return banco.pericias
}

/** O banco com as perícias da semente já gravadas. */
function lerComPericias(): Banco {
  const banco = ler()
  if (!banco.pericias) {
    semear(banco)
    gravar(banco)
  }
  return banco
}

/** A perícia em andamento do processo (a mais nova). */
const periciaDo = (banco: Banco, processoId: string) => banco.pericias?.filter((p) => p.processoId === processoId).at(-1)

function naTela(banco: Banco, pericia: Pericia): PericiaNaTela {
  const { ficha, processo } = fichaDoProcesso(banco, pericia.processoId)!
  const hoje = hojeIso(agora())
  const situacao = situacaoDaPericia(pericia)
  const { marcacao, lembrete } = pericia
  // Depois de uma remarcação, a tentativa diária recomeça do dia dela.
  const desde = hojeIso(new Date(pericia.remarcadaEm ?? pericia.liberadaEm ?? pericia.abertaEm))
  const jaPassou = situacao === 'agendada' && periciaJaPassou(marcacao!, agora())
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
    perfil: pericia.peritoId ? perfilDoPerito(peritosDo(banco).find((p) => p.id === pericia.peritoId)!) : undefined,
    jaPassou,
    anteriores: (banco.pericias ?? []).slice(0, banco.pericias!.indexOf(pericia)).filter((p) => p.processoId === pericia.processoId),
    ...(situacao === 'agendada' && !jaPassou && !marcacao!.confirmacao?.confirmou && { presenca: confirmacaoDaPresenca(marcacao!.data, agora()) }),
  }
}

/** Lê o banco, acha a perícia do processo e aplica a mudança; grava e devolve a perícia na tela. */
async function mudar(processoId: string, mudanca: (banco: Banco, pericia: Pericia, hoje: string) => void): Promise<PericiaNaTela> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  if (!pericia) throw new Error('Este caso não tem perícia')
  mudanca(banco, pericia, hojeIso(agora()))
  gravar(banco)
  return naTela(banco, pericia)
}

const podeMarcar = (p: Pericia) => ['marcar', 'aguardando-comprovante'].includes(situacaoDaPericia(p))

/** POST /api/processos/:id/pericia/tentativas. A tentativa sem sucesso: o dia e o que aconteceu; a tarefa continua (CA1). */
export function registrarTentativa(processoId: string, t: { dia: string; oQueAconteceu: string }, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia, hoje) => {
    const motivo = motivoParaNaoRegistrarTentativa(t, hoje)
    if (motivo) throw new Error(motivo)
    if (!podeMarcar(pericia)) throw new Error('Esta perícia não está para marcar.')
    const quando = agora().toISOString()
    pericia.tentativas.push({ dia: t.dia, oQueAconteceu: t.oQueAconteceu.trim(), quem, quando })
    pericia.historico.push({ quando, quem, oQue: `Tentativa sem sucesso em ${dataCurta(t.dia, hoje)}: ${t.oQueAconteceu.trim()}`, passo: 'DP.02' })
  })
}

/** POST /api/processos/:id/pericia/comprovante/leitura. IA simulada: lê data, hora, local e tipo; o perito não vem (CA2, CA3). */
export async function lerComprovante(processoId: string, nome: string): Promise<LidoDoComprovante> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  if (!pericia) throw new Error('Este caso não tem perícia')
  return leitura(pericia, nome, hojeIso(agora()))
}

/** POST /api/processos/:id/pericia/marcacao. Registra a perícia conferida (CA2, CA3, CA4); de novo, troca a data (CA8). */
export function registrarMarcacao(
  processoId: string,
  m: { comprovante: { nome: string; hash?: string }; lido: LidoDoComprovante; pedeDocumentoNovo: boolean },
  quem: string,
): Promise<PericiaNaTela> {
  return mudar(processoId, (banco, pericia, hoje) => {
    const motivo = motivoParaNaoRegistrarMarcacao({ comprovante: m.comprovante.nome, lido: m.lido, pedeDocumentoNovo: m.pedeDocumentoNovo }, hoje)
    if (motivo) throw new Error(motivo)
    if (!podeMarcar(pericia) && situacaoDaPericia(pericia) !== 'agendada') throw new Error('Esta perícia não está para marcar.')
    marcar(banco, pericia, m, quem)
  })
}

/** Marcada no Meu INSS sem o comprovante ainda (DP.E1): a tarefa espera, com lembrete diário (CA6). */
export function esperarComprovante(processoId: string, d: { pedeDocumentoNovo: boolean }, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    if (!podeMarcar(pericia)) throw new Error('Esta perícia não está para marcar.')
    const quando = agora().toISOString()
    pericia.esperaComprovante = { desde: quando }
    pericia.pedeDocumentoNovo = d.pedeDocumentoNovo
    if (d.pedeDocumentoNovo) abrirDocumentos(pericia, quando)
    pericia.historico.push(
      { quando, quem, oQue: 'Marcou no Meu INSS; o comprovante ainda não saiu: a tarefa espera, com lembrete diário', passo: 'DP.E1' },
      d.pedeDocumentoNovo
        ? { quando, quem, oQue: 'A perícia pede documento novo: atribuiu à Documentação (DP.03)', passo: 'DP.02' }
        : { quando, quem, oQue: 'A perícia não pede documento novo', passo: 'DP.02' },
    )
  })
}

export const MINIMO_DO_MOTIVO = 3

/** Remarcar (CA8, CA9): a data sai, a tentativa de marcar recomeça e a remarcação conta no limite (G15). */
export function remarcarPericia(processoId: string, motivo: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    if (motivo.trim().length < MINIMO_DO_MOTIVO) throw new Error('Diga o motivo da remarcação.')
    if (!pericia.marcacao && !pericia.esperaComprovante) throw new Error('Esta perícia ainda não foi marcada.')
    if (situacaoDaPericia(pericia) === 'aguardando-resultado') throw new Error('A perícia já foi feita: o cliente compareceu.')
    remarcar(pericia, motivo.trim(), quem)
  })
}

/** A data sai e volta "Remarcar perícia", contando no limite; passou dele, sobe para a advogada responsável (G15). */
function remarcar(pericia: Pericia, motivo: string, quem: string) {
  const quando = agora().toISOString()
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

export const MINIMO_DA_JUSTIFICATIVA = 10

/** A advogada responsável, no limite (G15), autoriza mais uma remarcação, com justificativa: volta ao Jurídico administrativo. */
export function autorizarRemarcacao(processoId: string, justificativa: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    if (situacaoDaPericia(pericia) !== 'na-advogada') throw new Error('Esta perícia não está com a advogada.')
    if (justificativa.trim().length < MINIMO_DA_JUSTIFICATIVA) throw new Error('Escreva a justificativa (pelo menos 10 letras).')
    pericia.autorizadas = (pericia.autorizadas ?? 0) + 1
    pericia.historico.push({ quando: agora().toISOString(), quem, oQue: `Autorizou mais uma remarcação (G15): ${justificativa.trim()}`, passo: 'DP.02' })
  })
}

/** A mensagem do lembrete da véspera, para conferir no Chatwoot (CA7). */
export async function obterLembrete(processoId: string): Promise<{ nome: string; telefone: string; mensagem: string }> {
  const t = await obterPericia(processoId)
  if (!t?.pericia.marcacao) throw new Error('A perícia ainda não tem data')
  const { marcacao } = t.pericia
  return {
    nome: t.ficha.nome,
    telefone: t.ficha.telefone,
    mensagem: mensagemDoLembrete({ nome: t.ficha.nome, tipo: marcacao.tipo, data: marcacao.data, hora: marcacao.hora, local: marcacao.local }, diaFalado(marcacao.data)),
  }
}

/** POST /api/processos/:id/pericia/lembrete. Enviado pelo Chatwoot depois de revisado pelo Jurídico (CA7, Q5). */
export function registrarLembrete(processoId: string, mensagem: string, quem = 'Jurídico administrativo'): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    if (!pericia.marcacao || !pericia.lembrete) throw new Error('A perícia ainda não tem data')
    const quando = agora().toISOString()
    pericia.lembrete = { ...pericia.lembrete, enviadoEm: quando, por: quem, mensagem }
    pericia.historico.push({ quando, quem, oQue: 'Enviou o lembrete da véspera pelo Chatwoot: data, hora, local e o que levar', passo: 'DP.04' })
  })
}

/** Chamado pela GGVP-31 (D2.03), pelo despacho da sênior (D3) e pelo pedido do juiz (D3a). Ponta para ligar na junção. */
export async function iniciarPericia(processoId: string, pedido: PedidoDePericia): Promise<Pericia> {
  await esperar()
  const banco = lerComPericias()
  const pericia = criar(banco, processoId, pedido, agora())
  gravar(banco)
  return pericia
}

/** A vigília do INSS viu o agendamento liberado (D2.E1): a tarefa entra na Central do Jurídico administrativo (CA2). */
export async function liberarAgendamento(processoId: string): Promise<Pericia> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  if (!pericia) throw new Error('Este caso não tem perícia')
  if (!pericia.liberadaEm) {
    pericia.liberadaEm = agora().toISOString()
    pericia.historico.push({ quando: pericia.liberadaEm, quem: SISTEMA, oQue: 'O INSS liberou o agendamento; a tarefa entrou na Central do Jurídico administrativo', passo: 'D2.E1' })
    gravar(banco)
  }
  return pericia
}

/** GET /api/processos/:id/pericia */
export async function obterPericia(processoId: string): Promise<PericiaNaTela | null> {
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  return pericia ? naTela(banco, pericia) : null
}

/** A etapa do caso em perícia, para a ficha do cliente (CA1). Sem perícia, nada. */
export function etapaDaPericia(processoId: string): string | null {
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  return pericia ? etapaEmPericia(pericia, hojeIso(agora())) : null
}

/**
 * "O que acontece agora", com o contexto que a IA já sabe do caso (pedido do Lucas no cartão da GGVP-49, 02/10). IA
 * simulada: o texto sai do dado da perícia. Sem nome de gênero: o primeiro nome do cliente.
 */
export function oQueAconteceAgora(t: PericiaNaTela): string {
  const { pericia, ficha } = t
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const depois =
    `Se a perícia pedir documento novo, a Documentação reúne até ${DIAS_ANTES_DOCUMENTOS} dias antes; até ${DIAS_ANTES_PREPARO} dias antes, ` +
    `o Jurídico administrativo liga para ${primeiro} com a orientação, e na véspera ${primeiro} recebe o lembrete.`
  if (t.situacao === 'aguardando-inss') {
    return (
      `O pedido está registrado. Assim que o INSS liberar o agendamento (D2.E1), a tarefa «Marcar a perícia» entra na Central do ` +
      `Jurídico administrativo, que marca a ${tipo} de ${primeiro} pelo Meu INSS (senha no cofre, G9). ${depois}`
    )
  }
  const r = pericia.resultado?.registrado
  if (t.situacao === 'concluida' && r) {
    const hoje = hojeIso(agora())
    return (
      `O resultado da ${tipo} de ${primeiro} foi ${r.favoravel ? 'favorável' : 'desfavorável'}, registrado por ${r.quem} em ${dataCurta(hojeIso(new Date(r.quando)), hoje)}: ` +
      `${COMO_SEGUE[pericia.origem]}${r.manifestarAte ? `, até ${dataCurta(r.manifestarAte, hoje)} (${DIAS_PARA_MANIFESTAR} dias, G12)` : ''}.`
    )
  }
  if (t.situacao === 'aguardando-resultado') {
    const m = pericia.marcacao!
    return (
      `${primeiro} compareceu à ${tipo} de ${dataCurta(m.data, hojeIso(agora()))}. Agora o caso espera o perito e o resultado (DP.E3, DP.E4): ` +
      `a advogada responsável acompanha ${pericia.instancia === 'inss' ? 'no GERID' : 'no processo'} e confere o resultado (DP.08).`
    )
  }
  if (t.jaPassou) {
    return `A ${tipo} de ${primeiro} já passou: o Jurídico administrativo registra se ${primeiro} compareceu. Se faltou, a perícia volta para remarcar e conta no limite (G15).`
  }
  if (t.situacao === 'na-advogada') {
    return (
      `A perícia passou do limite de ${LIMITE_DE_REMARCACOES_DA_PERICIA} remarcações: a advogada responsável decide se vale mais uma (G15). ` +
      `Se autorizar, a tarefa de marcar volta para o Jurídico administrativo.`
    )
  }
  if (t.situacao === 'aguardando-comprovante') {
    return (
      `A ${tipo} de ${primeiro} já foi marcada no Meu INSS, mas o comprovante ainda não saiu (DP.E1). O Jurídico administrativo recebe ` +
      `um lembrete por dia até subir o comprovante; o sistema lê data, hora, local e tipo. ${depois}`
    )
  }
  if (t.situacao === 'agendada' && pericia.marcacao && t.prazos) {
    const m = pericia.marcacao
    const hoje = hojeIso(agora())
    const quando = `${diaFalado(m.data)}, às ${m.hora}, em ${m.local}`
    const como =
      m.origem === 'juizo'
        ? `O sistema leu a data na publicação do juízo e pôs na agenda e na ficha: ${quando}.`
        : `A ${tipo} de ${primeiro} está marcada para ${quando}; o sistema leu o comprovante e pôs na agenda e na ficha.`
    const documentos = pericia.pedeDocumentoNovo ? ` A Documentação reúne o que a perícia pede até ${dataCurta(t.prazos.documentosAte, hoje)}.` : ''
    const o = pericia.orientacao
    const orientacao = !o
      ? ''
      : o.bloqueio
        ? ' A orientação montada pela IA foi bloqueada pela verificação e pede revisão.'
        : o.modo === 'perfil' && t.perfil
          ? ` O perfil de ${t.perfil.perito.nome} está na base e a orientação já segue esse perfil (DP.05).`
          : ' A orientação padrão já está montada (DP.05).'
    const p = pericia.preparacao
    const preparo = p
      ? ` ${primeiro} já recebeu a orientação ${p.canal === 'chatwoot' ? 'pelo Chatwoot' : 'na ligação'}, em ${dataCurta(hojeIso(new Date(p.quando)), hoje)};`
      : ` Até ${dataCurta(t.prazos.preparoAte, hoje)}, o Jurídico administrativo liga para ${primeiro} com a orientação;`
    return `${como}${documentos}${orientacao}${preparo} na véspera, ${dataCurta(t.prazos.vespera, hoje)}, sai o lembrete.`
  }
  const como =
    pericia.instancia === 'inss'
      ? `pelo Meu INSS (senha no cofre, G9), tentando todo dia até conseguir, e sobe o comprovante: o sistema lê data, hora, local e tipo`
      : `com o juízo, e registra a data e o local que vierem do processo`
  return `O Jurídico administrativo marca a ${tipo} de ${primeiro} ${como}. ${depois}`
}

/** O detalhe da linha da tarefa, como no Figma (2051:173). */
function detalheDaTarefa(t: PericiaNaTela): string {
  const { pericia } = t
  const onde = pericia.instancia === 'inss' ? 'no Meu INSS (senha no cofre); subir o comprovante' : `no ${NOMES_DA_INSTANCIA[pericia.instancia].toLowerCase()}`
  const deOnde = esperaOInss(pericia.origem) ? 'o INSS já liberou o agendamento' : ORIGENS[pericia.origem].rotulo
  return [t.beneficio, NOMES_DO_TIPO[pericia.tipo], deOnde, onde].join(' · ')
}

/** A orientação pronta e ainda não passada ao cliente; com documento novo, só depois da Documentação (GGVP-61, GGVP-62). */
const paraOrientar = ({ situacao, jaPassou, pericia: p }: PericiaNaTela) =>
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

/** O chat acha a perícia para marcar do cliente que a mensagem cita (GGVP-53, CA5). Sem ela, nada. */
export function periciaParaMarcarDaFicha(fichaId: string): { processoId: string; beneficio: string } | null {
  const banco = lerComPericias()
  const pericia = (banco.pericias ?? []).find((p) => p.fichaId === fichaId && podeMarcar(p))
  return pericia ? { processoId: pericia.processoId, beneficio: naTela(banco, pericia).beneficio } : null
}

/** Uma linha do chat da Central (Figma 2107:892): o cliente, a ação, o porquê curto e o prazo. */
export type ItemDoChat = { cliente: string; acao: string; sub: string; href: string }

/** "Quais perícias eu tenho para marcar?" (Figma 2107:892): as tarefas de marcar e remarcar, com o porquê curto. */
export function periciasParaMarcar(): ItemDoChat[] {
  return tarefasDoJuridicoAdm()
    .filter((t) => t.codigo === 'DP.02')
    .map((t) => {
      const p = lerComPericias().pericias!.find((x) => `pericia-marcar-${x.id}` === t.id)!
      const porque =
        p.remarcacoes > 0
          ? `o cliente faltou · ${p.remarcacoes}ª remarcação (limite G15)`
          : esperaOInss(p.origem)
            ? 'o INSS já liberou o agendamento'
            : ORIGENS[p.origem].rotulo
      return { cliente: t.cliente!.nome, acao: t.acao, sub: `${porque} · ${t.prazo}`, href: t.href! }
    })
}

/** As tarefas da perícia na Central do Jurídico administrativo (CA2): "<nome> · Marcar perícia", liberadas. */
export function tarefasDoJuridicoAdm(): Tarefa[] {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const tarefas: Tarefa[] = []
  for (const t of (banco.pericias ?? []).map((p) => naTela(banco, p))) {
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
        detalhe: [t.beneficio, `${NOMES_DO_TIPO[pericia.tipo]} em ${dataCurta(m.data, hoje)}${m.origem === 'juizo' ? ' (data lida da publicação pelo sistema)' : ''}`, como, 'ligar para o cliente'].join(' · '),
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

/** As da advogada responsável: a perícia que passou do limite de remarcações (CA9, G15). Nunca a sênior. */
export function tarefasDaAdvogadaNaPericia(): Tarefa[] {
  const banco = lerComPericias()
  return (banco.pericias ?? [])
    .map((p) => naTela(banco, p))
    .flatMap((t): Tarefa[] => {
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
            detalhe: [t.beneficio, `${NOMES_DO_TIPO[t.pericia.tipo]} feita em ${dataCurta(m.data, hojeIso(agora()))}`, saiu ? `resultado ${onde}` : `esperando o resultado ${onde}`].join(' · '),
            prazo: saiu ? 'hoje' : 'esperando o resultado',
            urgente: saiu,
          },
        ]
      }
      return []
    })
}

const PASSO_NA_AGENDA = { comprovante: 'DP.02 · Marcar a perícia no INSS', juizo: 'DP.04 · Data do juízo, lida da publicação' }

/** A perícia marcada na agenda (CA2): categoria "Perícias", com o passo e o caso. Ligado em dados/agenda.ts. */
export function eventosDasPericias(banco: Banco, hoje: string): EventoDaAgenda[] {
  const pericias = banco.pericias ?? semear(structuredClone(banco))
  return pericias.flatMap((p): EventoDaAgenda[] => {
    const achado = fichaDoProcesso(banco, p.processoId)
    if (!p.marcacao || !achado) return []
    const m = p.marcacao
    const tipo = NOMES_DO_TIPO[p.tipo]
    return [
      {
        id: `pericia:${p.id}`,
        data: m.data,
        hora: m.hora,
        duracao: 60,
        titulo: achado.ficha.nome,
        oQue: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        categoria: 'pericias',
        responsavel: 'Jurídico administrativo',
        passo: PASSO_NA_AGENDA[m.origem],
        estado: m.comparecimento ? (m.comparecimento.compareceu ? 'realizado' : 'faltou') : m.data < hoje ? 'confirmar' : 'agendado',
        fichaId: achado.ficha.id,
        remarcacoes: p.remarcacoes,
        processoId: p.processoId,
        local: m.local,
      },
    ]
  })
}

// GGVP-56 · Reunir o que a perícia pede: a Documentação reúne, cobra todo dia até 10 dias antes e conclui.

function comDocumentos(pericia: Pericia): DocumentosDaPericia {
  if (!pericia.documentos) throw new Error('Esta perícia não pede documento novo.')
  if (pericia.documentos.concluida) throw new Error('Os documentos desta perícia já foram concluídos.')
  return pericia.documentos
}

/** A falta de um item, com justificativa (CA5). */
export function justificarFalta(processoId: string, itemId: string, justificativa: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    const d = comDocumentos(pericia)
    const item = KIT_DA_PERICIA[pericia.tipo].find((i) => i.id === itemId)
    if (!item) throw new Error('Item da perícia não encontrado.')
    if (justificativa.trim().length < MINIMO_DA_FALTA) throw new Error('Diga por que o documento falta.')
    d.faltas[itemId] = justificativa.trim()
    pericia.historico.push({ quando: agora().toISOString(), quem, oQue: `Registrou a falta de ${item.nome.toLowerCase()}: ${justificativa.trim()}`, passo: 'DP.03' })
  })
}

/** Concluir (CA5, CA6): cada item anexado ou justificado e as conferências; grava quem e quando e volta ao Jurídico administrativo. */
export function concluirDocumentos(processoId: string, c: { conferidas: string[] }, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (banco, pericia, hoje) => {
    const d = comDocumentos(pericia)
    const { ficha } = fichaDoProcesso(banco, processoId)!
    const ate = pericia.marcacao && prazosDaPericia(pericia.marcacao.data).documentosAte
    const na = documentosNaTela(ficha, pericia, hoje, ate)!
    const exigidas = CONFERENCIAS_DA_PERICIA[pericia.tipo].map((x) => x.id)
    const motivo = motivoParaNaoConcluirDocumentos({ faltando: na.faltando.length, conferidas: c.conferidas, exigidas })
    if (motivo) throw new Error(motivo)
    const quando = agora().toISOString()
    d.concluida = { quando, quem, conferidas: c.conferidas }
    const anexados = na.itens.filter((i) => i.arquivo).length
    const faltas = na.itens.length - anexados
    const volta = pericia.marcacao ? 'ligar e orientar o cliente (DP.06)' : 'subir o comprovante do INSS (DP.02)'
    pericia.historico.push(
      { quando, quem, oQue: `Concluiu os documentos da perícia: ${anexados} anexado${anexados === 1 ? '' : 's'}${faltas ? `, ${faltas} com a falta justificada` : ''}`, passo: 'DP.03' },
      { quando, quem: SISTEMA, oQue: `O fluxo voltou ao Jurídico administrativo: ${volta}`, passo: 'DP.03' },
    )
  })
}

/** O que o laudo deve abordar, sugerido pela IA com as perguntas do roteiro do benefício (CA7). A Documentação confere. */
export async function abordarSugeridoNaPericia(processoId: string): Promise<string> {
  const banco = lerComPericias()
  const achado = fichaDoProcesso(banco, processoId)
  const roteiro = achado ? roteiroDoCaso(banco, achado.processo.beneficio) : undefined
  const perguntas = roteiro ? emVigor(roteiro).itens.filter((i) => i.tipo === 'obrigatorio' && i.pergunta).map((i) => `• ${i.pergunta}`) : []
  return perguntas.length > 0 ? `O relatório médico precisa responder:\n${perguntas.join('\n')}` : ''
}

/** O pedido ao médico (CA7): só o que o documento deve abordar; o servidor recusa diagnóstico, CID, grau, conclusão e frase pronta (G20). */
export function pedirAoMedicoNaPericia(processoId: string, abordar: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    const d = comDocumentos(pericia)
    if (!abordar.trim()) throw new Error('Escreva o que o documento deve abordar.')
    const problema = problemaG20(abordar)
    if (problema) throw new Error(problema)
    const quando = agora().toISOString()
    d.pedidosAoMedico.push({ quando, quem, abordar: abordar.trim() })
    pericia.historico.push({ quando, quem, oQue: 'Preparou o pedido ao médico do laudo da perícia (o que o documento deve abordar, G20)', passo: 'DP.03' })
  })
}

/** A mensagem de cobrança do que falta, com o pedido ao médico quando há, para conferir no Chatwoot. */
export async function obterCobrancaDaPericia(processoId: string): Promise<{ nome: string; telefone: string; mensagem: string }> {
  const t = await obterPericia(processoId)
  if (!t?.documentos) throw new Error('Esta perícia não pede documento novo.')
  const hoje = hojeIso(agora())
  const primeiro = t.ficha.nome.split(' ')[0]
  const ate = t.prazos?.documentosAte
  const pedido = t.pericia.documentos!.pedidosAoMedico.at(-1)
  const quais = t.documentos.faltando.map((i) => i.nome.toLowerCase()).join('; ')
  const de = t.pericia.marcacao ? ` de ${dataCurta(t.pericia.marcacao.data, hoje)}` : ''
  const mensagem =
    `Olá, ${primeiro}! Aqui é do escritório GGV. Para a sua ${NOMES_DO_TIPO[t.pericia.tipo]}${de}, ainda precisamos de: ${quais}. ` +
    `Mande foto por aqui ou traga ao escritório${ate ? ` até ${dataCurta(ate, hoje)}` : ''}.` +
    (pedido ? `\n\nPara o laudo, leve ao seu médico este pedido; ele responde com as palavras dele:\n${pedido.abordar}\n\n` : ' ') +
    'Qualquer dúvida, é só responder esta mensagem.'
  return { nome: t.ficha.nome, telefone: t.ficha.telefone, mensagem }
}

/** A cobrança do dia, enviada pelo Chatwoot depois de conferida (Lucas, 02/10: a Documentação cobra, todo dia). */
export function registrarCobrancaDaPericia(processoId: string, mensagem: string, quem = 'Documentação'): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia, hoje) => {
    const d = comDocumentos(pericia)
    const quando = agora().toISOString()
    d.cobrancas.push({ dia: hoje, quando, quem, como: 'chatwoot', mensagem })
    pericia.historico.push({ quando, quem, oQue: 'Cobrou pelo Chatwoot o que a perícia pede e ainda falta', passo: 'DP.03' })
  })
}

/** "Adiar": a cobrança de hoje fica para amanhã. */
export function adiarCobrancaDaPericia(processoId: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia, hoje) => {
    const d = comDocumentos(pericia)
    const quando = agora().toISOString()
    d.cobrancas.push({ dia: hoje, quando, quem, como: 'adiada' })
    pericia.historico.push({ quando, quem, oQue: 'Adiou a cobrança dos documentos da perícia para amanhã', passo: 'DP.03' })
  })
}

/** Passou dos 10 dias antes com documento faltando: a advogada responsável registra o que decidiu (G15). */
export function decidirFaltaDaPericia(processoId: string, texto: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    const d = comDocumentos(pericia)
    if (texto.trim().length < MINIMO_DA_JUSTIFICATIVA) throw new Error('Escreva a decisão (pelo menos 10 letras).')
    const quando = agora().toISOString()
    d.decisaoDaAdvogada = { quando, quem, texto: texto.trim() }
    pericia.historico.push({ quando, quem, oQue: `Decidiu sobre o documento que falta (G15): ${texto.trim()}`, passo: 'DP.03' })
  })
}

/** As tarefas da Documentação na Central do Atendimento: reunir e, quando é dia, cobrar (CA1, CA2, CA3). */
export function tarefasDaDocumentacaoNaPericia(): Tarefa[] {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const tarefas: Tarefa[] = []
  for (const t of (banco.pericias ?? []).map((p) => naTela(banco, p))) {
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
export function tarefasDeDecidirDocumentoDaPericia(): Tarefa[] {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  return (banco.pericias ?? [])
    .map((p) => naTela(banco, p))
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

// GGVP-61 · A orientação da perícia, padrão ou pelo perfil do perito (DP.05, sem tela própria).

const nomeCurto = (nome: string) => nome.replace(/\s*\(exemplo\)$/, '')

/**
 * DP.05: a IA monta a orientação quando a data é registrada (CA1, CA2, CA7), padrão ou pelo perfil do perito (regra
 * unificada, Lucas 02/10). IA simulada: o texto sai do dado da perícia, do acervo do benefício e do perfil. Antes de chegar
 * ao Jurídico administrativo, a verificação barra instrução proibida (CA4, CA8). `pedido` simula um pedido feito à IA,
 * que ela segue sem filtro: é o teste dos pedidos maliciosos (CA10).
 */
export function montarOrientacao(banco: Banco, pericia: Pericia, quando: Date, pedido?: string): OrientacaoDaPericia {
  const m = pericia.marcacao
  if (!m) throw new Error('A perícia ainda não tem data')
  const { ficha } = fichaDoProcesso(banco, pericia.processoId)!
  const perito = pericia.peritoId ? peritosDo(banco).find((p) => p.id === pericia.peritoId) : undefined
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
    // A jurimetria só entra com amostra suficiente; abaixo do mínimo, nada dela segue (CA12, G22).
    ...(perfil?.jurimetria.suficiente && { jurimetria: perfil.jurimetria }),
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

/** A pergunta de um clique (CA6): a equipe liga o perito quando a informação chega; a orientação sai de novo pelo perfil. */
export function ligarPerito(processoId: string, peritoId: string, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (banco, pericia) => {
    const perito = peritosDo(banco).find((p) => p.id === peritoId)
    if (!perito) throw new Error('Perito não encontrado.')
    pericia.peritoId = perito.id
    delete pericia.peritoLido
    pericia.historico.push({ quando: agora().toISOString(), quem, oQue: `Ligou o perito: ${perito.nome}`, passo: 'DP.05' })
    if (pericia.marcacao) montarOrientacao(banco, pericia, agora())
  })
}

/** Os peritos que a pergunta de um clique oferece: os do mesmo tipo da perícia (CA6). */
export function peritosParaLigar(tipo: TipoDePericia): { id: string; nome: string; especialidade: string }[] {
  return peritosDo(lerComPericias())
    .filter((p) => p.tipo === tipo)
    .map(({ id, nome, especialidade }) => ({ id, nome, especialidade }))
}

/** Os processos com o perito, para a janela da jurimetria (Figma 2184:2). */
export function processosComOPerito(peritoId: string): { processoId: string; cliente: string; sub: string }[] {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  return (banco.pericias ?? [])
    .filter((p) => p.peritoId === peritoId)
    .map((p) => {
      const t = naTela(banco, p)
      const m = p.marcacao
      return { processoId: p.processoId, cliente: t.ficha.nome, sub: m ? `perícia ${dataCurta(m.data, hoje)}, ${m.hora} · ${m.local}` : NOMES_DA_SITUACAO_CURTA[t.situacao] }
    })
}

const NOMES_DA_SITUACAO_CURTA: Record<SituacaoDaPericia, string> = {
  'aguardando-inss': 'esperando o INSS',
  marcar: 'para marcar',
  'aguardando-comprovante': 'esperando o comprovante',
  agendada: 'agendada',
  'na-advogada': 'com a advogada',
  'aguardando-resultado': 'esperando o resultado',
  concluida: 'resultado registrado',
}

/** A recusa do chat fica registrada (CA11, G11): quem pediu, quando e o quê. */
export function registrarRecusaDoChat(texto: string, quem: string) {
  const banco = ler()
  ;(banco.recusasDoChat ??= []).push({ quando: agora().toISOString(), quem, texto })
  gravar(banco)
}

/** O que a recusa registrou, para a auditoria. */
export function recusasDoChat(): { quando: string; quem: string; texto: string }[] {
  return ler().recusasDoChat ?? []
}

/**
 * "Dica para a perícia" no chat (Figma 2186:857): o resumo da orientação do cliente citado, o perito e a tarefa. Só
 * responde e orienta. Os números da jurimetria vêm do sistema; com amostra pequena, "amostra insuficiente" (G22).
 */
export async function dicaParaAPericia(texto: string): Promise<{ texto: string; itens: ItemDoChat[] } | null> {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const pericia = (banco.pericias ?? []).find((p) => {
    const ficha = banco.fichas.find((f) => f.id === p.fichaId)!
    return new RegExp(`\\b${ficha.nome.split(' ')[0]}\\b`, 'i').test(texto) && p.orientacao
  })
  if (!pericia?.orientacao || !pericia.marcacao) return null
  const t = naTela(banco, pericia)
  const primeiro = t.ficha.nome.split(' ')[0]
  const m = pericia.marcacao
  const tarefa: ItemDoChat = {
    cliente: t.ficha.nome,
    acao: 'Orientar para a perícia',
    sub: `${diaFalado(m.data)}, ${m.hora} · ${m.local}${t.prazos ? ` · ligar até ${dataCurta(t.prazos.preparoAte, hoje)}` : ''}`,
    href: `/casos/${pericia.processoId}/pericia/orientar`,
  }
  if (pericia.orientacao.modo === 'perfil' && t.perfil) {
    const j = t.perfil.jurimetria
    const numeros = j.suficiente ? `${j.laudos} laudos, ${j.taxa}% favoráveis` : `${j.laudos} laudos: amostra insuficiente`
    return {
      texto:
        `Pelo perfil de ${nomeCurto(t.perfil.perito.nome)} (${numeros}), peça para ${primeiro} levar ${t.perfil.pediu.join(' e ')}. ` +
        `O perito costuma perguntar ${t.perfil.perguntou.join(' e ')}. Na ligação: conte a ${primeiro} como é a perícia e lembre de responder com calma e com sinceridade.`,
      itens: [
        { cliente: t.perfil.perito.nome, acao: 'Ver o perfil do perito', sub: numeros, href: `/casos/${pericia.processoId}/pericia?perito=1` },
        tarefa,
      ],
    }
  }
  return {
    texto: `A orientação de ${primeiro} é a padrão: ${pericia.orientacao.motivo}. Ela já traz data, local, o que levar e como é a ${NOMES_DO_TIPO[pericia.tipo]}.`,
    itens: [tarefa],
  }
}

// GGVP-62 · Preparar o cliente: o Jurídico administrativo revisa a orientação e passa ao cliente (DP.06).

/**
 * POST /api/processos/:id/pericia/orientacao. Só com "Revisei a orientação" (CA3). O servidor verifica de novo o texto,
 * editado ou não (CA4); com instrução proibida, recusa e registra a tentativa (CA6). Guarda o texto, o canal e a data
 * (CA2, CA7). O Chatwoot é simulado (GGVP-102).
 */
export async function enviarOrientacao(
  processoId: string,
  o: { texto: string; canal: CanalDaOrientacao; revisei: boolean },
  quem: string,
): Promise<PericiaNaTela> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  if (!pericia) throw new Error('Este caso não tem perícia')
  if (!pericia.marcacao || !pericia.orientacao) throw new Error('A orientação ainda não está pronta.')
  if (!o.revisei) throw new Error('Marque "Revisei a orientação" antes de enviar.')
  const texto = o.texto.trim()
  if (!texto) throw new Error('Escreva a orientação.')
  if (o.canal === 'chatwoot' && !fichaDoProcesso(banco, processoId)!.ficha.telefone) throw new Error('Sem telefone: complete na ficha antes de enviar.')
  const quando = agora().toISOString()
  const motivo = problemaDaOrientacao(texto)
  if (motivo) {
    ;(pericia.enviosRecusados ??= []).push({ quando, quem, motivo, texto })
    pericia.historico.push({ quando, quem: SISTEMA, oQue: `Recusou o envio da orientação por ${quem}: ${motivo}`, passo: 'DP.06' })
    gravar(banco)
    throw new Error(motivo)
  }
  pericia.preparacao = { quando, quem, canal: o.canal, texto }
  pericia.historico.push({
    quando,
    quem,
    oQue: o.canal === 'chatwoot' ? 'Enviou a orientação pelo Chatwoot, como documento e instrução' : 'Ligou para o cliente e passou a orientação',
    passo: 'DP.06',
  })
  gravar(banco)
  return naTela(banco, pericia)
}

/**
 * "O Pedro me ligou. O que eu falo?" (Figma 2107:1091): a próxima tarefa do cliente na Central do Jurídico
 * administrativo e, com a orientação pronta, o resumo dela (CA8). Só responde e orienta: não executa nada.
 */
export function clienteLigou(texto: string): { texto: string; itens?: ItemDoChat[] } {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const ficha = banco.fichas.find((f) => (banco.pericias ?? []).some((p) => p.fichaId === f.id) && new RegExp(`\\b${f.nome.split(' ')[0]}\\b`, 'i').test(texto))
  if (!ficha) return { texto: 'Diga o nome do cliente que ligou: eu mostro a próxima tarefa e a orientação.' }
  const primeiro = ficha.nome.split(' ')[0]
  const tarefa = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === ficha.id)
  const pericia = banco.pericias!.filter((p) => p.fichaId === ficha.id).at(-1)!
  const m = pericia.marcacao
  if (!tarefa) {
    const feita = pericia.preparacao
    return {
      texto: feita
        ? `${primeiro} já recebeu a orientação em ${dataCurta(hojeIso(new Date(feita.quando)), hoje)} (${feita.canal === 'chatwoot' ? 'pelo Chatwoot' : 'na ligação'}). Se for dúvida, repasse o que está guardado no caso; se a data mudou, a tarefa volta.`
        : `${primeiro} não tem tarefa sua agora na perícia. A situação está na página do processo.`,
      itens: [{ cliente: ficha.nome, acao: 'Ver a perícia', sub: m ? `perícia ${dataCurta(m.data, hoje)}, ${m.hora}` : NOMES_DA_SITUACAO_CURTA[situacaoDaPericia(pericia)], href: `/casos/${pericia.processoId}/pericia` }],
    }
  }
  if (tarefa.codigo === 'DP.06' && m) {
    return {
      texto:
        `A próxima tarefa é sua: orientar ${primeiro} para a perícia de ${dataCurta(m.data, hoje)}. A orientação da IA está pronta com data, local, o que levar e como é a ${NOMES_DO_TIPO[pericia.tipo]}: ` +
        `${diaFalado(m.data)}, às ${m.hora}, em ${m.local}; levar ${O_QUE_LEVAR[pericia.tipo]}. Nunca oriente a esconder ou mudar a situação real (G11).`,
      itens: [{ cliente: ficha.nome, acao: tarefa.acao, sub: `perícia ${dataCurta(m.data, hoje)} · ${pericia.orientacao?.bloqueio ? 'orientação bloqueada: revisar' : 'orientação da IA pronta'}`, href: tarefa.href! }],
    }
  }
  return {
    texto: `A próxima tarefa é sua: ${tarefa.acao.toLowerCase()} de ${primeiro}. A orientação sai quando a perícia tiver data.`,
    itens: [{ cliente: ficha.nome, acao: tarefa.acao, sub: `${tarefa.detalhe} · ${tarefa.prazo}`, href: tarefa.href! }],
  }
}

// GGVP-66 · Comparecimento e remarcação (DP.07).

/** A confirmação de presença (CA7): confirmou ou não, com a observação; fica registrada. Não pode ir: é remarcar (CA9). */
export function confirmarPresenca(processoId: string, c: { confirmou: boolean; observacao?: string }, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (_banco, pericia) => {
    const m = pericia.marcacao
    if (!m || situacaoDaPericia(pericia) !== 'agendada' || periciaJaPassou(m, agora())) throw new Error('Não há perícia por vir para confirmar.')
    const observacao = c.observacao?.trim() || undefined
    if (!c.confirmou && !observacao) throw new Error('Diga o que aconteceu na tentativa (não atendeu, caixa postal…).')
    const quando = agora().toISOString()
    m.confirmacao = { quando, quem, confirmou: c.confirmou, ...(observacao && { observacao }) }
    pericia.historico.push({
      quando,
      quem,
      oQue: c.confirmou ? `Confirmou a presença do cliente na perícia${observacao ? ` (${observacao})` : ''}` : `Não conseguiu confirmar a presença: ${observacao}`,
      passo: 'DP.07',
    })
  })
}

/**
 * Depois do dia e da hora (CA1): compareceu, o caso espera o resultado com a advogada responsável (CA5); faltou, a data sai e
 * volta "Remarcar perícia", contando no limite (CA2), que, passado, sobe para a advogada (CA3, G15). A justificativa, se
 * houver (CA4).
 */
export function registrarComparecimento(processoId: string, r: { compareceu: boolean; justificativa?: string }, quem: string): Promise<PericiaNaTela> {
  return mudar(processoId, (banco, pericia, hoje) => {
    const m = pericia.marcacao
    if (!m || situacaoDaPericia(pericia) !== 'agendada') throw new Error('Esta perícia não está agendada.')
    if (!periciaJaPassou(m, agora())) throw new Error(`A perícia ainda não aconteceu: o comparecimento abre depois de ${dataCurta(m.data, hoje)}, ${m.hora}.`)
    const quando = agora().toISOString()
    const justificativa = r.justificativa?.trim() || undefined
    m.comparecimento = { quando, quem, compareceu: r.compareceu, ...(justificativa && { justificativa }) }
    const primeiro = fichaDoProcesso(banco, processoId)!.ficha.nome.split(' ')[0]
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
    remarcar(pericia, `${primeiro} não compareceu${porque}`, quem)
  })
}

// GGVP-70 · Conferir o resultado e decidir o próximo passo (DP.08, DP.10).

/**
 * IA simulada: o que o laudo (ou o registro do GERID) diz. "desfavoravel" no nome do arquivo faz o laudo desfavorável; no
 * desfavorável, a IA diz por que e indica se vale pedir nova perícia (Lucas, 02/10). A advogada decide.
 */
function leituraDoLaudo(pericia: Pericia, beneficio: string, nome: string): LeituraDoLaudo {
  const social = pericia.tipo === 'social'
  const conteudo = social
    ? { observou: ['quem mora na casa e a renda de cada um', 'as condições da moradia'], perguntou: ['quem ajuda nas despesas da casa'], pediu: ['comprovantes de renda e de despesas'] }
    : { observou: ['como a pessoa senta, levanta e anda'], perguntou: ['quanto tempo a pessoa aguenta sentada e em pé'], pediu: ['laudos e receitas dos últimos 12 meses'] }
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

/** A perícia do resultado: a que espera o resultado ou a última já conferida. */
function periciaDoResultado(banco: Banco, processoId: string): Pericia | undefined {
  return banco.pericias?.filter((p) => p.processoId === processoId && ['aguardando-resultado', 'concluida'].includes(situacaoDaPericia(p))).at(-1)
}

/** GET /api/processos/:id/pericia/resultado */
export async function obterResultado(processoId: string): Promise<PericiaNaTela | null> {
  const banco = lerComPericias()
  const pericia = periciaDoResultado(banco, processoId)
  return pericia ? naTela(banco, pericia) : null
}

/** A vigília do GERID (ou a publicação do laudo) viu o resultado (DP.E4): a tarefa da advogada fica urgente (CA1). Ponta do Mateus. */
export async function resultadoNoGerid(processoId: string): Promise<PericiaNaTela> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDoResultado(banco, processoId)
  if (!pericia || situacaoDaPericia(pericia) !== 'aguardando-resultado') throw new Error('Esta perícia não espera resultado.')
  if (!pericia.resultado?.disponivelEm) {
    const quando = agora().toISOString()
    pericia.resultado = { ...pericia.resultado, disponivelEm: quando }
    pericia.historico.push({
      quando,
      quem: SISTEMA,
      oQue: `O resultado apareceu ${pericia.instancia === 'inss' ? 'no GERID' : 'no processo'}: a tarefa da advogada ficou urgente`,
      passo: 'DP.E4',
    })
    gravar(banco)
  }
  return naTela(banco, pericia)
}

/** POST /api/processos/:id/pericia/laudo/leitura. IA simulada: o resumo do laudo, para a advogada conferir (CA5). */
export async function lerLaudoDaPericia(processoId: string, nome: string): Promise<LeituraDoLaudo> {
  await esperar()
  const banco = lerComPericias()
  const pericia = periciaDoResultado(banco, processoId)
  if (!pericia) throw new Error('Esta perícia não espera resultado.')
  return leituraDoLaudo(pericia, naTela(banco, pericia).beneficio, nome)
}

/**
 * POST /api/processos/:id/pericia/resultado (CA2 a CA6). O laudo vai para a pasta; favorável, ou desfavorável sem nova
 * perícia, o resultado sobe no card e volta para quem pediu; desfavorável com nova perícia, o Jurídico administrativo marca
 * de novo, sem contar como remarcação. No desfavorável, a indicação da IA fica no histórico (Lucas, 02/10).
 */
export function registrarResultado(
  processoId: string,
  r: { laudo: { nome: string; hash?: string }; favoravel?: boolean; novaPericia?: boolean; conferidas: string[] },
  quem: string,
): Promise<PericiaNaTela> {
  return mudar(processoId, (banco, pericia, hoje) => {
    if (situacaoDaPericia(pericia) !== 'aguardando-resultado') throw new Error('Esta perícia não espera resultado.')
    const exigidas = CONFERENCIAS_DO_RESULTADO[pericia.tipo].map((c) => c.id)
    const motivo = motivoParaNaoRegistrarResultado({ laudo: !!r.laudo.nome.trim(), favoravel: r.favoravel, novaPericia: r.novaPericia, conferidas: r.conferidas }, exigidas)
    if (motivo) throw new Error(motivo)
    const { ficha, processo } = fichaDoProcesso(banco, processoId)!
    const quando = agora().toISOString()
    const nomes = ficha.arquivos.map((a) => a.nome)
    const nome = nomes.includes(r.laudo.nome) ? r.laudo.nome.replace(/(\.pdf)$/i, ' (2)$1') : r.laudo.nome
    ficha.arquivos.push({ nome, tipo: 'laudo-pericia', local: processoId, data: hoje, origem: 'card', repetido: false, aguardaLeitura: false, hash: r.laudo.hash })
    const leitura = leituraDoLaudo(pericia, nomeBeneficio(processo.beneficio), nome)
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
      pericia.historico.push(
        { quando, quem: SISTEMA, oQue: `A IA indicou: ${leitura.porque} Vale pedir nova perícia: ${leitura.valeNovaPericia ? 'sim' : 'não'}.`, passo: 'DP.10' },
        { quando, quem, oQue: nova ? 'Decidiu pedir nova perícia' : 'Decidiu não pedir nova perícia: o caso volta à origem marcado como desfavorável', passo: 'DP.10' },
      )
    }
    if (nova) {
      const m = pericia.marcacao!
      const outra = criar(
        banco,
        processoId,
        { origem: pericia.origem, tipo: pericia.tipo, instancia: pericia.instancia, pedidaPor: quem, oQuePede: `nova ${NOMES_DO_TIPO[pericia.tipo]}, depois do resultado desfavorável de ${dataCurta(m.data, hoje)}` },
        agora(),
        agora(),
      )
      pericia.historico.push({ quando, quem: SISTEMA, oQue: `Abriu a nova perícia para o Jurídico administrativo marcar (não conta como remarcação): ${outra.id}`, passo: 'DP.10' })
      return
    }
    pericia.historico.push({
      quando,
      quem: SISTEMA,
      oQue:
        `O resultado subiu no card e voltou para quem pediu (${ORIGENS[pericia.origem].rotulo}): ${COMO_SEGUE[pericia.origem]}` +
        (manifestarAte ? `, até ${dataCurta(manifestarAte, hoje)} (${DIAS_PARA_MANIFESTAR} dias, G12)` : ''),
      passo: 'DP.08',
    })
  })
}

/**
 * "Quais perícias temos esta semana?" (Figma 2107:667): as perícias marcadas de hoje a 6 dias. Cada item abre a página do
 * processo, com a perícia em destaque, e não a Agenda (CA9).
 */
export function periciasDaSemana(): { texto: string; itens: ItemDoChat[] } {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const ate = somarDias(hoje, 6)
  const itens = (banco.pericias ?? [])
    .filter((p) => p.marcacao && !p.marcacao.comparecimento && p.marcacao.data >= hoje && p.marcacao.data <= ate)
    .sort((a, b) => `${a.marcacao!.data}${a.marcacao!.hora}`.localeCompare(`${b.marcacao!.data}${b.marcacao!.hora}`))
    .map((p): ItemDoChat => {
      const t = naTela(banco, p)
      const m = p.marcacao!
      const tipo = NOMES_DO_TIPO[p.tipo]
      const onde = p.instancia === 'inss' ? 'INSS' : `judicial${t.perfil ? `, ${nomeCurto(t.perfil.perito.nome)}` : ''}`
      return {
        cliente: t.ficha.nome,
        acao: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        sub: `${onde} · ${dataCurta(m.data, hoje)}, ${m.hora}${p.preparacao ? ' · orientação passada' : ''}`,
        href: `/casos/${p.processoId}/pericia`,
      }
    })
  if (itens.length === 0) return { texto: `Nenhuma perícia marcada até ${dataCurta(ate, hoje)}.`, itens }
  return {
    texto:
      `${itens.length === 1 ? 'Uma perícia' : `${itens.length} perícias`} até ${dataCurta(ate, hoje)}. Cada uma abre o processo do cliente, com a perícia em destaque. ` +
      'A orientação ao cliente é do Jurídico administrativo; a conferência do resultado é sua (DP.08).',
    itens,
  }
}

/**
 * "Como o Dr. A. Prado costuma avaliar problemas de coluna?" (Figma 2186:2): os números do sistema, com a amostra (G22), e o
 * que a IA resume dos laudos; as perícias e as conferências com o perito. Sem perito citado, nada.
 */
export function comoOPeritoAvalia(texto: string): { texto: string; itens: ItemDoChat[] } | null {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const perito = peritosDo(banco).find((p) => new RegExp(`\\b${nomeCurto(p.nome).split(' ').at(-1)}\\b`, 'i').test(texto))
  if (!perito) return null
  const perfil = perfilDoPerito(perito)
  const j = perfil.jurimetria
  const geral = j.suficiente ? `${j.laudos} laudos, ${j.taxa}% favoráveis` : `${j.laudos} laudos (amostra insuficiente, G22)`
  const doAssunto = perfil.porAssunto.find((a) => new RegExp(`\\b${a.assunto.split(' ')[0]}`, 'i').test(texto))
  const assunto = !doAssunto
    ? ''
    : doAssunto.jurimetria.suficiente
      ? ` Em ${doAssunto.assunto}: ${doAssunto.jurimetria.laudos} laudos, ${doAssunto.jurimetria.taxa}% favoráveis.`
      : ` Em ${doAssunto.assunto} ainda são poucos laudos (${doAssunto.jurimetria.laudos}), então a porcentagem não aparece (G22).`
  const pericias = (banco.pericias ?? []).filter((p) => p.peritoId === perito.id)
  const itens = pericias.map((p): ItemDoChat => {
    const t = naTela(banco, p)
    const m = p.marcacao
    if (t.situacao === 'aguardando-resultado' || t.situacao === 'concluida') {
      return { cliente: t.ficha.nome, acao: 'Conferir resultado da perícia', sub: `perícia de ${m ? dataCurta(m.data, hoje) : '—'} com ${nomeCurto(perito.nome)}`, href: `/casos/${p.processoId}/pericia/resultado` }
    }
    const tipo = NOMES_DO_TIPO[p.tipo]
    return {
      cliente: t.ficha.nome,
      acao: tipo.charAt(0).toUpperCase() + tipo.slice(1),
      sub: `${m ? `${diaFalado(m.data)}, ${m.hora} · ${m.local}` : NOMES_DA_SITUACAO_CURTA[t.situacao]} · com ${nomeCurto(perito.nome)}`,
      href: `/casos/${p.processoId}/pericia`,
    }
  })
  return {
    texto: `Pelo acervo, ${nomeCurto(perito.nome)} tem ${geral}.${assunto} Costuma perguntar ${perfil.perguntou.join(' e ')}. Os números vêm do sistema; eu só resumo os laudos.`,
    itens: [
      ...(pericias[0] ? [{ cliente: nomeCurto(perito.nome), acao: 'Ver o perfil do perito', sub: `${geral} · o que costuma perguntar`, href: `/casos/${pericias[0].processoId}/pericia?perito=1` }] : []),
      ...itens,
    ],
  }
}
