// Tarefas do setor (GGVP-147): o líder do Atendimento e a Sênior, líder do Jurídico, veem todas as tarefas abertas do
// setor e escolhem quem faz cada uma; quem recebe vê a tarefa em "Minhas tarefas". A atribuição vale no servidor.
import { arrayOverlaps, eq, inArray } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  AtribuirTarefa,
  MinhasDoSetor,
  PERFIS_DO_SETOR,
  QuadroDoSetor,
  ROTULO_PERFIL,
  setorDoPerfil,
  type Erro,
  type Perfil,
  type Setor,
  type TarefaDoSetor,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { atribuicaoTarefa, usuario } from '../banco/esquema.ts'
import type { TarefasPorArea } from '../fluxo/tarefasPorArea.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

type Opcoes = { banco: Banco; agora?: () => Date; tarefasPorArea: TarefasPorArea }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
export const MSG_FORA_DO_SETOR = 'Escolha uma pessoa do seu setor.'
const prazoDaTela = (iso: string) => `até ${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function registrarRotasSetor(app: FastifyInstance, { banco, agora = () => new Date(), tarefasPorArea }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  /** Quem é do setor: os usuários com algum perfil dele. */
  const pessoasDo = (setor: Setor) =>
    banco
      .select({ id: usuario.id, nome: usuario.nome, perfis: usuario.perfis })
      .from(usuario)
      .where(arrayOverlaps(usuario.perfis, [...PERFIS_DO_SETOR[setor]]))

  /** Todas as tarefas abertas do setor, de todas as áreas, uma vez cada, com quem faz. Sem responsável e urgentes no topo. */
  async function tarefasDo(setor: Setor): Promise<TarefaDoSetor[]> {
    const vistas = new Map<string, Awaited<ReturnType<TarefasPorArea['doPerfil']>>[number]>()
    for (const perfil of PERFIS_DO_SETOR[setor]) for (const t of await tarefasPorArea.doPerfil(perfil)) if (!t.concluida && !vistas.has(t.id)) vistas.set(t.id, t)
    const ids = [...vistas.keys()]
    const atribuicoes = ids.length
      ? await banco
          .select({ a: atribuicaoTarefa, nome: usuario.nome })
          .from(atribuicaoTarefa)
          .leftJoin(usuario, eq(atribuicaoTarefa.responsavelId, usuario.id))
          .where(inArray(atribuicaoTarefa.tarefaId, ids))
      : []
    const porTarefa = new Map(atribuicoes.map((l) => [l.a.tarefaId, l]))
    const nomes = new Map((await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario)).map((u) => [u.id, u.nome]))
    const lista = [...vistas.values()].map((t): TarefaDoSetor => {
      const l = porTarefa.get(t.id)
      const a = l?.a
      return {
        id: t.id,
        codigo: t.codigo,
        cliente: t.cliente ? { id: t.cliente.id, nome: t.cliente.nome } : null,
        contexto: t.contexto ?? null,
        acao: t.acao,
        detalhe: t.detalhe,
        // O prazo que o líder deu na atribuição vale no lugar do da tarefa.
        prazo: a?.prazo ? prazoDaTela(a.prazo) : (t.prazo ?? null),
        urgente: Boolean(t.urgente) || a?.prioridade === 'alta',
        href: t.href ?? null,
        responsavel: a?.responsavelId && l?.nome ? { id: a.responsavelId, nome: l.nome } : null,
        prioridade: (a?.prioridade as TarefaDoSetor['prioridade']) ?? null,
        recado: a?.avisar ? (a.recado ?? null) : null,
        atribuidaPor: a?.avisar ? (nomes.get(a.atribuidaPor) ?? null) : null,
      }
    })
    // G15: sem responsável ou com o prazo estourado, primeiro.
    return lista.sort((x, y) => Number(Boolean(y.urgente) || !y.responsavel) - Number(Boolean(x.urgente) || !x.responsavel))
  }

  // CA1, CA3: só o líder (a matriz dá `tarefa.atribuir` ao líder do Atendimento e à Sênior); o setor vem do perfil da sessão.
  app.get('/api/setor', { preHandler: exigir(banco, 'tarefa.atribuir', agora) }, async (pedido, resposta) => {
    const setor = setorDoPerfil(pedido.perfilAtivo)
    if (!setor) return negar(resposta, 403, MSG_FORA_DO_SETOR)
    const tarefas = await tarefasDo(setor)
    const pessoas = (await pessoasDo(setor)).map((p) => ({
      id: p.id,
      nome: p.nome,
      funcao: p.perfis
        .filter((x) => (PERFIS_DO_SETOR[setor] as readonly string[]).includes(x))
        .map((x) => ROTULO_PERFIL[x as Perfil])
        .join(', '),
      carga: tarefas.filter((t) => t.responsavel?.id === p.id).length,
    }))
    return QuadroDoSetor.parse({ setor, pessoas, tarefas })
  })

  // CA2, CA3, CA4: atribuir (ou deixar sem responsável) grava no servidor, e o histórico guarda quem, para quem e quando.
  app.post('/api/setor/atribuicoes', { preHandler: exigir(banco, 'tarefa.atribuir', agora) }, async (pedido, resposta) => {
    const entrada = AtribuirTarefa.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira a atribuição.')
    const setor = setorDoPerfil(pedido.perfilAtivo)
    if (!setor) return negar(resposta, 403, MSG_FORA_DO_SETOR)
    const { tarefaId, responsavelId, prazo, prioridade, recado, avisar } = entrada.data
    if (!(await tarefasDo(setor)).some((t) => t.id === tarefaId)) return negar(resposta, 404, 'Esta tarefa não está aberta no seu setor.')
    if (responsavelId && !(await pessoasDo(setor)).some((p) => p.id === responsavelId)) return negar(resposta, 400, MSG_FORA_DO_SETOR)
    const quem = pedido.usuario!.id
    const linha = { responsavelId, prazo: prazo ?? null, prioridade, recado: recado || null, avisar, atribuidaPor: quem, atribuidaEm: agora() }
    await banco
      .insert(atribuicaoTarefa)
      .values({ tarefaId, ...linha })
      .onConflictDoUpdate({ target: atribuicaoTarefa.tarefaId, set: linha })
    await historico(quem, 'tarefa_atribuida', pedido, `tarefa:${tarefaId}`, { para: responsavelId })
    return resposta.code(201).send({ ok: true })
  })

  // "Minhas tarefas" de quem é do setor: o que o líder deu a ela e o que deu a outra pessoa (sai da fila dela).
  app.get('/api/setor/minhas', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido) => {
    const setor = setorDoPerfil(pedido.perfilAtivo)
    if (!setor) return MinhasDoSetor.parse({ minhas: [], deOutros: [] })
    const eu = pedido.usuario!.id
    const tarefas = await tarefasDo(setor)
    return MinhasDoSetor.parse({
      minhas: tarefas.filter((t) => t.responsavel?.id === eu),
      deOutros: tarefas.filter((t) => t.responsavel && t.responsavel.id !== eu).map((t) => t.id),
    })
  })
}
