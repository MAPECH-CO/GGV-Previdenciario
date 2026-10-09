import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acervoTrecho, atendimento, caso, chamadaIa, modelo, peticao, peticaoVersao, pessoa, publicacao, resultadoInss } from '../banco/esquema.ts'
import { alimentarAcervo, anonimizar, buscarNoAcervo } from './acervo.ts'
import { DIMENSOES_DO_VETOR, criarIa } from './ia.ts'

let banco: Banco
let fechar: () => Promise<void>
let atual: string
let outro: string
const BPC = 'bpc_loas_deficiente'

async function novoCaso(nome: string, beneficio: string) {
  const [p] = await banco.insert(pessoa).values({ nome, situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio, fase: 'judicial' }).returning()
  return c.id
}
async function peticaoAprovada(casoId: string, conteudo: string, aprovada = true) {
  const [p] = await banco.insert(peticao).values({ casoId, tipo: 'inicial' }).returning()
  await banco.insert(peticaoVersao).values({ peticaoId: p.id, numero: 1, conteudo, hash: 'h', geradaPor: 'gabi', aprovadaEm: aprovada ? new Date() : null })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  atual = await novoCaso('Maria Souza', BPC)
  outro = await novoCaso('Joana Pereira Lima', BPC)
})
afterEach(() => fechar())

describe('GGVP-45 · buscar no acervo antes de escrever', () => {
  it('CA1, CA4, CA6 · traz o trecho de outro caso do mesmo benefício, com a origem e sem dado pessoal', async () => {
    await peticaoAprovada(
      outro,
      'Joana Pereira Lima, CPF 123.456.789-09, residente na Rua das Flores, 120, CEP 01234-567, telefone (11) 98765-4321. O INSS negou o benefício alegando renda per capita acima do limite, mas a miserabilidade ficou comprovada pelo estudo social.',
    )
    const fontes = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'indeferido por renda per capita acima do limite', saude: true })
    expect(fontes).toHaveLength(1)
    expect(fontes[0]).toMatchObject({ tipo: 'acervo', referencia: `caso:${outro}` })
    expect(fontes[0].trecho).toMatch(/^Petição aprovada: /)
    expect(fontes[0].trecho).toContain('miserabilidade')
    for (const dado of ['Joana', 'Pereira', '123.456.789-09', 'Flores', '01234-567', '98765-4321']) expect(fontes[0].trecho).not.toContain(dado)
  })

  it('CA1 · o próprio caso, outro benefício, versão não aprovada e publicação sem classe de mérito não entram; motivo, mérito e modelo entram', async () => {
    await peticaoAprovada(atual, 'renda per capita acima do limite, petição do próprio caso')
    await peticaoAprovada(await novoCaso('Ana Dias', 'pensao_morte'), 'renda per capita acima do limite, outro benefício')
    await peticaoAprovada(outro, 'renda per capita acima do limite, versão ainda em conferência', false)
    await banco.insert(publicacao).values({ fonte: 'aasp', casoId: outro, disponibilizadaEm: '2026-09-01', texto: 'Intimação sobre renda per capita.', hash: 'p1', classe: 'exigencia' })
    expect(await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita', saude: true })).toEqual([])

    await banco.insert(resultadoInss).values({ casoId: outro, resultado: 'indeferido', dataDecisao: '2026-08-01', motivoEscrito: 'Renda per capita superior a um quarto do salário mínimo.' })
    await banco.insert(publicacao).values({ fonte: 'aasp', casoId: outro, disponibilizadaEm: '2026-09-10', texto: 'Sentença: a renda per capita não afasta a miserabilidade; procedente.', hash: 'p2', classe: 'merito' })
    const [m] = await banco.insert(modelo).values({ tipo: 'peticao', nome: 'BPC renda', conteudo: 'Modelo: renda per capita e o critério do STF.' }).returning()
    const fontes = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita', saude: true })
    expect(fontes.map((f) => f.trecho!.split(':')[0]).sort()).toEqual(['Decisão de mérito', 'Modelo da casa', 'Motivo de indeferimento'])
    expect(fontes.find((f) => f.trecho!.startsWith('Modelo'))!.referencia).toBe(`modelo:${m.id}`)
  })

  it('CA2 · nada parecido, ou pedido sem palavra, devolve vazio', async () => {
    await peticaoAprovada(outro, 'Qualidade de segurado comprovada pelo CNIS.')
    expect(await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita', saude: true })).toEqual([])
    expect(await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: '123 !!', saude: true })).toEqual([])
  })

  it('CA6 · anonimizar troca e-mail e o nome inteiro sem deixar sobra', () => {
    expect(anonimizar('Joana Pereira Lima (joana@ex.com) pediu.', 'Joana Pereira Lima (exemplo)')).toBe('[cliente] ([e-mail]) pediu.')
  })
})

describe('GGVP-141 · o acervo se alimenta sozinho', () => {
  const VETOR = Array.from({ length: DIMENSOES_DO_VETOR }, () => 0.01)
  const comIa = (ambiente: Record<string, string> = { OPENAI_API_KEY: 'chave-de-teste' }) =>
    criarIa({ banco, ambiente, fetch: async () => new Response(JSON.stringify({ data: [{ embedding: VETOR }] })) })
  /** Uma conversa do Relacionamento, guardada como a rota guarda (no `dados` do atendimento). */
  async function conversa(conferida: boolean, saude: boolean) {
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, outro))
    await banco.insert(atendimento).values({
      pessoaId: c.pessoaId,
      casoId: outro,
      canal: 'telefone',
      inicio: new Date(),
      dados: {
        registro: 'Joana Pereira Lima contou que voltou a trabalhar meio período.',
        analise: { mudancas: [{ campo: 'trabalho', saude }], atualizar: [], observacao: 'Pedir o CNIS atualizado.' },
        ...(conferida ? { conferidaEm: '2026-10-08T15:00:00Z' } : {}),
      },
    })
  }

  it('CA1, CA3 · as fontes e a conversa conferida entram anonimizadas, com a saúde marcada; rodar de novo não duplica', async () => {
    await peticaoAprovada(outro, 'Joana Pereira Lima, CPF 123.456.789-09: renda per capita abaixo do limite.')
    await conversa(true, true)
    await conversa(false, false) // não conferida: não entra
    const ia = comIa()
    expect(await alimentarAcervo(banco, ia)).toEqual({ novos: 2, vetores: 0 }) // os dois são só do Jurídico, e sem a autorização não há vetor
    const trechos = await banco.select().from(acervoTrecho).orderBy(acervoTrecho.origem)
    expect(trechos.map((t) => [t.origem, t.soJuridico, t.referencia.split(':')[0]])).toEqual([
      ['Conversa conferida', true, 'conversa'],
      ['Petição aprovada', true, 'caso'],
    ])
    for (const t of trechos) for (const dado of ['Joana', 'Pereira', '123.456.789-09']) expect(t.texto).not.toContain(dado)
    expect(await alimentarAcervo(banco, ia)).toEqual({ novos: 0, vetores: 0 })
    expect(await banco.$count(acervoTrecho)).toBe(2)
  })

  it('CA4 · o vetor vem pelo motor; o trecho só do Jurídico ganha vetor só com a autorização do escritório', async () => {
    await banco.insert(modelo).values({ tipo: 'peticao', nome: 'BPC renda', conteudo: 'Modelo: renda per capita e o critério do STF.' })
    await peticaoAprovada(outro, 'Renda per capita abaixo do limite.')
    expect(await alimentarAcervo(banco, comIa())).toEqual({ novos: 2, vetores: 1 }) // só o modelo
    expect(await alimentarAcervo(banco, comIa({ OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }))).toEqual({ novos: 0, vetores: 1 })
    expect((await banco.select().from(acervoTrecho)).map((t) => t.embedding?.length)).toEqual([DIMENSOES_DO_VETOR, DIMENSOES_DO_VETOR])
    expect((await banco.select().from(chamadaIa).where(eq(chamadaIa.finalidade, 'vetor_acervo'))).map((c) => c.situacao)).toEqual(['ok', 'ok'])
  })
})

describe('GGVP-141 · busca híbrida (sentido e palavra, por RRF)', () => {
  /** Vetores de brinquedo: o texto com "renda per capita acima" aponta para um lado; o resto, para o outro, como a consulta. */
  let pedidos: string[] = []
  let iaQueEntende: ReturnType<typeof criarIa>
  beforeEach(() => {
    pedidos = []
    iaQueEntende = criarIa({
      banco,
      ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' },
      fetch: async (_url, init) => {
        const { input } = JSON.parse(String(init?.body)) as { input: string }
        pedidos.push(input)
        const v = Array<number>(DIMENSOES_DO_VETOR).fill(0)
        v[/renda per capita acima/.test(input) ? 1 : 0] = 1
        return new Response(JSON.stringify({ data: [{ embedding: v }] }))
      },
    })
  })

  it('CA2 · acha pelo sentido o que a palavra não acha e mistura as duas listas, sempre com a fonte', async () => {
    const terceiro = await novoCaso('Ana Dias', BPC)
    await peticaoAprovada(outro, 'O INSS negou por renda per capita acima do limite.')
    await peticaoAprovada(terceiro, 'Hipossuficiência econômica do grupo familiar comprovada pelo estudo social.')
    await alimentarAcervo(banco, iaQueEntende)
    const fontes = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita', saude: true, ia: iaQueEntende })
    // A do outro caso aparece nas duas listas e vem primeiro; a do terceiro só pelo sentido, e vem depois.
    expect(fontes.map((f) => f.referencia)).toEqual([`caso:${outro}`, `caso:${terceiro}`])
    expect(fontes[1].trecho).toMatch(/^Petição aprovada: Hipossuficiência/)
    expect(pedidos.at(-1)).toBe('renda per capita')
  })

  it('CA2 · sem vetor no acervo, segue só pela palavra, sem chamar a IA', async () => {
    await peticaoAprovada(outro, 'O INSS negou por renda per capita acima do limite.')
    const antes = pedidos.length
    const fontes = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita', saude: true, ia: iaQueEntende })
    expect([fontes.map((f) => f.referencia), pedidos.length]).toEqual([[`caso:${outro}`], antes])
  })

  it('CA1 · trecho só do Jurídico só entra com `saude`; o modelo da casa entra sempre', async () => {
    await peticaoAprovada(outro, 'O INSS negou por renda per capita acima do limite.')
    const [m] = await banco.insert(modelo).values({ tipo: 'peticao', nome: 'BPC renda', conteudo: 'Modelo: renda per capita e o critério do STF.' }).returning()
    await alimentarAcervo(banco, iaQueEntende)
    const semSaude = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita', ia: iaQueEntende })
    expect(semSaude.map((f) => f.referencia)).toEqual([`modelo:${m.id}`])
  })
})
