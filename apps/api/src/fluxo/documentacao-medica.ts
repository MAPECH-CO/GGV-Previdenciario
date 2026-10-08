// O caso como as telas da documentação médica leem (GGVP-132): a ficha da Recepção (o fichário do #29), o processo e as
// partes guardadas em `documentacao_medica`. Comum às rotas do parecer, do complemento, da deficiência, do acidente e da
// criança.
import { and, eq } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, documentacaoMedica, type PARTES_DOCUMENTACAO_MEDICA } from '../banco/esquema.ts'
import { UUID, criarFichario } from '../rotas/recepcao.ts'
import type { Ficha, Processo } from '../../../web/src/dados/tipos.ts'

export const MSG_CASO_NAO_ENCONTRADO = 'Caso não encontrado.'

export type CasoMedico = { id: string; pessoaId: string; ficha: Ficha; processo: Processo }

export type Parte = (typeof PARTES_DOCUMENTACAO_MEDICA)[number]

export function criarCasoMedico(banco: Banco, agora: () => Date) {
  const fichario = criarFichario(banco, agora)

  /** O caso pelo id do processo das telas (o id do caso no banco), com a ficha inteira da pessoa. */
  async function acharCaso(id: string): Promise<CasoMedico | null> {
    if (!UUID.test(id)) return null
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, id))
    if (!c) return null
    const [ficha] = await fichario.fichas([c.pessoaId])
    const processo = ficha?.processos.find((p) => p.id === id)
    return ficha && processo ? { id, pessoaId: c.pessoaId, ficha, processo } : null
  }

  /** Uma linha no histórico da ficha, como as telas mostram: só o que aconteceu, nunca o conteúdo clínico. */
  async function anotar(c: CasoMedico, oQue: string, pedido: FastifyRequest) {
    const [ficha] = await fichario.fichas([c.pessoaId])
    ficha.historico.push(fichario.evento(oQue, await fichario.nomeDe(pedido)))
    await fichario.guardar(ficha)
  }

  async function lerParte<T>(casoId: string, parte: Parte): Promise<T | undefined> {
    const [l] = await banco
      .select({ documento: documentacaoMedica.documento })
      .from(documentacaoMedica)
      .where(and(eq(documentacaoMedica.casoId, casoId), eq(documentacaoMedica.parte, parte)))
    return l?.documento as T | undefined
  }

  async function gravarParte(casoId: string, parte: Parte, documento: unknown) {
    await banco
      .insert(documentacaoMedica)
      .values({ casoId, parte, documento, atualizadoEm: agora() })
      .onConflictDoUpdate({ target: [documentacaoMedica.casoId, documentacaoMedica.parte], set: { documento, atualizadoEm: agora() } })
  }

  return { acharCaso, anotar, nomeDe: fichario.nomeDe, fichas: fichario.fichas, lerParte, gravarParte }
}
