import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, pessoa, publicacao, publicacaoDescarte, tarefa } from '../banco/esquema.ts'
import { MOTIVO_CNJ_DESCONHECIDO, MOTIVO_REPETIDA, MOTIVO_SEM_CNJ, casarPublicacoes } from './casar.ts'
import { CNJ_EXEMPLO, fonteDeExemplo, textoDoHtml } from './fontes.ts'

let banco: Banco
let fechar: () => Promise<void>
let casoId: string

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
  casoId = c.id
  await banco.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: CNJ_EXEMPLO.exigencia })
})
afterEach(() => fechar())

const bruta = (texto: string, numeroCnj: string | null = CNJ_EXEMPLO.exigencia, fonte = 'aasp') => ({ fonte, numeroCnj, disponibilizadaEm: '2026-10-05', texto, partes: 'A x INSS' })

describe('GGVP-26 · casar a publicação pelo CNJ', () => {
  it('CA1 · com CNJ de um caso, liga ao caso (com ou sem máscara) e põe "Ler publicação" na fila da advogada, uma vez', async () => {
    await casarPublicacoes(banco, [bruta('Intime-se.', '0001234-96.2026.4.03.6301'), bruta('Cite-se.')])
    const pubs = await banco.select().from(publicacao)
    expect(pubs.map((p) => [p.casoId, p.fila])).toEqual([
      [casoId, null],
      [casoId, null],
    ])
    expect((await banco.select().from(tarefa)).map((t) => [t.titulo, t.perfilDono])).toEqual([['Ler publicação', 'advogada']])
  })

  it('CA2, CA4 · a mesma publicação de outra fonte, com espaços e maiúsculas, é descartada e o descarte fica registrado', async () => {
    const r = await casarPublicacoes(banco, [bruta('Intime-se a parte.'), bruta('  INTIME-SE A PARTE. ', CNJ_EXEMPLO.exigencia, 'djen')])
    expect(r).toEqual({ novas: 1, repetidas: 1, fila: 0 })
    const [d] = await banco.select().from(publicacaoDescarte)
    const [original] = await banco.select().from(publicacao)
    expect([d.fonte, d.motivo, d.publicacaoId]).toEqual(['djen', MOTIVO_REPETIDA, original.id])
  })

  it('CA3, CA5 · sem CNJ, ou com CNJ que não é de nenhum caso, vai para a fila de revisão com o motivo', async () => {
    const r = await casarPublicacoes(banco, [bruta('Sem número.', null), bruta('Outro processo.', CNJ_EXEMPLO.desconhecido)])
    expect(r).toEqual({ novas: 2, repetidas: 0, fila: 2 })
    const fila = await banco.select().from(publicacao).where(eq(publicacao.fila, 'revisao'))
    expect(fila.map((p) => p.motivoFila).sort()).toEqual([MOTIVO_CNJ_DESCONHECIDO, MOTIVO_SEM_CNJ])
    expect(await banco.select().from(tarefa)).toEqual([])
  })

  it('rodar a fonte de exemplo duas vezes não duplica nada', async () => {
    const dia = new Date('2026-10-05T16:00:00Z')
    const primeira = await casarPublicacoes(banco, await fonteDeExemplo.buscar(dia, dia))
    const segunda = await casarPublicacoes(banco, await fonteDeExemplo.buscar(dia, dia))
    expect([primeira, segunda]).toEqual([
      { novas: 5, repetidas: 1, fila: 3 },
      { novas: 0, repetidas: 6, fila: 0 },
    ])
  })
})

describe('GGVP-26 CA2, CA4, CA6 · a mesma publicação nas duas fontes reais (grupo 4, decisão 51)', () => {
  // Respostas gravadas do mesmo ato, inventadas: o DJEN em HTML (como a fonte limpa) e a AASP com material a mais em volta.
  const doDjen = textoDoHtml(
    '<p>Intime-se a parte autora para, no prazo de 15 (quinze) dias, juntar laudo médico atualizado, sob pena de extinção.</p><p>São Paulo, 05/10/2026.</p>',
  )
  const daAasp =
    'Juizado Especial Federal de São Paulo - 1ª Vara-Gabinete (exemplo) Processo 0001234-96.2026.4.03.6301 Intime-se a parte autora para, no prazo de 15 (quinze) dias, juntar laudo médico atualizado, sob pena de extinção. São Paulo, 05/10/2026'

  async function casarNaOrdem(primeira: string, segunda: string) {
    const textos: Record<string, string> = { djen: doDjen, aasp: daAasp }
    const contagens = [
      await casarPublicacoes(banco, [bruta(textos[primeira], CNJ_EXEMPLO.exigencia, primeira)]),
      await casarPublicacoes(banco, [bruta(textos[segunda], CNJ_EXEMPLO.exigencia, segunda)]),
    ]
    const publicacoes = await banco.select().from(publicacao)
    const descartes = await banco.select().from(publicacaoDescarte)
    return { contagens, publicacoes, descartes }
  }

  it('o DJEN primeiro e a AASP depois: fica uma só, e o descarte aponta a original', async () => {
    const { contagens, publicacoes, descartes } = await casarNaOrdem('djen', 'aasp')
    expect(contagens).toEqual([
      { novas: 1, repetidas: 0, fila: 0 },
      { novas: 0, repetidas: 1, fila: 0 },
    ])
    expect(publicacoes.map((p) => p.fonte)).toEqual(['djen'])
    expect(descartes.map((d) => [d.fonte, d.motivo, d.publicacaoId])).toEqual([['aasp', MOTIVO_REPETIDA, publicacoes[0].id]])
  })

  it('a AASP primeiro e o DJEN depois: também fica uma só', async () => {
    const { contagens, publicacoes, descartes } = await casarNaOrdem('aasp', 'djen')
    expect(contagens[1]).toEqual({ novas: 0, repetidas: 1, fila: 0 })
    expect(publicacoes.map((p) => p.fonte)).toEqual(['aasp'])
    expect(descartes.map((d) => [d.fonte, d.publicacaoId])).toEqual([['djen', publicacoes[0].id]])
  })

  it('atos diferentes do mesmo processo no mesmo dia, de fontes diferentes, não viram repetida', async () => {
    const decisaoLonga =
      'Vistos. Trata-se de pedido de benefício por incapacidade (exemplo). Defiro a produção de prova pericial e designo perícia médica para 20/11/2026, às 10h, na sede deste Juizado, devendo a parte comparecer com documento de identidade e todos os exames que tiver. Intime-se.'
    const r = await casarPublicacoes(banco, [
      bruta(doDjen, CNJ_EXEMPLO.exigencia, 'djen'),
      bruta('Designo perícia médica para 20/11/2026, às 10h (exemplo).', CNJ_EXEMPLO.exigencia, 'aasp'),
      bruta('Intime-se.', CNJ_EXEMPLO.exigencia, 'djen'),
      bruta(decisaoLonga, CNJ_EXEMPLO.exigencia, 'aasp'),
    ])
    expect(r).toEqual({ novas: 4, repetidas: 0, fila: 0 })
    expect(await banco.select().from(publicacaoDescarte)).toEqual([])
  })
})
