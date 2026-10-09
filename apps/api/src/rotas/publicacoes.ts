// Publicações da vigília (GGVP-26, GGVP-34, GGVP-37, GGVP-59, GGVP-74): fila de revisão da Sênior, leitura e classificação.
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { ClassificarPublicacao, LeituraDaPublicacaoPelaIa, PublicacaoParaLer, PublicacoesDoCaso, SugestaoDePublicacao, VincularPublicacao, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, pessoa, prazo, publicacao, publicacaoReclassificacao, tarefa, usuario } from '../banco/esquema.ts'
import { feriadosDoProcesso } from '../fluxo/prazo-judicial.ts'
import { lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { casoDoCnj, pedirLeitura } from '../vigilia/casar.ts'
import { encaminhar } from '../vigilia/encaminhar.ts'
import { itensDaFila } from '../vigilia/fila.ts'
import { peritoDaPublicacao } from '../vigilia/perito.ts'

export const MSG_CNJ_SEM_CASO = 'Nenhum processo do escritório tem esse número CNJ.'

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export const MSG_IA_SEM_LEITURA = 'A IA não respondeu agora: classifique pela leitura.'

export function registrarRotasPublicacoes(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  // GGVP-26 CA7, CA10, CA12: a fila da Sênior, com a idade e o prazo mínimo de cada item.
  app.get('/api/publicacoes/fila', { preHandler: exigir(banco, 'publicacao.casar', agora) }, async () => itensDaFila(banco, agora()))

  // GGVP-26 CA8, CA9, CA11: vincular com o CNJ de um processo existente, ou registrar que não é do escritório.
  app.post<{ Params: { id: string } }>('/api/publicacoes/:id/vinculo', { preHandler: exigir(banco, 'publicacao.casar', agora) }, async (pedido, resposta) => {
    const entrada = VincularPublicacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, pedido.params.id))
    if (!p || p.fila !== 'revisao') return negar(resposta, 404, 'Esta publicação não está na fila de revisão.')
    const quem = pedido.usuario!.id
    const d = entrada.data
    if (d.decisao === 'fora_do_escritorio') {
      await banco.update(publicacao).set({ fila: null, foraDoEscritorio: true, vinculadaPor: quem, vinculadaEm: agora() }).where(eq(publicacao.id, p.id))
      await historico(quem, 'publicacao_fora_do_escritorio', pedido, `publicacao:${p.id}`)
      return resposta.code(201).send({ ok: true })
    }
    const casoId = await casoDoCnj(banco, d.numeroCnj)
    if (!casoId) return negar(resposta, 409, MSG_CNJ_SEM_CASO)
    await banco
      .update(publicacao)
      .set({ fila: null, casoId, numeroCnj: d.numeroCnj, vinculadaPor: quem, vinculadaEm: agora() })
      .where(eq(publicacao.id, p.id))
    // CA9: daqui em diante, segue como qualquer publicação casada: a advogada lê e classifica.
    await pedirLeitura(banco, casoId)
    await historico(quem, 'publicacao_vinculada', pedido, `publicacao:${p.id}`, { casoId, numeroCnj: d.numeroCnj })
    return resposta.code(201).send({ ok: true, casoId })
  })

  const nomeDe = async (id: string | null) =>
    id ? ((await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, id)))[0]?.nome ?? null) : null

  /** O prazo do encaminhamento atual; reclassificada para andamento, não tem prazo. */
  const prazoDa = async (publicacaoId: string, classe: string | null) => {
    if (classe === 'andamento') return null
    const [p] = await banco.select().from(prazo).where(eq(prazo.publicacaoId, publicacaoId)).orderBy(desc(prazo.criadoEm)).limit(1)
    return p ? { inicio: p.inicio, fim: p.fim, regra: p.regra, versao: p.regraVersao } : null
  }

  // GGVP-34 e GGVP-74 (épico IA): a IA sugere o tipo de ato, os dias escritos e um resumo. Nada classifica: só guarda a
  // classe sugerida, e quem classifica, conta o prazo e encaminha é a pessoa, na rota da classificação. Sugestão pronta
  // (07/10): a mesma função serve à rota e ao preparo, que lê em segundo plano toda publicação casada ainda sem classe.
  app.post<{ Params: { id: string } }>('/api/publicacoes/:id/sugestao', { preHandler: exigir(banco, 'publicacao.classificar', agora) }, async (pedido, resposta) => {
    return (await sugerirClasse(pedido.params.id, pedido.usuario!.id)) ?? negar(resposta, 404, 'Publicação não encontrada.')
  })
  preparo.registrar(
    async () => (await banco.select({ id: publicacao.id }).from(publicacao).where(and(isNotNull(publicacao.casoId), isNull(publicacao.classe)))).map((p) => p.id),
    (publicacaoId) => sugerirClasse(publicacaoId, null, { soPreparar: true }),
  )

  async function sugerirClasse(publicacaoId: string, quem: string | null, como: ComoSugerir = {}) {
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, publicacaoId))
    if (!p || !p.casoId) return null
    const validar = (texto: string) => LeituraDaPublicacaoPelaIa.safeParse(lerJson(texto)).success
    const s = await ia.sugerir(
      'classificar_publicacao',
      { casoId: p.casoId, quem, conteudo: p.texto, fontes: [{ tipo: 'publicacao', referencia: `publicacao:${p.id}` }] },
      { ...como, validar },
    )
    if (!s) return SugestaoDePublicacao.parse({ sugestao: null, motivo: MSG_IA_SEM_LEITURA })
    const lida = LeituraDaPublicacaoPelaIa.parse(lerJson(s.texto))
    if (p.classeSugeridaIa !== lida.classe) await banco.update(publicacao).set({ classeSugeridaIa: lida.classe }).where(eq(publicacao.id, p.id))
    return SugestaoDePublicacao.parse({ sugestao: { ...lida, chamadaId: s.chamadaId, modelo: s.modelo, alerta: s.alerta }, motivo: null })
  }

  // GGVP-74 CA4 e GGVP-34 CA3: a publicação, a classificação e o prazo contado (com a regra e a versão).
  app.get<{ Params: { id: string } }>('/api/publicacoes/:id', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, pedido.params.id))
    if (!p || !p.casoId) return negar(resposta, 404, 'Publicação não encontrada.')
    const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, p.casoId))
    return PublicacaoParaLer.parse({
      id: p.id,
      casoId: p.casoId,
      cliente: c?.nome ?? null,
      numeroCnj: p.numeroCnj,
      fonte: p.fonte,
      disponibilizadaEm: p.disponibilizadaEm,
      texto: p.texto,
      classe: p.classe,
      classificadaPor: await nomeDe(p.revisadaPor),
      classificadaEm: p.revisadaEm?.toISOString() ?? null,
      prazo: await prazoDa(p.id, p.classe),
      feriadosCadastrados: (await feriadosDoProcesso(banco, p.numeroCnj)).size > 0,
      podeClassificar: pode(pedido.perfilAtivo, 'publicacao.classificar'),
    })
  })

  // GGVP-34 CA1, CA4, CA5, CA10 e GGVP-37: a pessoa classifica (ou reclassifica); o sistema conta e encaminha.
  app.post<{ Params: { id: string } }>(
    '/api/publicacoes/:id/classificacao',
    { preHandler: exigir(banco, 'publicacao.classificar', agora) },
    async (pedido, resposta) => {
      const entrada = ClassificarPublicacao.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, pedido.params.id))
      if (!p || !p.casoId) return negar(resposta, 404, 'Publicação não encontrada.')
      const quem = pedido.usuario!.id
      const { classe, dias, vara, juiz } = entrada.data
      const contado = await banco.transaction(async (tx) => {
        if (p.classe && p.classe !== classe) await tx.insert(publicacaoReclassificacao).values({ publicacaoId: p.id, de: p.classe, para: classe, por: quem })
        await tx.update(publicacao).set({ classe, revisadaPor: quem, revisadaEm: agora() }).where(eq(publicacao.id, p.id))
        const prazoContado = await encaminhar(tx, p, classe, dias, agora())
        // GGVP-74 CA1: lidas todas as publicações do caso, "Ler publicação" sai da fila.
        const [naoLida] = await tx
          .select({ id: publicacao.id })
          .from(publicacao)
          .where(and(eq(publicacao.casoId, p.casoId!), isNull(publicacao.classe)))
          .limit(1)
        if (!naoLida)
          await tx
            .update(tarefa)
            .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
            .where(and(eq(tarefa.casoId, p.casoId!), eq(tarefa.passo, 'D3a.01'), isNull(tarefa.concluidaEm)))
        return prazoContado
      })
      await historico(quem, p.classe ? 'publicacao_reclassificada' : 'publicacao_classificada', pedido, `publicacao:${p.id}`, { de: p.classe, para: classe })
      // GGVP-59 CA1, CA6: o perito que a nomeação cita vai ao histórico do caso; sem reconhecer, a pergunta de um clique
      // da Perícia identifica, e nada trava.
      if (classe === 'nomeacao_perito') {
        const nomeado = await peritoDaPublicacao(banco, p.texto)
        await historico(quem, 'perito_nomeado', pedido, `caso:${p.casoId}`, { publicacao: p.id, perito: nomeado, reconhecido: nomeado !== null })
      }
      // GGVP-64 parte 2 (CA1): a vara e o juiz conferidos vão para o caso; campo vazio não apaga o que já estava.
      if (vara || juiz) {
        const [antes] = await banco.select({ vara: caso.vara, juiz: caso.juiz }).from(caso).where(eq(caso.id, p.casoId))
        const depois = { vara: vara ?? antes.vara, juiz: juiz ?? antes.juiz }
        await banco.update(caso).set(depois).where(eq(caso.id, p.casoId))
        await historico(quem, 'vara_e_juiz_conferidos', pedido, `caso:${p.casoId}`, { publicacao: p.id, antes, depois })
      }
      return resposta.code(201).send({ ok: true, classe, prazo: contado ? { inicio: contado.inicio, fim: contado.fim, regra: contado.regra, versao: contado.versao } : null })
    },
  )

  // GGVP-74 CA5, CA7: as publicações do processo, com a classificação, quem leu e o prazo.
  app.get<{ Params: { id: string } }>('/api/casos/:id/publicacoes', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const linhas = await banco.select().from(publicacao).where(eq(publicacao.casoId, casoId)).orderBy(desc(publicacao.disponibilizadaEm), desc(publicacao.criadoEm))
    const publicacoes = []
    for (const p of linhas)
      publicacoes.push({
        id: p.id,
        disponibilizadaEm: p.disponibilizadaEm,
        fonte: p.fonte,
        trecho: p.texto.trim().slice(0, 200),
        classe: p.classe,
        classificadaPor: await nomeDe(p.revisadaPor),
        prazo: await prazoDa(p.id, p.classe),
      })
    return PublicacoesDoCaso.parse({ casoId, cliente: c.nome, publicacoes })
  })
}
