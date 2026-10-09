// Casar a publicação pelo número CNJ (GGVP-26 CA1 a CA5): repetida é descartada com registro, mesmo vinda de outra
// fonte; com CNJ de um caso, liga ao caso e põe na fila da advogada; sem CNJ ou com CNJ desconhecido, vai para a
// fila de revisão da Sênior.
import { createHash } from 'node:crypto'
import { normalizarCnj, validarCnj } from '@ggv/campos'
import { and, eq, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { identificadorCaso, publicacao, publicacaoDescarte, tarefa } from '../banco/esquema.ts'
import type { PublicacaoBruta } from './fontes.ts'

export const MOTIVO_SEM_CNJ = 'número CNJ não informado na publicação'
export const MOTIVO_CNJ_DESCONHECIDO = 'número CNJ não encontrado no sistema'
export const MOTIVO_REPETIDA = 'repetida: mesma data, mesmo processo e mesmo teor'

const textoNormalizado = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()

/** Sem a fonte no hash: a mesma publicação repetida pela mesma fonte, ou igual nas duas, é uma só (CA4). */
export const hashDaPublicacao = (data: string, cnj: string | null, texto: string) =>
  createHash('sha256').update(`${data}|${cnj ?? 'sem-cnj'}|${textoNormalizado(texto)}`).digest('hex')

/** O teor para comparar fontes: minúsculas, pontuação trocada por espaço, espaços simples. */
const teor = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * A mesma publicação vinda da outra fonte (CA4; grupo 4, decisão 51). A AASP repete o texto do DJEN com material a
 * mais, e o hash não vê. Mesma data, mesmo CNJ, outra fonte e um teor contém o outro, com o menor tendo pelo menos
 * metade do maior. A metade evita que um "Intime-se." curto suma dentro de outro ato do mesmo processo.
 */
async function originalDeOutraFonte(banco: Banco, b: PublicacaoBruta, cnj: string): Promise<string | null> {
  const novo = teor(b.texto)
  const candidatas = await banco
    .select({ id: publicacao.id, fonte: publicacao.fonte, texto: publicacao.texto })
    .from(publicacao)
    .where(and(eq(publicacao.numeroCnj, cnj), eq(publicacao.disponibilizadaEm, b.disponibilizadaEm)))
  for (const c of candidatas) {
    if (c.fonte === b.fonte) continue
    const outro = teor(c.texto)
    const [menor, maior] = novo.length <= outro.length ? [novo, outro] : [outro, novo]
    if (menor && menor.length * 2 >= maior.length && maior.includes(menor)) return c.id
  }
  return null
}

/** CA2, CA6: a repetida não entra, mas o descarte fica registrado com o motivo e a original. */
async function descartar(banco: Banco, b: PublicacaoBruta, cnj: string | null, publicacaoId: string | null, agora: Date) {
  await banco
    .insert(publicacaoDescarte)
    .values({ fonte: b.fonte, numeroCnj: cnj, disponibilizadaEm: b.disponibilizadaEm, trecho: b.texto.trim().slice(0, 200), motivo: MOTIVO_REPETIDA, publicacaoId, criadoEm: agora })
}

/** Caso ligado ao número CNJ (`identificador_caso`, tipo `cnj`, só os dígitos). */
export async function casoDoCnj(banco: Banco, cnj: string): Promise<string | null> {
  const [l] = await banco
    .select({ casoId: identificadorCaso.casoId })
    .from(identificadorCaso)
    .where(and(eq(identificadorCaso.tipo, 'cnj'), eq(identificadorCaso.valor, cnj)))
  return l?.casoId ?? null
}

/** "Ler publicação" para a advogada: uma tarefa aberta por caso cobre todas as publicações ainda não lidas (GGVP-74 CA6). */
export async function pedirLeitura(banco: Banco, casoId: string) {
  const [aberta] = await banco
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3a.01'), isNull(tarefa.concluidaEm)))
  if (!aberta) await banco.insert(tarefa).values({ casoId, passo: 'D3a.01', titulo: 'Ler publicação', perfilDono: 'advogada' })
}

export async function casarPublicacoes(banco: Banco, brutas: PublicacaoBruta[], agora = new Date()) {
  const contagem = { novas: 0, repetidas: 0, fila: 0 }
  for (const b of brutas) {
    const digitos = b.numeroCnj ? normalizarCnj(b.numeroCnj) : null
    const cnj = digitos && validarCnj(digitos) ? digitos : null
    const hash = hashDaPublicacao(b.disponibilizadaEm, cnj, b.texto)
    const daOutraFonte = cnj ? await originalDeOutraFonte(banco, b, cnj) : null
    if (daOutraFonte) {
      await descartar(banco, b, cnj, daOutraFonte, agora)
      contagem.repetidas++
      continue
    }
    const casoId = cnj ? await casoDoCnj(banco, cnj) : null
    const motivoFila = casoId ? null : cnj ? MOTIVO_CNJ_DESCONHECIDO : MOTIVO_SEM_CNJ
    const [nova] = await banco
      .insert(publicacao)
      .values({ fonte: b.fonte, numeroCnj: cnj, casoId, disponibilizadaEm: b.disponibilizadaEm, texto: b.texto, partes: b.partes, hash, fila: casoId ? null : 'revisao', motivoFila, criadoEm: agora })
      .onConflictDoNothing({ target: publicacao.hash })
      .returning({ id: publicacao.id })
    if (!nova) {
      const [original] = await banco.select({ id: publicacao.id }).from(publicacao).where(eq(publicacao.hash, hash))
      await descartar(banco, b, cnj, original?.id ?? null, agora)
      contagem.repetidas++
      continue
    }
    contagem.novas++
    if (casoId) await pedirLeitura(banco, casoId)
    else contagem.fila++
  }
  return contagem
}
