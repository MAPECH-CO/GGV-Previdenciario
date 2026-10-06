// Vigília do Meu INSS (GGVP-35) e indeferido segue para a Justiça (GGVP-48). A vigília é manual: o INSS não tem API (Q6).
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { EncerrarCaso, RespostaDoInss, VigiliaDoCaso, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, exigencia, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'

export const MSG_FORA_DA_VIGILIA = 'O caso não está esperando a resposta do INSS.'
export const MSG_COMUNICACAO = 'Anexe a comunicação do INSS (PDF ou imagem, até 25 MB).'
export const MSG_CARTA = 'Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => agora.toISOString().slice(0, 10)

export function registrarRotasVigilia(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  async function vigiliaAberta(casoId: string) {
    const [e] = await banco
      .select()
      .from(etapa)
      .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.04'), isNull(etapa.concluidaEm)))
      .limit(1)
    return e ?? null
  }

  // CA7 e CA10: o que o caso espera do INSS, desde quando, e o que já foi registrado.
  app.get<{ Params: { id: string } }>('/api/casos/:id/vigilia', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco
      .select({ id: caso.id, beneficio: caso.beneficio, fase: caso.fase, cliente: pessoa.nome })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const [espera] = await banco
      .select()
      .from(etapa)
      .where(and(eq(etapa.casoId, casoId), eq(etapa.situacao, 'aguardando_externo'), isNull(etapa.concluidaEm)))
      .orderBy(desc(etapa.iniciadaEm))
      .limit(1)
    const decisoes = await banco
      .select({ quando: resultadoInss.criadoEm, resultado: resultadoInss.resultado, motivo: resultadoInss.motivoIndeferimento, quem: usuario.nome })
      .from(resultadoInss)
      .innerJoin(usuario, eq(resultadoInss.registradoPor, usuario.id))
      .where(eq(resultadoInss.casoId, casoId))
    const exigencias = await banco
      .select({ quando: exigencia.criadoEm, texto: exigencia.descricao, quem: usuario.nome })
      .from(exigencia)
      .innerJoin(usuario, eq(exigencia.analisadaPor, usuario.id))
      .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'inss')))
    const registros = [
      ...decisoes.map((d) => ({ quando: d.quando.toISOString(), tipo: 'decisao', resumo: d.resultado === 'deferido' ? 'Deferido' : `Indeferido: ${d.motivo ?? ''}`, quem: d.quem })),
      ...exigencias.map((x) => ({ quando: x.quando.toISOString(), tipo: 'exigencia', resumo: `Exigência: ${x.texto.slice(0, 140)}`, quem: x.quem })),
    ].sort((a, b) => a.quando.localeCompare(b.quando))
    return VigiliaDoCaso.parse({
      casoId: c.id,
      cliente: c.cliente,
      beneficio: c.beneficio,
      fase: c.fase,
      esperando: espera?.aguardando ?? null,
      desde: espera?.iniciadaEm.toISOString() ?? null,
      registros,
      podeRegistrar: pode(pedido.perfilAtivo, 'inss.registrar_resposta') && Boolean(await vigiliaAberta(casoId)),
      podeEncerrar: pode(pedido.perfilAtivo, 'caso.encerrar') && c.fase === 'judicial',
    })
  })

  // GGVP-35 CA3, CA5, CA6, CA8, CA10 e GGVP-48 CA1 a CA3.
  app.post<{ Params: { id: string } }>('/api/casos/:id/vigilia', { preHandler: exigir(banco, 'inss.registrar_resposta', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    if (!formulario) return negar(resposta, 400, MSG_COMUNICACAO)
    const { campos, arquivo } = formulario
    const entrada = RespostaDoInss.safeParse({ ...campos, diferenteDoPedido: campos.diferenteDoPedido === 'true' })
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Resposta do INSS inválida.')
    const vigilia = await vigiliaAberta(casoId)
    if (!vigilia) return negar(resposta, 409, MSG_FORA_DA_VIGILIA)
    const quem = pedido.usuario!.id
    const dados = entrada.data
    const anexoValido = arquivo && TIPOS_DE_ANEXO.includes(arquivo.mime)

    if (dados.tipo === 'exigencia') {
      // CA6: texto e data obrigatórios; o prazo fica "a calcular" até o código da GGVP-34 (G12). CA8: a vigília continua.
      await banco.transaction(async (tx) => {
        await tx.insert(exigencia).values({ casoId, origem: 'inss', descricao: dados.texto, recebidaEm: dados.data, analisadaPor: quem })
        await tx.insert(tarefa).values({ casoId, passo: 'D2.05', titulo: 'Tratar exigência do INSS', perfilDono: 'advogada' })
        if (anexoValido) await tx.insert(documento).values({ casoId, tipo: 'comunicacao_inss', origem: 'portal', recebidoPor: quem, ...(await guardarArquivo(armazenamento, casoId, arquivo, 'exigencia-inss')) })
      })
      await historico(quem, 'exigencia_inss_registrada', pedido, `caso:${casoId}`)
      return resposta.code(201).send({ ok: true, aberto: 'exigencia' })
    }

    // CA5 (e GGVP-48 CA2): sem a comunicação anexada, ou a carta, no caso de indeferido, não conclui.
    if (!anexoValido) return negar(resposta, 400, dados.resultado === 'indeferido' ? MSG_CARTA : MSG_COMUNICACAO)
    const indeferido = dados.resultado === 'indeferido'
    const doc = await guardarArquivo(armazenamento, casoId, arquivo, indeferido ? 'carta-indeferimento' : 'comunicacao-inss')
    const fecharVigilia = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    await banco.transaction(async (tx) => {
      const [d] = await tx
        .insert(documento)
        .values({ casoId, tipo: indeferido ? 'carta_indeferimento' : 'comunicacao_inss', origem: 'portal', recebidoPor: quem, ...doc })
        .returning()
      await tx.insert(resultadoInss).values({
        casoId,
        resultado: dados.resultado,
        dataDecisao: hoje(agora()),
        motivoIndeferimento: indeferido ? dados.motivoInss : null,
        documentoId: d.id,
        registradoPor: quem,
      })
      await tx.update(etapa).set(fecharVigilia).where(eq(etapa.id, vigilia.id))
      await tx
        .update(tarefa)
        .set(fecharVigilia)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.04'), isNull(tarefa.concluidaEm)))
      if (indeferido) {
        // GGVP-48: o caso vai para a Justiça; a tarefa já traz a carta (evidência) e o motivo do INSS (no resultado).
        await tx.update(caso).set({ fase: 'judicial', atualizadoEm: agora() }).where(eq(caso.id, casoId))
        await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.01', situacao: 'aberta', iniciadaEm: agora() })
        await tx.insert(tarefa).values({ casoId, passo: 'D3.01', titulo: 'Registrar indeferimento', perfilDono: 'advogada', evidenciaDocumentoId: d.id })
      } else if (dados.diferenteDoPedido) {
        await tx.insert(tarefa).values({ casoId, passo: 'D2.06', titulo: 'Analisar deferimento diferente do pedido', perfilDono: 'advogada' })
      } else {
        await tx.insert(tarefa).values({ casoId, passo: 'D2.06', titulo: 'Prestar contas', perfilDono: 'advogada' })
      }
    })
    await historico(quem, indeferido ? 'indeferimento_registrado' : 'deferimento_registrado', pedido, `caso:${casoId}`, { diferenteDoPedido: dados.diferenteDoPedido })
    return resposta.code(201).send({ ok: true, aberto: indeferido ? 'justica' : dados.diferenteDoPedido ? 'analise' : 'prestacao' })
  })

  // GGVP-48 (resposta do revisor de 05/10): a Sênior pode encerrar o indeferido em vez de judicializar, com motivo.
  app.post<{ Params: { id: string } }>('/api/casos/:id/encerrar', { preHandler: exigir(banco, 'caso.encerrar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = EncerrarCaso.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Motivo obrigatório.')
    const [c] = await banco.select({ fase: caso.fase }).from(caso).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    if (c.fase !== 'judicial') return negar(resposta, 409, 'Só o caso indeferido, antes da Justiça, pode ser encerrado aqui.')
    await banco.transaction(async (tx) => {
      await tx
        .update(caso)
        .set({ fase: 'encerrado', desfecho: 'desistencia', causaDesfecho: entrada.data.motivo, encerradoEm: agora(), atualizadoEm: agora() })
        .where(eq(caso.id, casoId))
      await tx
        .update(tarefa)
        .set({ situacao: 'cancelada', concluidaEm: agora(), concluidaPor: pedido.usuario!.id })
        .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.situacao, ['aberta', 'em_andamento', 'aguardando'])))
    })
    await historico(pedido.usuario!.id, 'caso_encerrado', pedido, `caso:${casoId}`)
    return resposta.code(201).send({ ok: true })
  })
}
