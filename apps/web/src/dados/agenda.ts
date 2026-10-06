// EXEMPLO. Servidor de exemplo da agenda (GGVP-123), sobre o mesmo banco de servidor.ts. Ligar no servidor: trocar o
// corpo de cada função por fetch no endpoint indicado, sobre o contrato da design.md (change ggvp-6). O link do Meet e a
// conversa do Chatwoot são simulados.
import { dataParaIso } from '../campos.ts'
import { emAberto } from '../regras/busca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import {
  DURACOES,
  HORARIOS,
  equipeDaEntrevista,
  estadoDoEvento,
  horarioOcupado,
  mensagemDoConvite,
  podeRemarcar,
} from '../regras/agenda.ts'
import { precisaConfirmar } from '../regras/confirmacao.ts'
import { EQUIPE, TIPOS_DE_ENTREVISTA } from './catalogos.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type {
  Agendamento,
  CompromissoInterno,
  EventoDaAgenda,
  EventoHistorico,
  Ficha,
  Marcacao,
  RespostaMarcacao,
  Tarefa,
} from './tipos.ts'

const PASSOS: Record<string, string> = {
  Entrevista: 'D1.09 · Atender e entrevistar',
  'Retirada da cópia do contrato': 'D1.20 · Entregar a cópia do contrato',
  'Recontatar lead': 'D1.14 · Recontatar lead',
}

const nomeDaEquipe = (id: string) => EQUIPE.find((m) => m.id === id)?.nome ?? id
const nomeDoTipo = (id: string | undefined) => TIPOS_DE_ENTREVISTA.find((t) => t.id === id)?.nome.toLowerCase() ?? ''
export const linkDoMeet = (agendamentoId: string) => `meet.google.com/ggv-${agendamentoId}`

function doAgendamento(ficha: Ficha, a: Agendamento, hoje: string): EventoDaAgenda {
  return {
    id: a.id,
    data: a.data,
    hora: a.hora,
    duracao: a.duracao ?? 45,
    titulo: ficha.nome,
    oQue: a.oQue === 'Entrevista' ? 'Fazer entrevista' : a.oQue,
    // O recontato do lead que não fechou é um "Retorno a lead" (GGVP-60).
    categoria: a.oQue === 'Recontatar lead' ? 'retornos' : 'visitas',
    tipo: a.tipo,
    responsavel: a.com,
    passo: PASSOS[a.oQue],
    estado: estadoDoEvento(a.estado, a.data, hoje),
    fichaId: ficha.id,
    remarcacoes: a.remarcacoes ?? 0,
    conviteEnviadoEm: a.conviteEnviadoEm,
    gravar: a.gravar,
    ...(precisaConfirmar(ficha, a, hoje) && { aConfirmar: true }),
  }
}

/** Entrevistas e retiradas das fichas e os compromissos internos, em ordem; o remarcado sai (CA5). */
function eventosDoBanco(banco: Banco, hoje: string): EventoDaAgenda[] {
  const dasFichas = banco.fichas.flatMap((f) => f.agendamentos.filter((a) => a.estado !== 'remarcado').map((a) => doAgendamento(f, a, hoje)))
  const internos = banco.internos.map(
    (i): EventoDaAgenda => ({
      id: i.id,
      data: i.data,
      hora: i.hora,
      duracao: i.duracao,
      titulo: i.titulo,
      oQue: 'Compromisso interno',
      categoria: 'visitas',
      responsavel: nomeDaEquipe(i.responsavel),
      estado: estadoDoEvento(i.estado, i.data, hoje),
      remarcacoes: 0,
    }),
  )
  return [...dasFichas, ...internos].sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
}

/** GET /api/agenda?de=&ate= */
export async function eventosDaAgenda(de: string, ate: string): Promise<EventoDaAgenda[]> {
  return eventosDoBanco(ler(), hojeIso(agora())).filter((e) => e.data >= de && e.data <= ate)
}

/** Entrevista que passou sem registro: a Central do Atendimento lembra de confirmar se aconteceu (CA8). */
export function tarefasDeConfirmar(): Tarefa[] {
  return eventosDoBanco(ler(), hojeIso(agora()))
    .filter((e) => e.estado === 'confirmar' && e.fichaId)
    .map((e) => ({
      id: `confirmar-${e.id}`,
      codigo: 'D1.03',
      cliente: { id: e.fichaId!, nome: e.titulo },
      acao: 'Confirmar se a entrevista aconteceu',
      detalhe: `${e.oQue.toLowerCase()} de ${dataCurta(e.data, hojeIso(agora()))} às ${e.hora} · marcar realizado ou faltou`,
      urgente: true,
      href: '/agenda?ver=lista',
    }))
}

function acharAgendamento(banco: Banco, id: string): { ficha: Ficha; agendamento: Agendamento } {
  for (const ficha of banco.fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === id)
    if (agendamento) return { ficha, agendamento }
  }
  throw new Error('Compromisso não encontrado')
}

const quando = (a: { data: string; hora: string }, hoje: string) => `${dataCurta(a.data, hoje)} às ${a.hora}`

/** POST /api/fichas/:id/agendamentos. Horário ocupado avisa e deixa confirmar (CA3); remarcar pede o motivo e tem limite (CA7, G15). */
export async function marcarEntrevista(fichaId: string, m: Marcacao): Promise<RespostaMarcacao> {
  await esperar()
  const hoje = hojeIso(agora())
  const com = equipeDaEntrevista(EQUIPE).find((p) => p.id === m.com)
  const valido =
    TIPOS_DE_ENTREVISTA.some((t) => t.id === m.tipo) &&
    dataParaIso(m.data.split('-').reverse().join('/')) === m.data &&
    m.data >= hoje &&
    HORARIOS.includes(m.hora) &&
    DURACOES.includes(m.duracao) &&
    com !== undefined &&
    (!m.remarcar || m.remarcar.motivo.trim().length >= 3)
  if (!valido) throw new Error('Marcação inválida')

  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const antigo = m.remarcar && ficha.agendamentos.find((a) => a.id === m.remarcar!.agendamentoId)
  if (m.remarcar && (!antigo || !(emAberto(antigo) || antigo.estado === 'faltou'))) throw new Error('Não dá para remarcar este compromisso')
  if (antigo && !podeRemarcar(antigo.remarcacoes ?? 0)) return { resultado: 'limite' }

  const ocupados = horarioOcupado(eventosDoBanco(banco, hoje), m).filter((e) => e.id !== antigo?.id)
  if (ocupados.length > 0 && !m.confirmarHorarioOcupado) return { resultado: 'ocupado', conflitos: ocupados }

  banco.seq += 1
  const agendamento: Agendamento = {
    id: `${ficha.id}-ag-${banco.seq}`,
    data: m.data,
    hora: m.hora,
    oQue: 'Entrevista',
    com: com!.nome,
    tipo: m.tipo,
    duracao: m.duracao,
    estado: 'marcado',
    remarcacoes: antigo ? (antigo.remarcacoes ?? 0) + 1 : 0,
    gravar: m.gravar,
    levar: m.levar,
    pedirFicha: m.pedirFicha,
  }
  ficha.agendamentos.push(agendamento)
  const como = `(${nomeDoTipo(m.tipo)}) com ${com!.nome}`
  if (antigo) {
    antigo.estado = 'remarcado'
    ficha.contatos.push({ data: hoje, canal: 'Remarcação', texto: m.remarcar!.motivo.trim() })
    ficha.historico.push(
      evento(`Remarcou a entrevista de ${quando(antigo, hoje)} para ${quando(m, hoje)} ${como}, ${agendamento.remarcacoes}ª remarcação: ${m.remarcar!.motivo.trim()}`),
    )
  } else {
    ficha.historico.push(evento(`Marcou a entrevista para ${quando(m, hoje)} ${como}`))
  }
  gravar(banco)
  return { resultado: 'marcado', agendamento }
}

/**
 * POST /api/agendamentos/:id/resultado. "Realizado" conclui a tarefa e, na entrevista do lead, abre o "Cadastrar lead"
 * do Jurídico (CA6); "Faltou" grava a falta, e a tela abre o remarcar (CA8, CA9).
 */
export async function registrarResultado(id: string, resultado: 'realizado' | 'faltou'): Promise<{ evento: EventoHistorico }> {
  await esperar()
  const banco = ler()
  const hoje = hojeIso(agora())
  const interno = banco.internos.find((i) => i.id === id)
  if (interno) {
    if (interno.estado !== 'marcado') throw new Error('Este compromisso já foi registrado')
    interno.estado = resultado
    gravar(banco)
    return { evento: evento(`${resultado === 'realizado' ? 'Realizado' : 'Não aconteceu'}: ${interno.titulo}`) }
  }
  const { ficha, agendamento } = acharAgendamento(banco, id)
  if (!emAberto(agendamento)) throw new Error('Este compromisso já foi registrado')
  agendamento.estado = resultado
  const entrevista = agendamento.oQue === 'Entrevista'
  const nome = entrevista ? 'a entrevista' : `"${agendamento.oQue}"`
  let registro: EventoHistorico
  if (resultado === 'realizado') {
    for (const t of banco.tarefas) if (t.cliente?.id === ficha.id && t.acao === 'Receber para a entrevista') t.concluida = true
    if (entrevista && ficha.situacao === 'lead') {
      banco.seq += 1
      banco.tarefas.push({
        id: `cadastro-${banco.seq}`,
        codigo: 'D1.10',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Cadastrar lead',
        detalhe: `entrevista realizada em ${dataCurta(agendamento.data, hoje)}`,
        href: `/clientes/${ficha.id}`,
        setor: 'Jurídico',
      })
    }
    registro = evento(`Marcou ${nome} de ${dataCurta(agendamento.data, hoje)} como realizada`)
  } else {
    registro = evento(`Registrou a falta ${entrevista ? 'à entrevista' : `em "${agendamento.oQue}"`} de ${dataCurta(agendamento.data, hoje)}`)
  }
  ficha.historico.push(registro)
  gravar(banco)
  return { evento: registro }
}

/** GET /api/agendamentos/:id/convite. A mensagem pronta para conferir no Chatwoot (CA4). */
export async function prepararConvite(id: string): Promise<{ nome: string; telefone: string; mensagem: string }> {
  const { ficha, agendamento: a } = acharAgendamento(ler(), id)
  const mensagem = mensagemDoConvite({
    nome: ficha.nome,
    tipo: a.tipo ?? 'presencial',
    data: a.data,
    hora: a.hora,
    link: linkDoMeet(a.id),
    pedirFicha: a.pedirFicha ?? true,
    levar: a.levar ?? true,
    gravar: a.gravar ?? true,
  })
  return { nome: ficha.nome, telefone: ficha.telefone, mensagem }
}

/** POST /api/agendamentos/:id/convite. O convite enviado no Chatwoot fica em "Últimos contatos". */
export async function registrarConvite(id: string, mensagem: string): Promise<{ evento: EventoHistorico }> {
  await esperar()
  const banco = ler()
  const { ficha, agendamento } = acharAgendamento(banco, id)
  if (!ficha.telefone) throw new Error('Sem telefone: complete na ficha')
  const hoje = hojeIso(agora())
  agendamento.conviteEnviadoEm = agora().toISOString()
  ficha.contatos.push({ data: hoje, canal: 'Chatwoot', texto: `Convite da entrevista de ${quando(agendamento, hoje)}: ${mensagem.trim()}` })
  const registro = evento('Enviou o convite da entrevista pelo Chatwoot')
  ficha.historico.push(registro)
  gravar(banco)
  return { evento: registro }
}

/** POST /api/agenda/internos. Compromisso sem cliente, como "gravação amanhã" (CA5). */
export async function criarCompromissoInterno(c: CompromissoInterno): Promise<EventoDaAgenda> {
  await esperar()
  const hoje = hojeIso(agora())
  const valido =
    c.titulo.trim().length >= 3 &&
    c.titulo.trim().length <= 80 &&
    c.data >= hoje &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(c.hora) &&
    c.duracao >= 15 &&
    c.duracao <= 480 &&
    EQUIPE.some((m) => m.id === c.responsavel && m.papel !== 'captador')
  if (!valido) throw new Error('Compromisso inválido')
  const banco = ler()
  banco.seq += 1
  const id = `interno-${banco.seq}`
  banco.internos.push({ ...c, titulo: c.titulo.trim(), id, estado: 'marcado' })
  gravar(banco)
  return eventosDoBanco(banco, hoje).find((e) => e.id === id)!
}
