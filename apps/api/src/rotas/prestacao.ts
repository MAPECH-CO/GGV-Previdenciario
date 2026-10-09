// Benefício deferido (GGVP-44) e caso ganho (GGVP-98): prestação de contas da advogada (G8), recebimento do Financeiro,
// e o Financeiro avisa o cliente e marca a ida ao banco (Lucas, 06/10); o Atendimento leva. Um caminho para o INSS e
// para a Justiça (Mateus, 07/10).
import { and, arrayOverlaps, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  AgendarIdaAoBanco,
  ConcluirIdaAoBanco,
  IdaAoBancoDoCaso,
  LevarAoBancoDoCaso,
  PrestacaoDoCaso,
  ReceberPrestacao,
  RegistrarEnvio,
  SalvarPrestacao,
  calcularPrestacao,
  pode,
  type Erro,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { agendamento, caso, contrato, documento, eventoAuditoria, mensagem, modelo, pessoa, prestacaoContas, processoAcervo, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarBloqueio } from '../sessao/rotas.ts'

export const MSG_SEM_DEFERIDO = 'A prestação de contas nasce do deferimento registrado na vigília.'
export const MSG_ANTES_DA_PRESTACAO = 'A ida ao banco é agendada depois da prestação de contas concluída.'
export const MSG_G8 = 'O aviso ao cliente só sai depois do OK da advogada na prestação de contas (G8).'
export const MODELO_IDA_AO_BANCO = 'Confirmação da ida ao banco'
export const MSG_MESMA_PESSOA = 'Quem deu o OK na prestação não registra o recebimento.'
export const MSG_ACOMPANHANTE = 'Escolha quem do Atendimento acompanha o cliente'
export const MSG_ANTES_DO_AVISO = 'Avise o cliente antes de confirmar o recebimento.'
export const MSG_ENCERRADO = 'Este caso já foi encerrado.'
export const MSG_ANTES_DO_RECEBIMENTO = 'Registre o recebimento da prestação atual antes de avisar o cliente.'
export const MSG_SEM_DESFECHO = 'O caso não tem desfecho nem deferimento registrado: registre o resultado antes de avisar o cliente.'
export const MSG_DATA_PASSADA = 'A ida ao banco não pode ser marcada numa data ou hora que já passou.'
export const TITULO_AVISO = 'Avisar resultado e agendar a ida ao banco'
export const TITULO_LEVAR = 'Levar ao banco'
export const MSG_SEM_IDA = 'Não há ida ao banco marcada para levar neste caso.'
export const TITULO_REMARCAR = 'Remarcar a ida ao banco'
export const TITULO_CONFIRMAR = 'Confirmar o recebimento: cliente levado ao banco'
/** O que o cliente leva ao banco (P3 do roteiro de 09/10). Lista fixa, a confirmar com o Lucas; nunca valor. */
export const O_QUE_LEVAR = ['Documento oficial com foto do cliente (RG ou CNH)', 'CPF do cliente', 'Carta de concessão do benefício ou a decisão da Justiça']
/** GGVP-98 CA6 (Lucas, Q24): quem leva o cliente ao banco é do Atendimento. */
const ATENDIMENTO = ['atendimento', 'atendimento_lider']

/**
 * GGVP-98 CA9: quando o Financeiro confirmou o recebimento de cada caso, depois da ida ao banco. É o dinheiro na mão, para o
 * painel Financeiro (GGVP-78) e os Resultados (GGVP-75); o "Receber e lançar" vem antes e ainda não é.
 */
export async function recebimentosConfirmados(banco: Banco): Promise<Map<string, Date>> {
  const eventos = await banco.select({ alvo: eventoAuditoria.alvo, quando: eventoAuditoria.quando }).from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'recebimento_confirmado'))
  return new Map(eventos.map((e) => [e.alvo.replace(/^caso:/, ''), e.quando]))
}

type Opcoes = { banco: Banco; agora?: () => Date }
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const ABERTAS = ['aberta', 'em_andamento', 'aguardando'] as const
const FUSO = 'America/Sao_Paulo'
const dataBr = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
const horaBr = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(d)

export function registrarRotasPrestacao(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const bloqueio = registrarBloqueio(banco, agora)
  /** O histórico na mesma transação da mudança: os dois ficam, ou nenhum. */
  const noHistorico = (tx: Tx, quem: string, acao: string, pedido: FastifyRequest, casoId: string, detalhe: Record<string, unknown> = {}) =>
    tx.insert(eventoAuditoria).values({ quem, acao, alvo: `caso:${casoId}`, quando: agora(), detalhe: { ip: pedido.ip, ...detalhe } })
  /** Trava o caso na transação e confere de novo a fase: pedidos ao mesmo tempo passam um de cada vez (CA9). */
  const casoAberto = async (tx: Tx, casoId: string) =>
    (await tx.select({ fase: caso.fase }).from(caso).where(eq(caso.id, casoId)).for('update'))[0]?.fase !== 'encerrado'

  const clienteDo = async (casoId: string) =>
    (
      await banco
        .select({ pessoaId: pessoa.id, nome: pessoa.nome, beneficio: caso.beneficio, fase: caso.fase, desfecho: caso.desfecho })
        .from(caso)
        .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
        .where(eq(caso.id, casoId))
    )[0] ?? null

  const deferimento = async (casoId: string) =>
    (
      await banco
        .select()
        .from(resultadoInss)
        .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'deferido')))
        .orderBy(desc(resultadoInss.criadoEm))
        .limit(1)
    )[0] ?? null

  const versoesDo = (casoId: string) => banco.select().from(prestacaoContas).where(eq(prestacaoContas.casoId, casoId)).orderBy(desc(prestacaoContas.versao))

  const agendamentoAtual = async (casoId: string) =>
    (
      await banco
        .select()
        .from(agendamento)
        .where(and(eq(agendamento.casoId, casoId), eq(agendamento.tipo, 'ida_ao_banco'), eq(agendamento.situacao, 'marcado')))
        .orderBy(desc(agendamento.criadoEm))
        .limit(1)
    )[0] ?? null

  async function nomes(ids: (string | null)[]) {
    const validos = [...new Set(ids.filter((i): i is string => i !== null))]
    const linhas = validos.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, validos)) : []
    return (id: string | null) => linhas.find((l) => l.id === id)?.nome ?? null
  }

  // CA2, CA4, CA5, CA8: valores só para o Financeiro e a advogada que faz a prestação (`prestacao.ver`; Pedro, 06/10), com a carta e as versões.
  app.get<{ Params: { id: string } }>('/api/casos/:id/prestacao', { preHandler: exigir(banco, 'prestacao.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const c = await clienteDo(casoId)
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const def = await deferimento(casoId)
    const [carta] = def?.documentoId ? await banco.select({ id: documento.id, nome: documento.nomeOriginal }).from(documento).where(eq(documento.id, def.documentoId)) : []
    const [ct] = await banco.select({ percentual: contrato.percentualHonorarios }).from(contrato).where(eq(contrato.casoId, casoId)).orderBy(desc(contrato.criadoEm)).limit(1)
    const versoes = await versoesDo(casoId)
    const ag = await agendamentoAtual(casoId)
    const nome = await nomes([...versoes.flatMap((v) => [v.okAdvogadaPor, v.recebidaPor]), ag?.acompanhanteId ?? null])
    const atual = versoes[0]
    return PrestacaoDoCaso.parse({
      casoId,
      cliente: c.nome,
      beneficio: c.beneficio,
      carta: carta ?? null,
      percentualContrato: ct?.percentual ?? null,
      versoes: versoes.map((v) => ({
        versao: v.versao,
        valorRecebido: v.valorRecebido,
        percentual: v.percentualHonorarios,
        honorarios: v.honorarios,
        repasse: v.valorCliente,
        formaPagamento: v.formaPagamento,
        prazoPagamento: v.prazoPagamento,
        por: nome(v.okAdvogadaPor),
        em: v.okAdvogadaEm?.toISOString() ?? null,
        recebidaPor: nome(v.recebidaPor),
        recebidaEm: v.recebidaEm?.toISOString() ?? null,
        divergencia: v.divergencia,
      })),
      agendamento: ag ? { quando: ag.quando.toISOString(), local: ag.local ?? '', acompanhante: nome(ag.acompanhanteId) } : null,
      podeEditar: pode(pedido.perfilAtivo, 'prestacao.dar_ok') && def !== null,
      podeReceber: pode(pedido.perfilAtivo, 'prestacao.registrar_recebimento') && atual !== undefined && !atual.recebidaEm && !atual.divergencia,
    })
  })

  // CA1, CA5, CA6: concluir grava a versão com o OK da advogada e abre o recebimento do Financeiro (o aviso vem depois, GGVP-98 CA4).
  app.post<{ Params: { id: string } }>('/api/casos/:id/prestacao', { preHandler: exigir(banco, 'prestacao.dar_ok', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = SalvarPrestacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const def = await deferimento(casoId)
    if (!def) return negar(resposta, 409, MSG_SEM_DEFERIDO)
    const d = entrada.data
    const valores = calcularPrestacao(d.valorRecebido, d.percentual)
    const quem = pedido.usuario!.id
    // CA9: caso encerrado não ganha versão nova. A versão é contada com o caso travado, para duas não saírem iguais.
    const versao = await banco.transaction(async (tx) => {
      if (!(await casoAberto(tx, casoId))) return null
      const [anterior] = await tx.select({ versao: prestacaoContas.versao }).from(prestacaoContas).where(eq(prestacaoContas.casoId, casoId)).orderBy(desc(prestacaoContas.versao)).limit(1)
      const versao = (anterior?.versao ?? 0) + 1
      await tx.insert(prestacaoContas).values({
        casoId,
        versao,
        valorRecebido: valores.valorRecebido,
        honorarios: valores.honorarios,
        valorCliente: valores.repasse,
        percentualHonorarios: d.percentual.toFixed(2),
        formaPagamento: d.formaPagamento ?? null,
        prazoPagamento: d.prazoPagamento,
        cartaDocumentoId: def.documentoId,
        okAdvogadaPor: quem,
        okAdvogadaEm: agora(),
      })
      await tx
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.06'), eq(tarefa.perfilDono, 'advogada'), isNull(tarefa.concluidaEm)))
      // CA7: a tarefa do Financeiro só nasce aqui. Nova versão reabre o recebimento (CA6).
      const [doFinanceiro] = await tx
        .select({ id: tarefa.id })
        .from(tarefa)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.06r'), inArray(tarefa.situacao, [...ABERTAS])))
      if (!doFinanceiro) await tx.insert(tarefa).values({ casoId, passo: 'D2.06r', titulo: 'Receber a prestação de contas', perfilDono: 'financeiro' })
      await noHistorico(tx, quem, versao === 1 ? 'prestacao_concluida' : 'prestacao_alterada', pedido, casoId, { versao })
      return versao
    })
    if (versao === null) return negar(resposta, 409, MSG_ENCERRADO)
    return resposta.code(201).send({ ok: true, versao, ...valores })
  })

  // CA9 e GGVP-98 CA3, CA4, CA8: recebido com os valores conferidos (quem e quando) abre o aviso do Financeiro; divergência
  // volta à advogada com o motivo. Quem deu o OK não recebe: recusa e registro.
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/prestacao/recebimento',
    { preHandler: exigir(banco, 'prestacao.registrar_recebimento', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const entrada = ReceberPrestacao.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const [atual] = await versoesDo(casoId)
      if (!atual || atual.recebidaEm || atual.divergencia) return negar(resposta, 409, 'Não há prestação esperando o recebimento.')
      const quem = pedido.usuario!.id
      if (atual.okAdvogadaPor === quem) {
        // Separação de funções, e não o G8 ("o aviso só sai depois do OK"): código neutro, sem número (Mateus, 08/10; Q21).
        await bloqueio(pedido, casoId, 'funcoes', 'D2.06r', { motivo: 'ok_e_recebimento' })
        return negar(resposta, 409, MSG_MESMA_PESSOA)
      }
      const d = entrada.data
      const feito = await banco.transaction(async (tx) => {
        // A condição vai no próprio update: dois recebimentos ao mesmo tempo, só o primeiro conta.
        const [esperando] = await tx
          .update(prestacaoContas)
          .set(d.resultado === 'recebido' ? { recebidaPor: quem, recebidaEm: agora() } : { divergencia: d.motivo })
          .where(and(eq(prestacaoContas.id, atual.id), isNull(prestacaoContas.recebidaEm), isNull(prestacaoContas.divergencia)))
          .returning({ id: prestacaoContas.id })
        if (!esperando) return false
        await tx
          .update(tarefa)
          .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
          .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.06r'), isNull(tarefa.concluidaEm)))
        if (d.resultado === 'divergencia')
          await tx.insert(tarefa).values({ casoId, passo: 'D2.06', titulo: `Corrigir a prestação: ${d.motivo}`, perfilDono: 'advogada' })
        else {
          // GGVP-98 CA1, CA4: só depois do recebimento nasce o aviso, uma vez por caso.
          const [doAviso] = await tx.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.06b')))
          if (!doAviso) await tx.insert(tarefa).values({ casoId, passo: 'D2.06b', titulo: TITULO_AVISO, perfilDono: 'financeiro' })
        }
        await noHistorico(tx, quem, d.resultado === 'recebido' ? 'prestacao_recebida' : 'prestacao_divergente', pedido, casoId, { versao: atual.versao })
        return true
      })
      if (!feito) return negar(resposta, 409, 'Não há prestação esperando o recebimento.')
      return resposta.code(201).send({ ok: true })
    },
  )

  async function modeloAtivo() {
    const [m] = await banco
      .select()
      .from(modelo)
      .where(and(eq(modelo.tipo, 'mensagem'), eq(modelo.nome, MODELO_IDA_AO_BANCO), eq(modelo.ativo, true)))
      .orderBy(desc(modelo.versao))
      .limit(1)
    return m ?? null
  }

  const montar = (texto: string, campos: Record<string, string>) => texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => campos[chave] ?? inteiro)

  async function situacaoDoBanco(casoId: string) {
    const c = await clienteDo(casoId)
    const ag = await agendamentoAtual(casoId)
    const m = await modeloAtivo()
    const [atual] = await versoesDo(casoId)
    const [tarefaDoBanco] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.06b'))).limit(1)
    const [levar] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.06l'), isNull(tarefa.concluidaEm))).limit(1)
    const acompanhante = ag ? (await nomes([ag.acompanhanteId]))(ag.acompanhanteId) : null
    // {acompanhamento}: a frase só aparece quando alguém do escritório vai junto.
    const texto =
      ag && m && c
        ? montar(m.conteudo, {
            cliente: c.nome,
            data: dataBr(ag.quando),
            hora: horaBr(ag.quando),
            local: ag.local ?? '',
            acompanhamento: acompanhante ? ` ${acompanhante}, do escritório, vai com você.` : '',
          })
        : null
    return { c, ag, m, acompanhante, okAdvogada: Boolean(atual?.okAdvogadaEm), tarefaDoBanco: tarefaDoBanco ?? null, levar: levar ?? null, texto, atual }
  }

  // CA3, CA10 e GGVP-98: o Financeiro vê o agendamento e a mensagem para revisar; quem acompanha vem do Atendimento.
  app.get<{ Params: { id: string } }>('/api/casos/:id/banco', { preHandler: exigir(banco, 'banco.agendar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const s = await situacaoDoBanco(casoId)
    if (!s.c) return negar(resposta, 404, 'Caso não encontrado.')
    const avisos = await banco
      .select({ quando: mensagem.enviadaEm, canal: mensagem.canal, texto: mensagem.conteudo, quem: usuario.nome })
      .from(mensagem)
      .innerJoin(usuario, eq(mensagem.enviadaPor, usuario.id))
      .where(eq(mensagem.casoId, casoId))
      .orderBy(desc(mensagem.criadoEm))
    const equipe = await banco
      .select({ id: usuario.id, nome: usuario.nome })
      .from(usuario)
      .where(arrayOverlaps(usuario.perfis, ATENDIMENTO))
      .orderBy(asc(usuario.nome))
    return IdaAoBancoDoCaso.parse({
      casoId,
      cliente: s.c.nome,
      agendamento: s.ag ? { id: s.ag.id, data: dataBr(s.ag.quando), hora: horaBr(s.ag.quando), local: s.ag.local ?? '', acompanhante: s.acompanhante } : null,
      equipe,
      mensagem: s.texto,
      modeloCadastrado: s.m !== null,
      okAdvogada: s.okAdvogada,
      avisos: avisos.map((a) => ({ quando: a.quando?.toISOString() ?? '', canal: a.canal, texto: a.texto, quem: a.quem })),
      podeAgendar: s.tarefaDoBanco !== null && s.c.fase !== 'encerrado',
      podeConfirmar: s.ag !== null && Boolean(s.atual?.clienteAvisadoEm) && s.c.fase !== 'encerrado',
      encerrado: s.c.fase === 'encerrado',
    })
  })

  // CA10, CA12 e GGVP-98 CA6, CA7: agenda (ou remarca: o anterior é cancelado); quem acompanha, do Atendimento, recebe
  // "Levar ao banco" com a data, e a tarefa anda junto na remarcação.
  app.post<{ Params: { id: string } }>('/api/casos/:id/banco', { preHandler: exigir(banco, 'banco.agendar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = AgendarIdaAoBanco.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const s = await situacaoDoBanco(casoId)
    if (!s.c) return negar(resposta, 404, 'Caso não encontrado.')
    // CA9: o caso encerrado não reabre a ida ao banco nem cria outro "Levar ao banco".
    if (s.c.fase === 'encerrado') return negar(resposta, 409, MSG_ENCERRADO)
    if (!s.tarefaDoBanco) return negar(resposta, 409, MSG_ANTES_DA_PRESTACAO)
    const d = entrada.data
    // CA6: hora de Brasília (sem horário de verão desde 2019). A tela limita a data a partir de hoje; o servidor recusa
    // também a hora de hoje que já passou.
    const quando = new Date(`${d.data}T${d.hora}:00-03:00`)
    if (quando < agora()) return negar(resposta, 400, MSG_DATA_PASSADA)
    const [u] = await banco.select({ perfis: usuario.perfis }).from(usuario).where(eq(usuario.id, d.acompanhanteId))
    if (!u || !u.perfis.some((p) => ATENDIMENTO.includes(p))) return negar(resposta, 400, MSG_ACOMPANHANTE)
    const quem = pedido.usuario!.id
    const prazo = d.data
    const feito = await banco.transaction(async (tx) => {
      if (!(await casoAberto(tx, casoId))) return false
      if (s.ag) await tx.update(agendamento).set({ situacao: 'cancelado' }).where(eq(agendamento.id, s.ag.id))
      await tx.insert(agendamento).values({
        pessoaId: s.c!.pessoaId,
        casoId,
        tipo: 'ida_ao_banco',
        quando,
        local: d.local,
        acompanhanteId: d.acompanhanteId,
        criadoPor: quem,
      })
      if (s.levar) await tx.update(tarefa).set({ prazo, responsavelId: d.acompanhanteId }).where(eq(tarefa.id, s.levar.id))
      else await tx.insert(tarefa).values({ casoId, passo: 'D2.06l', titulo: TITULO_LEVAR, perfilDono: 'atendimento', responsavelId: d.acompanhanteId, prazo })
      // Remarcou: o convite precisa sair de novo (CA12), e o título volta ao aviso (o "Remarcar: motivo" já foi atendido).
      if (s.ag) await tx.update(tarefa).set({ titulo: TITULO_AVISO, situacao: 'aberta', concluidaEm: null, concluidaPor: null }).where(eq(tarefa.id, s.tarefaDoBanco!.id))
      await noHistorico(tx, quem, s.ag ? 'ida_ao_banco_remarcada' : 'ida_ao_banco_agendada', pedido, casoId)
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_ENCERRADO)
    return resposta.code(201).send({ ok: true })
  })

  // CA3, CA11 (G8, Q5) e GGVP-98 CA2, CA5: a pessoa revisou e enviou a mensagem do modelo; o portal registra data, canal e
  // texto, e o caso entra no acervo como processo bom (uma vez), com a baixa no histórico.
  app.post<{ Params: { id: string } }>('/api/casos/:id/banco/envio', { preHandler: exigir(banco, 'banco.agendar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = RegistrarEnvio.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const s = await situacaoDoBanco(casoId)
    if (s.c?.fase === 'encerrado') return negar(resposta, 409, MSG_ENCERRADO)
    if (!s.c || !s.ag) return negar(resposta, 409, 'Agende a ida ao banco antes de avisar o cliente.')
    if (!s.okAdvogada || !s.atual) {
      await bloqueio(pedido, casoId, 'G8', 'D3b.03')
      return negar(resposta, 409, MSG_G8)
    }
    // CA4: versão nova depois do recebimento volta para o Financeiro; o aviso espera o novo recebimento.
    if (!s.atual.recebidaEm) return negar(resposta, 409, MSG_ANTES_DO_RECEBIMENTO)
    if (!s.m || !s.texto) return negar(resposta, 409, 'Modelo "Confirmação da ida ao banco" não cadastrado.')
    // CA2: só entra no acervo como processo bom o caso com o resultado registrado; sem ele, o aviso espera.
    const desfecho = s.c.desfecho ?? ((await deferimento(casoId)) ? 'deferido' : null)
    if (!desfecho) return negar(resposta, 409, MSG_SEM_DESFECHO)
    const quem = pedido.usuario!.id
    const feito = await banco.transaction(async (tx) => {
      if (!(await casoAberto(tx, casoId))) return false
      await tx.insert(mensagem).values({
        pessoaId: s.c!.pessoaId,
        casoId,
        canal: entrada.data.canal,
        modeloId: s.m!.id,
        conteudo: s.texto!,
        aprovadaPor: quem,
        enviadaPor: quem,
        enviadaEm: agora(),
      })
      await tx.update(prestacaoContas).set({ clienteAvisadoEm: agora() }).where(eq(prestacaoContas.id, s.atual!.id))
      if (s.tarefaDoBanco) await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, s.tarefaDoBanco.id))
      // O desfecho fica sem conferência: a que põe o caso nas contas da jurimetria é da GGVP-41 (CA5).
      const [noAcervo] = await tx.select({ id: processoAcervo.id }).from(processoAcervo).where(eq(processoAcervo.casoId, casoId))
      if (!noAcervo) await tx.insert(processoAcervo).values({ casoId, beneficio: s.c!.beneficio, desfecho, fonte: 'portal' })
      // O histórico vai na mesma transação: o aviso, o acervo e a baixa ficam juntos, ou nenhum fica.
      await noHistorico(tx, quem, 'cliente_avisado_ida_ao_banco', pedido, casoId, { canal: entrada.data.canal })
      await noHistorico(tx, quem, 'baixa_registrada', pedido, casoId, { acervo: 'processo_bom' })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_ENCERRADO)
    return resposta.code(201).send({ ok: true })
  })

  // GGVP-98 (P3 do roteiro de 09/10): quem leva, do Atendimento (perfil da sessão), vê a visita da tarefa aberta "Levar ao
  // banco": cliente, data, hora, local e o que levar. Nenhum valor: o Atendimento não vê valor.
  const quemLeva = { preHandler: exigir(banco, 'banco.levar', agora) }
  app.get<{ Params: { id: string } }>('/api/casos/:id/banco/levar', quemLeva, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const s = await situacaoDoBanco(casoId)
    if (!s.c) return negar(resposta, 404, 'Caso não encontrado.')
    if (!s.levar || !s.ag) return negar(resposta, 409, MSG_SEM_IDA)
    return LevarAoBancoDoCaso.parse({
      casoId,
      cliente: s.c.nome,
      data: dataBr(s.ag.quando),
      hora: horaBr(s.ag.quando),
      local: s.ag.local ?? '',
      acompanhante: s.acompanhante,
      oQueLevar: O_QUE_LEVAR,
    })
  })

  // "Levei o cliente ao banco" conclui a tarefa com quem e quando, e a tarefa do Financeiro reabre para confirmar o
  // recebimento (CA9). "Não deu" cancela a ida e volta ao Financeiro remarcar, com o motivo no título da tarefa dele, e o
  // aviso antigo deixa de valer: sem o aviso da nova data ao cliente, não há recebimento a confirmar.
  app.post<{ Params: { id: string } }>('/api/casos/:id/banco/levar', quemLeva, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = ConcluirIdaAoBanco.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const s = await situacaoDoBanco(casoId)
    if (!s.c) return negar(resposta, 404, 'Caso não encontrado.')
    if (s.c.fase === 'encerrado') return negar(resposta, 409, MSG_ENCERRADO)
    if (!s.levar || !s.ag) return negar(resposta, 409, MSG_SEM_IDA)
    const d = entrada.data
    const quem = pedido.usuario!.id
    const recusa = await banco.transaction(async (tx) => {
      if (!(await casoAberto(tx, casoId))) return MSG_ENCERRADO
      // A condição vai no próprio update: dois cliques ao mesmo tempo, só o primeiro conta.
      const [aberta] = await tx
        .update(tarefa)
        .set({ situacao: d.resultado === 'levado' ? 'concluida' : 'cancelada', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.id, s.levar!.id), isNull(tarefa.concluidaEm)))
        .returning({ id: tarefa.id })
      if (!aberta) return MSG_SEM_IDA
      if (d.resultado === 'nao_deu') {
        await tx.update(agendamento).set({ situacao: 'cancelado' }).where(eq(agendamento.id, s.ag!.id))
        if (s.atual) await tx.update(prestacaoContas).set({ clienteAvisadoEm: null }).where(eq(prestacaoContas.id, s.atual.id))
      }
      if (s.tarefaDoBanco)
        await tx
          .update(tarefa)
          .set({ titulo: d.resultado === 'levado' ? TITULO_CONFIRMAR : `${TITULO_REMARCAR}: ${d.motivo}`, situacao: 'aberta', concluidaEm: null, concluidaPor: null })
          .where(eq(tarefa.id, s.tarefaDoBanco.id))
      await noHistorico(tx, quem, d.resultado === 'levado' ? 'cliente_levado_ao_banco' : 'ida_ao_banco_nao_feita', pedido, casoId, d.resultado === 'nao_deu' ? { motivo: d.motivo } : {})
      return null
    })
    if (recusa) return negar(resposta, 409, recusa)
    return resposta.code(201).send({ ok: true })
  })

  // GGVP-98 CA9: feita a ida ao banco, o Financeiro confirma o recebimento e o caso fecha.
  app.post<{ Params: { id: string } }>('/api/casos/:id/banco/confirmacao', { preHandler: exigir(banco, 'banco.agendar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const s = await situacaoDoBanco(casoId)
    if (!s.c) return negar(resposta, 404, 'Caso não encontrado.')
    if (s.c.fase === 'encerrado') return negar(resposta, 409, MSG_ENCERRADO)
    if (!s.ag || !s.atual?.clienteAvisadoEm) return negar(resposta, 409, MSG_ANTES_DO_AVISO)
    const quem = pedido.usuario!.id
    const feito = await banco.transaction(async (tx) => {
      if (!(await casoAberto(tx, casoId))) return false
      await tx.update(agendamento).set({ situacao: 'realizado' }).where(eq(agendamento.id, s.ag!.id))
      if (s.levar) await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, s.levar.id))
      // A tarefa do Financeiro reaberta pelo "Levei" (confirmar o recebimento) fecha aqui.
      if (s.tarefaDoBanco)
        await tx
          .update(tarefa)
          .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
          .where(and(eq(tarefa.id, s.tarefaDoBanco.id), isNull(tarefa.concluidaEm)))
      await tx.update(caso).set({ fase: 'encerrado', encerradoEm: agora(), atualizadoEm: agora() }).where(eq(caso.id, casoId))
      await noHistorico(tx, quem, 'recebimento_confirmado', pedido, casoId)
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_ENCERRADO)
    return resposta.code(201).send({ ok: true })
  })
}
