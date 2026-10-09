// As mensagens ao cliente no servidor (GGVP-138; telas da GGVP-102), sobre o fichário da Recepção. O catálogo de modelos e
// o que o texto não pode ter (G9, G11, G20) são as regras puras das telas, importadas. Cada envio fica em `mensagem`, que o
// modelo de dados já tinha, com o status de entrega; o contato vai para "Últimos contatos" da ficha.
// Com as variáveis do Chatwoot no ambiente, o envio sai pelo Chatwoot de verdade (GGVP-146, `../chatwoot.ts`). Sem elas, segue
// simulado atrás de `RELACIONAMENTO_SIMULADO` (o contato pelo telefone da ficha, uma conversa aberta, a entrega
// confirmada); com `nao`, o envio falha com o motivo. Fora de produção, o Chatwoot de verdade só fala com os telefones da
// lista de teste (`permite`, em `../chatwoot.ts`): fora dela, nem a consulta nem o envio vão a ele, e o envio fica como
// não enviado.
// ponytail: as regras vêm de apps/web; mover para um pacote comum quando a ligação terminar.
import { and, desc, eq, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { normalizarTelefone } from '@ggv/campos'
import { IdDoModelo, PedidoDeMensagem, type Erro, type MensagemAoCliente, type MensagemPronta } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { decisao, mensagem, usuario } from '../banco/esquema.ts'
import { MSG_CHATWOOT_FORA, abrirChatwoot } from '../chatwoot.ts'
import { criarCasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { COMO, diaFalado, horaFalada, mensagemDoConvite } from '../../../web/src/regras/agenda.ts'
import { CANAIS, RESULTADOS } from '../../../web/src/regras/cobranca.ts'
import { complementoNaTela, doProcesso, type Complemento } from '../../../web/src/regras/complemento.ts'
import { mensagemDaConfirmacao } from '../../../web/src/regras/confirmacao.ts'
import { MODELOS_DE_MENSAGEM, comAvisoDaSenha, ordenarConversas, problemasDaMensagem } from '../../../web/src/regras/mensagens.ts'
import { camposDoProcessoEmVigor } from './conversa.ts'
import { TITULO_AVISO } from './prestacao.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario, horaEmBrasilia } from './recepcao.ts'

export const MSG_CHATWOOT_DESLIGADO = 'o Chatwoot de verdade ainda não está ligado'
export const MSG_SEM_CONTATO = 'o Chatwoot não achou o contato deste telefone'
export const MSG_SEM_TELEFONE = 'a ficha não tem telefone'
export const MSG_FORA_DA_LISTA = 'o telefone está fora da lista de teste da homologação'
export const MSG_FAVORAVEL_PELO_FINANCEIRO = `O aviso de resultado favorável sai pela tela «${TITULO_AVISO}», do Financeiro, com o texto que a advogada revisou na prestação de contas (G8).`
export const MSG_SEM_TEXTO_APROVADO = 'Falta o texto aprovado pelo Jurídico: o aviso usa só esse texto, sem estratégia interna.'
export const MSG_SEM_COMPLEMENTO_ABERTO = 'Sem pedido de complemento aberto no processo.'
export const MSG_A_ADVOGADA_FALA = 'A advogada decidiu falar ela mesma com o cliente sobre o resultado: o aviso sai só por ela.'
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
  const chatwoot = abrirChatwoot(ambiente)
  const simulado = !chatwoot && ambiente.RELACIONAMENTO_SIMULADO !== 'nao'
  const historico = registrarHistorico(banco, agora)
  const { hoje, evento, nomeDe, guardar } = criarFichario(banco, agora)
  const { lerParte, gravarParte } = criarCasoMedico(banco, agora)

  /**
   * O cliente no Chatwoot: o contato do telefone da ficha e as conversas dele (CA6). De verdade, a falha da consulta não
   * trava a mensagem pronta, mas não vale como "sem conversa": volta como `consulta: 'falhou'`, a tela não deixa enviar e o
   * envio não abre conversa nova no lugar da escolhida.
   */
  async function noChatwoot(ficha: Ficha): Promise<Pick<MensagemPronta, 'contato' | 'conversas' | 'simulado' | 'consulta' | 'foraDaLista'>> {
    const telefone = normalizarTelefone(ficha.telefone ?? '')
    if (chatwoot) {
      if (!telefone) return { contato: null, conversas: [], simulado: false }
      if (!chatwoot.permite(telefone)) return { contato: null, conversas: [], simulado: false, foraDaLista: true }
      const achado = await chatwoot.cliente(telefone, ficha.nome).catch(() => null)
      if (!achado) return { contato: null, conversas: [], simulado: false, consulta: 'falhou' }
      return { ...achado, conversas: ordenarConversas(achado.conversas), simulado: false }
    }
    if (!simulado || !telefone) return { contato: null, conversas: [], simulado: true }
    const id = Number(telefone.slice(-8))
    const conversas = [{ id, caixa: 'GGV PREV', situacao: 'aberta' as const, mensagens: 2, ultimaEm: agora().toISOString() }]
    return { contato: { id, nome: ficha.nome, telefone }, conversas: ordenarConversas(conversas), simulado: true }
  }

  /** O último resumo do resultado aprovado pelo Jurídico no caso, com quem fala e quem aprovou (GGVP-22, `resultado.aprovar_resumo`). */
  async function resumoAprovado(casoId: string) {
    const [r] = await banco
      .select({ texto: decisao.justificativa, quemFala: decisao.resultado, por: decisao.decididoPor })
      .from(decisao)
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'resumo_cliente')))
      .orderBy(desc(decisao.decididoEm))
      .limit(1)
    return r?.texto ? { ...r, texto: r.texto } : null
  }

  /** O texto de cada modelo, com os dados do cliente e do caso (CA1), em frases curtas e sem termo jurídico (CA3). */
  async function textoDoModelo(ficha: Ficha, modelo: IdDoModelo, processoId?: string, usuarioId?: string): Promise<Pronta> {
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
      // GGVP-29: a orientação ao médico do pedido de complemento aberto no caso, a mesma da tela; parada no laço (G15), não sai.
      case 'complemento': {
        const atual = processo && doProcesso((await lerParte<Complemento[]>(processo.id, 'complemento')) ?? [], processo.id)
        if (!processo || !atual || atual.encerrado) return travado(MSG_SEM_COMPLEMENTO_ABERTO)
        const tela = complementoNaTela(atual, { ficha, processo, beneficio, hoje: hoje() })
        return tela.motivoParado ? travado(tela.motivoParado) : pronto(tela.mensagem)
      }
      case 'boas-vindas':
        return pronto(`Olá, ${primeiro}! Boas-vindas ao escritório GGV. Seu caso de ${beneficio} começou. Qualquer dúvida, fale com a gente por aqui.`)
      case 'cobranca':
        return pronto(`Olá, ${primeiro}! Para seguir com o seu caso de ${beneficio}, faltam documentos. Pode trazer aqui ou mandar foto por esta conversa?`)
      // CA7: o favorável sai com o texto da prestação de contas (G8), pela tela do Financeiro, que registra o aviso, o
      // recebimento e a baixa; o resumo da GGVP-22 é o do caso perdido e não serve para ele.
      case 'resultado-favoravel':
        return travado(MSG_FAVORAVEL_PELO_FINANCEIRO)
      // CA8: o desfavorável usa só o resumo que o Jurídico aprovou (GGVP-22), sem mudar uma letra. Se a advogada decidiu falar
      // ela mesma (caso complexo, CA5 da GGVP-22), só ela manda.
      case 'resultado-desfavoravel': {
        const aprovado = processo && (await resumoAprovado(processo.id))
        if (!aprovado) return travado(MSG_SEM_TEXTO_APROVADO)
        if (aprovado.quemFala === 'advogada' && aprovado.por !== usuarioId) return travado(MSG_A_ADVOGADA_FALA)
        return pronto(aprovado.texto, false)
      }
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
  async function preparar(ficha: Ficha, modelo: IdDoModelo, processoId?: string, usuarioId?: string): Promise<MensagemPronta> {
    const pronta = await textoDoModelo(ficha, modelo, processoId, usuarioId)
    return { modelo, ...pronta, texto: comAvisoDaSenha(pronta.texto), ...(await noChatwoot(ficha)) }
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

  /** Grava a tentativa no complemento aberto do caso (a parte `complemento` da documentação médica). */
  async function tentativaDoComplemento(casoId: string, quem: string) {
    const lista = (await lerParte<Complemento[]>(casoId, 'complemento')) ?? []
    const atual = doProcesso(lista, casoId)
    if (!atual || atual.encerrado) return null
    atual.tentativas = [...(atual.tentativas ?? []), { dia: hoje(), canal: 'chatwoot', resultado: 'sem-resposta', quem }]
    await gravarParte(casoId, 'complemento', lista)
    return { casoId, n: atual.tentativas.length }
  }

  /**
   * Sai pela conversa do cliente no Chatwoot (CA6), com o texto revisado (CA1). Confere de novo a trava do modelo (G8, CA8)
   * e o que o texto não pode ter (G9, G11, G20); a recusa do portão fica no histórico. A falha do canal volta para a tela e
   * fica no histórico (CA5); a mesma mensagem já enviada na mesma conversa não sai de novo.
   */
  async function enviar(pedido: FastifyRequest, ficha: Ficha, p: PedidoDeEnvio): Promise<{ erro: string } | { mensagem: MensagemAoCliente }> {
    if (p.processoId && !ficha.processos.some((x) => x.id === p.processoId)) return { erro: 'Processo não encontrado.' }
    const pronta = await preparar(ficha, p.modelo, p.processoId, pedido.usuario!.id)
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
    // Sem conversa do cliente na caixa (a consulta respondeu vazia), a conversa 0 pede ao Chatwoot que abra uma. Com a
    // consulta caída, a conversa pedida vale para achar o envio repetido, mas nada sai (abaixo).
    if (pronta.conversas.length && !pronta.conversas.some((c) => c.id === p.conversa)) return { erro: 'Escolha a conversa do cliente no Chatwoot.' }
    const conversa = pronta.conversas.length || pronta.consulta ? p.conversa : 0
    const [repetida] = await banco
      .select()
      .from(mensagem)
      .where(and(eq(mensagem.pessoaId, ficha.id), eq(mensagem.conversaChatwoot, conversa), eq(mensagem.conteudo, texto), ne(mensagem.status, 'falhou')))
    const quem = await nomeDe(pedido)
    if (repetida) return { mensagem: paraTela(repetida, quem) }
    let destino = conversa
    let status: MensagemAoCliente['status'] = 'entregue'
    let erro: string | undefined
    if (chatwoot) {
      // O Chatwoot de verdade: a falha dele volta como aviso e o envio fica registrado, sem reenviar sozinho (CA5).
      const telefone = normalizarTelefone(ficha.telefone ?? '')
      try {
        if (!telefone) throw new Error(MSG_SEM_TELEFONE)
        // A trava da homologação: fora da lista de teste, o Chatwoot não é chamado.
        if (!chatwoot.permite(telefone)) throw new Error(MSG_FORA_DA_LISTA)
        // Sem resposta da consulta, a conversa escolhida não se confere, e outra não entra no lugar dela.
        if (pronta.consulta) throw new Error(MSG_CHATWOOT_FORA)
        destino ||= await chatwoot.abrirConversa(telefone, ficha.nome)
        ;({ status, erro } = await chatwoot.enviar(destino, texto))
      } catch (e) {
        status = 'falhou'
        erro = e instanceof Error ? e.message : 'o Chatwoot falhou'
      }
    } else if (!pronta.contato) {
      status = 'falhou'
      erro = simulado ? MSG_SEM_CONTATO : MSG_CHATWOOT_DESLIGADO
    }
    const [linha] = await banco
      .insert(mensagem)
      .values({
        pessoaId: ficha.id,
        casoId: p.processoId ?? ficha.processos[0]?.id ?? null,
        canal: 'whatsapp',
        modelo: p.modelo,
        conteudo: texto,
        conversaChatwoot: destino,
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
    // G15 (GGVP-29 CA3): a orientação que saiu conta como tentativa do laço, ainda sem resposta, de qualquer janela, como em
    // rotas/complemento.ts. A trava do modelo já conferiu que o complemento está aberto e não parado.
    const tentativa = p.modelo === 'complemento' && status !== 'falhou' ? await tentativaDoComplemento(p.processoId ?? ficha.processos[0]!.id, quem) : null
    if (tentativa) ficha.historico.push(evento(`Complemento ao médico: ${tentativa.n}ª tentativa por ${CANAIS.chatwoot} (${RESULTADOS['sem-resposta']})`, quem))
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'mensagem_enviada', pedido, `pessoa:${ficha.id}`, { mensagem: linha.id, modelo: p.modelo, status })
    if (tentativa) await historico(pedido.usuario!.id, 'complemento_tentativa_registrada', pedido, `caso:${tentativa.casoId}`, { tentativa: tentativa.n, canal: 'chatwoot', resultado: 'sem-resposta' })
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
    return correio.preparar(ficha, modelo.data, pedido.query.processo, pedido.usuario!.id)
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
