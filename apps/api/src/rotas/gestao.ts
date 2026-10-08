// Tentativas bloqueadas (GGVP-109 CA9): as recusas de portão e as ações fora do perfil, das mais recentes, para a gestão.
import { TentativasBloqueadas, type PortaoDeBloqueio } from '@ggv/contratos'
import { desc, eq, inArray, or, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'

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
}
const UUID = /^[0-9a-f-]{36}$/
type Detalhe = { portao?: PortaoDeBloqueio; passo?: string; perfil?: string | null; acao?: string; casoId?: string }

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
}
