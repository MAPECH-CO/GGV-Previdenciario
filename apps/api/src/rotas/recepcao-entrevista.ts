// A entrevista gravada e a transcrição no servidor (GGVP-125, bloco 3a), sobre o fichário da Recepção. As regras são as
// do servidor de exemplo do Pedro (entrevista.ts e transcricao.ts). A gravação e a transcrição seguem simuladas, como nas
// telas: o áudio é um relógio e a transcrição é a conversa de exemplo, já sem senha (G9). Nada aqui apaga áudio nem texto.
// A entrevista tem dado de saúde: gravar e transcrever pedem `entrevista.gravar` (Jurídico).
import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { dataParaIso, formatarTelefone, normalizarData } from '@ggv/campos'
import {
  AcaoNaGravacaoPedida,
  AudioGravadoFora,
  ConferenciaDaTranscricao,
  ConversaRegistrada,
  DocumentosDaEntrevista,
  EntrevistaSemAudio,
  FimDaGravacao,
  InicioDaGravacao,
  PedidoDeTranscricao,
  ProvaNoTrecho,
  pode,
  type Erro,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { exigir } from '../sessao/rotas.ts'
import type { Armazenamento } from '../armazenamento.ts'
import type { Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { guardarAudio, transcreverGravacao } from '../fluxo/transcricao.ts'
import { lerFormulario } from './formulario.ts'
import { TIPOS_DE_ENTREVISTA, nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import { conversaDeExemplo } from '../../../web/src/dados/exemplo.ts'
import type { AcaoNaGravacao, Agendamento, Ficha, Gravacao, TarefaEncaminhada } from '../../../web/src/dados/tipos.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { documentosDaEntrevista, ehAudio, juntarPartes, partesDoAudio, relogio, resumoDaEntrevista, tirarSenhas } from '../../../web/src/regras/entrevista.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario, horaEmBrasilia } from './recepcao.ts'

export const MSG_GRAVACAO_NAO_ENCONTRADA = 'Gravação não encontrada.'
export const MSG_ENTREVISTA_NAO_ENCONTRADA = 'Entrevista não encontrada.'
export const MSG_SEM_AVISO = 'Avise o cliente que a conversa será gravada antes de gravar (G10).'
const CANAIS_DA_CONVERSA = ['WhatsApp', 'Telefone', 'Presencial', 'Vídeo']

/** Áudio de voz a 128 kbit/s: 16 kB por segundo. Só para o tamanho do arquivo simulado. */
const BYTES_POR_SEGUNDO = 16_000
const ESTADO_DEPOIS: Partial<Record<AcaoNaGravacao['acao'], Gravacao['estado']>> = {
  pausou: 'pausada',
  'abriu-cofre': 'pausada',
  retomou: 'gravando',
  'guardou-senha': 'gravando',
  falhou: 'falhou',
}

const advogadaDa = (a: Agendamento) => a.com ?? 'Advogada'
const canalDo = (a: Agendamento) => (TIPOS_DE_ENTREVISTA.find((t) => t.id === (a.tipo ?? 'presencial'))?.nome ?? 'presencial').split(' ')[0].toLowerCase()
const audioDaGravacao = (ficha: Ficha, g: Gravacao): Gravacao['audio'] => {
  const tamanho = g.duracao * BYTES_POR_SEGUNDO
  return { nome: `entrevista-${ficha.id}-${g.data}.webm`, formato: 'webm', tamanho, partes: partesDoAudio(tamanho) }
}
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** GGVP-133: o motor de IA, o armazenamento e o preparo ligam a transcrição de verdade; sem eles, segue o exemplo. */
type Opcoes = { banco: Banco; agora?: () => Date; ia?: Ia; armazenamento?: Armazenamento; preparo?: Preparo }

export const MSG_AUDIO_GRANDE = 'O áudio não chegou inteiro: cada arquivo vai até 25 MB.'
const MSG_SEM_ARMAZENAMENTO = 'O armazenamento do áudio não está ligado.'
const formatoDo = (nome: string) => nome.split('.').at(-1)?.toLowerCase() ?? ''

export function registrarRotasRecepcaoEntrevista(app: FastifyInstance, { banco, agora = () => new Date(), ia, armazenamento, preparo }: Opcoes) {
  const real = ia && armazenamento ? { banco, ia, armazenamento } : null
  const f = criarFichario(banco, agora)
  const { hoje, evento, nomeDe, fichas, guardar, abrirTarefa, garantirAberta, concluirTarefas, tarefas, acharAgendamento, guardarGravacao, acharGravacao } = f
  const gravar = { preHandler: exigir(banco, 'entrevista.gravar', agora) }
  const editar = { preHandler: exigir(banco, 'ficha.editar', agora) }

  const acao = (g: Gravacao, nome: AcaoNaGravacao['acao'], aos: number) => {
    g.acoes.push({ acao: nome, quando: agora().toISOString(), aos })
    g.duracao = Math.max(g.duracao, aos)
  }

  const novaGravacao = (ficha: Ficha, a: Agendamento, origem: Gravacao['origem']): Gravacao => ({
    id: `gravacao-${randomUUID()}`,
    fichaId: ficha.id,
    agendamentoId: a.id,
    data: hoje(),
    titulo: 'Entrevista com a advogada',
    canal: canalDo(a),
    participantes: [advogadaDa(a), ficha.nome],
    duracao: 0,
    origem,
    estado: 'gravando',
    acoes: [],
    transcricao: 'transcrevendo',
    trechos: [],
    extraidas: [],
    documentos: [],
    soJuridico: true,
    marcas: [],
  })

  /**
   * O fim da entrevista (GGVP-40 CA5): o compromisso vira realizado, o "Preparar entrevista" sai da fila, a advogada
   * define o benefício (D1.12) e, para o lead, recebe "Cadastrar lead" (D1.10).
   */
  async function fecharEntrevista(ficha: Ficha, a: Agendamento, g: Gravacao): Promise<TarefaEncaminhada | undefined> {
    a.estado = 'realizado'
    if (g.audio) ficha.transcricoes += 1
    await concluirTarefas(ficha.id, 'Preparar entrevista', `preparar-${a.id}`)
    await garantirAberta({
      id: `definir-${ficha.id}`,
      codigo: 'D1.12',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Definir benefício',
      detalhe: [nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir', 'benefício sugerido, você decide (G3)'].join(' · '),
      prazo: 'hoje',
      href: `/entrevista/${a.id}/beneficio`,
      setor: 'Jurídico',
    })
    if (ficha.situacao !== 'lead') return undefined
    const tarefa: TarefaEncaminhada = {
      id: `cadastrar-${ficha.id}`,
      codigo: 'D1.10',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Cadastrar lead',
      detalhe: [
        nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir',
        `entrevista de ${a.data === hoje() ? 'hoje' : dataCurta(a.data, hoje())}`,
        'dados da ficha e da entrevista para conferir',
      ].join(' · '),
      prazo: 'hoje',
      href: `/clientes/${ficha.id}/cadastro`,
      setor: 'Jurídico',
    }
    await garantirAberta(tarefa)
    return tarefa
  }

  /** Grava a gravação e a ficha e devolve o que a cópia das telas precisa. */
  async function salvar(g: Gravacao, ficha: Ficha, tarefa?: TarefaEncaminhada) {
    await guardarGravacao(g)
    await guardar(ficha)
    return { gravacao: g, tarefa, ficha, tarefas: await tarefas(ficha.id) }
  }

  // GGVP-40 CA4, G10: só grava com o aviso ao cliente registrado, com a hora. A que está aberta continua.
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/gravacoes', gravar, async (pedido, resposta) => {
    if (!InicioDaGravacao.safeParse(pedido.body).success) return negar(resposta, 400, MSG_SEM_AVISO)
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
    const { ficha, agendamento } = achado
    const aberta = (await f.gravacoes(true)).find((g) => g.agendamentoId === agendamento.id && g.estado !== 'encerrada')
    if (aberta) return { gravacao: aberta, ficha }
    const g = novaGravacao(ficha, agendamento, 'portal')
    g.avisoEm = agora().toISOString()
    acao(g, 'avisou', 0)
    acao(g, 'gravou', 0)
    ficha.historico.push(evento(`Avisou o cliente às ${horaEmBrasilia(agora())} que a conversa seria gravada (G10) e começou a gravar a entrevista`, await nomeDe(pedido)))
    const { tarefa: _, ...salvo } = await salvar(g, ficha)
    return salvo
  })

  // CA5, CA6, CA8: cada ação fica registrada com a hora e o ponto do áudio.
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/acoes', gravar, async (pedido, resposta) => {
    const entrada = AcaoNaGravacaoPedida.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Ação inválida.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g } = achado
    if (g.estado === 'encerrada') return negar(resposta, 400, 'A gravação já foi encerrada.')
    acao(g, entrada.data.acao, entrada.data.aos)
    g.estado = ESTADO_DEPOIS[entrada.data.acao]!
    await guardarGravacao(g)
    return { gravacao: g }
  })

  // CA2, CA5, CA12: o áudio fica no caso e vai para a transcrição; sem internet, espera.
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/encerrar', gravar, async (pedido, resposta) => {
    const entrada = FimDaGravacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Fim da gravação inválido.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g, ficha, agendamento } = achado
    if (g.estado === 'encerrada') return { gravacao: g }
    acao(g, 'encerrou', entrada.data.aos)
    g.estado = 'encerrada'
    g.audio = g.audio?.documentos ? g.audio : audioDaGravacao(ficha, g)
    g.transcricao = entrada.data.online ? 'transcrevendo' : 'aguardando-internet'
    const tarefa = agendamento && (await fecharEntrevista(ficha, agendamento, g))
    ficha.historico.push(evento(`Encerrou a entrevista gravada (${Math.max(1, Math.round(g.duracao / 60))} min); o áudio ficou no caso`, await nomeDe(pedido)))
    return salvar(g, ficha, tarefa)
  })

  // CA12: a internet voltou; o áudio guardado no computador sobe uma vez só.
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/audio', gravar, async (pedido, resposta) => {
    // GGVP-133: o áudio de verdade chega em partes e cada uma vira documento na pasta do cliente. A última parte de quem
    // estava sem internet ("ultima") manda a gravação para a transcrição.
    if (pedido.isMultipart()) {
      if (!real) return negar(resposta, 503, MSG_SEM_ARMAZENAMENTO)
      const formulario = await lerFormulario(pedido)
      if (!formulario) return negar(resposta, 400, MSG_AUDIO_GRANDE)
      const { arquivo, campos } = formulario
      const inicio = Number(campos.inicio ?? 0)
      if (!arquivo || !ehAudio({ nome: arquivo.nome, tipo: arquivo.mime }) || !Number.isFinite(inicio) || inicio < 0) return negar(resposta, 400, 'Esse arquivo não é de áudio.')
      const achadoComAudio = await acharGravacao(pedido.params.id)
      if (!achadoComAudio) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
      const { gravacao: g } = achadoComAudio
      const id = await guardarAudio(real, g, arquivo, pedido.usuario!.id)
      const antes = g.audio?.documentos ? g.audio : undefined
      const documentos = [...(antes?.documentos ?? []), { id, inicio }]
      g.audio = { nome: antes?.nome ?? arquivo.nome, formato: formatoDo(arquivo.nome), tamanho: (antes?.tamanho ?? 0) + arquivo.conteudo.length, partes: documentos.length, documentos }
      if (campos.ultima === 'sim' && g.transcricao === 'aguardando-internet') {
        acao(g, 'enviou-audio', g.duracao)
        g.transcricao = 'transcrevendo'
      }
      await guardarGravacao(g)
      return { gravacao: g }
    }
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g } = achado
    if (g.transcricao !== 'aguardando-internet') return { gravacao: g }
    acao(g, 'enviou-audio', g.duracao)
    g.transcricao = 'transcrevendo'
    await guardarGravacao(g)
    return { gravacao: g }
  })

  // CA8: a gravação falhou e a advogada registra a entrevista sem áudio; o que foi gravado até a falha fica no caso.
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/sem-audio', gravar, async (pedido, resposta) => {
    const entrada = EntrevistaSemAudio.safeParse(pedido.body)
    if (!entrada.success || entrada.data.notas.length < 3) return negar(resposta, 400, 'Escreva o que foi conversado.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g, ficha, agendamento } = achado
    acao(g, 'sem-audio', g.duracao)
    g.estado = 'encerrada'
    g.transcricao = 'sem-audio'
    g.registro = entrada.data.notas
    if (g.duracao > 0 && !g.audio?.documentos) g.audio = audioDaGravacao(ficha, g)
    const tarefa = agendamento && (await fecharEntrevista(ficha, agendamento, g))
    ficha.historico.push(evento('Registrou a entrevista sem áudio: a gravação falhou', await nomeDe(pedido)))
    return salvar(g, ficha, tarefa)
  })

  // CA9, CA10: o áudio gravado fora do portal, de qualquer formato e tamanho, vai para a transcrição.
  app.post<{ Params: { id: string } }>('/api/entrevistas/:id/audio', gravar, async (pedido, resposta) => {
    // GGVP-133 CA2: o arquivo de verdade (a gravação da ligação baixada da conversa do Chatwoot, ou outro áudio de fora)
    // vira documento na pasta do cliente e vai para a transcrição. O portal não busca nada no Chatwoot.
    if (pedido.isMultipart()) {
      if (!real) return negar(resposta, 503, MSG_SEM_ARMAZENAMENTO)
      const formulario = await lerFormulario(pedido)
      if (!formulario) return negar(resposta, 400, MSG_AUDIO_GRANDE)
      const arquivo = formulario.arquivo
      if (!arquivo || !ehAudio({ nome: arquivo.nome, tipo: arquivo.mime })) return negar(resposta, 400, 'Esse arquivo não é de áudio.')
      const achadoDeFora = await acharAgendamento(pedido.params.id)
      if (!achadoDeFora) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
      const { ficha, agendamento } = achadoDeFora
      const g = novaGravacao(ficha, agendamento, 'arquivo')
      g.estado = 'encerrada'
      const id = await guardarAudio(real, g, arquivo, pedido.usuario!.id)
      g.audio = { nome: arquivo.nome, formato: formatoDo(arquivo.nome), tamanho: arquivo.conteudo.length, partes: 1, documentos: [{ id, inicio: 0 }] }
      acao(g, 'subiu-arquivo', 0)
      const tarefa = await fecharEntrevista(ficha, agendamento, g)
      ficha.historico.push(evento(`Subiu o áudio da entrevista gravado fora do portal (${arquivo.nome}); foi para a transcrição`, await nomeDe(pedido)))
      return salvar(g, ficha, tarefa)
    }
    const entrada = AudioGravadoFora.safeParse(pedido.body)
    if (!entrada.success || !ehAudio(entrada.data)) return negar(resposta, 400, 'Esse arquivo não é de áudio.')
    const achado = await acharAgendamento(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_ENTREVISTA_NAO_ENCONTRADA)
    const { ficha, agendamento } = achado
    const { nome, tamanho } = entrada.data
    const g = novaGravacao(ficha, agendamento, 'arquivo')
    g.estado = 'encerrada'
    g.audio = { nome, formato: nome.split('.').at(-1)?.toLowerCase() ?? '', tamanho, partes: partesDoAudio(tamanho) }
    acao(g, 'subiu-arquivo', 0)
    const tarefa = await fecharEntrevista(ficha, agendamento, g)
    ficha.historico.push(evento(`Subiu o áudio da entrevista gravado fora do portal (${nome}); foi para a transcrição`, await nomeDe(pedido)))
    return salvar(g, ficha, tarefa)
  })

  // GGVP-46: a transcrição simulada (a conversa de exemplo até onde gravou, nas partes do áudio e juntada de novo, com
  // quem fala e sem senha). `falhar` simula a falha do serviço (CA3); "tentar de novo" é pedir outra vez.
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/transcricao', gravar, async (pedido, resposta) => {
    const entrada = PedidoDeTranscricao.safeParse(pedido.body ?? {})
    if (!entrada.success) return negar(resposta, 400, 'Pedido inválido.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g, ficha, agendamento } = achado
    if (g.estado !== 'encerrada' || (g.transcricao !== 'transcrevendo' && g.transcricao !== 'falhou')) return { gravacao: g }
    // GGVP-133 CA1, CA8: com o áudio de verdade guardado, o texto vem da OpenAI, pelo motor; falhou, o áudio fica e a
    // pessoa tenta de novo. Sem áudio guardado (gravação sem microfone), segue a conversa de exemplo abaixo.
    if (g.audio?.documentos?.length && real) {
      await transcreverGravacao(real, g, ficha, pedido.usuario!.id)
      await guardarGravacao(g)
      return { gravacao: g }
    }
    if (entrada.data.falhar) {
      g.transcricao = 'falhou'
      g.motivoDaFalha = 'o serviço de transcrição não respondeu'
      await guardarGravacao(g)
      return { gravacao: g }
    }
    const falas = conversaDeExemplo(ficha, agendamento ? advogadaDa(agendamento) : 'Advogada')
    if (g.origem === 'arquivo') g.duracao = falas.at(-1)!.aos + 10
    const ditas = falas.filter((fala) => fala.aos <= g.duracao)
    const partes = g.audio?.partes ?? 1
    const tamanho = Math.ceil((g.duracao + 1) / partes)
    const trechos = juntarPartes(
      Array.from({ length: partes }, (_, i) => ({
        inicio: i * tamanho,
        trechos: ditas
          .filter((fala) => fala.aos >= i * tamanho && fala.aos < (i + 1) * tamanho)
          .map((fala) => ({ aos: fala.aos - i * tamanho, quem: fala.quem, papel: fala.papel, texto: fala.texto })),
      })),
    )
    const extraidas = ditas.flatMap((fala) => fala.extrai ?? [])
    if (g.acoes.some((x) => x.acao === 'guardou-senha')) {
      extraidas.push({ id: 'senha', rotulo: 'Senha do gov.br', valor: 'digitada no cofre: não consta na transcrição (G9)', destino: 'cofre' })
    }
    g.trechos = tirarSenhas(trechos)
    g.extraidas = extraidas
    g.resumo = resumoDaEntrevista(ficha, extraidas)
    g.documentos = documentosDaEntrevista(ficha, extraidas)
    g.transcricao = 'pronta'
    g.motivoDaFalha = undefined
    await guardarGravacao(g)
    return { gravacao: g }
  })

  // GGVP-46 CA6, G14: só o que a advogada conferiu sai da transcrição. O da ficha muda a ficha, com o valor antigo no
  // histórico; o da Documentação vira "Pedir documento"; cofre e processo ficam marcados.
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/conferencias', gravar, async (pedido, resposta) => {
    const entrada = ConferenciaDaTranscricao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Marque o que você conferiu.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g, ficha } = achado
    const quem = await nomeDe(pedido)
    const quando = agora().toISOString()
    const deQuando = `da entrevista de ${dataCurta(g.data, hoje())}`
    for (const info of g.extraidas.filter((e) => entrada.data.ids.includes(e.id) && !e.conferidaEm)) {
      info.conferidaEm = quando
      if (info.destino === 'ficha' && info.campo) {
        const falado = (v: string) => (info.campo === 'telefone' && v ? formatarTelefone(v) : v)
        const antes = ficha[info.campo] ?? ''
        ficha[info.campo] = info.valor
        ficha.historico.push(evento(`Levou à ficha, ${deQuando}, ${info.rotulo.toLowerCase()}: «${falado(antes) || '—'}» → «${falado(info.valor)}»`, quem))
        if (!g.marcas.includes('ficha atualizada')) g.marcas.push('ficha atualizada')
      }
      if (info.destino === 'documentacao') {
        await abrirTarefa({
          id: `pedir-${randomUUID()}`,
          codigo: 'D1.23',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Pedir documento',
          detalhe: `${info.valor} · citado ${deQuando}`,
          prazo: 'esta semana',
          href: `/clientes/${ficha.id}`,
          setor: 'Documentação · ADM',
        })
        ficha.historico.push(evento(`Pediu à Documentação, ${deQuando}: ${info.valor}`, quem))
      }
    }
    const { tarefa: _, ...salvo } = await salvar(g, ficha)
    return salvo
  })

  // CA7: a lista conferida vai para o checklist do benefício (GGVP-91).
  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/documentos', gravar, async (pedido, resposta) => {
    const entrada = DocumentosDaEntrevista.safeParse(pedido.body)
    const lista = entrada.success ? entrada.data.documentos.filter(Boolean) : []
    if (lista.length === 0 || lista.some((d) => d.length < 2 || d.length > 120)) return negar(resposta, 400, 'Lista de documentos inválida.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g, ficha } = achado
    g.documentos = lista
    g.documentosConferidosEm = agora().toISOString()
    ficha.checklist = [...new Set([...(ficha.checklist ?? []), ...lista])]
    ficha.historico.push(evento(`Conferiu os documentos da entrevista e mandou ao checklist do benefício: ${lista.join(', ')}`, await nomeDe(pedido)))
    const { tarefa: _, ...salvo } = await salvar(g, ficha)
    return salvo
  })

  // CA6: marca ou desmarca um trecho como prova.
  app.patch<{ Params: { id: string; aos: string } }>('/api/gravacoes/:id/trechos/:aos', gravar, async (pedido, resposta) => {
    const entrada = ProvaNoTrecho.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Diga se é prova.')
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return negar(resposta, 404, MSG_GRAVACAO_NAO_ENCONTRADA)
    const { gravacao: g, ficha } = achado
    const aos = Number(pedido.params.aos)
    const trecho = g.trechos.find((t) => t.aos === aos)
    if (!trecho) return negar(resposta, 404, 'Trecho não encontrado.')
    trecho.prova = entrada.data.prova || undefined
    ficha.historico.push(evento(`${entrada.data.prova ? 'Marcou' : 'Desmarcou'} como prova o trecho de ${relogio(aos).slice(3)} (${g.titulo.toLowerCase()})`, await nomeDe(pedido)))
    const { tarefa: _, ...salvo } = await salvar(g, ficha)
    return salvo
  })

  // GGVP-46 CA6: a conversa sem áudio, escrita por quem participou. Só é do Jurídico se quem registra vê dado de saúde.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/conversas', editar, async (pedido, resposta) => {
    const entrada = ConversaRegistrada.safeParse(pedido.body)
    const c = entrada.success ? entrada.data : null
    const data = c ? dataParaIso(normalizarData(c.data)) : null
    if (
      !c ||
      data === null ||
      data > hoje() ||
      !CANAIS_DA_CONVERSA.includes(c.canal) ||
      c.titulo.length < 3 ||
      c.titulo.length > 120 ||
      c.participantes.length < 3 ||
      c.participantes.length > 120 ||
      c.texto.length < 3 ||
      c.texto.length > 4000
    )
      return negar(resposta, 400, 'Conversa incompleta ou inválida.')
    const ficha = UUID.test(pedido.params.id) ? (await fichas([pedido.params.id]))[0] : undefined
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const g: Gravacao = {
      id: `conversa-${randomUUID()}`,
      fichaId: ficha.id,
      data,
      titulo: `${c.canal}: ${c.titulo}`,
      canal: c.canal,
      participantes: c.participantes.split(/\s*[,+]\s*/).filter(Boolean),
      duracao: 0,
      origem: 'registro',
      estado: 'encerrada',
      acoes: [],
      transcricao: 'sem-audio',
      trechos: [],
      extraidas: [],
      documentos: [],
      registro: c.texto,
      soJuridico: c.perfil === 'juridico' && pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe'),
      marcas: [],
    }
    ficha.historico.push(evento(`Registrou uma conversa sem áudio: ${g.titulo}`, await nomeDe(pedido)))
    const { tarefa: _, ...salvo } = await salvar(g, ficha)
    return salvo
  })

  // GGVP-133: o preparo em segundo plano (a cada 5 minutos) transcreve as gravações com áudio de verdade que esperam.
  if (real && preparo)
    preparo.registrar(
      async () =>
        (await f.gravacoes(true)).filter((g) => g.estado === 'encerrada' && g.transcricao === 'transcrevendo' && g.audio?.documentos?.length).map((g) => g.id),
      async (id) => {
        const achado = await acharGravacao(id)
        if (!achado || achado.gravacao.transcricao !== 'transcrevendo') return
        await transcreverGravacao(real, achado.gravacao, achado.ficha, null)
        await guardarGravacao(achado.gravacao)
      },
    )
}
