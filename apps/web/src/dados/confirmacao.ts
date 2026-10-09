// EXEMPLO. Servidor de exemplo da confirmação da entrevista do lead (GGVP-21), sobre o mesmo banco de servidor.ts. Ligar
// no servidor: trocar o corpo de cada função por fetch no endpoint indicado, sobre o contrato da design.md (change ggvp-6).
// O Chatwoot e a ligação são simulados.
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { TENTATIVAS_DE_CONFIRMACAO, confirmada, depoisDaTentativa, mensagemDaConfirmacao, precisaConfirmar, tentativaAtual } from '../regras/confirmacao.ts'
import { emAberto } from '../regras/busca.ts'
import { linkDoMeet } from './agenda.ts'
import { nomeBeneficio } from './catalogos.ts'
import { QUEM, agendamentoDoServidor, agora, esperar, evento, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type {
  Agendamento,
  CanalDoContato,
  EventoHistorico,
  Ficha,
  RegistroDaConfirmacao,
  RespostaDaConfirmacao,
  Tarefa,
  TarefaEncaminhada,
} from './tipos.ts'

const CANAL: Record<CanalDoContato, string> = { ligacao: 'Ligação', mensagem: 'Chatwoot' }
const CANAL_FALADO: Record<CanalDoContato, string> = { ligacao: 'ligação', mensagem: 'mensagem pelo Chatwoot' }

const quando = (a: Agendamento, hoje: string) => `${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)} às ${a.hora}`

function acharAgendamento(banco: Banco, id: string): { ficha: Ficha; agendamento: Agendamento } | null {
  for (const ficha of banco.fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === id)
    if (agendamento) return { ficha, agendamento }
  }
  return null
}

/** Uma por entrevista de lead ainda não confirmada, com o prazo da próxima tentativa (CA1, CA6). */
export function tarefasDeConfirmarAgendamento(): Tarefa[] {
  const hoje = hojeIso(agora())
  return ler().fichas.flatMap((f) =>
    f.agendamentos
      .filter((a) => precisaConfirmar(f, a, hoje))
      .map((a): Tarefa => {
        const proxima = a.confirmacao?.proximaEm
        return {
          id: `confirmar-agendamento-${a.id}`,
          codigo: 'D1.04',
          cliente: { id: f.id, nome: f.nome },
          acao: 'Confirmar agendamento',
          detalhe: [
            nomeBeneficio(f.beneficioInteresse) || 'benefício a definir',
            `entrevista ${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)} ${a.hora}`,
            proxima ? `tentativa ${tentativaAtual(a.confirmacao)} de ${TENTATIVAS_DE_CONFIRMACAO}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          prazo: proxima && proxima > hoje ? `nova tentativa ${dataCurta(proxima, hoje)}` : a.data === hoje ? a.hora : dataCurta(a.data, hoje),
          urgente: a.data === hoje,
          href: `/agenda/confirmar/${a.id}`,
        }
      }),
  )
}

export type DadosDaConfirmacao = { ficha: Ficha; agendamento: Agendamento; tentativa: number; mensagem: string }

/** GET /api/agendamentos/:id/confirmacao. Nulo quando o compromisso não existe. */
export async function obterConfirmacao(agendamentoId: string): Promise<DadosDaConfirmacao | null> {
  const achado = acharAgendamento(ler(), agendamentoId)
  if (!achado) return null
  const { ficha, agendamento: a } = achado
  const mensagem = mensagemDaConfirmacao({
    nome: ficha.nome,
    tipo: a.tipo ?? 'presencial',
    data: a.data,
    hora: a.hora,
    link: linkDoMeet(a.id),
    beneficio: ficha.beneficioInteresse,
    fichaPreenchida: ficha.fichaAtendimentoPreenchida,
  })
  return { ficha, agendamento: a, tentativa: tentativaAtual(a.confirmacao), mensagem }
}

/** POST /api/agendamentos/:id/confirmacao/mensagem. A mensagem conferida e enviada no Chatwoot fica em "Últimos contatos". */
export async function registrarMensagemDeConfirmacao(agendamentoId: string, mensagem: string): Promise<{ evento: EventoHistorico }> {
  if (agendamentoDoServidor(agendamentoId)) {
    const r = await noBanco<{ evento: EventoHistorico; ficha: Ficha }>(`/agendamentos/${agendamentoId}/confirmacao/mensagem`, {
      method: 'POST',
      corpo: { mensagem: mensagem.trim() },
    })
    receber(r)
    return { evento: r.evento }
  }
  await esperar()
  const banco = ler()
  const achado = acharAgendamento(banco, agendamentoId)
  if (!achado) throw new Error('Compromisso não encontrado')
  const { ficha, agendamento } = achado
  if (!ficha.telefone) throw new Error('Sem telefone: complete na ficha')
  if (mensagem.trim() === '' || mensagem.length > 1000) throw new Error('Mensagem vazia ou longa demais')
  const hoje = hojeIso(agora())
  ficha.contatos.push({ data: hoje, canal: 'Chatwoot', texto: `Confirmação da entrevista de ${quando(agendamento, hoje)}: ${mensagem.trim()}` })
  const registro = evento('Mandou a mensagem de confirmação da entrevista pelo Chatwoot')
  ficha.historico.push(registro)
  gravar(banco)
  return { evento: registro }
}

/** "Preparar entrevista" do Jurídico, uma só por entrevista (CA3). A ficha de atendimento (GGVP-24) também chama. */
export function abrirPreparacao(banco: Banco, ficha: Ficha, a: Agendamento): TarefaEncaminhada {
  const id = `preparar-${a.id}`
  const existente = banco.tarefas.find((t) => t.id === id)
  if (existente) return existente
  const hoje = hojeIso(agora())
  const tarefa: TarefaEncaminhada = {
    id,
    codigo: 'D1.06',
    cliente: { id: ficha.id, nome: ficha.nome },
    acao: 'Preparar entrevista',
    detalhe: [nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir', `entrevista ${quando(a, hoje)}`, 'ficha de atendimento preenchida'].join(' · '),
    prazo: a.data === hoje ? `antes das ${a.hora}` : dataCurta(a.data, hoje),
    href: `/entrevista/${a.id}/preparar`,
    setor: 'Jurídico',
  }
  banco.tarefas.push(tarefa)
  ficha.historico.push(evento(`Mandou ao Jurídico: preparar a entrevista de ${quando(a, hoje)}`))
  return tarefa
}

/** A pendência do Atendimento: a ficha em papel preenchida e escaneada antes da entrevista (CA2, CA7). */
export function abrirPreenchimento(banco: Banco, ficha: Ficha, a: Agendamento): TarefaEncaminhada {
  const hoje = hojeIso(agora())
  const tarefa: TarefaEncaminhada = {
    id: `preencher-ficha-${a.id}`,
    codigo: 'D1.05',
    cliente: { id: ficha.id, nome: ficha.nome },
    acao: 'Preencher ficha',
    detalhe: `ficha em papel, no balcão ou com quem captou, escaneada antes da entrevista de ${quando(a, hoje)}`,
    prazo: a.data === hoje ? `até ${a.hora}` : `até ${dataCurta(a.data, hoje)} ${a.hora}`,
    urgente: a.data === hoje,
    href: `/clientes/${ficha.id}/ficha-de-atendimento`,
    setor: 'Atendimento',
  }
  if (!banco.tarefas.some((t) => t.id === tarefa.id && !t.concluida)) banco.tarefas.push(tarefa)
  ficha.historico.push(evento(`Abriu a pendência "Preencher ficha", até a entrevista de ${quando(a, hoje)}`))
  return tarefa
}

/**
 * POST /api/agendamentos/:id/confirmacao. Grava quando, quem e o canal (CA5). Confirmou: com ficha, o Jurídico prepara
 * (CA3); sem ficha, a pendência da ficha (CA2, CA7). Sem resposta: a próxima em 3 dias e, na segunda, a sênior (CA6).
 */
export async function registrarConfirmacao(agendamentoId: string, r: RegistroDaConfirmacao): Promise<RespostaDaConfirmacao> {
  if (!agendamentoDoServidor(agendamentoId)) await esperar()
  const valido =
    (r.canal === 'ligacao' || r.canal === 'mensagem') &&
    (r.resultado === 'sem-resposta' || (r.resultado === 'confirmou' && typeof r.jaPreencheuFicha === 'boolean'))
  if (!valido) throw new Error('Registro inválido')
  if (agendamentoDoServidor(agendamentoId)) {
    // GGVP-125: a confirmação e as tarefas que ela abre (preparar, preencher, a da sênior) ficam no servidor.
    const { ficha, tarefas, ...resposta } = await noBanco<RespostaDaConfirmacao & { ficha: Ficha; tarefas: TarefaEncaminhada[] }>(
      `/agendamentos/${agendamentoId}/confirmacao`,
      { method: 'POST', corpo: r },
    )
    receber({ ficha, tarefas })
    return resposta
  }

  const banco = ler()
  const hoje = hojeIso(agora())
  const achado = acharAgendamento(banco, agendamentoId)
  if (!achado) throw new Error('Compromisso não encontrado')
  const { ficha, agendamento: a } = achado
  const aberta = ficha.situacao === 'lead' && a.oQue === 'Entrevista' && emAberto(a) && a.data >= hoje && !confirmada(a.confirmacao)
  if (!aberta) throw new Error('Esta entrevista não espera confirmação')
  const proxima = a.confirmacao?.proximaEm
  if (r.resultado === 'sem-resposta' && proxima && proxima > hoje) throw new Error(`A próxima tentativa é em ${dataCurta(proxima, hoje)}`)

  const confirmacao = (a.confirmacao ??= { tentativas: [] })
  const tentativa = confirmacao.tentativas.length + 1
  confirmacao.tentativas.push({ quando: agora().toISOString(), quem: QUEM, canal: r.canal, resultado: r.resultado })
  const canal = CANAL[r.canal]
  const falado = CANAL_FALADO[r.canal]
  const sobre = `a entrevista de ${quando(a, hoje)}`

  if (r.resultado === 'confirmou') {
    delete confirmacao.proximaEm
    // Confirmada pela sênior: a tarefa dela sai.
    for (const t of banco.tarefas) if (t.id === `confirmar-senior-${a.id}`) t.concluida = true
    ficha.contatos.push({ data: hoje, canal, texto: `Confirmou ${sobre}.` })
    ficha.historico.push(evento(`Confirmou ${sobre} (${falado}, tentativa ${tentativa})`))
    const tarefa = r.jaPreencheuFicha ? abrirPreparacao(banco, ficha, a) : abrirPreenchimento(banco, ficha, a)
    gravar(banco)
    return { tentativa, naSenior: confirmacao.naSenior ?? false, tarefa }
  }

  const semResposta = confirmacao.tentativas.filter((t) => t.resultado === 'sem-resposta').length
  const depois = depoisDaTentativa(semResposta, hoje)
  ficha.contatos.push({ data: hoje, canal, texto: `Sem resposta à confirmação de ${sobre} (tentativa ${tentativa} de ${TENTATIVAS_DE_CONFIRMACAO}).` })
  if (!depois.naSenior) {
    confirmacao.proximaEm = depois.proximaEm
    ficha.historico.push(
      evento(`Tentativa ${tentativa} de ${TENTATIVAS_DE_CONFIRMACAO} sem resposta (${falado}); nova tentativa em ${dataCurta(depois.proximaEm, hoje)}`),
    )
    gravar(banco)
    return { tentativa, proximaEm: depois.proximaEm, naSenior: false }
  }

  delete confirmacao.proximaEm
  const jaEstava = confirmacao.naSenior === true
  confirmacao.naSenior = true
  ficha.historico.push(evento(`Tentativa ${tentativa} sem resposta (${falado})${jaEstava ? '' : ': passou para a advogada sênior'}`))
  let tarefa: TarefaEncaminhada | undefined
  if (!jaEstava) {
    tarefa = {
      id: `confirmar-senior-${a.id}`,
      codigo: 'D1.04',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Confirmar agendamento',
      detalhe: `${TENTATIVAS_DE_CONFIRMACAO} tentativas sem resposta · a advogada sênior resolve e entra em contato com o lead`,
      prazo: a.data === hoje ? a.hora : dataCurta(a.data, hoje),
      urgente: true,
      href: `/agenda/confirmar/${a.id}`,
      setor: 'Jurídico',
    }
    banco.tarefas.push(tarefa)
  }
  gravar(banco)
  return { tentativa, naSenior: true, tarefa }
}
