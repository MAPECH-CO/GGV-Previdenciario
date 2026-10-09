// Glossário do escritório (GGVP-143 CA2): a tela, a transcrição (GGVP-133) e o motor de IA leem os termos daqui, do banco.
import type { TermoDoGlossario } from '@ggv/contratos'
import { asc } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { glossarioTermo } from '../banco/esquema.ts'

/** Os termos do escritório, por tipo e em ordem alfabética. */
export async function termosDoGlossario(banco: Banco): Promise<TermoDoGlossario[]> {
  const linhas = await banco
    .select({ id: glossarioTermo.id, termo: glossarioTermo.termo, tipo: glossarioTermo.tipo, significado: glossarioTermo.significado })
    .from(glossarioTermo)
    .orderBy(asc(glossarioTermo.tipo), asc(glossarioTermo.termo))
  return linhas as TermoDoGlossario[]
}
