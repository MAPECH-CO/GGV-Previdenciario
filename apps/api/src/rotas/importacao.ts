// O importador da planilha do escritório (GGVP-146, parte 2). A simulação mostra o relatório e não grava nada; a
// gravação repete a análise sobre o banco e só grava se o relatório for o mesmo que a pessoa conferiu. Quem importa é a
// gestão do escritório (a mesma permissão de mudar a configuração). Nenhum dado de cliente vai ao registro do servidor:
// o histórico guarda só as contagens, e o erro do banco sai só com o código.
import { createHash } from 'node:crypto'
import { ConfirmacaoDaImportacao, PlanilhaDoEscritorio, RelatorioDaImportacao, TAMANHO_MAXIMO_DA_PLANILHA, type Erro } from '@ggv/contratos'
import { inArray, isNotNull, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, pessoa } from '../banco/esquema.ts'
import { analisarPlanilha, type Analise, type NoPortal } from '../fluxo/importacao.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_RELATORIO_MUDOU = 'O relatório mudou desde a simulação (a planilha ou o portal). Simule de novo e confira.'
export const MSG_NADA_A_GRAVAR = 'Nada a gravar: nenhum cliente ou processo novo.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
/** Cabe a planilha no limite do contrato, com folga para o JSON. */
const LIMITE = { bodyLimit: TAMANHO_MAXIMO_DA_PLANILHA * 2 }

/** Os CPFs, os números de processo e os casos em andamento que já estão no portal. */
async function lerPortal(banco: Banco): Promise<NoPortal> {
  const pessoas = await banco.select({ id: pessoa.id, nome: pessoa.nome, cpf: pessoa.cpf }).from(pessoa).where(isNotNull(pessoa.cpf))
  const numeros = await banco.select({ tipo: identificadorCaso.tipo, valor: identificadorCaso.valor }).from(identificadorCaso).where(inArray(identificadorCaso.tipo, ['nb', 'cnj']))
  const abertos = await banco.select({ pessoaId: caso.pessoaId, beneficio: caso.beneficio }).from(caso).where(ne(caso.fase, 'encerrado'))
  return {
    pessoas: new Map(pessoas.map((p) => [p.cpf!, { id: p.id, nome: p.nome }])),
    numeros: new Set(numeros.map((n) => `${n.tipo}:${n.valor}`)),
    casosAbertos: new Set(abertos.map((c) => `${c.pessoaId}:${c.beneficio}`)),
  }
}

/** O relatório que a tela mostra, com a marca do que foi conferido: o plano inteiro, com o que seria gravado. */
function relatorio({ linhas, erros, colunasIgnoradas }: Analise): RelatorioDaImportacao {
  const conferido = createHash('sha256').update(JSON.stringify({ linhas, erros })).digest('hex')
  const contar = (cliente: 'novo' | 'ja-cadastrado') => new Set(linhas.filter((l) => l.cliente === cliente).map((l) => l.pessoa.cpf)).size
  return RelatorioDaImportacao.parse({
    conferido,
    clientes: { novos: contar('novo'), jaCadastrados: contar('ja-cadastrado') },
    processos: { novos: linhas.filter((l) => l.processo === 'novo').length, jaCadastrados: linhas.filter((l) => l.processo === 'ja-cadastrado').length },
    // O parse tira das linhas o que só a gravação usa (os dados da pessoa e do caso).
    linhas,
    erros,
    colunasIgnoradas,
  })
}

export function registrarRotasImportacao(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const gestao = { preHandler: exigir(banco, 'configuracao.editar', agora), ...LIMITE }

  // Simulação: o relatório antes de gravar. Nada muda no banco nem no histórico.
  app.post('/api/importacao/simulacao', gestao, async (pedido, resposta) => {
    const entrada = PlanilhaDoEscritorio.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha a planilha.')
    return relatorio(analisarPlanilha(entrada.data.arquivo, await lerPortal(banco)))
  })

  // Gravação: só com a confirmação da pessoa e o mesmo relatório. As linhas com erro ficam de fora; o cliente que já
  // existe pelo CPF não muda, e o processo entra na ficha dele.
  app.post('/api/importacao', gestao, async (pedido, resposta) => {
    const entrada = ConfirmacaoDaImportacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Confira o relatório e confirme antes de gravar.')
    try {
      const feito = await banco.transaction(async (tx) => {
        const portal = await lerPortal(tx)
        const analise = analisarPlanilha(entrada.data.arquivo, portal)
        const r = relatorio(analise)
        if (r.conferido !== entrada.data.conferido) return { erro: 409, mensagem: MSG_RELATORIO_MUDOU } as const
        if (r.clientes.novos + r.processos.novos === 0) return { erro: 400, mensagem: MSG_NADA_A_GRAVAR } as const
        const ids = new Map<string, string>()
        for (const l of analise.linhas) {
          if (l.cliente !== 'novo' || ids.has(l.pessoa.cpf)) continue
          const [p] = await tx.insert(pessoa).values({ ...l.pessoa, situacao: 'cliente', origem: 'importacao' }).returning({ id: pessoa.id })
          ids.set(l.pessoa.cpf, p.id)
        }
        for (const l of analise.linhas) {
          if (l.processo !== 'novo' || !l.caso) continue
          const pessoaId = ids.get(l.pessoa.cpf) ?? portal.pessoas.get(l.pessoa.cpf)!.id
          const [c] = await tx.insert(caso).values({ pessoaId, beneficio: l.caso.beneficio, fase: l.caso.fase }).returning({ id: caso.id })
          const { nb, cnj } = l.caso
          const numeros = [...(nb ? [{ casoId: c.id, tipo: 'nb', valor: nb }] : []), ...(cnj ? [{ casoId: c.id, tipo: 'cnj', valor: cnj }] : [])]
          if (numeros.length > 0) await tx.insert(identificadorCaso).values(numeros)
        }
        return r
      })
      if ('erro' in feito) return negar(resposta, feito.erro, feito.mensagem)
      await historico(pedido.usuario!.id, 'importacao_gravada', pedido, 'importacao', {
        clientes: feito.clientes.novos,
        processos: feito.processos.novos,
        linhasComErro: feito.erros.length,
        conferido: feito.conferido,
      })
      return { clientes: feito.clientes, processos: feito.processos, linhasComErro: feito.erros.length }
    } catch (e) {
      // O erro do banco traz o valor da linha (o CPF, por exemplo): sai só o código, nunca o detalhe.
      const codigo = (e as { code?: string }).code
      pedido.log.error({ codigo }, 'importação não gravou')
      return negar(resposta, codigo === '23505' ? 409 : 500, codigo === '23505' ? MSG_RELATORIO_MUDOU : 'Não deu para gravar. Nada foi gravado.')
    }
  })
}
