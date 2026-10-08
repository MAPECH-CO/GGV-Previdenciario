// As mensagens ao cliente no servidor (GGVP-138; telas da GGVP-102), sobre o fichário da Recepção. O catálogo de modelos e
// o que o texto não pode ter (G9, G11, G20) são as regras puras das telas, importadas. Cada envio fica em `mensagem`, que o
// modelo de dados já tinha, com o status de entrega; o contato vai para "Últimos contatos" da ficha.
// O Chatwoot segue simulado atrás de `RELACIONAMENTO_SIMULADO` (o contato pelo telefone da ficha, uma conversa aberta, a
// entrega confirmada); com `nao`, o envio falha com o motivo. O Chatwoot de verdade é outra história.
// ponytail: as regras vêm de apps/web; mover para um pacote comum quando a ligação terminar.
import { and, desc, eq, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { normalizarTelefone } from '@ggv/campos'
import { IdDoModelo, PedidoDeMensagem, type Erro, type MensagemAoCliente, type MensagemPronta } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { mensagem, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { COMO, diaFalado, horaFalada, mensagemDoConvite } from '../../../web/src/regras/agenda.ts'
import { mensagemDaConfirmacao } from '../../../web/src/regras/confirmacao.ts'
import { MODELOS_DE_MENSAGEM, comAvisoDaSenha, ordenarConversas, problemasDaMensagem } from '../../../web/src/regras/mensagens.ts'
import { camposDoProcessoEmVigor } from './conversa.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario, horaEmBrasilia } from './recepcao.ts'

export const MSG_CHATWOOT_DESLIGADO = 'o Chatwoot de verdade ainda não está ligado'
export const MSG_SEM_CONTATO = 'o Chatwoot não achou o contato deste telefone'
const STATUS_FALADO: Record<MensagemAoCliente['status'], string> = { enviada: 'enviada', entregue: 'entregue', lida: 'lida', falhou: 'não saiu' }

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; agora?: () => Date; ambiente?: Record<string, string | undefined> }
type Pronta = Pick<MensagemPronta, 'texto' | 'editavel' | 'trava'>
export type PedidoDeEnvio = { modelo: IdDoModelo; texto: string; conversa: number; processoId?: string; noCard?: false }

/**
 * O correio do cliente, comum às mensagens e ao aviso de mudança dos dados bancários (GGVP-111 CA5): a mensagem pronta de
 * cada modelo e o envio pelo Chatwoot, com o registro e o histórico.
 */
export function criarCorreio(banco: Banco, agora: () => Date, ambiente: Record<string, string | undefined> = process.env) {
  const simulado = ambiente.RELACIONAMENTO_SIMULADO !== 'nao'
  const historico = registrarHistorico(banco, agora)
  const { hoje, evento, nomeDe, guardar } = criarFichario(banco, agora)

  /** O cliente no Chatwoot simulado: o contato do telefone da ficha e uma conversa aberta com ele (CA6). */
  function noChatwoot(ficha: Ficha): Pick<MensagemPronta, 'contato' | 'conversas'> {
    const telefone = normalizarTelefone(ficha.telefone ?? '')
    if (!simulado || !telefone) return { contato: null, conversas: [] }
    const id = Number(telefone.slice(-8))
    const conversas = [{ id, caixa: 'GGV PREV', situacao: 'aberta' as const, mensagens: 2, ultimaEm: agora().toISOString() }]
    return { contato: { id, nome: ficha.nome, telefone }, conversas: ordenarConversas(conversas) }
  }

  /** O texto de cada modelo, com os dados do cliente e do caso (CA1), em frases curtas e sem termo jurídico (CA3). */
  async function textoDoModelo(ficha: Ficha, modelo: IdDoModelo, processoId?: string): Promise<Pronta> {
    const processo = ficha.processos.find((p) => p.id === processoId) ?? ficha.processos[0]
    const primeiro = ficha.nome.split(' ')[0]
    const beneficio = nomeBeneficio(processo?.beneficio ?? ficha.beneficioInteresse) || 'benefício'
    const pronto = (texto: string, editavel = true): Pronta => ({ texto, editavel, trava: null })
    const travado = (trava: string): Pronta => ({ texto: '', editavel: false, trava })
    const entrevista = ficha.agendamentos
      .filter((a) => a.data >= hoje() && (a.estado ?? 'marcado') === 'marcado')
      .sort((a, b) => a.data.localeCompare(b.data))[0]
    const semEntrevista = 'Sem entrevista marcada: marque na agenda.'
    switch (modelo) {
      case 'convite':
        if (!entrevista) return travado(semEntrevista)
        return pronto(
          mensagemDoConvite({ nome: ficha.nome, tipo: entrevista.tipo ?? 'presencial', data: entrevista.data, hora: entrevista.hora, pedirFicha: entrevista.pedirFicha ?? true, levar: entrevista.levar ?? true, gravar: entrevista.gravar ?? true }),
        )
      case 'lembrete':
        if (!entrevista) return travado(semEntrevista)
        return pronto(`Olá, ${primeiro}! Lembrete: sua conversa com o escritório GGV é ${diaFalado(entrevista.data)}, às ${horaFalada(entrevista.hora)}, ${COMO[entrevista.tipo ?? 'presencial']}. Traga RG, CPF e os laudos.`)
      case 'confirmacao':
        if (!entrevista) return travado(semEntrevista)
        return pronto(
          mensagemDaConfirmacao({ nome: ficha.nome, tipo: entrevista.tipo ?? 'presencial', data: entrevista.data, hora: entrevista.hora, beneficio: ficha.beneficioInteresse, fichaPreenchida: ficha.fichaAtendimentoPreenchida }),
        )
      // O pedido de complemento ao médico ainda vive no servidor de exemplo da documentação médica.
      case 'complemento':
        return travado('Sem pedido de complemento aberto no processo.')
      case 'boas-vindas':
        return pronto(`Olá, ${primeiro}! Boas-vindas ao escritório GGV. Seu caso de ${beneficio} começou. Qualquer dúvida, fale com a gente por aqui.`)
      case 'cobranca':
        return pronto(`Olá, ${primeiro}! Para seguir com o seu caso de ${beneficio}, faltam documentos. Pode trazer aqui ou mandar foto por esta conversa?`)
      // O texto aprovado do resultado vem da prestação de contas (GGVP-11), que ainda não está no servidor: sem ele, não sai.
      case 'resultado-favoravel':
        return travado('Falta o OK da advogada na prestação de contas: o aviso só sai depois dele (G8).')
      case 'resultado-desfavoravel':
        return travado('Falta o texto aprovado pelo Jurídico: o aviso usa só esse texto, sem estratégia interna.')
      case 'aviso-de-mudanca':
        return pronto(`Olá, ${primeiro}. Os dados para você receber os valores do seu caso mudaram hoje, a seu pedido. Se não foi você, ligue para o escritório agora.`)
      case 'pericia-orientacao':
      case 'pericia-presenca': {
        const pericia = processo && (await camposDoProcessoEmVigor(banco, ficha.id, processo.id))?.pericia
        if (!pericia) return travado('Sem perícia marcada no processo.')
        return pronto(
          modelo === 'pericia-orientacao'
            ? `Olá, ${primeiro}! Sua perícia no INSS é ${diaFalado(pericia)}. Chegue 30 minutos antes. Leve RG, os laudos originais, exames e receitas, em ordem de data. Conte ao perito, com a verdade, o que você sente no dia a dia.`
            : `Olá, ${primeiro}! Sua perícia no INSS é ${diaFalado(pericia)}. Você confirma que vai? Responda por aqui, por favor.`,
        )
      }
    }
  }

  /** A mensagem pronta para revisar: todo modelo diz que o escritório nunca pede a senha do gov.br (GGVP-111 CA4). */
  async function preparar(ficha: Ficha, modelo: IdDoModelo, processoId?: string): Promise<MensagemPronta> {
    const pronta = await textoDoModelo(ficha, modelo, processoId)
    return { modelo, ...pronta, texto: comAvisoDaSenha(pronta.texto), ...noChatwoot(ficha) }
  }

  const paraTela = (m: typeof mensagem.$inferSelect, quem: string): MensagemAoCliente => ({
    id: m.id,
    fichaId: m.pessoaId,
    ...(m.casoId && { processoId: m.casoId }),
    modelo: m.modelo as IdDoModelo,
    texto: m.conteudo,
    canal: 'Chatwoot',
    conversa: m.conversaChatwoot ?? 0,
    quando: (m.enviadaEm ?? m.criadoEm).toISOString(),
    quem,
    status: m.status as MensagemAoCliente['status'],
    ...(m.erro && { erro: m.erro }),
  })

  async function doCliente(fichaId: string): Promise<MensagemAoCliente[]> {
    const linhas = await banco
      .select({ m: mensagem, quem: usuario.nome })
      .from(mensagem)
      .leftJoin(usuario, eq(mensagem.enviadaPor, usuario.id))
      .where(eq(mensagem.pessoaId, fichaId))
      .orderBy(desc(mensagem.criadoEm))
    return linhas.filter((l) => l.m.modelo).map((l) => paraTela(l.m, l.quem ?? 'Alguém do escritório'))
  }

  /**
   * Sai pela conversa do cliente no Chatwoot (CA6), com o texto revisado (CA1). Confere de novo a trava do modelo (G8, CA8)
   * e o que o texto não pode ter (G9, G11, G20); a recusa do portão fica no histórico. A falha do canal volta para a tela e
   * fica no histórico (CA5); a mesma mensagem já enviada na mesma conversa não sai de novo.
   */
  async function enviar(pedido: FastifyRequest, ficha: Ficha, p: PedidoDeEnvio): Promise<{ erro: string } | { mensagem: MensagemAoCliente }> {
    if (p.processoId && !ficha.processos.some((x) => x.id === p.processoId)) return { erro: 'Processo não encontrado.' }
    const pronta = await preparar(ficha, p.modelo, p.processoId)
    if (pronta.trava) return { erro: pronta.trava }
    const texto = p.texto.trim()
    if (!texto) return { erro: 'Escreva a mensagem.' }
    if (!pronta.editavel && texto !== pronta.texto) return { erro: 'O texto aprovado não muda: o aviso sai como foi revisado.' }
    const problema = problemasDaMensagem(texto).bloqueia[0]
    if (problema) {
      // Só o código do portão, nunca o texto (pode ter dado de saúde).
      const portao = /\((G\d+)\)/.exec(problema)?.[1] ?? 'G20'
      await historico(pedido.usuario!.id, 'portao_bloqueado', pedido, `pessoa:${ficha.id}`, { portao, passo: 'D5', perfil: pedido.perfilAtivo, modelo: p.modelo })
      return { erro: problema }
    }
    if (pronta.contato && !pronta.conversas.some((c) => c.id === p.conversa)) return { erro: 'Escolha a conversa do cliente no Chatwoot.' }
    const conversa = pronta.contato ? p.conversa : 0
    const [repetida] = await banco
      .select()
      .from(mensagem)
      .where(and(eq(mensagem.pessoaId, ficha.id), eq(mensagem.conversaChatwoot, conversa), eq(mensagem.conteudo, texto), ne(mensagem.status, 'falhou')))
    const quem = await nomeDe(pedido)
    if (repetida) return { mensagem: paraTela(repetida, quem) }
    const erro = pronta.contato ? undefined : simulado ? MSG_SEM_CONTATO : MSG_CHATWOOT_DESLIGADO
    const status: MensagemAoCliente['status'] = erro ? 'falhou' : 'entregue'
    const [linha] = await banco
      .insert(mensagem)
      .values({
        pessoaId: ficha.id,
        casoId: p.processoId ?? ficha.processos[0]?.id ?? null,
        canal: 'whatsapp',
        modelo: p.modelo,
        conteudo: texto,
        conversaChatwoot: conversa,
        status,
        erro: erro ?? null,
        enviadaPor: pedido.usuario!.id,
        enviadaEm: agora(),
      })
      .returning()
    const nome = MODELOS_DE_MENSAGEM[p.modelo].nome
    // No card do cliente: a data, o canal com a hora e o status, e o texto (CA2, CA4).
    if (p.noCard !== false || erro) ficha.contatos.push({ data: hoje(), canal: `Chatwoot · ${horaEmBrasilia(agora())} · ${STATUS_FALADO[status]}`, texto })
    ficha.historico.push(
      evento(erro ? `A mensagem «${nome}» não saiu pelo Chatwoot: ${erro}. Nada foi reenviado sozinho.` : `Enviou pelo Chatwoot a mensagem «${nome}» (${STATUS_FALADO[status]})`, quem),
    )
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'mensagem_enviada', pedido, `pessoa:${ficha.id}`, { mensagem: linha.id, modelo: p.modelo, status })
    return { mensagem: paraTela(linha, quem) }
  }

  return { preparar, enviar, doCliente }
}

export function registrarRotasMensagens(app: FastifyInstance, { banco, agora = () => new Date(), ambiente = process.env }: Opcoes) {
  const { fichas } = criarFichario(banco, agora)
  const correio = criarCorreio(banco, agora, ambiente)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const enviar = { preHandler: exigir(banco, 'mensagem.enviar', agora) }
  const acharFicha = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  // GGVP-102 CA1, CA6: a mensagem pronta do modelo, com a trava e o cliente no Chatwoot.
  app.get<{ Params: { id: string; modelo: string }; Querystring: { processo?: string } }>('/api/fichas/:id/mensagens/:modelo', ver, async (pedido, resposta) => {
    const modelo = IdDoModelo.safeParse(pedido.params.modelo)
    if (!modelo.success) return negar(resposta, 404, 'Modelo não encontrado.')
    const ficha = await acharFicha(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    return correio.preparar(ficha, modelo.data, pedido.query.processo)
  })

  // GGVP-102 CA1 a CA9: o envio pelo Chatwoot, com o registro e os portões.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/mensagens', enviar, async (pedido, resposta) => {
    const entrada = PedidoDeMensagem.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Mensagem inválida.')
    const ficha = await acharFicha(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const r = await correio.enviar(pedido, ficha, entrada.data)
    return 'erro' in r ? negar(resposta, 400, r.erro) : r.mensagem
  })

  // GGVP-102 CA2, CA4: as mensagens mandadas ao cliente, da mais nova para a mais antiga.
  app.get<{ Params: { id: string } }>('/api/fichas/:id/mensagens', ver, async (pedido, resposta) => {
    if (!UUID.test(pedido.params.id)) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    return correio.doCliente(pedido.params.id)
  })
}
