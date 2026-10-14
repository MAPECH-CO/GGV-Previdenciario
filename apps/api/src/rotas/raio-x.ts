// GGVP-158 P7.7 (GGVP-148): o importador do Raio-X, a base histórica dos processos, como o importador de hoje. A Sênior
// simula (o relatório, sem gravar) e confirma o mesmo relatório; os processos entram no acervo com a fonte `raio_x`, uma
// vez só pelo número. A confirmação dela vale como a conferência dos desfechos: entram conferidos, e a jurimetria lê. Os
// indicadores saem da base importada, por código. Nada do arquivo vai ao registro do servidor: o histórico guarda só as
// contagens, e o erro do banco sai só com o código.
import { ConfirmacaoDaImportacao, PlanilhaDoEscritorio, TAMANHO_MAXIMO_DA_PLANILHA, type Erro } from '@ggv/contratos'
import { eq, isNotNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { processoAcervo } from '../banco/esquema.ts'
import { analisarRaioX, indicadoresDoRaioX, relatorioDoRaioX } from '../fluxo/raio-x.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { peritoPeloNome } from '../vigilia/perito.ts'

export const MSG_RAIO_X_MUDOU = 'O relatório mudou desde a simulação (a planilha ou o acervo). Simule de novo e confira.'
export const MSG_RAIO_X_SEM_NOVOS = 'Nada a gravar: nenhum processo novo.'
/** Linhas por insert: cabe no limite de parâmetros do PostgreSQL com folga. */
const POR_VEZ = 500

type Opcoes = { banco: Banco; agora?: () => Date }
type Tx = Banco | Parameters<Parameters<Banco['transaction']>[0]>[0]
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** Os números que já estão no acervo: o mesmo processo não entra duas vezes. */
const noAcervo = async (tx: Tx) =>
  new Set((await tx.select({ n: processoAcervo.numeroCnj }).from(processoAcervo).where(isNotNull(processoAcervo.numeroCnj))).flatMap((l) => l.n ?? []))

export function registrarRotasRaioX(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const daSenior = { preHandler: exigir(banco, 'acervo.conferir_desfecho', agora), bodyLimit: TAMANHO_MAXIMO_DA_PLANILHA * 2 }

  // A simulação: o relatório antes de gravar. Nada muda no banco nem no histórico.
  app.post('/api/acervo/raio-x/simulacao', daSenior, async (pedido, resposta) => {
    const entrada = PlanilhaDoEscritorio.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha a planilha.')
    return relatorioDoRaioX(analisarRaioX(entrada.data.arquivo, await noAcervo(banco)))
  })

  // A carga: só com a confirmação da Sênior e o mesmo relatório. As linhas com erro e os números já no acervo ficam de
  // fora; o perito vem pelo nome (o que não existe nasce, como na nomeação).
  app.post('/api/acervo/raio-x', daSenior, async (pedido, resposta) => {
    const entrada = ConfirmacaoDaImportacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Confira o relatório e confirme antes de gravar.')
    const quem = pedido.usuario!.id
    try {
      const feito = await banco.transaction(async (tx) => {
        const analise = analisarRaioX(entrada.data.arquivo, await noAcervo(tx))
        const r = relatorioDoRaioX(analise)
        if (r.conferido !== entrada.data.conferido) return { erro: 409, mensagem: MSG_RAIO_X_MUDOU } as const
        if (!analise.novos.length) return { erro: 400, mensagem: MSG_RAIO_X_SEM_NOVOS } as const
        const peritos = new Map<string, string>()
        for (const nome of r.peritos) peritos.set(nome, (await peritoPeloNome(tx, nome, 'medica')).id)
        const linhas = analise.novos.map(({ perito, ...p }) => ({
          ...p,
          peritoId: perito ? (peritos.get(perito) ?? null) : null,
          fonte: 'raio_x',
          desfechoConferidoPor: p.desfecho ? quem : null,
        }))
        for (let i = 0; i < linhas.length; i += POR_VEZ) await tx.insert(processoAcervo).values(linhas.slice(i, i + POR_VEZ))
        return r
      })
      if ('erro' in feito) return negar(resposta, feito.erro, feito.mensagem)
      await historico(quem, 'raio_x_importado', pedido, 'acervo', { processos: feito.processos.novos, linhasComErro: feito.erros.length, conferido: feito.conferido })
      return resposta.code(201).send({ processos: feito.processos, linhasComErro: feito.erros.length })
    } catch (e) {
      // O erro do banco traz o valor da linha: sai só o código, nunca o detalhe.
      const codigo = (e as { code?: string }).code
      pedido.log.error({ codigo }, 'Raio-X não gravou')
      return negar(resposta, codigo === '23505' ? 409 : 500, codigo === '23505' ? MSG_RAIO_X_MUDOU : 'Não deu para gravar. Nada foi gravado.')
    }
  })

  // Os indicadores do Raio-X, da base importada, cada um com o número de casos e a data da base.
  app.get('/api/acervo/raio-x', { preHandler: exigir(banco, 'resultados.ver', agora) }, async () => {
    const base = await banco
      .select({
        numeroCnj: processoAcervo.numeroCnj,
        desfecho: processoAcervo.desfecho,
        dataDecisao: processoAcervo.dataDecisao,
        falhaNossa: processoAcervo.falhaNossa,
        laudoFavoravel: processoAcervo.laudoFavoravel,
        extintoPorDeterminacao: processoAcervo.extintoPorDeterminacao,
        faltouPericia: processoAcervo.faltouPericia,
        resultadoRecurso: processoAcervo.resultadoRecurso,
        cartorioCobrou: processoAcervo.cartorioCobrou,
      })
      .from(processoAcervo)
      .where(eq(processoAcervo.fonte, 'raio_x'))
    return indicadoresDoRaioX(base.map((r) => ({ ...r, numeroCnj: r.numeroCnj ?? '', cartorioCobrou: r.cartorioCobrou as string[] | null })))
  })
}
