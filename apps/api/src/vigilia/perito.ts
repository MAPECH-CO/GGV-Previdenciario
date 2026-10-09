// GGVP-59 CA1, CA6: o perito que a publicação de nomeação cita, pelo nome e pelas grafias conhecidas da base.
import type { Banco } from '../banco/conexao.ts'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { pericia, perito } from '../banco/esquema.ts'

/** Sem acento, minúsculo, só letras e números, com espaço nas pontas para casar palavra inteira: "Dr. Zé" → " dr ze ". */
const normal = (s: string) =>
  ` ${s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `

/**
 * O perito da base cujo nome, nome normalizado ou grafia aparece no texto. Mais de um bate: vale o nome mais longo, o
 * mais específico. Nenhum: nulo, e a pergunta de um clique da Perícia identifica (CA6); nada trava.
 */
export async function peritoDaPublicacao(banco: Banco, texto: string) {
  const t = normal(texto)
  let achado: { id: string; nome: string; laudos: number } | null = null
  let tamanho = 0
  for (const p of await banco.select().from(perito))
    for (const grafia of [p.nome, p.nomeNormalizado, ...((p.grafias as string[] | null) ?? [])]) {
      const g = normal(grafia)
      if (g.trim() && g.length > tamanho && t.includes(g)) {
        achado = { id: p.id, nome: p.nome, laudos: ((p.perfil as { laudos?: unknown[] } | null)?.laudos ?? []).length }
        tamanho = g.length
      }
    }
  return achado
}

/**
 * GGVP-152 CA3: o perito nomeado fica ligado à perícia aberta do caso (sem resultado e sem perito), do mesmo tipo dele, a
 * mais recente. A perícia é lida do documento guardado junto (GGVP-137), então o perito vai aos dois, com uma linha no
 * histórico dela. Sem perícia aberta, nada muda: o perito segue no histórico do caso.
 */
export async function ligarPeritoNomeado(banco: Banco, casoId: string, peritoId: string, quando: Date) {
  const [p] = await banco.select({ nome: perito.nome, perfil: perito.perfil }).from(perito).where(eq(perito.id, peritoId))
  const tipo = (p?.perfil as { tipo?: string } | null)?.tipo
  const [aberta] = await banco
    .select({ id: pericia.id, documento: pericia.documento })
    .from(pericia)
    .where(and(eq(pericia.casoId, casoId), isNull(pericia.resultado), isNull(pericia.peritoId), tipo ? eq(pericia.tipo, tipo) : undefined))
    .orderBy(desc(pericia.criadoEm))
    .limit(1)
  if (!p || !aberta) return null
  const doc = aberta.documento as { peritoId?: string; peritoLido?: string; historico?: object[] } | null
  const documento = doc && {
    ...doc,
    peritoId,
    peritoLido: undefined,
    historico: [...(doc.historico ?? []), { quando: quando.toISOString(), quem: 'Sistema', oQue: `Perito nomeado na publicação: ${p.nome}`, passo: 'DP.05' }],
  }
  await banco.update(pericia).set({ peritoId, ...(documento && { documento }) }).where(eq(pericia.id, aberta.id))
  return aberta.id
}
