// Esperas vencidas (GGVP-105 CA8, G15): uma vez por dia, a tarefa de laço (cobrança, contato ou remarcação: a que tem
// limite de tentativas) com o prazo vencido sem contato conta a tentativa "sem resposta até o prazo" e ganha o prazo do
// próximo lembrete, pelo intervalo da configuração. No limite, sobe uma vez: para a Sênior, ou, na perícia, para a
// advogada. A tarefa continua com o setor, como no laço que a pessoa registra (exigências do INSS e do juiz).
import { and, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { tarefa, tentativa } from '../banco/esquema.ts'
import { lembreteDoLaco } from './exigencia.ts'

export const RESULTADO_VENCIDA = 'sem resposta até o prazo'

const hojeEmBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

/** Uma rodada: devolve quantas tarefas de laço estavam vencidas. */
export async function vencerEsperas(banco: Banco, agora: Date) {
  const hoje = hojeEmBrasilia(agora)
  const vencidas = await banco
    .select()
    .from(tarefa)
    .where(
      and(
        isNotNull(tarefa.limiteTentativas),
        isNull(tarefa.concluidaEm),
        isNull(tarefa.escaladaEm),
        inArray(tarefa.situacao, ['aberta', 'em_andamento', 'aguardando']),
        lt(tarefa.prazo, hoje),
      ),
    )
  for (const t of vencidas) {
    const tentativas = t.tentativas + 1
    const limite = t.limiteTentativas!
    const sobe = tentativas >= limite
    const para = t.passo?.startsWith('DP.') ? 'advogada' : 'senior'
    const prazo = (await lembreteDoLaco(banco, hoje, null, Math.max(1, limite - tentativas))) ?? t.prazo
    await banco.transaction(async (tx) => {
      await tx.insert(tentativa).values({ tarefaId: t.id, quando: agora, canal: 'sistema', resultado: RESULTADO_VENCIDA })
      await tx
        .update(tarefa)
        .set({ tentativas, prazo, ...(sobe ? { escaladaEm: agora, escaladaPara: para } : {}) })
        .where(eq(tarefa.id, t.id))
      if (sobe) await tx.insert(tarefa).values({ casoId: t.casoId, passo: t.passo, titulo: `Laço sem retorno: ${t.titulo}`, perfilDono: para, criadoEm: agora })
    })
  }
  return vencidas.length
}
