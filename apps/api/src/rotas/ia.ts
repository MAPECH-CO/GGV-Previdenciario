// Auditoria das chamadas à IA de um caso (GGVP-106 CA4). A saída pode ter dado de saúde: só o Jurídico a vê, e cada
// leitura fica em `acesso_dado_sensivel` (GGVP-96 CA13).
import { desc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { ChamadasDaIa, pode, type FonteDaIa } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, chamadaIa, usuario } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'

export function registrarRotasIa(app: FastifyInstance, { banco, agora = () => new Date() }: { banco: Banco; agora?: () => Date }) {
  app.get<{ Params: { id: string } }>('/api/casos/:id/ia', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido) => {
    const casoId = pedido.params.id
    const linhas = await banco
      .select({ c: chamadaIa, quem: usuario.nome })
      .from(chamadaIa)
      .leftJoin(usuario, eq(chamadaIa.pedidaPor, usuario.id))
      .where(eq(chamadaIa.casoId, casoId))
      .orderBy(desc(chamadaIa.quando))
    const veSaida = pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')
    // O trecho das fontes pode trazer texto de laudo: segue a mesma regra da saída.
    const fontes = (c: (typeof linhas)[number]['c']) =>
      veSaida ? (c.fontes as FonteDaIa[]) : (c.fontes as FonteDaIa[]).map(({ tipo, referencia }) => ({ tipo, referencia }))
    const lidas = linhas.filter((l) => veSaida && (l.c.saida !== null || (l.c.fontes as FonteDaIa[]).some((f) => f.trecho)))
    if (lidas.length)
      await banco.insert(acessoDadoSensivel).values(
        lidas.map((l) => ({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, casoId, recurso: `chamada_ia:${l.c.id}`, quando: agora() })),
      )
    return ChamadasDaIa.parse({
      chamadas: linhas.map(({ c, quem }) => ({
        id: c.id,
        finalidade: c.finalidade,
        fornecedor: c.fornecedor,
        modelo: c.modelo,
        situacao: c.situacao,
        quem,
        quando: c.quando.toISOString(),
        fontes: fontes(c),
        saida: veSaida ? c.saida : null,
        alerta: c.alerta,
      })),
    })
  })
}
