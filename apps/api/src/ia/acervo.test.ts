import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, modelo, peticao, peticaoVersao, pessoa, publicacao, resultadoInss } from '../banco/esquema.ts'
import { anonimizar, buscarNoAcervo } from './acervo.ts'

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
    const fontes = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'indeferido por renda per capita acima do limite' })
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
    expect(await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita' })).toEqual([])

    await banco.insert(resultadoInss).values({ casoId: outro, resultado: 'indeferido', dataDecisao: '2026-08-01', motivoEscrito: 'Renda per capita superior a um quarto do salário mínimo.' })
    await banco.insert(publicacao).values({ fonte: 'aasp', casoId: outro, disponibilizadaEm: '2026-09-10', texto: 'Sentença: a renda per capita não afasta a miserabilidade; procedente.', hash: 'p2', classe: 'merito' })
    const [m] = await banco.insert(modelo).values({ tipo: 'peticao', nome: 'BPC renda', conteudo: 'Modelo: renda per capita e o critério do STF.' }).returning()
    const fontes = await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita' })
    expect(fontes.map((f) => f.trecho!.split(':')[0]).sort()).toEqual(['Decisão de mérito', 'Modelo da casa', 'Motivo de indeferimento'])
    expect(fontes.find((f) => f.trecho!.startsWith('Modelo'))!.referencia).toBe(`modelo:${m.id}`)
  })

  it('CA2 · nada parecido, ou pedido sem palavra, devolve vazio', async () => {
    await peticaoAprovada(outro, 'Qualidade de segurado comprovada pelo CNIS.')
    expect(await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: 'renda per capita' })).toEqual([])
    expect(await buscarNoAcervo(banco, { casoId: atual, beneficio: BPC, consulta: '123 !!' })).toEqual([])
  })

  it('CA6 · anonimizar troca e-mail e o nome inteiro sem deixar sobra', () => {
    expect(anonimizar('Joana Pereira Lima (joana@ex.com) pediu.', 'Joana Pereira Lima (exemplo)')).toBe('[cliente] ([e-mail]) pediu.')
  })
})
