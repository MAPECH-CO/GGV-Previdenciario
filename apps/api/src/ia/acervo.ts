// Buscar no acervo antes de escrever (GGVP-45): o que a casa já viveu em outros casos, por texto em português, no
// próprio PostgreSQL. Só entra o que uma pessoa aprovou ou registrou: petição aprovada, decisão de mérito classificada,
// motivo de indeferimento e modelo de petição ativo. O trecho sai sem dado pessoal do cliente de origem (CA6).
// ponytail: to_tsvector calculado na hora, sem índice; índice GIN ou embeddings (pgvector) quando o acervo crescer.
import { sql } from 'drizzle-orm'
import type { FonteDaIa } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'

export const MSG_SEM_REFERENCIA = 'Sem referência na casa: nada parecido no acervo; a IA usou só o caso.'

type Busca = { casoId: string; beneficio: string | null; consulta: string; limite?: number }
type Linha = { de: string; origem: string; texto: string; nome: string | null }

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

/** CA6: CPF, CEP, telefone, e-mail, endereço e o nome do cliente de origem viram marcadores. */
export function anonimizar(texto: string, nome: string | null) {
  let t = texto
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    .replace(/\b\d{5}-\d{3}\b/g, '[CEP]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
    .replace(/\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/g, '[telefone]')
    .replace(/\b(Rua|R\.|Avenida|Av\.|Travessa|Alameda|Estrada|Rodovia|Praça)\s[^,;\n]*(,\s*(n[º°o.]\s*)?\d+)?/gi, '[endereço]')
  if (nome) {
    const partes = nome.replace(/\(.*?\)/g, '').split(/\s+/).filter((p) => p.length > 2 && !PARTICULAS.has(p.toLowerCase()))
    for (const p of [nome, ...partes]) t = t.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[cliente]')
    t = t.replace(/\[cliente\](\s+\[cliente\])+/g, '[cliente]')
  }
  return t
}

/** As palavras do pedido (só letras, então não há como montar consulta inválida). */
const palavras = (consulta: string) => [...new Set(consulta.toLowerCase().match(/\p{L}{4,}/gu) ?? [])].slice(0, 30)

/** Até 400 caracteres em volta da primeira palavra do pedido que aparece (pelo radical), já anonimizado. */
function recortar(texto: string, termos: string[]) {
  const minusculo = texto.toLowerCase()
  const achou = Math.min(...termos.map((p) => minusculo.indexOf(p.slice(0, 5))).filter((i) => i >= 0), texto.length)
  const inicio = Math.max(0, (achou === texto.length ? 0 : achou) - 120)
  return `${inicio ? '…' : ''}${texto.slice(inicio, inicio + 400).trim()}${inicio + 400 < texto.length ? '…' : ''}`
}

/** CA1, CA4: até `limite` trechos de outros casos (mesmo benefício quando há) e modelos, do mais parecido ao menos. */
export async function buscarNoAcervo(banco: Banco, { casoId, beneficio, consulta, limite = 3 }: Busca): Promise<FonteDaIa[]> {
  const termos = palavras(consulta)
  if (!termos.length) return []
  // PGlite e node-postgres devolvem `rows`; o tipo genérico do Drizzle não diz.
  const { rows } = (await banco.execute(sql`
    with fonte as (
      select 'Petição aprovada' as de, p.caso_id, null::uuid as modelo_id, v.conteudo as texto
        from peticao_versao v join peticao p on p.id = v.peticao_id where v.aprovada_em is not null
      union all
      select 'Decisão de mérito', pu.caso_id, null, pu.texto from publicacao pu where pu.classe = 'merito' and pu.caso_id is not null
      union all
      select 'Motivo de indeferimento', r.caso_id, null, coalesce(r.motivo_escrito, r.motivo_indeferimento)
        from resultado_inss r where r.resultado = 'indeferido' and coalesce(r.motivo_escrito, r.motivo_indeferimento) is not null
      union all
      select 'Modelo da casa', null, m.id, m.conteudo from modelo m where m.tipo = 'peticao' and m.ativo
    ),
    achados as (
      select f.*, pe.nome, ts_rank(to_tsvector('portuguese', f.texto), q) as nota
        from fonte f
        left join caso c on c.id = f.caso_id
        left join pessoa pe on pe.id = c.pessoa_id,
        to_tsquery('portuguese', ${termos.join(' | ')}) q
       where to_tsvector('portuguese', f.texto) @@ q
         and (f.modelo_id is not null or (f.caso_id <> ${casoId} and (${beneficio}::text is null or c.beneficio = ${beneficio})))
       order by nota desc
       limit ${limite}
    )
    select de, nome, coalesce('caso:' || caso_id, 'modelo:' || modelo_id) as origem, texto from achados order by nota desc`)) as unknown as { rows: Linha[] }
  // CA6: anonimiza o texto inteiro antes de recortar, para o corte não deixar meio endereço para trás.
  return rows.map((r) => ({ tipo: 'acervo', referencia: r.origem, trecho: `${r.de}: ${recortar(anonimizar(r.texto, r.nome), termos)}` }))
}
