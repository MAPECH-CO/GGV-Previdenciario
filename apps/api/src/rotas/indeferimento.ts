// Do indeferido ao despacho (GGVP-52, 54): quem viu o indeferido escreve o motivo com as suas palavras, que vai para
// o banco de motivos (`resultado_inss`), e a Sênior recebe o caso para despachar (G4). Sem IA até o épico IA jurídica.
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { Indeferimento, RegistrarMotivo, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'
import { MSG_CARTA } from './vigilia.ts'

export const MSG_SEM_INDEFERIMENTO = 'Este caso não tem indeferimento registrado.'
export const MSG_MOTIVO_JA_REGISTRADO = 'O motivo deste indeferimento já foi registrado.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasIndeferimento(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  /** O último indeferimento do caso, com o cliente. */
  async function indeferimentoDo(casoId: string) {
    const [l] = await banco
      .select({ resultado: resultadoInss, cliente: pessoa.nome, beneficio: caso.beneficio })
      .from(resultadoInss)
      .innerJoin(caso, eq(resultadoInss.casoId, caso.id))
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    return l ?? null
  }

  const tarefaAberta = async (casoId: string, passo: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  // GGVP-52 CA3, CA7: a carta, o motivo do INSS e o motivo escrito, com quem e quando.
  app.get<{ Params: { id: string } }>('/api/casos/:id/indeferimento', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const l = await indeferimentoDo(casoId)
    if (!l) return negar(resposta, 404, MSG_SEM_INDEFERIMENTO)
    const r = l.resultado
    const [carta] = r.documentoId ? await banco.select({ id: documento.id, nome: documento.nomeOriginal }).from(documento).where(eq(documento.id, r.documentoId)) : []
    const [autor] = r.motivoEscritoPor ? await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, r.motivoEscritoPor)) : []
    return Indeferimento.parse({
      casoId,
      cliente: l.cliente,
      beneficio: l.beneficio,
      dataDecisao: r.dataDecisao,
      motivoInss: r.motivoIndeferimento,
      carta: carta ?? null,
      motivoEscrito: r.motivoEscrito && autor && r.motivoEscritoEm ? { texto: r.motivoEscrito, por: autor.nome, em: r.motivoEscritoEm.toISOString() } : null,
      podeRegistrar: pode(pedido.perfilAtivo, 'inss.registrar_resposta') && Boolean(await tarefaAberta(casoId, 'D3.01')),
    })
  })

  // GGVP-52 CA1, CA2, CA4 a CA7: motivo e carta obrigatórios; grava no banco de motivos sem duplicar e o despacho nasce.
  app.post<{ Params: { id: string } }>('/api/casos/:id/indeferimento/motivo', { preHandler: exigir(banco, 'inss.registrar_resposta', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    if (!formulario) return negar(resposta, 400, MSG_CARTA)
    const entrada = RegistrarMotivo.safeParse({ motivo: formulario.campos.motivo })
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const l = await indeferimentoDo(casoId)
    if (!l) return negar(resposta, 404, MSG_SEM_INDEFERIMENTO)
    const registro = await tarefaAberta(casoId, 'D3.01')
    if (!registro) return negar(resposta, 409, MSG_MOTIVO_JA_REGISTRADO)
    // CA4: a carta do registro do indeferido vale; o arquivo só é pedido se ela faltar.
    const arquivo = formulario.arquivo
    if (!l.resultado.documentoId && !(arquivo && TIPOS_DE_ANEXO.includes(arquivo.mime))) return negar(resposta, 400, MSG_CARTA)
    const quem = pedido.usuario!.id
    const carta = !l.resultado.documentoId && arquivo ? await guardarArquivo(armazenamento, casoId, arquivo, 'carta-indeferimento') : null
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    const feito = await banco.transaction(async (tx) => {
      // CA5: duas confirmações ao mesmo tempo não duplicam: só uma conclui a tarefa.
      const [t] = await tx
        .update(tarefa)
        .set(fechar)
        .where(and(eq(tarefa.id, registro.id), isNull(tarefa.concluidaEm)))
        .returning()
      if (!t) return false
      const [doc] = carta ? await tx.insert(documento).values({ casoId, tipo: 'carta_indeferimento', origem: 'portal', recebidoPor: quem, ...carta }).returning() : []
      await tx
        .update(resultadoInss)
        .set({ motivoEscrito: entrada.data.motivo, motivoEscritoPor: quem, motivoEscritoEm: agora(), ...(doc ? { documentoId: doc.id } : {}) })
        .where(eq(resultadoInss.id, l.resultado.id))
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.01'), isNull(etapa.concluidaEm)))
      // CA6: sem IA, o despacho da Sênior nasce direto (GGVP-54).
      await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.03', situacao: 'aberta', iniciadaEm: agora() })
      await tx.insert(tarefa).values({ casoId, passo: 'D3.03', titulo: 'Despachar caso', perfilDono: 'senior', criadoEm: agora() })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_MOTIVO_JA_REGISTRADO)
    // CA7: na linha do processo, com autor e data (o texto fica no banco de motivos, não no histórico).
    await historico(quem, 'indeferimento_motivo_registrado', pedido, `caso:${casoId}`, { resultado: l.resultado.id })
    return resposta.code(201).send({ ok: true })
  })
}
