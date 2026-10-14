// GGVP-158 P7.4: a sugestão de benefício da entrevista (GGVP-51), pela IA, com os casos parecidos do acervo de verdade.
// A IA recomenda sempre, com o porquê e as fontes; sem caso parecido, o porquê diz que não há referência na casa. O que a
// advogada citou (G3) e os requisitos numéricos (G19) ficam no código. A sugestão de cada entrevista é a última que a IA
// deu para a gravação: a tela mostra essa, e a decisão registra a mesma, sem chamar de novo.
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { CATALOGO_BENEFICIOS, type FonteDaIa } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, chamadaIa } from '../banco/esquema.ts'
import { MSG_SEM_REFERENCIA, SEM_CASO, buscarNoAcervo } from '../ia/acervo.ts'
import { FINALIDADES, lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import type { Ficha, Gravacao, Requisito } from '../../../web/src/dados/tipos.ts'
import { beneficioCitado, requisitosDoBeneficio } from '../../../web/src/regras/beneficio.ts'
import { ehDesde } from '../../../web/src/regras/entrevista.ts'
import { motivoSemIa } from './transcricao.ts'

const FINALIDADE = 'sugerir_beneficio'
const DO_CATALOGO = new Set<string>(CATALOGO_BENEFICIOS.map((b) => b.id))

/** A saída da IA. Benefício fora do catálogo não vale: o modelo não inventa benefício. */
const BeneficioDaIa = z.object({ sugerido: z.string(), alternativa: z.string().nullish(), porque: z.string().trim().min(1).max(800) })
function lida(texto: string) {
  const r = BeneficioDaIa.safeParse(lerJson(texto))
  if (!r.success || !DO_CATALOGO.has(r.data.sugerido) || (r.data.alternativa && !DO_CATALOGO.has(r.data.alternativa))) return null
  const { sugerido, alternativa, porque } = r.data
  return { sugerido, ...(alternativa && alternativa !== sugerido && { alternativa }), porque }
}

/** Os dados dos requisitos numéricos (G19): a carência do CNIS registrado no caso, o "desde" que a advogada conferiu e o nascimento. */
export type DadosDosRequisitos = { carencia?: number; semTrabalharDesde?: string; nascimento?: string }
export type SugestaoDoBeneficio = {
  sugerido: string
  alternativa?: string
  porque: string
  requisitos: Requisito[]
  /** De onde veio: os trechos do acervo que a IA leu. */
  fontes: FonteDaIa[]
  chamadaId: string
  alerta: string | null
}
type Guardada = { chamadaId: string; texto: string; fontes: FonteDaIa[]; alerta: string | null }

export function criarSugestaoDoBeneficio({ banco, ia }: { banco: Banco; ia: Ia }) {
  const daGravacao = (gravacaoId: string) => sql`${chamadaIa.fontes} @> ${JSON.stringify([{ referencia: `gravacao:${gravacaoId}` }])}::jsonb`

  /** A última sugestão que a IA deu para a gravação, ou nula. */
  async function ultima(gravacaoId: string): Promise<Guardada | null> {
    const [c] = await banco
      .select()
      .from(chamadaIa)
      .where(and(eq(chamadaIa.finalidade, FINALIDADE), eq(chamadaIa.situacao, 'ok'), daGravacao(gravacaoId)))
      .orderBy(desc(chamadaIa.quando))
      .limit(1)
    return c?.saida ? { chamadaId: c.id, texto: c.saida, fontes: c.fontes as FonteDaIa[], alerta: c.alerta } : null
  }

  /** Pede a sugestão à IA: o benefício de interesse, as falas (já sem a senha, G9) e os casos parecidos do acervo. */
  async function pedir(ficha: Ficha, g: Gravacao, quem: string | null, como: ComoSugerir = {}) {
    const interesse = nomeBeneficio(ficha.beneficioInteresse) || 'a definir'
    // ponytail: deixa de fora só o caso mais novo da pessoa, onde a transcrição dela entra no acervo; os mais antigos
    // dela podem aparecer, anonimizados. Excluir pela pessoa se a advogada estranhar.
    const [doCaso] = await banco.select({ id: caso.id }).from(caso).where(eq(caso.pessoaId, ficha.id)).orderBy(desc(caso.criadoEm)).limit(1)
    const consulta = [interesse, ...g.trechos.map((t) => t.texto)].join(' ')
    const acervo = await buscarNoAcervo(banco, { casoId: doCaso?.id ?? SEM_CASO, beneficio: null, consulta, saude: FINALIDADES[FINALIDADE].saude, ia })
    const conteudo = [
      `Benefício de interesse: ${interesse}.`,
      'Falas da entrevista:',
      JSON.stringify(g.trechos.map((t) => ({ quem: t.papel, texto: t.texto }))),
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos):', ...acervo.map((a) => `- ${a.trecho}`)] : ['Acervo da casa: nada parecido.']),
    ].join('\n')
    const fontes: FonteDaIa[] = [{ tipo: 'documento', referencia: `gravacao:${g.id}` }, ...acervo]
    return ia.sugerir(FINALIDADE, { casoId: null, quem, conteudo, fontes }, { ...como, validar: (t) => lida(t) !== null })
  }

  /**
   * A definição do benefício: o citado (G3), a sugestão, os dados dos requisitos e o aviso. A sugestão é a última da
   * gravação; sem ela, pede à IA, a não ser com `soLer` (a decisão registra a que a tela mostrou).
   */
  async function definicao(ficha: Ficha, g: Gravacao | undefined, hoje: string, { quem = null, soLer = false }: { quem?: string | null; soLer?: boolean } = {}) {
    const dados: DadosDosRequisitos = {
      ...(ficha.cnisDigitado && { carencia: ficha.cnisDigitado.resultado.carencia }),
      semTrabalharDesde: g?.extraidas.find((e) => ehDesde(e) && e.conferidaEm)?.valor,
      nascimento: ficha.nascimento,
    }
    if (!g) return { citado: null, sugestao: null, dados, aviso: null }
    const s = (await ultima(g.id)) ?? (soLer ? null : await pedir(ficha, g, quem))
    const l = s && lida(s.texto)
    const acervo = s?.fontes.filter((f) => f.tipo === 'acervo') ?? []
    const sugestao: SugestaoDoBeneficio | null =
      s && l
        ? {
            ...l,
            porque: acervo.length ? l.porque : `${MSG_SEM_REFERENCIA} ${l.porque}`,
            requisitos: requisitosDoBeneficio(l.sugerido, dados, hoje),
            fontes: acervo,
            chamadaId: s.chamadaId,
            alerta: s.alerta ?? null,
          }
        : null
    const aviso = sugestao ? null : `Sem a sugestão da IA: ${motivoSemIa(ia)}. Defina o benefício pela lista do escritório.`
    return { citado: beneficioCitado(g.trechos) ?? null, sugestao, dados, aviso }
  }

  /** As gravações que já têm sugestão, para o preparo não pedir de novo. */
  async function sugeridas() {
    const linhas = await banco.select({ fontes: chamadaIa.fontes }).from(chamadaIa).where(and(eq(chamadaIa.finalidade, FINALIDADE), eq(chamadaIa.situacao, 'ok')))
    return new Set(linhas.flatMap((l) => (l.fontes as FonteDaIa[]).map((f) => f.referencia)))
  }

  /** GGVP-106: em segundo plano, uma tentativa por conteúdo e por dia. */
  const preparar = (ficha: Ficha, g: Gravacao) => pedir(ficha, g, null, { soPreparar: true })

  return { definicao, sugeridas, preparar }
}
