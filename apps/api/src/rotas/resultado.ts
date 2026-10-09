// Explicar o resultado ao cliente no caso perdido (GGVP-22). O Jurídico escreve e aprova o resumo, sem estratégia
// interna, e decide quem fala (Lucas, 06/10); quem fala registra cada contato. Sem IA até 09/10: o texto é do Jurídico.
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AprovarResumo, faltaCompletar, ROTULO_BENEFICIO, RegistrarContato, ResultadoParaExplicar, SugestaoDoResumo, pode, type Beneficio, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { atendimento, caso, decisao, eventoAuditoria, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import type { ComoSugerir, Ia } from '../ia/ia.ts'
import { casosComTarefaAberta, type Preparo } from '../ia/preparo.ts'
import { exigir } from '../sessao/rotas.ts'

export const TITULO_RESUMO = 'Aprovar o resumo para o cliente'
export const TITULO_EXPLICAR = 'Explicar resultado'
export const MSG_SEM_RESUMO_ESPERANDO = 'Não há resultado esperando o resumo.'
export const MSG_SEM_EXPLICACAO = 'Não há explicação ao cliente em aberto neste caso.'
export const MSG_OUTRA_PESSOA = 'Quem registra o contato é quem ficou com a explicação.'
/** As ações do histórico que registram um contato desta explicação; cada uma guarda o atendimento e a tarefa. */
const CONTATO_REGISTRADO = ['resultado_explicado', 'resultado_sem_contato']

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** CA5: o contato é de quem ficou com a explicação: a advogada que a pegou ou, no padrão, o Atendimento (o líder também). */
function ehDeQuemFala(t: { perfilDono: string | null; responsavelId: string | null }, usuarioId: string, perfil: string | null | undefined) {
  if (t.responsavelId) return t.responsavelId === usuarioId
  return t.perfilDono === 'atendimento' ? perfil === 'atendimento' || perfil === 'atendimento_lider' : perfil === t.perfilDono
}

/**
 * Abre o caminho do resultado perdido: "Aprovar o resumo para o cliente" para a advogada, se não houver uma aberta.
 * Quem chama: o estudo de caso (GGVP-19, só na primeira vez do caso) e, quando existirem, o "Não recorrer"
 * (GGVP-100); hoje também a semente.
 */
export async function abrirExplicacaoDoResultado(tx: Banco | Tx, casoId: string) {
  const [aberta] = await tx
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.06r'), isNull(tarefa.concluidaEm)))
  if (!aberta) await tx.insert(tarefa).values({ casoId, passo: 'D3b.06r', titulo: TITULO_RESUMO, perfilDono: 'advogada' })
}

export function registrarRotasResultado(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {

  const aberta = async (casoId: string, passo: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  // CA1, CA3: o resumo aprovado (com quem aprovou) e os contatos; nada do estudo de caso.
  app.get<{ Params: { id: string } }>('/api/casos/:id/resultado', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome, fase: caso.fase }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const [resumo] = await banco
      .select({ texto: decisao.justificativa, quemFala: decisao.resultado, em: decisao.decididoEm, por: usuario.nome })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'resumo_cliente')))
      .orderBy(desc(decisao.decididoEm))
      .limit(1)
    // CA4: os contatos da explicação mais recente, ligados à tarefa pelo histórico (cada registro guarda o atendimento e
    // a tarefa). Outro atendimento do caso, ou os contatos de uma explicação anterior, não entram.
    // ponytail: o vínculo vive no histórico; uma coluna `tarefa_id` em `atendimento` na próxima migração do épico.
    const [ultima] = await banco
      .select({ id: tarefa.id })
      .from(tarefa)
      .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.06')))
      .orderBy(desc(tarefa.criadoEm))
      .limit(1)
    const registros = ultima
      ? await banco
          .select({ detalhe: eventoAuditoria.detalhe })
          .from(eventoAuditoria)
          .where(and(eq(eventoAuditoria.alvo, `caso:${casoId}`), inArray(eventoAuditoria.acao, CONTATO_REGISTRADO)))
      : []
    const idsDosContatos = registros.flatMap((r) => {
      const d = r.detalhe as { atendimento?: string; tarefa?: string } | null
      return d?.tarefa === ultima?.id && d?.atendimento ? [d.atendimento] : []
    })
    const contatos = idsDosContatos.length
      ? await banco
          .select({ quando: atendimento.inicio, canal: atendimento.canal, explicado: atendimento.resumo, quem: usuario.nome })
          .from(atendimento)
          .innerJoin(usuario, eq(atendimento.responsavelId, usuario.id))
          .where(inArray(atendimento.id, idsDosContatos))
          .orderBy(asc(atendimento.inicio))
      : []
    const explicacao = await aberta(casoId, 'D3b.06')
    return ResultadoParaExplicar.parse({
      casoId,
      cliente: c.nome,
      resumo: resumo ? { texto: resumo.texto ?? '', aprovadoPor: resumo.por, aprovadoEm: resumo.em.toISOString(), quemFala: resumo.quemFala } : null,
      contatos: contatos.map((x) => ({ quando: x.quando.toISOString(), canal: x.canal, explicado: x.explicado, quem: x.quem })),
      podeAprovar: pode(pedido.perfilAtivo, 'resultado.aprovar_resumo') && Boolean(await aberta(casoId, 'D3b.06r')),
      podeRegistrar: pode(pedido.perfilAtivo, 'resultado.explicar') && explicacao !== null && ehDeQuemFala(explicacao, pedido.usuario!.id, pedido.perfilAtivo),
      encerrado: c.fase === 'encerrado',
    })
  })

  // Épico IA (CA3, Lucas 06/10): a IA escreve um rascunho do resumo, com o benefício, o desfecho e a última decisão de
  // mérito; não grava nada. O Jurídico completa e aprova pela rota do resumo. Sugestão pronta (07/10): a mesma função
  // serve à rota e ao preparo em segundo plano.
  app.post<{ Params: { id: string } }>('/api/casos/:id/resultado/sugestao', { preHandler: exigir(banco, 'resultado.aprovar_resumo', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    if (!(await aberta(casoId, 'D3b.06r'))) return negar(resposta, 409, MSG_SEM_RESUMO_ESPERANDO)
    return (await rascunho(casoId, pedido.usuario!.id)) ?? negar(resposta, 404, 'Caso não encontrado.')
  })
  preparo.registrar(
    () => casosComTarefaAberta(banco, 'D3b.06r'),
    (casoId) => rascunho(casoId, null, { soPreparar: true }),
  )

  async function rascunho(casoId: string, quem: string | null, como: ComoSugerir = {}) {
    const [c] = await banco.select({ nome: pessoa.nome, beneficio: caso.beneficio, desfecho: caso.desfecho }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return null
    const [decisaoDeMerito] = await banco
      .select({ id: publicacao.id, texto: publicacao.texto })
      .from(publicacao)
      .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
      .orderBy(desc(publicacao.disponibilizadaEm))
      .limit(1)
    const conteudo = [
      `Cliente: ${c.nome}`,
      `Benefício pedido: ${c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não informado'}`,
      `Resultado: ${c.desfecho ?? 'perdemos'}`,
      // Sem o texto da decisão, a IA não pode explicar o porquê (ela inventava um motivo); a advogada completa.
      `Texto da decisão: ${decisaoDeMerito?.texto ?? 'não está no sistema; o motivo fica para a advogada completar'}`,
    ].join('\n')
    const fontes = decisaoDeMerito ? [{ tipo: 'publicacao' as const, referencia: `publicacao:${decisaoDeMerito.id}` }] : [{ tipo: 'caso' as const, referencia: `caso:${casoId}` }]
    const s = await ia.sugerir('resumo_resultado', { casoId, quem, conteudo, fontes }, como)
    return SugestaoDoResumo.parse({ sugestao: s, motivo: s ? null : 'A IA não escreveu agora: escreva o resumo.' })
  }

  // CA3, CA5: o Jurídico aprova o resumo (decisão de pessoa) e escolhe quem fala; nasce "Explicar resultado" para ele.
  app.post<{ Params: { id: string } }>('/api/casos/:id/resultado/resumo', { preHandler: exigir(banco, 'resultado.aprovar_resumo', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = AprovarResumo.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o resumo.')
    // CA6: o rascunho da IA deixa "[completar...]" quando a decisão não está no sistema; assim não vai ao cliente.
    const falta = faltaCompletar(entrada.data.texto)
    if (falta) return negar(resposta, 400, falta)
    const pendente = await aberta(casoId, 'D3b.06r')
    if (!pendente) return negar(resposta, 409, MSG_SEM_RESUMO_ESPERANDO)
    const quem = pedido.usuario!.id
    const { texto, quemFala, chamadaIaId } = entrada.data
    const feito = await banco.transaction(async (tx) => {
      // A condição vai no próprio update: duas aprovações ao mesmo tempo, só a primeira fecha a tarefa e segue.
      const [fechada] = await tx
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.id, pendente.id), isNull(tarefa.concluidaEm)))
        .returning({ id: tarefa.id })
      if (!fechada) return false
      await tx.insert(decisao).values({
        casoId,
        passo: 'D3b.06',
        tipo: 'resumo_cliente',
        resultado: quemFala,
        justificativa: texto,
        // Épico IA: o rascunho da IA fica à parte do que o Jurídico aprovou.
        sugestaoIa: chamadaIaId ? { chamadaId: chamadaIaId } : null,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      // CA5: caso complexo, a advogada fica com a tarefa; no padrão, vai ao Atendimento.
      await tx.insert(tarefa).values({
        casoId,
        passo: 'D3b.06',
        titulo: TITULO_EXPLICAR,
        perfilDono: quemFala,
        responsavelId: quemFala === 'advogada' ? quem : null,
      })
      await tx.insert(eventoAuditoria).values({ quem, acao: 'resumo_cliente_aprovado', alvo: `caso:${casoId}`, quando: agora(), detalhe: { ip: pedido.ip, quemFala } })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_SEM_RESUMO_ESPERANDO)
    return resposta.code(201).send({ ok: true })
  })

  // CA2, CA4: cada contato com data e canal; "Sem contato" mantém a tarefa, "Expliquei" conclui e fecha o caso.
  app.post<{ Params: { id: string } }>('/api/casos/:id/resultado/contato', { preHandler: exigir(banco, 'resultado.explicar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = RegistrarContato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o contato.')
    const t = await aberta(casoId, 'D3b.06')
    if (!t) return negar(resposta, 409, MSG_SEM_EXPLICACAO)
    const quem = pedido.usuario!.id
    if (!ehDeQuemFala(t, quem, pedido.perfilAtivo)) return negar(resposta, 403, MSG_OUTRA_PESSOA)
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, casoId))
    const d = entrada.data
    const feito = await banco.transaction(async (tx) => {
      // Trava a tarefa e confere de novo que segue aberta: dois "Expliquei" ao mesmo tempo, só o primeiro registra.
      const [aindaAberta] = await tx.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.id, t.id), isNull(tarefa.concluidaEm))).for('update')
      if (!aindaAberta) return false
      const [a] = await tx
        .insert(atendimento)
        .values({
          pessoaId: c!.pessoaId,
          casoId,
          canal: d.canal,
          responsavelId: quem,
          inicio: agora(),
          fim: agora(),
          resumo: d.resultado === 'explicado' ? d.explicado : null,
        })
        .returning({ id: atendimento.id })
      if (d.resultado === 'explicado') {
        await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, t.id))
        await tx.update(caso).set({ fase: 'encerrado', encerradoEm: agora(), atualizadoEm: agora() }).where(eq(caso.id, casoId))
      }
      // O registro no histórico é o que liga o contato à tarefa (CA4): vai na mesma transação do atendimento.
      await tx.insert(eventoAuditoria).values({
        quem,
        acao: d.resultado === 'explicado' ? 'resultado_explicado' : 'resultado_sem_contato',
        alvo: `caso:${casoId}`,
        quando: agora(),
        detalhe: { ip: pedido.ip, canal: d.canal, atendimento: a.id, tarefa: t.id },
      })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_SEM_EXPLICACAO)
    return resposta.code(201).send({ ok: true })
  })
}
