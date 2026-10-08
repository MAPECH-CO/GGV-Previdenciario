// Fila de revisão da Sênior (GGVP-26 CA7, CA10, CA12): publicações sem CNJ ou com CNJ desconhecido, com a idade e o
// prazo mínimo que pode estar correndo (5 dias úteis a partir da publicação, contados pelo lado seguro).
import { PRAZO_SEM_DIAS_NA_DECISAO, type ItemDaFila } from '@ggv/contratos'
import { and, asc, eq } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { publicacao } from '../banco/esquema.ts'
import { feriadosDoProcesso, prazoJudicial } from '../fluxo/prazo-judicial.ts'
import { diasUteisAte } from '../fluxo/prazo-inss.ts'

const UM_DIA = 86_400_000
export const hojeEmBrasilia = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

export async function itensDaFila(banco: Banco, agora: Date): Promise<ItemDaFila[]> {
  const hoje = hojeEmBrasilia(agora)
  const linhas = await banco
    .select()
    .from(publicacao)
    .where(and(eq(publicacao.fila, 'revisao'), eq(publicacao.foraDoEscritorio, false)))
    .orderBy(asc(publicacao.disponibilizadaEm))
  const itens: ItemDaFila[] = []
  for (const p of linhas) {
    const feriados = await feriadosDoProcesso(banco, p.numeroCnj)
    const prazo = prazoJudicial(p.disponibilizadaEm, PRAZO_SEM_DIAS_NA_DECISAO, feriados)
    itens.push({
      id: p.id,
      fonte: p.fonte,
      disponibilizadaEm: p.disponibilizadaEm,
      texto: p.texto,
      partes: p.partes,
      numeroCnj: p.numeroCnj,
      motivo: p.motivoFila ?? '',
      idadeEmDias: Math.floor((Date.parse(hoje) - Date.parse(hojeEmBrasilia(p.criadoEm))) / UM_DIA),
      prazoMinimo: { inicio: prazo.inicio, fim: prazo.fim, regra: prazo.regra, versao: prazo.versao },
      diasUteisAtePrazo: diasUteisAte(hoje, prazo.fim, feriados),
    })
  }
  return itens
}
