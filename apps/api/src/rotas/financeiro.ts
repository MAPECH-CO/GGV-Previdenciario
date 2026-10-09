// Painel Financeiro (GGVP-78; Figma "Financeiro · painel" 1930:4): os números saem das prestações de contas gravadas
// (GGVP-44, GGVP-98), calculados em código (`montarPainelFinanceiro`, nos contratos). Quem vê os totais em dinheiro
// (`valores.ver_totais`: Financeiro e Sócio) abre o painel; as linhas de cada cliente vão só a quem vê valores
// (`valores.ver`). O que o banco não guarda (mensalidades, RPV, precatório), o painel não mostra.
// ponytail: lê todas as prestações e soma aqui; passar a soma para o SQL quando forem milhares.
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { formatarCnj, formatarNb } from '@ggv/campos'
import { Mes, PainelFinanceiro, ROTULO_BENEFICIO, montarPainelFinanceiro, pode, type Beneficio, type Erro, type LinhaDoFinanceiro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, pessoa, prestacaoContas, tarefa, usuario } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasFinanceiro(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  app.get<{ Querystring: { mes?: string } }>('/api/financeiro', { preHandler: exigir(banco, 'valores.ver_totais', agora) }, async (pedido, resposta) => {
    const hoje = hojeEmBrasilia(agora())
    const mes = Mes.safeParse(pedido.query.mes ?? hoje.slice(0, 7))
    if (!mes.success) return resposta.code(400).send({ erro: 'Mês inválido.' } satisfies Erro)

    // A versão atual de cada prestação: a maior.
    const atual = new Map<string, typeof prestacaoContas.$inferSelect>()
    for (const v of await banco.select().from(prestacaoContas).orderBy(desc(prestacaoContas.versao))) if (!atual.has(v.casoId)) atual.set(v.casoId, v)
    // Esperando o OK da advogada (G8): "Prestar contas" ou "Corrigir a prestação" aberta.
    const esperandoOk = new Set(
      (
        await banco
          .select({ casoId: tarefa.casoId })
          .from(tarefa)
          .where(and(eq(tarefa.passo, 'D2.06'), eq(tarefa.perfilDono, 'advogada'), isNull(tarefa.concluidaEm), inArray(tarefa.situacao, ['aberta', 'em_andamento', 'aguardando'])))
      ).map((t) => t.casoId),
    )
    const ids = [...new Set([...atual.keys(), ...esperandoOk])]
    const casos = ids.length
      ? await banco
          .select({ id: caso.id, cliente: pessoa.nome, beneficio: caso.beneficio, fase: caso.fase, desfecho: caso.desfecho, advogadaId: caso.advogadaResponsavelId })
          .from(caso)
          .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
          .where(inArray(caso.id, ids))
      : []
    const numeros = ids.length ? await banco.select().from(identificadorCaso).where(inArray(identificadorCaso.casoId, ids)) : []
    const pessoas = [...new Set([...casos.map((c) => c.advogadaId), ...[...atual.values()].flatMap((v) => [v.okAdvogadaPor, v.recebidaPor])].filter((u): u is string => !!u))]
    const nomes = new Map(pessoas.length ? (await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, pessoas))).map((u) => [u.id, u.nome]) : [])
    const nome = (id: string | null | undefined) => (id ? nomes.get(id) : undefined)

    const linhas = casos.map((c): LinhaDoFinanceiro => {
      const v = atual.get(c.id)
      const doCaso = (tipo: string) => numeros.find((n) => n.casoId === c.id && n.tipo === tipo)?.valor
      const [cnj, nb] = [doCaso('cnj'), doCaso('nb')]
      // A divergência volta à advogada (GGVP-44 CA9): a linha espera o OK de novo.
      const aguardandoOk = esperandoOk.has(c.id) || Boolean(v?.divergencia)
      const advogada = nome(c.advogadaId) ?? nome(v?.okAdvogadaPor)
      const financeiro = nome(v?.recebidaPor)
      return {
        casoId: c.id,
        cliente: c.cliente,
        beneficio: c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : null,
        processo: cnj ? formatarCnj(cnj) : nb ? `INSS · ${formatarNb(nb)}` : null,
        origem: c.fase === 'judicial' || c.desfecho?.startsWith('procedente') ? 'justica' : 'inss',
        valor: v?.honorarios ?? null,
        vencimento: v?.prazoPagamento ?? null,
        recebidoEm: v?.recebidaEm ? hojeEmBrasilia(v.recebidaEm) : null,
        responsavel: aguardandoOk ? (advogada ? `Advogada · ${advogada}` : 'Advogada') : financeiro ? `Financeiro · ${financeiro}` : 'Financeiro',
        aguardandoOk,
      }
    })
    return PainelFinanceiro.parse(montarPainelFinanceiro(linhas, mes.data, hoje, pode(pedido.perfilAtivo, 'valores.ver')))
  })
}
