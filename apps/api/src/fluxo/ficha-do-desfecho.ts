// GGVP-41 (CA1, CA4, CA10, CA11): a ficha do desfecho do portal no acervo, que a IA escreve em segundo plano e a Sênior
// confere. Sem ficha (falha ou sem chave), a conferência mostra que a IA ainda não leu; o preparo tenta no dia seguinte.
import { FichaDoDesfecho, ROTULO_BENEFICIO, ROTULO_DESFECHO_DO_ACERVO, type Beneficio, type DesfechoDoAcervo, type EstudoDaIa, type FonteDaIa } from '@ggv/contratos'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, pericia, pessoa, peticao, peticaoVersao, processoAcervo, publicacao, resultadoInss } from '../banco/esquema.ts'
import { anonimizar } from '../ia/acervo.ts'
import { lerJson, temCid, type ComoSugerir, type Ia } from '../ia/ia.ts'

// ponytail: a petição longa vai cortada, como no estudo de caso; o começo traz fatos, direito e pedidos.
const LIMITE_DA_PETICAO = 20_000

/** Os desfechos do portal (com o caso) que ainda não têm a ficha. */
export async function desfechosSemFicha(banco: Banco) {
  const linhas = await banco
    .select({ id: processoAcervo.id })
    .from(processoAcervo)
    .where(and(isNotNull(processoAcervo.casoId), isNotNull(processoAcervo.desfecho), isNull(processoAcervo.materia)))
  return linhas.map((l) => l.id)
}

/**
 * Grava a ficha já validada, sem dado pessoal (CA10), só se o registro ainda não tem uma (CA9). A tese vira grupo na
 * Gestão, que outros perfis veem: com CID (o estudo de caso não barra), entra sem tese, e a Sênior escreve a dela.
 */
export async function gravarFicha(banco: Banco, acervoId: string, ficha: FichaDoDesfecho, nomeDoCliente: string | null) {
  const limpo = (t: string | null) => (t ? anonimizar(t, nomeDoCliente) : null)
  const tese = ficha.tese && !temCid(ficha.tese) ? limpo(ficha.tese) : null
  await banco
    .update(processoAcervo)
    .set({ materia: limpo(ficha.materia), vara: limpo(ficha.vara), tese, resumo: limpo(ficha.resumo), licao: limpo(ficha.licao) })
    .where(and(eq(processoAcervo.id, acervoId), isNull(processoAcervo.materia)))
}

type Tx = Banco | Parameters<Parameters<Banco['transaction']>[0]>[0]

/**
 * GGVP-158 P7.5: o desfecho do caso no acervo, quando ele é conhecido (o deferimento do INSS, o desfecho de mérito, a ida
 * ao banco, o caso perdido). Um registro por caso, com o número, o perito da perícia mais nova e a data da decisão: o que
 * já existe sem desfecho ganha o desfecho, e o que já tem fica. O número que a base histórica trouxe sem caso passa a ser
 * deste caso. Sem dado pessoal: só número e ids. Devolve o id do registro, ou nulo sem o caso.
 */
export async function desfechoNoAcervo(tx: Tx, casoId: string, { desfecho, dataDecisao = null }: { desfecho: string; dataDecisao?: string | null }) {
  const [c] = await tx.select({ beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
  if (!c) return null
  const [cnj] = await tx
    .select({ valor: identificadorCaso.valor })
    .from(identificadorCaso)
    .where(and(eq(identificadorCaso.casoId, casoId), eq(identificadorCaso.tipo, 'cnj')))
    .limit(1)
  const doCaso = await tx.select({ id: processoAcervo.id, desfecho: processoAcervo.desfecho }).from(processoAcervo).where(eq(processoAcervo.casoId, casoId)).limit(1)
  const doNumero = !doCaso.length && cnj ? await tx.select({ id: processoAcervo.id, desfecho: processoAcervo.desfecho }).from(processoAcervo).where(eq(processoAcervo.numeroCnj, cnj.valor)).limit(1) : []
  const ja = doCaso[0] ?? doNumero[0]
  if (ja) {
    await tx
      .update(processoAcervo)
      .set({ casoId, ...(!ja.desfecho && { desfecho, dataDecisao }) })
      .where(eq(processoAcervo.id, ja.id))
    return ja.id
  }
  const [p] = await tx
    .select({ peritoId: pericia.peritoId })
    .from(pericia)
    .where(and(eq(pericia.casoId, casoId), isNotNull(pericia.peritoId)))
    .orderBy(desc(pericia.criadoEm))
    .limit(1)
  const [novo] = await tx
    .insert(processoAcervo)
    .values({ casoId, beneficio: c.beneficio, desfecho, dataDecisao, numeroCnj: cnj?.valor ?? null, peritoId: p?.peritoId ?? null, fonte: 'portal' })
    .returning({ id: processoAcervo.id })
  return novo.id
}

/** CA1, CA4, CA9: o caso perdido entra no acervo com a ficha do estudo de caso (GGVP-19), sem outra chamada à IA. */
export async function perdidoNoAcervo(banco: Banco, casoId: string, estudo: EstudoDaIa) {
  const [c] = await banco.select({ nome: pessoa.nome, desfecho: caso.desfecho }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
  if (!c?.desfecho) return
  // Um registro por caso: se a ida ao banco ou o lote já o pôs no acervo, só completa a ficha que falta.
  const acervoId = await desfechoNoAcervo(banco, casoId, { desfecho: c.desfecho })
  if (!acervoId) return
  const ficha = FichaDoDesfecho.parse({ materia: estudo.materia, vara: estudo.vara, tese: estudo.tese, resumo: estudo.resumo, licao: estudo.aprendizado })
  await gravarFicha(banco, acervoId, ficha, c.nome)
}

/** CA1, CA4: a IA lê o desfecho do caso (a decisão, o resultado do INSS e a petição) e devolve a ficha. */
export async function fichaDoDesfecho(banco: Banco, ia: Ia, acervoId: string, como: ComoSugerir = {}) {
  const [a] = await banco.select().from(processoAcervo).where(eq(processoAcervo.id, acervoId))
  if (!a?.casoId || !a.desfecho || a.materia) return null
  const casoId = a.casoId
  const [c] = await banco.select({ nome: pessoa.nome, beneficio: caso.beneficio }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
  const [merito] = await banco
    .select({ id: publicacao.id, texto: publicacao.texto })
    .from(publicacao)
    .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
    .orderBy(desc(publicacao.disponibilizadaEm))
    .limit(1)
  const [inss] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId)).orderBy(desc(resultadoInss.criadoEm)).limit(1)
  const [aprovada] = await banco
    .select({ conteudo: peticaoVersao.conteudo })
    .from(peticaoVersao)
    .innerJoin(peticao, eq(peticaoVersao.peticaoId, peticao.id))
    .where(and(eq(peticao.casoId, casoId), isNotNull(peticaoVersao.aprovadaEm)))
    .orderBy(desc(peticaoVersao.aprovadaEm))
    .limit(1)
  const motivoDoInss = inss ? [inss.motivoIndeferimento, inss.motivoEscrito].filter(Boolean).join(' ') : ''
  const conteudo = [
    `Benefício: ${c?.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não definido'}`,
    `Resultado: ${ROTULO_DESFECHO_DO_ACERVO[a.desfecho as DesfechoDoAcervo] ?? a.desfecho}`,
    `Texto da decisão: ${merito?.texto ?? 'não está no sistema'}`,
    `Resultado do INSS: ${inss ? `${inss.resultado} em ${inss.dataDecisao}${motivoDoInss ? `; ${motivoDoInss}` : ''}` : 'não há'}`,
    `Petição aprovada: ${aprovada ? aprovada.conteudo.slice(0, LIMITE_DA_PETICAO) : 'não está no sistema'}`,
  ].join('\n')
  const fontes: FonteDaIa[] = [merito ? { tipo: 'publicacao', referencia: `publicacao:${merito.id}` } : { tipo: 'caso', referencia: `caso:${casoId}` }]
  const validar = (texto: string) => FichaDoDesfecho.safeParse(lerJson(texto)).success
  const s = await ia.sugerir('ficha_do_desfecho', { casoId, quem: null, conteudo, fontes }, { ...como, validar })
  if (!s) return null
  const ficha = FichaDoDesfecho.parse(lerJson(s.texto))
  await gravarFicha(banco, a.id, ficha, c?.nome ?? null)
  return ficha
}
