// Benefício deferido (GGVP-44) e caso ganho (GGVP-98): prestação de contas da advogada (G8), recebimento do Financeiro,
// e o Financeiro avisa o cliente e marca a ida ao banco (Lucas, 06/10); o Atendimento leva. Um caminho para o INSS e
// para a Justiça (Mateus, 07/10).
import { and, arrayOverlaps, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  AgendarIdaAoBanco,
  IdaAoBancoDoCaso,
  PrestacaoDoCaso,
  ReceberPrestacao,
  RegistrarEnvio,
  SalvarPrestacao,
  calcularPrestacao,
  pode,
  type Erro,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { agendamento, caso, contrato, documento, mensagem, modelo, pessoa, prestacaoContas, processoAcervo, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_SEM_DEFERIDO = 'A prestação de contas nasce do deferimento registrado na vigília.'
export const MSG_ANTES_DA_PRESTACAO = 'A ida ao banco é agendada depois da prestação de contas concluída.'
export const MSG_G8 = 'O aviso ao cliente só sai depois do OK da advogada na prestação de contas (G8).'
export const MODELO_IDA_AO_BANCO = 'Confirmação da ida ao banco'
export const MSG_MESMA_PESSOA = 'Quem deu o OK na prestação não registra o recebimento.'
export const MSG_ACOMPANHANTE = 'Escolha quem do Atendimento acompanha o cliente'
export const MSG_ANTES_DO_AVISO = 'Avise o cliente antes de confirmar o recebimento.'
export const MSG_ENCERRADO = 'Este caso já foi encerrado.'
export const MSG_SEM_DESFECHO = 'O caso não tem desfecho nem deferimento registrado: registre o resultado antes de avisar o cliente.'
export const TITULO_AVISO = 'Avisar resultado e agendar a ida ao banco'
export const TITULO_LEVAR = 'Levar ao banco'
/** GGVP-98 CA6 (Lucas, Q24): quem leva o cliente ao banco é do Atendimento. */
const ATENDIMENTO = ['atendimento', 'atendimento_lider']

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const ABERTAS = ['aberta', 'em_andamento', 'aguardando'] as const
const FUSO = 'America/Sao_Paulo'
const dataBr = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
const horaBr = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(d)

export function registrarRotasPrestacao(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

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
    const [anterior] = await versoesDo(casoId)
    const versao = (anterior?.versao ?? 0) + 1
    const quem = pedido.usuario!.id
    await banco.transaction(async (tx) => {
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
    })
    await historico(quem, versao === 1 ? 'prestacao_concluida' : 'prestacao_alterada', pedido, `caso:${casoId}`, { versao })
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
        await bloqueio(pedido, casoId, 'G8', 'D2.06r', { motivo: 'ok_e_recebimento' })
        return negar(resposta, 409, MSG_MESMA_PESSOA)
      }
      const d = entrada.data
      await banco.transaction(async (tx) => {
        await tx
          .update(prestacaoContas)
          .set(d.resultado === 'recebido' ? { recebidaPor: quem, recebidaEm: agora() } : { divergencia: d.motivo })
          .where(eq(prestacaoContas.id, atual.id))
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
      })
      await historico(quem, d.resultado === 'recebido' ? 'prestacao_recebida' : 'prestacao_divergente', pedido, `caso:${casoId}`, { versao: atual.versao })
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
    const [u] = await banco.select({ perfis: usuario.perfis }).from(usuario).where(eq(usuario.id, d.acompanhanteId))
    if (!u || !u.perfis.some((p) => ATENDIMENTO.includes(p))) return negar(resposta, 400, MSG_ACOMPANHANTE)
    const quem = pedido.usuario!.id
    const prazo = d.data
    await banco.transaction(async (tx) => {
      if (s.ag) await tx.update(agendamento).set({ situacao: 'cancelado' }).where(eq(agendamento.id, s.ag.id))
      await tx.insert(agendamento).values({
        pessoaId: s.c!.pessoaId,
        casoId,
        tipo: 'ida_ao_banco',
        // Hora de Brasília (sem horário de verão desde 2019).
        quando: new Date(`${d.data}T${d.hora}:00-03:00`),
        local: d.local,
        acompanhanteId: d.acompanhanteId,
        criadoPor: quem,
      })
      if (s.levar) await tx.update(tarefa).set({ prazo, responsavelId: d.acompanhanteId }).where(eq(tarefa.id, s.levar.id))
      else await tx.insert(tarefa).values({ casoId, passo: 'D2.06l', titulo: TITULO_LEVAR, perfilDono: 'atendimento', responsavelId: d.acompanhanteId, prazo })
      // Remarcou: o convite precisa sair de novo (CA12).
      if (s.ag) await tx.update(tarefa).set({ situacao: 'aberta', concluidaEm: null, concluidaPor: null }).where(eq(tarefa.id, s.tarefaDoBanco!.id))
    })
    await historico(quem, s.ag ? 'ida_ao_banco_remarcada' : 'ida_ao_banco_agendada', pedido, `caso:${casoId}`)
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
    if (!s.m || !s.texto) return negar(resposta, 409, 'Modelo "Confirmação da ida ao banco" não cadastrado.')
    // CA2: só entra no acervo como processo bom o caso com o resultado registrado; sem ele, o aviso espera.
    const desfecho = s.c.desfecho ?? ((await deferimento(casoId)) ? 'deferido' : null)
    if (!desfecho) return negar(resposta, 409, MSG_SEM_DESFECHO)
    const quem = pedido.usuario!.id
    await banco.transaction(async (tx) => {
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
    })
    await historico(quem, 'cliente_avisado_ida_ao_banco', pedido, `caso:${casoId}`, { canal: entrada.data.canal })
    await historico(quem, 'baixa_registrada', pedido, `caso:${casoId}`, { acervo: 'processo_bom' })
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
    await banco.transaction(async (tx) => {
      await tx.update(agendamento).set({ situacao: 'realizado' }).where(eq(agendamento.id, s.ag!.id))
      if (s.levar) await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, s.levar.id))
      await tx.update(caso).set({ fase: 'encerrado', encerradoEm: agora(), atualizadoEm: agora() }).where(eq(caso.id, casoId))
    })
    await historico(quem, 'recebimento_confirmado', pedido, `caso:${casoId}`)
    return resposta.code(201).send({ ok: true })
  })
}
