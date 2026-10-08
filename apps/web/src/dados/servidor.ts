// EXEMPLO. Servidor de exemplo: funções com a forma dos endpoints da design.md (change ggvp-6), sobre a
// semente de exemplo.ts guardada no sessionStorage, porque os links recarregam a página e o que nasce no
// balcão precisa chegar à ficha. Aba nova começa da semente. Ligar no servidor: trocar o corpo de cada
// função por fetch no endpoint indicado, sobre o mesmo contrato.
import { normalizarCpf, validarCpf, validarNome, validarTelefone } from '../campos.ts'
import { agendamentoDoDia, buscar, etapaDaFicha } from '../regras/busca.ts'
import { hojeIso, hora } from '../regras/datas.ts'
import { fichaComCpf, fichasParecidas } from '../regras/duplicidade.ts'
import { IDADE_MAXIMA } from '../regras/formularios.ts'
import { pastasDoCliente } from '../regras/pasta.ts'
import { nomeBeneficio } from './catalogos.ts'
import { fichasDeExemplo, gravacoesDeExemplo, pastasDeExemplo } from './exemplo.ts'
import type { DocumentoLido } from './leitura.ts'
import type { ConferenciaDoChecklist } from './checklist.ts'
import type { RegistroDasBoasVindas } from './boasVindas.ts'
import type { Cobranca } from './cobranca.ts'
import type { Liberacao } from './liberacao.ts'
import type {
  CompromissoGuardado,
  EdicaoFicha,
  Encaminhamento,
  EventoHistorico,
  Ficha,
  Gravacao,
  FichaResumo,
  NovoCliente,
  PastaDrive,
  RespostaNovoCliente,
  RespostasDaSegundaFicha,
  ResultadoBusca,
  Setor,
  TarefaEncaminhada,
} from './tipos.ts'
import type { Contrato } from './contrato.ts'
import type { Roteiro } from '../regras/roteiro.ts'
import type { ParecerDoCaso } from './parecer.ts'
import type { Complemento } from './complemento.ts'
import type { DeficienciaDoCaso } from './deficiencia.ts'
import type { AcidenteDoCaso } from './acidente.ts'
import type { CriancaDoCaso } from './infantil.ts'
import type { Conversa } from './conversa.ts'
import type { VersaoDoCampo } from '../regras/conversa.ts'
import type { AvisoAprovado, MensagemAoCliente } from './mensagens.ts'
import type { PedidoBancario, RegistroBancario } from './seguranca.ts'

/** Onde a semente fica guardada na aba. A versão sobe quando a forma do dado muda. */
export const CHAVE = 'ggv.exemplo.v5'

/** Sem login ainda: quem faz é a pessoa do Atendimento. */
export const QUEM = 'Você (Atendimento)'

/** Nas telas do Jurídico, quem faz é a advogada (GGVP-28). */
export const QUEM_ADVOGADA = 'Você (Advogada)'

/** O resumo da IA do laudo novo: só o Jurídico vê; nunca entra na ficha da visão do Atendimento (GGVP-17, CA9). */
export type ResumoDeLaudo = { fichaId: string; processoId?: string; data: string; arquivo: string; resumo: string }

export type Banco = {
  fichas: Ficha[]
  pastas: PastaDrive[]
  tarefas: TarefaEncaminhada[]
  resumosDeLaudo: ResumoDeLaudo[]
  /** Compromissos sem cliente (GGVP-123, CA5). */
  internos: CompromissoGuardado[]
  /** A trilha do cofre: quem, quando e a ação, nunca o valor da senha (GGVP-24). */
  cofre: RegistroDoCofre[]
  /** A seção médica que a IA leu da segunda ficha em papel: vai direto ao Jurídico, sem passar pela tela do Atendimento (GGVP-28). */
  leiturasMedicas: { fichaId: string; medicos: Partial<RespostasDaSegundaFicha> }[]
  /** As gravações e as conversas sem áudio, guardadas para sempre (GGVP-40, GGVP-46). */
  gravacoes: Gravacao[]
  seq: number
  /** Um contrato por processo, do kit à cópia (GGVP-65 em diante). Sem ele, começa da semente de contrato.ts. */
  contratos?: Contrato[]
  /** O que a IA leu de cada documento que entrou, para a Documentação conferir e arquivar (GGVP-81). Nasce em leitura.ts. */
  leituras?: DocumentoLido[]
  /** Cada conferência do checklist de um caso (GGVP-91). */
  checklists?: ConferenciaDoChecklist[]
  /** Cada tentativa de envio das boas-vindas (GGVP-97). */
  boasVindas?: RegistroDasBoasVindas[]
  /** A cobrança dos documentos pendentes de cada caso (GGVP-101). */
  cobrancas?: Cobranca[]
  /** Quem liberou cada caso ao Jurídico, e quando (GGVP-18). */
  liberacoes?: Liberacao[]
  /** Os roteiros de conteúdo mínimo, com as versões (GGVP-93). Sem ele, começa da semente de roteiro.ts. */
  roteiros?: Roteiro[]
  /** A análise da IA e o registro do parecer médico de cada caso (GGVP-20). Sem ele, começa da semente de parecer.ts. */
  pareceres?: ParecerDoCaso[]
  /** A pendência de complemento ao médico de cada caso (GGVP-20 abre, GGVP-29 conduz). */
  complementos?: Complemento[]
  /** Os dados da deficiência de cada caso de Aposentadoria PCD (GGVP-42). Sem ele, começa da semente de deficiencia.ts. */
  deficiencias?: DeficienciaDoCaso[]
  /** A circunstância do acidente de cada caso de Auxílio-Acidente (GGVP-47). Sem ela, o checklist pede para marcar. */
  acidentes?: AcidenteDoCaso[]
  /** A condição e as terapias de cada criança do LOAS Deficiente de menor de 16 anos (GGVP-50). Dado de saúde. */
  criancas?: CriancaDoCaso[]
  /** As conversas com o lead ou o cliente, do fluxo D5 (GGVP-12). Sem ela, começa da semente de conversa.ts. */
  conversas?: Conversa[]
  /** As versões dos campos mudados pela conversa, com quem e quando (GGVP-84, G14). */
  versoes?: VersaoDoCampo[]
  /** Cada mensagem mandada ao cliente pelo Chatwoot, com o status de entrega (GGVP-102). */
  mensagens?: MensagemAoCliente[]
  /** O texto do resultado aprovado pelo Jurídico: o favorável com o OK da advogada (G8). Sem ele, a semente de mensagens.ts. */
  avisosAprovados?: AvisoAprovado[]
  /** Os dados bancários para o repasse, do mais antigo ao em vigor (GGVP-111). Sem eles, a semente de seguranca.ts. */
  dadosBancarios?: RegistroBancario[]
  /** A mudança dos dados bancários que espera a segunda confirmação (GGVP-111, CA5). */
  pedidosBancarios?: PedidoBancario[]
}

export type RegistroDoCofre = { fichaId: string; quando: string; quem: string; acao: 'guardou' | 'leu-do-papel' | 'conferiu' | 'nao-sabe' | 'renovou' }

let relogio = () => new Date()
let latencia = 400
let memoria: Banco | null = null

/** Para o teste: hora fixa e sem espera. */
export function configurarExemplo(opcoes: { agora?: () => Date; latencia?: number }) {
  if (opcoes.agora) relogio = opcoes.agora
  if (opcoes.latencia !== undefined) latencia = opcoes.latencia
}

/** Volta à semente. */
export function zerarExemplo() {
  memoria = null
  try {
    sessionStorage.removeItem(CHAVE)
  } catch {
    // Armazenamento bloqueado: a memória já foi zerada.
  }
}

export function agora(): Date {
  return relogio()
}

function semente(): Banco {
  const fichas = fichasDeExemplo(hojeIso(agora()))
  return { fichas, pastas: pastasDeExemplo(fichas), tarefas: [], resumosDeLaudo: [], internos: [], cofre: [], leiturasMedicas: [], gravacoes: gravacoesDeExemplo(), seq: 0 }
}

/** Para os outros arquivos do servidor de exemplo (documentos.ts). */
export function ler(): Banco {
  try {
    const guardado = sessionStorage.getItem(CHAVE)
    if (guardado) return JSON.parse(guardado) as Banco
  } catch {
    // Armazenamento bloqueado ou estragado: segue na memória.
  }
  memoria ??= semente()
  return structuredClone(memoria)
}

export function gravar(banco: Banco) {
  memoria = banco
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(banco))
  } catch {
    // Armazenamento bloqueado: fica só na memória desta página.
  }
}

export const esperar = () => new Promise<void>((pronto) => setTimeout(pronto, latencia))

export function evento(oQue: string, quem = QUEM): EventoHistorico {
  return { quando: agora().toISOString(), quem, oQue }
}

function resumo(ficha: Ficha, hoje: string): FichaResumo {
  return { id: ficha.id, nome: ficha.nome, situacao: ficha.situacao, etapa: etapaDaFicha(ficha, hoje), telefone: ficha.telefone }
}

function novoId(banco: Banco, nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '')
  let id = base
  for (let n = 2; banco.fichas.some((f) => f.id === id); n++) id = `${base}-${n}`
  return id
}

/** GET /api/balcao/busca?termo= */
export async function buscarNoBalcao(termo: string): Promise<ResultadoBusca[]> {
  return buscar(ler().fichas, termo, hojeIso(agora()))
}

/** GET /api/fichas/:id */
export async function obterFicha(id: string): Promise<Ficha | null> {
  return ler().fichas.find((f) => f.id === id) ?? null
}

/** O bloco "Já existe?" do Novo cliente: CPF repetido e fichas com telefone ou nome igual. */
export async function conferirDuplicidade(dados: { nome: string; telefone: string; cpf?: string }) {
  const { fichas } = ler()
  const hoje = hojeIso(agora())
  const comCpf = fichaComCpf(fichas, dados.cpf)
  return {
    comCpf: comCpf && resumo(comCpf, hoje),
    parecidas: fichasParecidas(fichas, dados).map((f) => resumo(f, hoje)),
  }
}

/** POST /api/fichas. Valida de novo com campos; CPF repetido nunca grava (CA6); parecida só com "É outra pessoa" (CA9). */
export async function criarFicha(dados: NovoCliente): Promise<RespostaNovoCliente> {
  await esperar()
  const valido =
    validarNome(dados.nome) &&
    validarTelefone(dados.telefone) &&
    (dados.cpf === undefined || validarCpf(dados.cpf)) &&
    Number.isInteger(dados.idade) &&
    dados.idade >= 0 &&
    dados.idade <= IDADE_MAXIMA &&
    dados.pretende.trim().length >= 3 &&
    (dados.comoChegou !== 'indicacao' || validarNome(dados.indicadoPor))
  if (!valido) throw new Error('Dados do novo cliente inválidos')

  const banco = ler()
  const hoje = hojeIso(agora())
  const cpf = dados.cpf ? normalizarCpf(dados.cpf) : undefined
  const existente = fichaComCpf(banco.fichas, cpf)
  if (existente) return { resultado: 'ja-existe', id: existente.id }
  const parecidas = fichasParecidas(banco.fichas, dados)
  if (parecidas.length > 0 && !dados.outraPessoa) {
    return { resultado: 'parecidas', fichas: parecidas.map((f) => resumo(f, hoje)) }
  }

  const [ano, mes] = hoje.split('-')
  const ficha: Ficha = {
    id: novoId(banco, dados.nome),
    situacao: 'lead',
    desde: `${mes}/${ano}`,
    nome: dados.nome,
    cpf,
    idade: dados.idade,
    telefone: dados.telefone,
    email: dados.email,
    cidadeUf: dados.cidadeUf,
    comoChegou: dados.comoChegou,
    indicadoPor: dados.indicadoPor,
    observacoes: dados.observacao,
    beneficioInteresse: dados.beneficioInteresse,
    resumo: ['lead', dados.cidadeUf?.replace(' / ', '/')].filter(Boolean).join(' · '),
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [],
    agendamentos: [],
    // A anotação do primeiro contato vai para "Últimos contatos" (CA13).
    contatos: [{ data: hoje, canal: 'Presencial (balcão)', texto: dados.pretende }],
    documentos: [],
    arquivos: [],
    transcricoes: 0,
    historico: [
      evento(
        parecidas.length > 0
          ? `Criou a ficha no balcão (lead), confirmando que é outra pessoa que ${parecidas.map((f) => f.nome).join(' e ')}`
          : 'Criou a ficha no balcão (lead)',
      ),
    ],
  }
  banco.fichas.push(ficha)
  gravar(banco)
  return { resultado: 'criada', id: ficha.id, pastas: pastasDoCliente(banco.pastas, ficha) }
}

/** POST /api/fichas/:id/pasta. Liga a pasta que já existe ou cria uma (CA14). Drive simulado. */
export async function ligarPasta(fichaId: string, pasta: string): Promise<PastaDrive & { nova: boolean }> {
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  let escolhida = banco.pastas.find((p) => p.id === pasta)
  const nova = escolhida === undefined
  if (pasta !== 'nova' && nova) throw new Error('Pasta não encontrada')
  if (!escolhida) {
    escolhida = { id: `drive-${ficha.id}`, nome: ficha.nome, caminho: `Leads/${hojeIso(agora()).slice(0, 4)}`, cpf: ficha.cpf }
    banco.pastas.push(escolhida)
  }
  ficha.pastaId = escolhida.id
  ficha.historico.push(
    evento(nova ? `Criou a pasta no Drive: ${escolhida.caminho}/${escolhida.nome}` : `Ligou à pasta que já existia no Drive: ${escolhida.caminho}/${escolhida.nome}`),
  )
  gravar(banco)
  return { ...escolhida, nova }
}

export async function obterPasta(id: string | undefined): Promise<PastaDrive | null> {
  return ler().pastas.find((p) => p.id === id) ?? null
}

const ROTULOS: Record<keyof EdicaoFicha, string> = {
  nome: 'nome',
  cpf: 'CPF',
  nascimento: 'data de nascimento',
  telefone: 'telefone',
  email: 'e-mail',
  estadoCivil: 'estado civil',
  endereco: 'endereço',
  cidadeUf: 'cidade',
  cep: 'CEP',
  profissao: 'profissão',
  comoChegou: 'como chegou',
  contatoPreferido: 'contato preferido',
  contatoApoio: 'contato de apoio',
  observacoes: 'observações',
}

/** PATCH /api/fichas/:id. Toda alteração entra no histórico com o que mudou. */
export async function salvarFicha(id: string, edicao: EdicaoFicha): Promise<{ ficha: Ficha } | { erro: 'cpf-de-outra-ficha'; nome: string }> {
  await esperar()
  if (!validarNome(edicao.nome) || !validarTelefone(edicao.telefone) || (edicao.cpf !== undefined && !validarCpf(edicao.cpf))) {
    throw new Error('Dados da ficha inválidos')
  }
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === id)
  if (!ficha) throw new Error('Ficha não encontrada')
  const dono = fichaComCpf(banco.fichas, edicao.cpf)
  if (dono && dono.id !== id) return { erro: 'cpf-de-outra-ficha', nome: dono.nome }

  const mudou = (Object.keys(ROTULOS) as (keyof EdicaoFicha)[]).filter((campo) => (ficha[campo] ?? '') !== (edicao[campo] ?? ''))
  if (edicao.comoChegou !== 'indicacao') ficha.indicadoPor = undefined
  Object.assign(ficha, edicao)
  if (mudou.length > 0) ficha.historico.push(evento(`Alterou ${juntar(mudou.map((c) => ROTULOS[c]))}`))
  gravar(banco)
  return { ficha }
}

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

/** POST /api/fichas/:id/encaminhamentos. O setor recebe a tarefa com a ficha e o agendamento (CA4); fica no histórico (CA8). */
export async function encaminhar(dados: Encaminhamento): Promise<{ tarefa: TarefaEncaminhada; evento: EventoHistorico }> {
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === dados.fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const hoje = hojeIso(agora())
  const agendamento = agendamentoDoDia(ficha, hoje)
  if (dados.motivo === 'entrevista' && !agendamento) throw new Error('Sem entrevista marcada hoje')
  const quando = agora().toISOString()
  const beneficio = nomeBeneficio(ficha.processos[0]?.beneficio ?? ficha.beneficioInteresse)
  // Quem veio entregar documento vai sempre à Documentação, com o caso em andamento (GGVP-17, CA1 e CA3).
  const documento = dados.motivo === 'documento'
  const caso = ficha.processos[0]

  banco.seq += 1
  const id = `balcao-${banco.seq}`
  const tarefa: TarefaEncaminhada = documento
    ? {
        id,
        codigo: 'D1.02',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Receber documento',
        detalhe: [
          caso ? `${nomeBeneficio(caso.beneficio)} · ${caso.etapa}` : 'sem caso em andamento',
          `chegou ao balcão às ${hora(quando)}`,
        ].join(' · '),
        prazo: 'agora',
        href: `/balcao/documento/${id}`,
        processoId: caso?.id,
        setor: 'Documentação · ADM',
      }
    : {
        id,
        codigo: 'D1.03',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: dados.motivo === 'entrevista' ? 'Receber para a entrevista' : 'Atender quem chegou',
        detalhe: [
          beneficio || 'benefício a definir',
          `chegou ao balcão às ${hora(quando)}`,
          agendamento ? `${agendamento.oQue.toLowerCase()} hoje ${agendamento.hora}` : 'sem agendamento hoje',
        ].join(' · '),
        prazo: 'agora',
        href: `/clientes/${ficha.id}`,
        setor: dados.setor,
      }
  banco.tarefas.push(tarefa)
  const registro = evento(
    documento
      ? `Encaminhou à Documentação · ADM para receber documento${caso ? `, ligado ao caso ${nomeBeneficio(caso.beneficio)}` : ''}`
      : dados.motivo === 'entrevista'
        ? `Encaminhou ao ${dados.setor} para a entrevista das ${agendamento!.hora}, com a ficha e o agendamento`
        : `Encaminhou ao setor ${dados.setor} (outra etapa), com a ficha e o agendamento`,
  )
  ficha.historico.push(registro)
  gravar(banco)
  return { tarefa, evento: registro }
}

/** Tarefas que o balcão mandou a um setor. As da Documentação aparecem na Central do Atendimento. */
export function tarefasDoSetor(setor: Setor): TarefaEncaminhada[] {
  return ler().tarefas.filter((t) => t.setor === setor && !t.concluida)
}
