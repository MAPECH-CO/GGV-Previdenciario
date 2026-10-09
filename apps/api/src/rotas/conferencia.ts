// Conferência da Sênior antes do INSS (GGVP-23): G1 (checklist), G2 (só a Sênior) e G17 (parecer médico) no servidor.
import { and, desc, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CasoParaConferencia, ChanceDeExito, DecidirConferencia, DispensarParecer, ROTULO_BENEFICIO, ResponderDispensa, pode, travaDoParecer, type Beneficio, type Erro, type SituacaoDoParecer } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import {
  acessoDadoSensivel,
  caso,
  contrato,
  decisao,
  documento,
  documentoMedico,
  fichaAtendimento,
  kitDocumento,
  parecerMedico,
  pessoa,
  processoAcervo,
  resultadoInss,
  tarefa,
  usuario,
} from '../banco/esquema.ts'
import { REGRA_DA_CHANCE, calcularChance } from '../fluxo/chance.ts'
import type { ComoSugerir, Ia } from '../ia/ia.ts'
import { casosComTarefaAberta, type Preparo } from '../ia/preparo.ts'
import { esperandoConferencia, okDaSenior } from '../fluxo/conferencia.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { ehPeca } from './documentos.ts'

export const MSG_NAO_ESPERA = 'Este caso não está esperando a conferência.'
export const MSG_G1 = 'Checklist incompleto (G1): faltam'
export const MSG_DISPENSA_JA_PEDIDA = 'A dispensa do parecer já foi pedida e espera outra Sênior.'
export const MSG_SEM_DISPENSA = 'Não há pedido de dispensa esperando resposta.'
export const MSG_MESMA_SENIOR = 'Quem pediu a dispensa não a aprova: uma pessoa sozinha nunca dispensa o parecer (G17).'

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
type ItemParecer = { item: string; atendido: boolean }
type LinhaParecer = typeof parecerMedico.$inferSelect

/** G17: sem a confirmação de uma pessoa, o parecer é só sugestão da IA ("pendente"), e o portão não abre. */
const situacaoDo = (p: LinhaParecer | undefined): SituacaoDoParecer | null =>
  !p ? null : p.confirmadoPor ? (p.resultado as SituacaoDoParecer) : 'pendente'

export function registrarRotasConferencia(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

  /** O pedido de dispensa esperando resposta (Q14): há mais pedidos que respostas. */
  async function dispensaPendente(casoId: string) {
    const linhas = await banco
      .select({ resultado: decisao.resultado, justificativa: decisao.justificativa, por: decisao.decididoPor, nome: usuario.nome })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'dispensa_parecer')))
      .orderBy(desc(decisao.decididoEm))
    const pedidos = linhas.filter((l) => l.resultado === 'pedida')
    return pedidos.length > linhas.length - pedidos.length ? pedidos[0] : null
  }

  async function montar(casoId: string, perfilAtivo: string | null, quem?: string) {
    const [c] = await banco
      .select({ id: caso.id, beneficio: caso.beneficio, cliente: pessoa.nome, abertoEm: caso.criadoEm })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, casoId))
    if (!c) return null
    // GGVP-96: a peça jurídica (pacote da petição, versões) só vai a quem vê a petição.
    const vePeca = pode(perfilAtivo, 'peticao.ver')
    const docs = (
      await banco
        .select({ id: documento.id, tipo: documento.tipo, nome: documento.nomeOriginal })
        .from(documento)
        .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
        .orderBy(documento.criadoEm)
    ).filter((d) => vePeca || !ehPeca(d.tipo))
    const kit = c.beneficio
      ? await banco
          .select({ tipo: kitDocumento.tipoDocumento })
          .from(kitDocumento)
          .where(
            and(
              eq(kitDocumento.beneficio, c.beneficio),
              eq(kitDocumento.obrigatorio, true),
              // GGVP-104 CA1, CA6: o caso fica com o kit vigente quando foi aberto.
              lte(kitDocumento.vigenteDesde, c.abertoEm),
              or(isNull(kitDocumento.revogadoEm), gt(kitDocumento.revogadoEm, c.abertoEm)),
            ),
          )
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
    // GGVP-96 CA12 e CA13: o parecer é dado de saúde; só o Jurídico recebe, e cada leitura de pessoa (`quem`) fica
    // registrada. O aprovar usa o parecer só para o portão G17, sem mostrar: não registra.
    const veParecer = pode(perfilAtivo, 'dado_saude.ver_detalhe')
    if (quem && parecer && veParecer) {
      await banco.insert(acessoDadoSensivel).values({ usuarioId: quem, perfil: perfilAtivo!, casoId, recurso: `parecer:${parecer.id}`, quando: agora() })
    }
    const ok = await okDaSenior(banco, casoId)
    const espera = await esperandoConferencia(banco, casoId)
    const pendente = await dispensaPendente(casoId)
    const situacao = situacaoDo(parecer)
    return CasoParaConferencia.parse({
      casoId: c.id,
      cliente: c.cliente,
      beneficio: c.beneficio,
      checklist: { cadastrado: kit.length > 0, completo: faltam.length === 0, faltam },
      documentos: docs,
      parecer: parecer && veParecer
        ? { resultado: parecer.resultado, itens: (parecer.itens as ItemParecer[]) ?? [], justificativaDispensa: parecer.justificativaDispensa }
        : null,
      parecerRestrito: !veParecer,
      travaDoParecer: travaDoParecer('aprovar-inss', c.beneficio, situacao && { situacao }, { laudoNovoEsperando: Boolean(laudoNovo), dispensaPedida: Boolean(pendente) }),
      dispensa:
        pendente && veParecer
          ? { pedidaPor: pendente.nome, justificativa: pendente.justificativa ?? '', podeResponder: pode(perfilAtivo, 'caso.aprovar_para_inss') && pendente.por !== quem }
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
    const dados = await montar(pedido.params.id, pedido.perfilAtivo, pedido.usuario!.id)
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
      if (dados.travaDoParecer) return recusar(pedido, resposta, casoId, 'G17', dados.travaDoParecer)
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

  // GGVP-131 (recorte de 07/10): a chance de êxito na conferência. O número vem do código, a partir dos desfechos
  // conferidos do acervo com o mesmo benefício; a IA lê o caso e explica os fatores. Fica no histórico (CA10).
  app.post<{ Params: { id: string } }>('/api/casos/:id/chance', daSenior, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const quem = pedido.usuario!.id
    const chance = await chanceDoCaso(casoId, pedido.perfilAtivo, quem)
    if (!chance) return negar(resposta, 404, 'Caso não encontrado.')
    const { casos, porcentagem, baseEm, fatores } = chance
    await historico(quem, 'chance_mostrada', pedido, `caso:${casoId}`, { casos, porcentagem, baseEm, chamada: fatores?.chamadaId ?? null })
    return chance
  })
  // Sugestão pronta (07/10): os fatores ficam prontos em segundo plano para a Sênior; a rodada não registra "mostrada".
  preparo.registrar(
    () => casosComTarefaAberta(banco, 'D2.01'),
    (casoId) => chanceDoCaso(casoId, 'senior', null, { soPreparar: true }),
  )

  async function chanceDoCaso(casoId: string, perfil: string | null, quem: string | null, como: ComoSugerir = {}) {
    const dados = await montar(casoId, perfil)
    if (!dados) return null
    const acervo = dados.beneficio
      ? await banco
          .select({ desfecho: processoAcervo.desfecho, criadoEm: processoAcervo.criadoEm })
          .from(processoAcervo)
          .where(and(eq(processoAcervo.beneficio, dados.beneficio), isNotNull(processoAcervo.desfechoConferidoPor)))
      : []
    const conta = calcularChance(acervo.map((a) => a.desfecho))
    const baseEm = conta.casos ? new Date(Math.max(...acervo.map((a) => a.criadoEm.getTime()))).toISOString() : null
    const [indeferido] = await banco
      .select({ motivo: resultadoInss.motivoEscrito, motivoInss: resultadoInss.motivoIndeferimento })
      .from(resultadoInss)
      .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    const [parecer] = await banco.select().from(parecerMedico).where(eq(parecerMedico.casoId, casoId)).orderBy(desc(parecerMedico.criadoEm)).limit(1)
    const itens = ((parecer?.itens as ItemParecer[] | null) ?? []).map((i) => `${i.item}: ${i.atendido ? 'atendido' : 'não atendido'}`)
    const conteudo = [
      `Benefício: ${dados.beneficio ? (ROTULO_BENEFICIO[dados.beneficio as Beneficio] ?? dados.beneficio) : 'não definido'}`,
      `Parecer médico: ${parecer ? `${parecer.resultado}${itens.length ? ` (${itens.join('; ')})` : ''}` : 'não há'}`,
      `Checklist: ${!dados.checklist.cadastrado ? 'kit não cadastrado' : dados.checklist.completo ? 'completo' : `faltam ${dados.checklist.faltam.join(', ')}`}`,
      // Frase inteira: com "sim/não" a IA lia "laudo novo não disponível".
      dados.laudoNovoEsperando ? 'Chegou um laudo médico novo que ainda espera a conferência' : 'Nenhum laudo médico novo esperando conferência',
      `Indeferimento anterior: ${indeferido ? (indeferido.motivo ?? indeferido.motivoInss ?? 'sem motivo registrado') : 'não há'}`,
      `Chance calculada pelo sistema: ${conta.porcentagem === null ? 'sem casos parecidos na casa ainda' : `${conta.porcentagem}% em ${conta.casos} casos parecidos`}`,
    ].join('\n')
    const fatores = await ia.sugerir('fatores_da_chance', { casoId, quem, conteudo, fontes: [{ tipo: 'regra', referencia: REGRA_DA_CHANCE }] }, como)
    return ChanceDeExito.parse({ ...conta, baseEm, regra: REGRA_DA_CHANCE, fatores, motivoIa: fatores ? null : 'A IA não respondeu agora: os fatores ficam com a sua leitura.' })
  }

  // G17 e GGVP-33 (Lucas, 01/10, Q14): a dispensa é de duas Sêniores diferentes. A primeira pede, com justificativa.
  app.post<{ Params: { id: string } }>('/api/casos/:id/parecer/dispensa', daSenior, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DispensarParecer.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Justificativa obrigatória.')
    if (!(await esperandoConferencia(banco, casoId))) return negar(resposta, 409, MSG_NAO_ESPERA)
    if (await dispensaPendente(casoId)) return negar(resposta, 409, MSG_DISPENSA_JA_PEDIDA)
    const quem = pedido.usuario!.id
    await banco.insert(decisao).values({
      casoId,
      passo: 'D2.01',
      tipo: 'dispensa_parecer',
      resultado: 'pedida',
      justificativa: entrada.data.justificativa,
      decididoPor: quem,
      perfil: pedido.perfilAtivo!,
      decididoEm: agora(),
    })
    await historico(quem, 'dispensa_parecer_pedida', pedido, `caso:${casoId}`)
    return resposta.code(201).send({ ok: true })
  })

  // A segunda Sênior, outra pessoa, aprova ou recusa. A mesma pessoa é recusada, e a tentativa fica no histórico.
  app.post<{ Params: { id: string } }>('/api/casos/:id/parecer/dispensa/aprovacao', daSenior, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = ResponderDispensa.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha aprovar ou recusar.')
    const pendente = await dispensaPendente(casoId)
    if (!pendente) return negar(resposta, 409, MSG_SEM_DISPENSA)
    const quem = pedido.usuario!.id
    if (pendente.por === quem) {
      await bloqueio(pedido, casoId, 'G17', 'D2.01', { motivo: 'mesma_senior' }, 'dispensa_parecer_recusada')
      return negar(resposta, 409, MSG_MESMA_SENIOR)
    }
    const { aprova } = entrada.data
    await banco.transaction(async (tx) => {
      const base = { casoId, passo: 'D2.01', tipo: 'dispensa_parecer', decididoPor: quem, perfil: pedido.perfilAtivo!, decididoEm: agora() }
      await tx.insert(decisao).values({ ...base, resultado: aprova ? 'aprovada' : 'recusada' })
      if (aprova)
        await tx.insert(parecerMedico).values({
          casoId,
          roteiroVersao: 0,
          resultado: 'dispensado',
          justificativaDispensa: pendente.justificativa,
          confirmadoPor: quem,
          confirmadoEm: agora(),
          criadoEm: agora(),
        })
    })
    await historico(quem, aprova ? 'parecer_dispensado' : 'dispensa_parecer_negada', pedido, `caso:${casoId}`)
    return resposta.code(201).send({ ok: true })
  })
}
