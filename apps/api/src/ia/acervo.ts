// Buscar no acervo antes de escrever (GGVP-45): o que a casa já viveu em outros casos, por texto em português, no
// próprio PostgreSQL. Entra o que uma pessoa aprovou ou registrou (petição aprovada, decisão de mérito classificada,
// motivo de indeferimento, modelo de petição ativo) e o estudo de caso da IA (GGVP-19, automático, marcado como da IA).
// O trecho sai sem dado pessoal do cliente de origem (CA6).
// ponytail: to_tsvector calculado na hora, sem índice; índice GIN ou embeddings (pgvector) quando o acervo crescer.
// GGVP-141 (ADR-013): o acervo se alimenta sozinho, em trechos com vetor, para a busca também pelo sentido.
import { createHash } from 'node:crypto'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { FonteDaIa } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acervoTrecho } from '../banco/esquema.ts'
import type { Ia } from './ia.ts'

export const MSG_SEM_REFERENCIA = 'Sem referência na casa: nada parecido no acervo; a IA usou só o caso.'

/** `saude`: trecho só do Jurídico entra (os fluxos passam pela finalidade da IA). `ia`: com ela, também pelo sentido (GGVP-141). */
type Busca = { casoId: string; beneficio: string | null; consulta: string; limite?: number; saude?: boolean; ia?: Ia }
type Achado = { chave: string; de: string; referencia: string; texto: string }
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

/**
 * As fontes do acervo (GGVP-45, GGVP-19, GGVP-141): o que uma pessoa aprovou, registrou ou conferiu. Documento do caso pode
 * trazer dado de saúde e fica só para o Jurídico (`so_juridico`); o modelo da casa não tem dado de cliente. A conversa
 * conferida é só do Jurídico quando trouxe fato de saúde ou veio de gravação só do Jurídico. O que a IA sugeriu e
 * ninguém conferiu não entra (parte 2).
 */
const FONTES = sql`
      select 'Petição aprovada' as de, p.caso_id, null::uuid as modelo_id, v.conteudo as texto, true as so_juridico, null::uuid as pessoa_id, 'caso:' || p.caso_id as referencia
        from peticao_versao v join peticao p on p.id = v.peticao_id where v.aprovada_em is not null
      union all
      select 'Decisão de mérito', pu.caso_id, null, pu.texto, true, null, 'caso:' || pu.caso_id from publicacao pu where pu.classe = 'merito' and pu.caso_id is not null
      union all
      select 'Motivo de indeferimento', r.caso_id, null, coalesce(r.motivo_escrito, r.motivo_indeferimento), true, null, 'caso:' || r.caso_id
        from resultado_inss r where r.resultado = 'indeferido' and coalesce(r.motivo_escrito, r.motivo_indeferimento) is not null
      union all
      select 'Modelo da casa', null, m.id, m.conteudo, false, null, 'modelo:' || m.id from modelo m where m.tipo = 'peticao' and m.ativo
      union all
      -- GGVP-19 CA2: o estudo de caso do processo perdido (automático, da IA), com o motivo e o aprendizado.
      select 'Estudo de caso da IA', ci.caso_id, null, concat_ws(' ', ci.saida::jsonb ->> 'motivo', ci.saida::jsonb ->> 'aprendizado'), true, null, 'caso:' || ci.caso_id
        from chamada_ia ci where ci.finalidade = 'estudo_de_caso' and ci.situacao = 'ok'
      union all
      -- GGVP-141 CA1: a conversa conferida do Relacionamento, com o registro e a observação.
      select 'Conversa conferida', a.caso_id, null, concat_ws(' ', a.dados ->> 'registro', a.dados -> 'analise' ->> 'observacao'),
             jsonb_path_exists(a.dados, '$.analise.mudancas[*] ? (@.saude == true)')
               or exists (select 1 from gravacao_recepcao g where g.id = a.dados ->> 'gravacaoId' and g.so_juridico),
             a.pessoa_id, 'conversa:' || a.id
        from atendimento a where a.dados ->> 'conferidaEm' is not null
      union all
      -- GGVP-141 CA1, parte 2: cada parecer que a advogada registrou, com os itens como ela conferiu (GGVP-132).
      select 'Parecer médico', dm.caso_id, null,
             concat_ws(' ', 'Parecer ' || (r ->> 'situacao') || '.',
               'Itens: ' || (select string_agg((i ->> 'texto') || ': ' || (i ->> 'situacao'), '; ' order by n)
                               from jsonb_array_elements(coalesce(r -> 'itens', '[]')) with ordinality as x(i, n)) || '.',
               'Abordar: ' || (r ->> 'abordar'), 'Conferência manual: ' || (r ->> 'conferenciaManual')),
             true, null, 'caso:' || dm.caso_id
        from documentacao_medica dm cross join lateral jsonb_array_elements(coalesce(dm.documento -> 'registros', '[]')) r
       where dm.parte = 'parecer'
      union all
      -- O laudo conferido: o resumo de cada documento da análise que um parecer conferiu; a análise sem parecer fica fora.
      select 'Laudo conferido', dm.caso_id, null, concat_ws(' ', d ->> 'tipo', 'de ' || (d ->> 'data') || ':', d ->> 'resumo'), true, null, 'caso:' || dm.caso_id
        from documentacao_medica dm
             cross join lateral jsonb_array_elements(coalesce(dm.documento -> 'analises', '[]')) a
             cross join lateral jsonb_array_elements(coalesce(a -> 'documentos', '[]')) d
       where dm.parte = 'parecer' and d ->> 'resumo' is not null
         and exists (select 1 from jsonb_array_elements(coalesce(dm.documento -> 'registros', '[]')) r where r ->> 'analise' = a ->> 'quando')
      union all
      -- A transcrição conferida (GGVP-46 CA6, GGVP-133): os trechos marcados como prova e as informações conferidas, sem
      -- senha, telefone e contato de apoio. A gravação é da pessoa: entra no caso mais novo dela, e sem caso espera o caso
      -- nascer. A gravação de uma conversa já entra como "Conversa conferida".
      select 'Transcrição conferida', c.id, null,
             concat_ws(' ',
               (select string_agg(t ->> 'texto', ' ' order by n) from jsonb_array_elements(coalesce(g.dados -> 'trechos', '[]')) with ordinality as x(t, n)
                 where t ->> 'prova' = 'true'),
               (select string_agg((e ->> 'rotulo') || ': ' || (e ->> 'valor'), '; ' order by n) from jsonb_array_elements(coalesce(g.dados -> 'extraidas', '[]')) with ordinality as x(e, n)
                 where e ->> 'conferidaEm' is not null and e ->> 'destino' <> 'cofre' and coalesce(e ->> 'campo', '') not in ('telefone', 'contatoApoio'))),
             g.so_juridico, g.pessoa_id, 'gravacao:' || g.id
        from gravacao_recepcao g
             cross join lateral (select id from caso where caso.pessoa_id = g.pessoa_id order by criado_em desc limit 1) c
       where g.dados ->> 'conversaId' is null
      union all
      -- O resultado da perícia que a advogada registrou, com a leitura do laudo que ela conferiu (GGVP-70, GGVP-139).
      select 'Resultado da perícia', p.caso_id, null,
             concat_ws(' ', 'Perícia ' || case p.tipo when 'medica' then 'médica' else p.tipo end || ':',
               case when p.documento -> 'resultado' -> 'registrado' ->> 'favoravel' = 'true' then 'favorável.' else 'desfavorável.' end,
               'Assunto: ' || nullif(l ->> 'assunto', '') || '.', nullif(l ->> 'resumo', ''), 'Conclusão: ' || nullif(l ->> 'conclusao', '') || '.',
               'Por quê: ' || nullif(l ->> 'porque', ''), 'Ponto de atenção: ' || nullif(l ->> 'pontoDeAtencao', '')),
             true, null, 'caso:' || p.caso_id
        from pericia p cross join lateral (select p.documento -> 'resultado' -> 'laudo' -> 'leitura' as l) x
       where p.documento -> 'resultado' -> 'registrado' is not null`

/** RRF: cada lista dá 1/(k + posição) a cada item; k = 60, o valor de referência do método. */
const K_DO_RRF = 60

/**
 * CA1, CA4 (GGVP-45) e CA2 (GGVP-141): até `limite` trechos de outros casos (mesmo benefício quando há) e modelos, do mais
 * parecido ao menos. Junta a busca por palavra com a busca por significado, quando há vetor, misturadas por RRF, sempre
 * com a fonte.
 */
export async function buscarNoAcervo(banco: Banco, { casoId, beneficio, consulta, limite = 3, saude = false, ia }: Busca): Promise<FonteDaIa[]> {
  const termos = palavras(consulta)
  if (!termos.length) return []
  const candidatos = limite * 3
  // PGlite e node-postgres devolvem `rows`; o tipo genérico do Drizzle não diz.
  const { rows } = (await banco.execute(sql`
    with fonte as (${FONTES}),
    achados as (
      select f.*, pe.nome, ts_rank(to_tsvector('portuguese', f.texto), q) as nota
        from fonte f
        left join caso c on c.id = f.caso_id
        left join pessoa pe on pe.id = coalesce(c.pessoa_id, f.pessoa_id),
        to_tsquery('portuguese', ${termos.join(' | ')}) q
       where to_tsvector('portuguese', f.texto) @@ q
         and (${saude}::boolean or not f.so_juridico)
         and (f.modelo_id is not null or (f.caso_id <> ${casoId} and (${beneficio}::text is null or c.beneficio = ${beneficio})))
       order by nota desc
       limit ${candidatos}
    )
    select de, nome, referencia as origem, texto from achados order by nota desc`)) as unknown as { rows: Linha[] }
  // CA6: anonimiza o texto inteiro antes de recortar, para o corte não deixar meio endereço para trás.
  const porPalavra: Achado[] = rows.map((r) => ({ chave: `${r.de}|${r.origem}`, de: r.de, referencia: r.origem, texto: anonimizar(r.texto, r.nome) }))
  const porSentido = await buscarPorSentido(banco, { casoId, beneficio, consulta, saude, ia, candidatos })
  const nota = new Map<string, { achado: Achado; nota: number }>()
  for (const lista of [porPalavra, porSentido])
    lista.forEach((achado, i) => {
      const x = nota.get(achado.chave) ?? { achado, nota: 0 }
      x.nota += 1 / (K_DO_RRF + i + 1)
      nota.set(achado.chave, x)
    })
  return [...nota.values()]
    .sort((a, b) => b.nota - a.nota)
    .slice(0, limite)
    .map(({ achado }) => ({ tipo: 'acervo', referencia: achado.referencia, trecho: `${achado.de}: ${recortar(achado.texto, termos)}` }))
}

/** GGVP-141 CA2: os trechos mais perto da consulta pelo sentido (pgvector, cosseno). Sem a IA ou sem vetor no acervo, nada. */
async function buscarPorSentido(
  banco: Banco,
  { casoId, beneficio, consulta, saude, ia, candidatos }: { casoId: string; beneficio: string | null; consulta: string; saude: boolean; ia?: Ia; candidatos: number },
): Promise<Achado[]> {
  if (!ia?.ligada) return []
  const [algum] = await banco.select({ id: acervoTrecho.id }).from(acervoTrecho).where(isNotNull(acervoTrecho.embedding)).limit(1)
  if (!algum) return []
  const v = await ia.vetor({ casoId, quem: null, texto: consulta.slice(0, LIMITE_DO_VETOR), saude, referencia: `consulta:caso:${casoId}` })
  if (!v) return []
  const { rows } = (await banco.execute(sql`
    select t.origem as de, t.referencia, t.texto
      from acervo_trecho t
     where t.embedding is not null
       and (${saude}::boolean or not t.so_juridico)
       and (t.referencia like 'modelo:%' or (t.caso_id <> ${casoId} and (${beneficio}::text is null or t.beneficio = ${beneficio})))
     order by t.embedding <=> ${JSON.stringify(v)}::vector
     limit ${candidatos}`)) as unknown as { rows: { de: string; referencia: string; texto: string }[] }
  return rows.map((r) => ({ chave: `${r.de}|${r.referencia}`, de: r.de, referencia: r.referencia, texto: r.texto }))
}

/** ponytail: corte simples para caber no modelo de embeddings; recortar o texto em pedaços quando o acervo pedir. */
const LIMITE_DO_VETOR = 8000
/** Vetores por rodada, para a rodada não demorar nem gastar de uma vez; o resto fica para a próxima. */
const VETORES_POR_RODADA = 50

/**
 * GGVP-141 CA1, CA3, CA4: o acervo se alimenta sozinho, na rodada da sugestão pronta. Grava, anonimizado, o que ainda não
 * está lá (pelo hash) e calcula pelo motor o vetor do que falta. Trecho só do Jurídico ganha vetor só com a autorização.
 * ponytail: lê as fontes inteiras a cada rodada; com milhares de itens, guardar a última leitura por fonte.
 */
export async function alimentarAcervo(banco: Banco, ia: Ia) {
  const { rows } = (await banco.execute(sql`
    with fonte as (${FONTES})
    select f.de, f.caso_id, f.referencia, f.texto, f.so_juridico, c.beneficio, pe.nome
      from fonte f
      left join caso c on c.id = f.caso_id
      left join pessoa pe on pe.id = coalesce(c.pessoa_id, f.pessoa_id)
     where f.referencia is not null and coalesce(trim(f.texto), '') <> ''`)) as unknown as {
    rows: { de: string; caso_id: string | null; referencia: string; texto: string; so_juridico: boolean; beneficio: string | null; nome: string | null }[]
  }
  const trechos = rows.map((r) => {
    const texto = anonimizar(r.texto, r.nome)
    const hash = createHash('sha256').update(`${r.de}\n${r.referencia}\n${texto}`).digest('hex')
    return { origem: r.de, referencia: r.referencia, casoId: r.caso_id, beneficio: r.beneficio, texto, soJuridico: r.so_juridico, hash }
  })
  const novos = trechos.length ? await banco.insert(acervoTrecho).values(trechos).onConflictDoNothing({ target: acervoTrecho.hash }).returning({ id: acervoTrecho.id }) : []
  const semVetor = await banco
    .select({ id: acervoTrecho.id, casoId: acervoTrecho.casoId, referencia: acervoTrecho.referencia, texto: acervoTrecho.texto, soJuridico: acervoTrecho.soJuridico })
    .from(acervoTrecho)
    .where(and(isNull(acervoTrecho.embedding), ia.saudeAutorizada ? undefined : eq(acervoTrecho.soJuridico, false)))
    .limit(VETORES_POR_RODADA)
  let vetores = 0
  for (const t of semVetor) {
    const v = await ia.vetor({ casoId: t.casoId, quem: null, texto: t.texto.slice(0, LIMITE_DO_VETOR), saude: t.soJuridico, referencia: t.referencia })
    if (!v) continue
    await banco.update(acervoTrecho).set({ embedding: v }).where(eq(acervoTrecho.id, t.id))
    vetores++
  }
  return { novos: novos.length, vetores }
}
