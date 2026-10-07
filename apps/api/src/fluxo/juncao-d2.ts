// Junção do D2 (GGVP-27 CA2, GGVP-31 CA3 e CA7): "protocolo feito E perícia resolvida (ou sem perícia)".
// Chamada depois do protocolo, da decisão de perícia e do resultado da perícia. Fechou: o caso entra na vigília
// (etapa D2.04, esperando o INSS, e a tarefa "Trazer a resposta do INSS"). Idempotente: chamar de novo não abre outra.
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { etapa, pericia, requerimentoInss, tarefa } from '../banco/esquema.ts'

export type EstadoJuncao = { protocolo: boolean; pericia: 'sem_decisao' | 'sem_pericia' | 'pendente' | 'resolvida'; fechou: boolean }

export async function estadoDaJuncaoD2(banco: Banco, casoId: string): Promise<EstadoJuncao> {
  const [protocolo] = await banco.select({ id: requerimentoInss.id }).from(requerimentoInss).where(eq(requerimentoInss.casoId, casoId)).limit(1)
  const [decisao] = await banco
    .select()
    .from(etapa)
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.03'), eq(etapa.situacao, 'concluida')))
    .orderBy(desc(etapa.concluidaEm))
    .limit(1)

  let situacaoPericia: EstadoJuncao['pericia'] = 'sem_decisao'
  if (decisao) {
    const chamadas = await banco.select({ resultado: pericia.resultado }).from(pericia).where(eq(pericia.chamadaPorEtapaId, decisao.id))
    situacaoPericia = chamadas.length === 0 ? 'sem_pericia' : chamadas.every((p) => p.resultado !== null) ? 'resolvida' : 'pendente'
  }
  const fechou = Boolean(protocolo) && (situacaoPericia === 'sem_pericia' || situacaoPericia === 'resolvida')
  return { protocolo: Boolean(protocolo), pericia: situacaoPericia, fechou }
}

/** Fecha a junção se der: abre a vigília (D2.04) e encerra a espera do protocolo (D2.E1). */
export async function avancarJuncaoD2(banco: Banco, casoId: string, agora = new Date()): Promise<EstadoJuncao> {
  const estado = await estadoDaJuncaoD2(banco, casoId)
  if (!estado.fechou) return estado
  const [jaNaVigilia] = await banco.select({ id: etapa.id }).from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.04'))).limit(1)
  if (jaNaVigilia) return estado
  await banco
    .update(etapa)
    .set({ situacao: 'concluida', concluidaEm: agora })
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.E1'), isNull(etapa.concluidaEm)))
  await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: agora })
  // GGVP-35 CA1: a vigília é manual; a tarefa fica na fila do Jurídico até alguém registrar a decisão do INSS.
  await banco.insert(tarefa).values({ casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  return estado
}
