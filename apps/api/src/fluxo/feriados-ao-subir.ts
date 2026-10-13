// P17 do roteiro (orquestrador, 09/10): com a tabela de feriados vazia, o prazo só pula sábado e domingo. Ao subir com
// banco de verdade, a API carrega os da lei de 2026 e 2027 (os mesmos do botão da Configuração, GGVP-146 parte 3), só se
// a tabela estiver vazia: o que a Sênior tirou ou acrescentou depois nunca é refeito.
import { ANOS_DE_FERIADOS, TarefaDaCentral } from '@ggv/contratos'
import { and, gte, lte } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { eventoAuditoria, feriado } from '../banco/esquema.ts'
import { feriadosDaLei } from './feriados.ts'

/** Devolve quantos entraram (0 quando a tabela já tinha algum). A carga fica no histórico, como a do botão. */
export async function carregarFeriadosSeVazio(banco: Banco, agora: Date): Promise<number> {
  const [algum] = await banco.select({ id: feriado.id }).from(feriado).limit(1)
  if (algum) return 0
  const novos = ANOS_DE_FERIADOS.flatMap((ano) => feriadosDaLei(ano))
  await banco.transaction(async (tx) => {
    await tx.insert(feriado).values(novos)
    await tx.insert(eventoAuditoria).values({
      quem: 'sistema',
      acao: 'feriados_carregados',
      alvo: 'feriados',
      quando: agora,
      detalhe: { anos: [...ANOS_DE_FERIADOS], acrescentados: novos.length, origem: 'inicio_do_servidor' },
    })
  })
  return novos.length
}

/**
 * GGVP-158 P5.11: o ano sem feriado nenhum na tabela vira tarefa da Sênior: o corrente, urgente (o prazo dele já conta só
 * sábado e domingo, o lado seguro, mas sem o resto); o seguinte, a partir de dezembro. A carga da lei aceita o ano.
 */
export async function anosSemFeriados(banco: Banco, hoje: string): Promise<TarefaDaCentral[]> {
  // A tabela vazia é a carga ao subir (acima); aqui, só o ano que falta numa lista que o escritório já usa.
  const [qualquer] = await banco.select({ id: feriado.id }).from(feriado).limit(1)
  if (!qualquer) return []
  const ano = Number(hoje.slice(0, 4))
  const anos = hoje.slice(5, 7) === '12' ? [ano, ano + 1] : [ano]
  const faltam: TarefaDaCentral[] = []
  for (const a of anos) {
    const [algum] = await banco
      .select({ id: feriado.id })
      .from(feriado)
      .where(and(gte(feriado.data, `${a}-01-01`), lte(feriado.data, `${a}-12-31`)))
      .limit(1)
    if (algum) continue
    faltam.push(
      TarefaDaCentral.parse({
        id: `00000000-0000-4000-8000-00000000${a}`,
        casoId: null,
        passo: null,
        cliente: null,
        contexto: 'Configuração',
        titulo: `Carregar os feriados de ${a}`,
        detalhe: `Sem os feriados de ${a}, o prazo pula só sábado e domingo. A carga da lei fica na Configuração.`,
        tela: '/configuracao',
        prazo: a === ano ? hoje : `${a}-01-01`,
        urgente: a === ano,
      }),
    )
  }
  return faltam
}
