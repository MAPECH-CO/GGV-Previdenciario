// O caso como as telas da documentação médica leem (GGVP-132): a ficha da Recepção (o fichário do #29), o processo e as
// partes guardadas em `documentacao_medica`. Comum às rotas do parecer, do complemento, da deficiência, do acidente e da
// criança.
import { and, asc, eq, isNull, ne, or } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, contratoRecepcao, documentacaoMedica, documento, documentoMedico, type PARTES_DOCUMENTACAO_MEDICA } from '../banco/esquema.ts'
import { UUID, criarFichario, type ContratoGuardado } from '../rotas/recepcao.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import type { Ficha, Processo } from '../../../web/src/dados/tipos.ts'

export const MSG_CASO_NAO_ENCONTRADO = 'Caso não encontrado.'

export type CasoMedico = { id: string; pessoaId: string; ficha: Ficha; processo: Processo }

export type Parte = (typeof PARTES_DOCUMENTACAO_MEDICA)[number]

/** Os documentos médicos do caso (os do processo e os pessoais), do mais antigo ao mais novo. */
export async function documentosMedicosDoCaso(banco: Banco, c: { id: string; pessoaId: string }) {
  return banco
    .select({
      id: documento.id,
      chave: documento.chaveArmazenamento,
      mime: documento.mime,
      criadoEm: documento.criadoEm,
      tipo: documentoMedico.tipo,
      dataEmissao: documentoMedico.dataEmissao,
      emitente: documentoMedico.profissional,
      conferidoEm: documentoMedico.confirmadoEm,
    })
    .from(documentoMedico)
    .innerJoin(documento, eq(documentoMedico.documentoId, documento.id))
    .where(
      and(
        isNull(documento.excluidoEm),
        ne(documento.situacao, 'recusado'),
        or(eq(documento.casoId, c.id), and(isNull(documento.casoId), eq(documento.pessoaId, c.pessoaId))),
      ),
    )
    .orderBy(asc(documento.criadoEm))
}

/**
 * O laudo novo: com parecer já registrado, o documento médico que ainda espera a conferência do Jurídico. A data é a do mais
 * antigo. Só a conta, sem a IA: o parecer e a página do processo usam a mesma (GGVP-158 P12.1).
 */
export function dataDoLaudoNovo(registros: number, naoConferidos: { criadoEm: Date }[]): string | undefined {
  if (!registros || !naoConferidos.length) return undefined
  return hojeEmBrasilia(naoConferidos.reduce((a, b) => (b.criadoEm < a.criadoEm ? b : a)).criadoEm)
}

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

  /**
   * CA6 (Pedro, 14/10): o parecer registrado conferiu o laudo novo. Conclui "Analisar laudo novo", que nasceu com o laudo
   * (uma por ficha), e limpa a marca "Laudo novo" da ficha e do processo no contrato da Recepção. Sem laudo novo, nada muda.
   */
  async function laudoConferido(c: CasoMedico) {
    await fichario.concluirTarefas(c.pessoaId, 'Analisar laudo novo', `laudo-${c.ficha.id}`)
    const [ficha] = await fichario.fichas([c.pessoaId])
    if (ficha?.laudoNovoEm) {
      delete ficha.laudoNovoEm
      await fichario.guardar(ficha)
    }
    const [linha] = await banco.select().from(contratoRecepcao).where(eq(contratoRecepcao.casoId, c.id))
    const g = linha?.dados as ContratoGuardado | undefined
    if (g?.processo.laudoNovoEm) {
      const { laudoNovoEm: _, ...processo } = g.processo
      await banco.update(contratoRecepcao).set({ dados: { ...g, processo }, atualizadoEm: agora() }).where(eq(contratoRecepcao.casoId, c.id))
    }
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

  return { acharCaso, anotar, laudoConferido, nomeDe: fichario.nomeDe, fichas: fichario.fichas, tarefas: fichario.tarefas, lerParte, gravarParte }
}
