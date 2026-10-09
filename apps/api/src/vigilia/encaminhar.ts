// Encaminhar pelo tipo de ato (GGVP-37): exigência vai para a análise da advogada (D3a), mérito para "Confirmar
// desfecho" (antes do D3b, GGVP-90), nomeação de perito para os quesitos (GGVP-59) e só andamento fica registrado. O
// prazo é contado em código (GGVP-34).
import type { CLASSES_DE_ATO } from '@ggv/contratos'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { etapa, prazo, publicacao, tarefa } from '../banco/esquema.ts'
import { feriadosDoProcesso, prazoJudicial } from '../fluxo/prazo-judicial.ts'

type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]
type Classe = (typeof CLASSES_DE_ATO)[number]
type Publicacao = typeof publicacao.$inferSelect

const DESTINO = {
  exigencia: { diagrama: 'D3a', passo: 'D3a.02', titulo: 'Analisar exigência do juiz' },
  merito: { diagrama: 'D4', passo: 'D4.02', titulo: 'Confirmar desfecho' },
  // GGVP-59 CA1: com o perito nomeado, quesitos, assistente técnico e impugnação (CPC, art. 465, §1º).
  nomeacao_perito: { diagrama: 'DP', passo: 'DP.05', titulo: 'Quesitos e assistente técnico' },
} as const

/**
 * Conta o prazo e abre a tarefa do destino. A tarefa guarda o prazo (`prazo_processual_id`), e o prazo guarda a
 * publicação: é assim que a reclassificação acha o que desfazer (CA7). Devolve o prazo contado, ou nulo no andamento.
 */
export async function encaminhar(tx: Tx, pub: Publicacao, classe: Classe, dias: number | null, agora: Date) {
  // CA7: o encaminhamento anterior desta publicação, se a tarefa ainda está aberta, é cancelado.
  const anteriores = await tx.select({ id: prazo.id }).from(prazo).where(eq(prazo.publicacaoId, pub.id))
  if (anteriores.length)
    await tx
      .update(tarefa)
      .set({ situacao: 'cancelada', concluidaEm: agora })
      .where(and(inArray(tarefa.prazoProcessualId, anteriores.map((a) => a.id)), isNull(tarefa.concluidaEm)))
  // CA3: só andamento fica registrado, sem tarefa.
  if (classe === 'andamento' || !pub.casoId || dias === null) return null
  const contado = prazoJudicial(pub.disponibilizadaEm, dias, await feriadosDoProcesso(tx, pub.numeroCnj))
  const [p] = await tx
    .insert(prazo)
    .values({ casoId: pub.casoId, origem: `publicacao_${classe}`, publicacaoId: pub.id, inicio: contado.inicio, fim: contado.fim, regra: contado.regra, regraVersao: contado.versao })
    .returning()
  const destino = DESTINO[classe]
  // CA1, CA2, CA4, CA5: a tarefa da advogada com o prazo, e o caso entra no trecho certo do fluxo.
  await tx.insert(etapa).values({ casoId: pub.casoId, diagrama: destino.diagrama, passo: destino.passo, situacao: 'aberta', iniciadaEm: agora })
  await tx.insert(tarefa).values({ casoId: pub.casoId, passo: destino.passo, titulo: destino.titulo, perfilDono: 'advogada', prazo: contado.fim, prazoProcessualId: p.id })
  return contado
}
