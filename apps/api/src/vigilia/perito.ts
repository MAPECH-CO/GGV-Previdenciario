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

/** Sem o título na frente ("Dra. Ana Souza" é a mesma "Ana Souza"), como no `nome_normalizado`. */
const semTitulo = (s: string) => normal(s).replace(/^ (?:dra?|doutora?|sra?) /, ' ').trim()

/** O tipo da perícia aberta do caso (a mais nova sem resultado e sem perito); sem nenhuma, médica. */
export async function tipoDaPericiaAberta(banco: Banco, casoId: string) {
  const [p] = await banco
    .select({ tipo: pericia.tipo })
    .from(pericia)
    .where(and(eq(pericia.casoId, casoId), isNull(pericia.resultado), isNull(pericia.peritoId)))
    .orderBy(desc(pericia.criadoEm))
    .limit(1)
  return p?.tipo ?? 'medica'
}

/**
 * GGVP-158 P5.2: o perito pelo nome que a pessoa conferiu. Acha pelo nome, pelo nome normalizado ou por uma grafia, sem o
 * título; sem achar, cria com o perfil vazio do tipo da perícia (médica ou social) e de onde atua. Sem lista inicial
 * (Lucas, 07/10, GGVP-131): a base cresce pela nomeação, pela pergunta de um clique e, na parte 7, pelo Raio-X.
 */
export async function peritoPeloNome(banco: Banco, nome: string, tipo: string, onde = '') {
  const chave = semTitulo(nome)
  for (const p of await banco.select().from(perito))
    if ([p.nome, p.nomeNormalizado, ...((p.grafias as string[] | null) ?? [])].some((g) => semTitulo(g) === chave)) return { id: p.id, nome: p.nome, novo: false }
  const [novo] = await banco.insert(perito).values({ nome: nome.trim(), nomeNormalizado: chave, perfil: { tipo, onde, laudos: [] } }).onConflictDoNothing().returning()
  if (novo) return { id: novo.id, nome: novo.nome, novo: true }
  // Outro pedido criou o mesmo nome no meio: vale o dele.
  const [ja] = await banco.select({ id: perito.id, nome: perito.nome }).from(perito).where(eq(perito.nomeNormalizado, chave))
  return { ...ja, novo: false }
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
