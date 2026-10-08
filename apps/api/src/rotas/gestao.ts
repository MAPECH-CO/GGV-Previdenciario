// Tentativas bloqueadas (GGVP-109 CA9): as recusas de portão e as ações fora do perfil, das mais recentes, para a gestão.
// Resultados (GGVP-75): o painel de resultado para os sócios.
import { PainelDeResultados, PedidoDoPainel, TentativasBloqueadas, pode, type Erro, type PortaoDeBloqueio } from '@ggv/contratos'
import { desc, eq, inArray, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { painelDeResultados } from '../fluxo/resultados.ts'
import { exigir } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'

/** Portão e passo → o que a pessoa tentou, em palavras da equipe. */
const DESCRICAO: Record<string, string> = {
  'G1:D2.01': 'Aprovar para o INSS com o checklist incompleto (G1)',
  'G17:D2.01': 'Aprovar para o INSS sem parecer médico "Suficiente" (G17)',
  'G2:D2.02': 'Protocolar no INSS sem o OK da Sênior (G2)',
  'G21:D2.05': 'Responder a exigência do INSS sem prova em todos os itens (G21)',
  'setores:D3.05': 'Pedir a petição antes de todos os setores subirem o card',
  'G7:D3.07': 'Protocolar na Justiça com trava falhando ou pacote alterado (G7)',
  'G6:D3a.04': 'Protocolar a manifestação sem a versão aprovada (G6)',
  'G21:D3a.04': 'Manifestar no processo sem prova em todos os itens (G21)',
  'G8:D3b.03': 'Avisar o cliente antes do OK da advogada na prestação de contas (G8)',
  'funcoes:D2.06r': 'Registrar o recebimento da prestação em que deu o OK (separação de funções: quem dá o OK não recebe)',
}
/** Um id do banco no formato uuid, antes de ir à consulta (texto fora do formato faz o PostgreSQL falhar). */
export const UUID = /^[0-9a-f-]{36}$/
type Detalhe = { portao?: PortaoDeBloqueio; passo?: string; perfil?: string | null; acao?: string; casoId?: string }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasGestao(app: FastifyInstance, { banco, agora = () => new Date() }: { banco: Banco; agora?: () => Date }) {
  app.get('/api/gestao/tentativas', { preHandler: exigir(banco, 'gestao.ver', agora) }, async () => {
    // ponytail: as 200 mais recentes; paginação quando a gestão pedir.
    const eventos = await banco
      .select()
      .from(eventoAuditoria)
      .where(or(eq(eventoAuditoria.acao, 'acesso_negado'), sql`${eventoAuditoria.detalhe}->>'portao' is not null`))
      .orderBy(desc(eventoAuditoria.quando))
      .limit(200)
    const casoDe = (e: (typeof eventos)[number]) => {
      const id = e.alvo.startsWith('caso:') ? e.alvo.slice(5) : (e.detalhe as Detalhe).casoId
      return id && UUID.test(id) ? id : null
    }
    const quemIds = [...new Set(eventos.map((e) => e.quem).filter((q) => UUID.test(q)))]
    const casoIds = [...new Set(eventos.map(casoDe).filter((c): c is string => c !== null))]
    const nomes = new Map(
      (quemIds.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, quemIds)) : []).map((u) => [u.id, u.nome]),
    )
    const clientes = new Map(
      (casoIds.length
        ? await banco.select({ id: caso.id, nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(inArray(caso.id, casoIds))
        : []
      ).map((c) => [c.id, c.nome]),
    )
    return TentativasBloqueadas.parse({
      tentativas: eventos.map((e) => {
        const d = e.detalhe as Detalhe
        const casoId = casoDe(e)
        const portao = d.portao ?? 'perfil'
        return {
          quando: e.quando.toISOString(),
          quem: nomes.get(e.quem) ?? 'Sem sessão',
          perfil: d.perfil ?? null,
          casoId,
          cliente: casoId ? (clientes.get(casoId) ?? null) : null,
          portao,
          descricao: e.acao === 'acesso_negado' ? `Ação fora do perfil (${d.acao})` : (DESCRICAO[`${portao}:${d.passo}`] ?? `Portão ${portao}`),
        }
      }),
    })
  })

  // GGVP-75: o período padrão é o ano até hoje, em Brasília. Os totais em dinheiro só vão para quem tem
  // `valores.ver_totais` (CA4); para os outros perfis o servidor manda `totais` nulo.
  app.get('/api/gestao/resultados', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido, resposta) => {
    const entrada = PedidoDoPainel.safeParse(pedido.query)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o período.')
    const hoje = hojeEmBrasilia(agora())
    // A data da base (G22) é o fim do período; depois de hoje não há dado, então o fim vai no máximo até hoje.
    const ate = entrada.data.ate && entrada.data.ate < hoje ? entrada.data.ate : hoje
    const { de = `${hoje.slice(0, 4)}-01-01`, recorte = null } = entrada.data
    if (de > ate) return negar(resposta, 400, 'A data inicial vem antes da final.')
    return PainelDeResultados.parse(await painelDeResultados(banco, { de, ate, recorte, verTotais: pode(pedido.perfilAtivo, 'valores.ver_totais') }))
  })
}
