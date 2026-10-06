// Conferência da Sênior antes do INSS (GGVP-23): G1 (checklist), G2 (só a Sênior) e G17 (parecer médico) no servidor.
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CasoParaConferencia, DecidirConferencia, DispensarParecer, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import {
  caso,
  contrato,
  decisao,
  documento,
  documentoMedico,
  fichaAtendimento,
  kitDocumento,
  parecerMedico,
  pessoa,
  tarefa,
} from '../banco/esquema.ts'
import { esperandoConferencia, okDaSenior } from '../fluxo/conferencia.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_NAO_ESPERA = 'Este caso não está esperando a conferência.'
export const MSG_G1 = 'Checklist incompleto (G1): faltam'
export const MSG_G17 = 'Sem parecer médico "Suficiente" ou dispensa justificada (G17).'
export const MSG_LAUDO_NOVO = 'Há laudo novo esperando conferência (G17).'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
type ItemParecer = { item: string; atendido: boolean }

export function registrarRotasConferencia(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

  async function montar(casoId: string, perfilAtivo: string | null) {
    const [c] = await banco
      .select({ id: caso.id, beneficio: caso.beneficio, cliente: pessoa.nome })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, casoId))
    if (!c) return null
    const docs = await banco
      .select({ id: documento.id, tipo: documento.tipo, nome: documento.nomeOriginal })
      .from(documento)
      .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
      .orderBy(documento.criadoEm)
    const kit = c.beneficio
      ? await banco.select({ tipo: kitDocumento.tipoDocumento }).from(kitDocumento).where(and(eq(kitDocumento.beneficio, c.beneficio), eq(kitDocumento.obrigatorio, true)))
      : []
    const tem = new Set(docs.map((d) => d.tipo))
    const faltam = kit.map((k) => k.tipo).filter((t) => !tem.has(t))
    const [parecer] = await banco.select().from(parecerMedico).where(eq(parecerMedico.casoId, casoId)).orderBy(desc(parecerMedico.criadoEm)).limit(1)
    const [laudoNovo] = await banco
      .select({ id: documentoMedico.id })
      .from(documentoMedico)
      .innerJoin(documento, eq(documentoMedico.documentoId, documento.id))
      .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm), isNull(documentoMedico.confirmadoEm)))
      .limit(1)
    const [ficha] = await banco.select({ id: fichaAtendimento.id }).from(fichaAtendimento).where(eq(fichaAtendimento.casoId, casoId)).limit(1)
    const [assinado] = await banco
      .select({ id: contrato.id })
      .from(contrato)
      .where(and(eq(contrato.casoId, casoId), eq(contrato.situacao, 'assinado')))
      .limit(1)
    const ok = await okDaSenior(banco, casoId)
    const espera = await esperandoConferencia(banco, casoId)
    return CasoParaConferencia.parse({
      casoId: c.id,
      cliente: c.cliente,
      beneficio: c.beneficio,
      checklist: { cadastrado: kit.length > 0, completo: faltam.length === 0, faltam },
      documentos: docs,
      parecer: parecer
        ? { resultado: parecer.resultado, itens: (parecer.itens as ItemParecer[]) ?? [], justificativaDispensa: parecer.justificativaDispensa }
        : null,
      laudoNovoEsperando: Boolean(laudoNovo),
      temFicha: Boolean(ficha),
      kitAssinado: Boolean(assinado),
      podeDecidir: pode(perfilAtivo, 'caso.aprovar_para_inss') && espera,
      situacao: espera || !ok ? 'aguardando' : ok.resultado === 'aprovado' ? 'aprovado' : 'reprovado',
    })
  }

  // CA1, CA4, CA5, CA6: quem tem `caso.ver` abre; só a Sênior com o caso na fila pode decidir.
  app.get<{ Params: { id: string } }>('/api/casos/:id/conferencia', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const dados = await montar(pedido.params.id, pedido.perfilAtivo)
    return dados ?? negar(resposta, 404, 'Caso não encontrado.')
  })

  const daSenior = { preHandler: exigir(banco, 'caso.aprovar_para_inss', agora) }

  async function recusar(pedido: FastifyRequest, resposta: FastifyReply, casoId: string, portao: 'G1' | 'G17', erro: string) {
    await bloqueio(pedido, casoId, portao, 'D2.01', {}, 'conferencia_recusada')
    return negar(resposta, 409, erro)
  }

  // CA2, CA3, CA5, CA7, CA8, CA9; CA10 pelo exigir (403 e histórico para quem não é Sênior).
  app.post<{ Params: { id: string } }>('/api/casos/:id/conferencia', daSenior, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DecidirConferencia.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Decisão inválida.')
    const dados = await montar(casoId, pedido.perfilAtivo)
    if (!dados) return negar(resposta, 404, 'Caso não encontrado.')
    if (!(await esperandoConferencia(banco, casoId))) return negar(resposta, 409, MSG_NAO_ESPERA)
    const quem = pedido.usuario!.id
    const base = { casoId, passo: 'D2.01', tipo: 'aprovacao_inss', decididoPor: quem, perfil: pedido.perfilAtivo!, decididoEm: agora() }
    const concluirD201 = (tx: Banco) =>
      tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.01'), isNull(tarefa.concluidaEm)))

    if (entrada.data.decisao === 'aprovar') {
      if (dados.checklist.cadastrado && !dados.checklist.completo) return recusar(pedido, resposta, casoId, 'G1', `${MSG_G1} ${dados.checklist.faltam.join(', ')}.`)
      if (!dados.parecer || !['suficiente', 'dispensado'].includes(dados.parecer.resultado)) return recusar(pedido, resposta, casoId, 'G17', MSG_G17)
      if (dados.laudoNovoEsperando) return recusar(pedido, resposta, casoId, 'G17', MSG_LAUDO_NOVO)
      await banco.transaction(async (tx) => {
        await tx.insert(decisao).values({ ...base, resultado: 'aprovado' })
        // CA2: protocolo e "precisa de perícia?" ao mesmo tempo.
        await tx.insert(tarefa).values([
          { casoId, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm' },
          { casoId, passo: 'D2.03', titulo: 'Decidir perícia', perfilDono: 'advogada' },
        ])
        await tx.update(caso).set({ fase: 'administrativa', atualizadoEm: agora() }).where(eq(caso.id, casoId))
        await concluirD201(tx as unknown as Banco)
      })
      await historico(quem, 'caso_aprovado_para_inss', pedido, `caso:${casoId}`)
      return resposta.code(201).send({ ok: true, situacao: 'aprovado' })
    }

    const { motivo, prazo } = entrada.data as { motivo: string; prazo?: string }
    await banco.transaction(async (tx) => {
      await tx.insert(decisao).values({ ...base, resultado: 'reprovado', justificativa: motivo })
      // CA3: volta ao Atendimento com o motivo visível; prazo só se a Sênior respondeu "Sim".
      await tx.insert(tarefa).values({
        casoId,
        passo: 'D1.ajuste',
        titulo: `Ajustar o caso: ${motivo.slice(0, 120)}`,
        perfilDono: 'atendimento',
        prazo: prazo ?? null,
      })
      await tx.update(caso).set({ fase: 'atendimento', atualizadoEm: agora() }).where(eq(caso.id, casoId))
      await concluirD201(tx as unknown as Banco)
    })
    await historico(quem, 'caso_reprovado_na_conferencia', pedido, `caso:${casoId}`, { temPrazo: Boolean(prazo) })
    return resposta.code(201).send({ ok: true, situacao: 'reprovado' })
  })

  // G17: só a Sênior dispensa o parecer, com justificativa, na própria conferência (resposta do revisor de 05/10).
  app.post<{ Params: { id: string } }>('/api/casos/:id/parecer/dispensa', daSenior, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DispensarParecer.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Justificativa obrigatória.')
    if (!(await esperandoConferencia(banco, casoId))) return negar(resposta, 409, MSG_NAO_ESPERA)
    await banco.insert(parecerMedico).values({
      casoId,
      roteiroVersao: 0,
      resultado: 'dispensado',
      justificativaDispensa: entrada.data.justificativa,
      confirmadoPor: pedido.usuario!.id,
      confirmadoEm: agora(),
      criadoEm: agora(),
    })
    await historico(pedido.usuario!.id, 'parecer_dispensado', pedido, `caso:${casoId}`)
    return resposta.code(201).send({ ok: true })
  })
}
