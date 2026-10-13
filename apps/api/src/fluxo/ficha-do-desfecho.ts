// GGVP-41 (CA1, CA4, CA10, CA11): a ficha do desfecho do portal no acervo, que a IA escreve em segundo plano e a Sênior
// confere. Sem ficha (falha ou sem chave), a conferência mostra que a IA ainda não leu; o preparo tenta no dia seguinte.
import { FichaDoDesfecho, ROTULO_BENEFICIO, ROTULO_DESFECHO_DO_ACERVO, type Beneficio, type DesfechoDoAcervo, type EstudoDaIa, type FonteDaIa } from '@ggv/contratos'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, pessoa, peticao, peticaoVersao, processoAcervo, publicacao, resultadoInss } from '../banco/esquema.ts'
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

/** CA1, CA4, CA9: o caso perdido entra no acervo com a ficha do estudo de caso (GGVP-19), sem outra chamada à IA. */
export async function perdidoNoAcervo(banco: Banco, casoId: string, estudo: EstudoDaIa) {
  const [c] = await banco.select({ nome: pessoa.nome, beneficio: caso.beneficio, desfecho: caso.desfecho }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
  if (!c?.desfecho) return
  // Um registro por caso: se a ida ao banco ou o lote já o pôs no acervo, só completa a ficha que falta.
  let [a] = await banco.select({ id: processoAcervo.id }).from(processoAcervo).where(eq(processoAcervo.casoId, casoId)).limit(1)
  if (!a) [a] = await banco.insert(processoAcervo).values({ casoId, beneficio: c.beneficio, desfecho: c.desfecho, fonte: 'portal' }).returning({ id: processoAcervo.id })
  const ficha = FichaDoDesfecho.parse({ materia: estudo.materia, vara: estudo.vara, tese: estudo.tese, resumo: estudo.resumo, licao: estudo.aprendizado })
  await gravarFicha(banco, a.id, ficha, c.nome)
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
