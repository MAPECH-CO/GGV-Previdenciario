// A agenda, a confirmação e o encaminhamento do balcão no servidor (GGVP-125, bloco 2), sobre o fichário da Recepção.
// As regras são as do servidor de exemplo do Pedro (agenda.ts, confirmacao.ts e o encaminhar de servidor.ts), com as
// regras puras importadas das telas: horários, durações, equipe, limite de remarcação (G15) e tentativas de confirmação.
// As tarefas que abrem e fecham ficam em `tarefa_recepcao`, para a Central de qualquer computador.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { dataParaIso } from '@ggv/campos'
import {
  ConfirmacaoDoLead,
  EncaminhamentoDoBalcao,
  EntrevistaAgora,
  MarcacaoDaEntrevista,
  MensagemEnviada,
  NovoCompromissoInterno,
  ResultadoDoCompromisso,
  pode,
  type Erro,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { compromissoInterno, fichaRecepcao } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { EQUIPE, TIPOS_DE_ENTREVISTA, nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type {
  Agendamento,
  CompromissoGuardado,
  EstadoDoCompromisso,
  EventoDaAgenda,
  EventoHistorico,
  Ficha,
  RespostaDaConfirmacao,
  RespostaMarcacao,
  TarefaEncaminhada,
} from '../../../web/src/dados/tipos.ts'
import { DURACOES, HORARIOS, equipeDaEntrevista, estadoDoEvento, horarioOcupado, podeRemarcar } from '../../../web/src/regras/agenda.ts'
import { agendamentoDoDia, emAberto } from '../../../web/src/regras/busca.ts'
import { TENTATIVAS_DE_CONFIRMACAO, confirmada, depoisDaTentativa, precisaConfirmar } from '../../../web/src/regras/confirmacao.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario, horaEmBrasilia } from './recepcao.ts'

export const MSG_COMPROMISSO_NAO_ENCONTRADO = 'Compromisso não encontrado.'
export const MSG_JA_REGISTRADO = 'Este compromisso já foi registrado.'

const PASSOS: Record<string, string> = {
  Entrevista: 'D1.09 · Atender e entrevistar',
  'Retirada da cópia do contrato': 'D1.20 · Entregar a cópia do contrato',
  'Entregar cópia do contrato': 'D1.20 · Entregar a cópia do contrato',
  'Recontatar lead': 'D1.14 · Recontatar lead',
}
const CANAL = { ligacao: 'Ligação', mensagem: 'Chatwoot' } as const
const CANAL_FALADO = { ligacao: 'ligação', mensagem: 'mensagem pelo Chatwoot' } as const

const nomeDaEquipe = (id: string) => EQUIPE.find((m) => m.id === id)?.nome ?? id
const nomeDoTipo = (id: string | undefined) => TIPOS_DE_ENTREVISTA.find((t) => t.id === id)?.nome.toLowerCase() ?? ''
const dataValida = (iso: string) => dataParaIso(iso.split('-').reverse().join('/')) === iso
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

function doAgendamento(ficha: Ficha, a: Agendamento, hoje: string): EventoDaAgenda {
  return {
    id: a.id,
    data: a.data,
    hora: a.hora,
    duracao: a.duracao ?? 45,
    titulo: ficha.nome,
    oQue: a.oQue === 'Entrevista' ? 'Fazer entrevista' : a.oQue,
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

const doInterno = (i: CompromissoGuardado, hoje: string): EventoDaAgenda => ({
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
})

const guardado = (l: typeof compromissoInterno.$inferSelect): CompromissoGuardado => ({
  id: l.id,
  titulo: l.titulo,
  data: l.data,
  hora: l.hora,
  duracao: l.duracao,
  responsavel: l.responsavel,
  estado: l.estado as EstadoDoCompromisso,
})

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasRecepcaoAgenda(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const { hoje, evento, nomeDe, fichas, guardar, abrirTarefa, concluirTarefas, tarefas, abrirPreparacao, quandoNaConfirmacao, acharAgendamento, gravacoes } =
    criarFichario(banco, agora)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }
  const quandoNaAgenda = (a: { data: string; hora: string }) => `${dataCurta(a.data, hoje())} às ${a.hora}`

  const internos = async () => (await banco.select().from(compromissoInterno)).map(guardado)

  /** As fichas que a Recepção tem no banco. ponytail: todas; filtrar pelas em andamento quando o escritório crescer. */
  async function fichasDaRecepcao(): Promise<Ficha[]> {
    const ids = (await banco.select({ id: fichaRecepcao.pessoaId }).from(fichaRecepcao)).map((r) => r.id)
    return ids.length ? fichas(ids) : []
  }

  /** A agenda do escritório: entrevistas e retiradas das fichas e os compromissos internos; o remarcado sai (CA5). */
  async function eventosDoEscritorio(): Promise<EventoDaAgenda[]> {
    const dasFichas = (await fichasDaRecepcao()).flatMap((f) => f.agendamentos.filter((a) => a.estado !== 'remarcado').map((a) => doAgendamento(f, a, hoje())))
    return [...dasFichas, ...(await internos()).map((i) => doInterno(i, hoje()))]
  }

  const fichaPeloId = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  const novoId = (ficha: Ficha) => `${ficha.id}-ag-${randomUUID().slice(0, 8)}`

  /** A pendência do Atendimento: a ficha em papel preenchida e escaneada antes da entrevista (GGVP-21 CA2, CA7). */
  async function abrirPreenchimento(ficha: Ficha, a: Agendamento, quem: string): Promise<TarefaEncaminhada> {
    const tarefa: TarefaEncaminhada = {
      id: `preencher-ficha-${a.id}`,
      codigo: 'D1.05',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Preencher ficha',
      detalhe: `ficha em papel, no balcão ou com quem captou, escaneada antes da entrevista de ${quandoNaConfirmacao(a)}`,
      prazo: a.data === hoje() ? `até ${a.hora}` : `até ${dataCurta(a.data, hoje())} ${a.hora}`,
      urgente: a.data === hoje(),
      href: `/clientes/${ficha.id}/ficha-de-atendimento`,
      setor: 'Atendimento',
    }
    await abrirTarefa(tarefa)
    ficha.historico.push(evento(`Abriu a pendência "Preencher ficha", até a entrevista de ${quandoNaConfirmacao(a)}`, quem))
    return tarefa
  }

  // A cópia das telas: as fichas da Recepção, as tarefas abertas, os compromissos internos e as gravações, ao abrir cada
  // tela. A gravação com dado de saúde só vai a quem tem `dado_saude.ver_detalhe` (bloco 3a).
  app.get('/api/recepcao', ver, async (pedido) => ({
    fichas: await fichasDaRecepcao(),
    tarefas: await tarefas(),
    internos: await internos(),
    gravacoes: await gravacoes(pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')),
  }))

  // GGVP-16 CA4 e GGVP-17 CA1, CA3: o balcão manda ao setor, com a ficha e o agendamento; quem veio entregar documento
  // vai sempre à Documentação, ligado ao caso em andamento.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/encaminhamentos', editar, async (pedido, resposta) => {
    const entrada = EncaminhamentoDoBalcao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Encaminhamento inválido.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const { motivo, setor } = entrada.data
    const agendamento = agendamentoDoDia(ficha, hoje())
    if (motivo === 'entrevista' && !agendamento) return negar(resposta, 400, 'Sem entrevista marcada hoje.')
    const chegou = `chegou ao balcão às ${horaEmBrasilia(agora())}`
    const caso = ficha.processos[0]
    const id = `balcao-${randomUUID()}`
    const tarefa: TarefaEncaminhada =
      motivo === 'documento'
        ? {
            id,
            codigo: 'D1.02',
            cliente: { id: ficha.id, nome: ficha.nome },
            acao: 'Receber documento',
            detalhe: [caso ? `${nomeBeneficio(caso.beneficio)} · ${caso.etapa}` : 'sem caso em andamento', chegou].join(' · '),
            prazo: 'agora',
            href: `/balcao/documento/${id}`,
            processoId: caso?.id,
            setor: 'Documentação · ADM',
          }
        : {
            id,
            codigo: 'D1.03',
            cliente: { id: ficha.id, nome: ficha.nome },
            acao: motivo === 'entrevista' ? 'Receber para a entrevista' : 'Atender quem chegou',
            detalhe: [
              nomeBeneficio(caso?.beneficio ?? ficha.beneficioInteresse) || 'benefício a definir',
              chegou,
              agendamento ? `${agendamento.oQue.toLowerCase()} hoje ${agendamento.hora}` : 'sem agendamento hoje',
            ].join(' · '),
            prazo: 'agora',
            href: `/clientes/${ficha.id}`,
            setor,
          }
    const registro = evento(
      motivo === 'documento'
        ? `Encaminhou à Documentação · ADM para receber documento${caso ? `, ligado ao caso ${nomeBeneficio(caso.beneficio)}` : ''}`
        : motivo === 'entrevista'
          ? `Encaminhou ao ${setor} para a entrevista das ${agendamento!.hora}, com a ficha e o agendamento`
          : `Encaminhou ao setor ${setor} (outra etapa), com a ficha e o agendamento`,
      await nomeDe(pedido),
    )
    ficha.historico.push(registro)
    await guardar(ficha)
    await abrirTarefa(tarefa)
    return { tarefa, evento: registro, ficha }
  })

  // GGVP-123 CA1 a CA3, CA7: marcar ou remarcar. Horário ocupado avisa e deixa confirmar; remarcar pede o motivo e tem
  // limite (G15): passou dele, a resposta é "limite" e nada é marcado.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/agendamentos', editar, async (pedido, resposta): Promise<(RespostaMarcacao & { ficha?: Ficha }) | Erro> => {
    const entrada = MarcacaoDaEntrevista.safeParse(pedido.body)
    const m = entrada.success ? entrada.data : null
    const com = m ? equipeDaEntrevista(EQUIPE).find((p) => p.id === m.com) : undefined
    if (
      !m ||
      !com ||
      !dataValida(m.data) ||
      m.data < hoje() ||
      !HORARIOS.includes(m.hora) ||
      !DURACOES.includes(m.duracao) ||
      (m.remarcar !== undefined && m.remarcar.motivo.length < 3)
    )
      return negar(resposta, 400, 'Marcação inválida.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const antigo = m.remarcar && ficha.agendamentos.find((a) => a.id === m.remarcar!.agendamentoId)
    if (m.remarcar && (!antigo || !(emAberto(antigo) || antigo.estado === 'faltou'))) return negar(resposta, 400, 'Não dá para remarcar este compromisso.')
    if (antigo && !podeRemarcar(antigo.remarcacoes ?? 0)) return { resultado: 'limite' }
    const ocupados = horarioOcupado(await eventosDoEscritorio(), m).filter((e) => e.id !== antigo?.id)
    if (ocupados.length > 0 && !m.confirmarHorarioOcupado) return { resultado: 'ocupado', conflitos: ocupados }

    const agendamento: Agendamento = {
      id: novoId(ficha),
      data: m.data,
      hora: m.hora,
      oQue: 'Entrevista',
      com: com.nome,
      tipo: m.tipo,
      duracao: m.duracao,
      estado: 'marcado',
      remarcacoes: antigo ? (antigo.remarcacoes ?? 0) + 1 : 0,
      gravar: m.gravar,
      levar: m.levar,
      pedirFicha: m.pedirFicha,
    }
    ficha.agendamentos.push(agendamento)
    const como = `(${nomeDoTipo(m.tipo)}) com ${com.nome}`
    const quem = await nomeDe(pedido)
    if (antigo) {
      antigo.estado = 'remarcado'
      ficha.contatos.push({ data: hoje(), canal: 'Remarcação', texto: m.remarcar!.motivo })
      ficha.historico.push(
        evento(`Remarcou a entrevista de ${quandoNaAgenda(antigo)} para ${quandoNaAgenda(m)} ${como}, ${agendamento.remarcacoes}ª remarcação: ${m.remarcar!.motivo}`, quem),
      )
    } else {
      ficha.historico.push(evento(`Marcou a entrevista para ${quandoNaAgenda(m)} ${como}`, quem))
    }
    await guardar(ficha)
    return { resultado: 'marcado', agendamento, ficha }
  })

  // GGVP-40: "Iniciar entrevista (Transcrição)": a pessoa já está aqui; nasce marcada para hoje, nesta hora de Brasília.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/entrevistas/agora', editar, async (pedido, resposta) => {
    const entrada = EntrevistaAgora.safeParse(pedido.body)
    const m = entrada.success ? entrada.data : null
    const com = m ? equipeDaEntrevista(EQUIPE).find((p) => p.id === m.com) : undefined
    if (!m || !com || !DURACOES.includes(m.duracao)) return negar(resposta, 400, 'Escolha o tipo e com quem.')
    const ficha = await fichaPeloId(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const agendamento: Agendamento = {
      id: novoId(ficha),
      data: hoje(),
      hora: horaEmBrasilia(agora()),
      oQue: 'Entrevista',
      com: com.nome,
      tipo: m.tipo,
      duracao: m.duracao,
      estado: 'marcado',
      remarcacoes: 0,
      gravar: m.gravar,
      confirmacao: { tentativas: [], presente: true },
    }
    ficha.agendamentos.push(agendamento)
    const quem = await nomeDe(pedido)
    ficha.historico.push(evento(`Iniciou a entrevista agora (${nomeDoTipo(m.tipo)}) com ${com.nome}, sem marcar antes`, quem))
    // Como na confirmação (BPMN D1.05 antes do D1.06): com a ficha de atendimento, a advogada recebe "Preparar entrevista";
    // sem ela, o Atendimento recebe "Preencher ficha", e a ficha salva abre o "Preparar entrevista".
    const tarefa = ficha.fichaAtendimentoPreenchida ? await abrirPreparacao(ficha, agendamento, quem) : await abrirPreenchimento(ficha, agendamento, quem)
    await guardar(ficha)
    return { agendamento, ficha, tarefas: [tarefa] }
  })

  // GGVP-123 CA6, CA8, CA9: realizado conclui o "Receber para a entrevista" e, na entrevista do lead, abre o "Cadastrar
  // lead" do Jurídico; faltou grava a falta. Vale também para o compromisso interno.
  app.post<{ Params: { id: string } }>('/api/agendamentos/:id/resultado', editar, async (pedido, resposta) => {
    const entrada = ResultadoDoCompromisso.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Escolha realizado ou faltou.')
    const { resultado } = entrada.data
    const quem = await nomeDe(pedido)
    if (UUID.test(pedido.params.id)) {
      const [linha] = await banco.select().from(compromissoInterno).where(eq(compromissoInterno.id, pedido.params.id))
      if (!linha) return negar(resposta, 404, MSG_COMPROMISSO_NAO_ENCONTRADO)
      if (linha.estado !== 'marcado') return negar(resposta, 400, MSG_JA_REGISTRADO)
      await banco.update(compromissoInterno).set({ estado: resultado }).where(eq(compromissoInterno.id, linha.id))
      const registro = evento(`${resultado === 'realizado' ? 'Realizado' : 'Não aconteceu'}: ${linha.titulo}`, quem)
      return { evento: registro, interno: { ...guardado(linha), estado: resultado } }
    }
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_COMPROMISSO_NAO_ENCONTRADO)
    const { ficha, agendamento: a } = achado
    if (!emAberto(a)) return negar(resposta, 400, MSG_JA_REGISTRADO)
    a.estado = resultado
    const entrevista = a.oQue === 'Entrevista'
    let registro: EventoHistorico
    if (resultado === 'realizado') {
      await concluirTarefas(ficha.id, 'Receber para a entrevista')
      if (entrevista && ficha.situacao === 'lead')
        await abrirTarefa({
          id: `cadastro-${a.id}`,
          codigo: 'D1.10',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Cadastrar lead',
          detalhe: `entrevista realizada em ${dataCurta(a.data, hoje())}`,
          href: `/clientes/${ficha.id}`,
          setor: 'Jurídico',
        })
      registro = evento(`Marcou ${entrevista ? 'a entrevista' : `"${a.oQue}"`} de ${dataCurta(a.data, hoje())} como realizada`, quem)
    } else {
      registro = evento(`Registrou a falta ${entrevista ? 'à entrevista' : `em "${a.oQue}"`} de ${dataCurta(a.data, hoje())}`, quem)
    }
    ficha.historico.push(registro)
    await guardar(ficha)
    return { evento: registro, ficha, tarefas: await tarefas(ficha.id) }
  })

  // GGVP-123 CA4: o convite enviado no Chatwoot fica em "Últimos contatos". A mensagem é montada nas telas, para conferir.
  app.post<{ Params: { id: string } }>('/api/agendamentos/:id/convite', editar, async (pedido, resposta) => {
    const entrada = MensagemEnviada.safeParse(pedido.body)
    if (!entrada.success || entrada.data.mensagem === '') return negar(resposta, 400, 'Escreva a mensagem.')
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_COMPROMISSO_NAO_ENCONTRADO)
    const { ficha, agendamento: a } = achado
    if (!ficha.telefone) return negar(resposta, 400, 'Sem telefone: complete na ficha.')
    a.conviteEnviadoEm = agora().toISOString()
    ficha.contatos.push({ data: hoje(), canal: 'Chatwoot', texto: `Convite da entrevista de ${quandoNaAgenda(a)}: ${entrada.data.mensagem}` })
    const registro = evento('Enviou o convite da entrevista pelo Chatwoot', await nomeDe(pedido))
    ficha.historico.push(registro)
    await guardar(ficha)
    return { evento: registro, ficha }
  })

  // GGVP-123 CA5: compromisso sem cliente, como "gravação amanhã".
  app.post('/api/agenda/internos', editar, async (pedido, resposta) => {
    const entrada = NovoCompromissoInterno.safeParse(pedido.body)
    const c = entrada.success ? entrada.data : null
    if (
      !c ||
      c.titulo.length < 3 ||
      !dataValida(c.data) ||
      c.data < hoje() ||
      c.duracao < 15 ||
      c.duracao > 480 ||
      !EQUIPE.some((m) => m.id === c.responsavel && m.papel !== 'captador')
    )
      return negar(resposta, 400, 'Compromisso inválido.')
    const [linha] = await banco.insert(compromissoInterno).values({ ...c, criadoPor: pedido.usuario!.id }).returning()
    const interno = guardado(linha)
    return { evento: doInterno(interno, hoje()), interno }
  })

  // GGVP-21: a mensagem de confirmação conferida e enviada no Chatwoot fica em "Últimos contatos".
  app.post<{ Params: { id: string } }>('/api/agendamentos/:id/confirmacao/mensagem', editar, async (pedido, resposta) => {
    const entrada = MensagemEnviada.safeParse(pedido.body)
    if (!entrada.success || entrada.data.mensagem === '' || entrada.data.mensagem.length > 1000) return negar(resposta, 400, 'Mensagem vazia ou longa demais.')
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_COMPROMISSO_NAO_ENCONTRADO)
    const { ficha, agendamento: a } = achado
    if (!ficha.telefone) return negar(resposta, 400, 'Sem telefone: complete na ficha.')
    ficha.contatos.push({ data: hoje(), canal: 'Chatwoot', texto: `Confirmação da entrevista de ${quandoNaConfirmacao(a)}: ${entrada.data.mensagem}` })
    const registro = evento('Mandou a mensagem de confirmação da entrevista pelo Chatwoot', await nomeDe(pedido))
    ficha.historico.push(registro)
    await guardar(ficha)
    return { evento: registro, ficha }
  })

  // GGVP-21 CA2 a CA7: grava quando, quem e o canal. Confirmou: com ficha, o Jurídico prepara; sem ficha, a pendência da
  // ficha. Sem resposta: a próxima em 3 dias e, na segunda, a advogada sênior (G15).
  app.post<{ Params: { id: string } }>('/api/agendamentos/:id/confirmacao', editar, async (pedido, resposta) => {
    const entrada = ConfirmacaoDoLead.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Registro inválido.')
    const r = entrada.data
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_COMPROMISSO_NAO_ENCONTRADO)
    const { ficha, agendamento: a } = achado
    if (!(ficha.situacao === 'lead' && a.oQue === 'Entrevista' && emAberto(a) && a.data >= hoje() && !confirmada(a.confirmacao)))
      return negar(resposta, 400, 'Esta entrevista não espera confirmação.')
    const proxima = a.confirmacao?.proximaEm
    if (r.resultado === 'sem-resposta' && proxima && proxima > hoje()) return negar(resposta, 400, `A próxima tentativa é em ${dataCurta(proxima, hoje())}.`)

    const quem = await nomeDe(pedido)
    const confirmacao = (a.confirmacao ??= { tentativas: [] })
    const tentativa = confirmacao.tentativas.length + 1
    confirmacao.tentativas.push({ quando: agora().toISOString(), quem, canal: r.canal, resultado: r.resultado })
    const sobre = `a entrevista de ${quandoNaConfirmacao(a)}`
    let saida: RespostaDaConfirmacao
    if (r.resultado === 'confirmou') {
      delete confirmacao.proximaEm
      // Confirmada pela sênior: a tarefa dela sai.
      await concluirTarefas(ficha.id, 'Confirmar agendamento', `confirmar-senior-${a.id}`)
      ficha.contatos.push({ data: hoje(), canal: CANAL[r.canal], texto: `Confirmou ${sobre}.` })
      ficha.historico.push(evento(`Confirmou ${sobre} (${CANAL_FALADO[r.canal]}, tentativa ${tentativa})`, quem))
      const tarefa = r.jaPreencheuFicha ? await abrirPreparacao(ficha, a, quem) : await abrirPreenchimento(ficha, a, quem)
      saida = { tentativa, naSenior: confirmacao.naSenior ?? false, tarefa }
    } else {
      const depois = depoisDaTentativa(confirmacao.tentativas.filter((t) => t.resultado === 'sem-resposta').length, hoje())
      ficha.contatos.push({ data: hoje(), canal: CANAL[r.canal], texto: `Sem resposta à confirmação de ${sobre} (tentativa ${tentativa} de ${TENTATIVAS_DE_CONFIRMACAO}).` })
      if (!depois.naSenior) {
        confirmacao.proximaEm = depois.proximaEm
        ficha.historico.push(
          evento(`Tentativa ${tentativa} de ${TENTATIVAS_DE_CONFIRMACAO} sem resposta (${CANAL_FALADO[r.canal]}); nova tentativa em ${dataCurta(depois.proximaEm, hoje())}`, quem),
        )
        saida = { tentativa, proximaEm: depois.proximaEm, naSenior: false }
      } else {
        delete confirmacao.proximaEm
        const jaEstava = confirmacao.naSenior === true
        confirmacao.naSenior = true
        ficha.historico.push(evento(`Tentativa ${tentativa} sem resposta (${CANAL_FALADO[r.canal]})${jaEstava ? '' : ': passou para a advogada sênior'}`, quem))
        let tarefa: TarefaEncaminhada | undefined
        if (!jaEstava) {
          tarefa = {
            id: `confirmar-senior-${a.id}`,
            codigo: 'D1.04',
            cliente: { id: ficha.id, nome: ficha.nome },
            acao: 'Confirmar agendamento',
            detalhe: `${TENTATIVAS_DE_CONFIRMACAO} tentativas sem resposta · a advogada sênior resolve e entra em contato com o lead`,
            prazo: a.data === hoje() ? a.hora : dataCurta(a.data, hoje()),
            urgente: true,
            href: `/agenda/confirmar/${a.id}`,
            setor: 'Jurídico',
          }
          await abrirTarefa(tarefa)
        }
        saida = { tentativa, naSenior: true, tarefa }
      }
    }
    await guardar(ficha)
    return { ...saida, ficha, tarefas: await tarefas(ficha.id) }
  })
}
