import { beforeEach, describe, expect, it } from 'vitest'
import { definirBeneficio, obterDefinicao } from './beneficio.ts'
import { encerrarGravacao, iniciarGravacao, transcrever } from './entrevista.ts'
import { tarefasDaAdvogada } from './preparacao.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

async function entrevista(agendamentoId: string) {
  const g = await iniciarGravacao(agendamentoId, { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  await transcrever(g.id)
}

describe('Definir o benefício · servidor de exemplo', () => {
  it('antes da transcrição, a IA não sugere; o CNIS do caso já está lá', async () => {
    const d = (await obterDefinicao('josefa-entrevista'))!
    expect(d.transcrita).toBe(false)
    expect(d.sugestao).toBeUndefined()
    expect(d.dados.vinculos).toHaveLength(2)
  })

  it('CA2, CA5 e CA7 · sem benefício citado, a IA propõe com os casos da casa, o porquê, a alternativa e os requisitos por código', async () => {
    await entrevista('josefa-entrevista')
    expect(tarefasDaAdvogada().map((t) => [t.acao, t.href])).toContainEqual(['Definir benefício', '/entrevista/josefa-entrevista/beneficio'])
    const { sugestao } = (await obterDefinicao('josefa-entrevista'))!
    expect(sugestao).toMatchObject({ sugerido: 'incapacidade-temporaria', alternativa: 'loas-idoso' })
    expect(sugestao!.citado).toBeUndefined()
    expect(sugestao!.base.map((c) => c.id)).toEqual(['acervo-0118', 'acervo-0342', 'acervo-0455'])
    expect(sugestao!.porque).toMatch(/^Parecido com 2 casos deferidos de Auxílio por Incapacidade Temporária na casa: parou de trabalhar, laudos/)
    expect(sugestao!.requisitos).toEqual([
      { texto: 'Carência: 147 contribuições no CNIS; o mínimo é 12 (calculado por código, G19)', atende: true },
      { texto: 'Afastamento: 126 dias desde 06/2026; precisa de mais de 15 (calculado por código, G19)', atende: true },
    ])
  })

  it('CA1 · o benefício que a advogada citou prevalece; o do acervo fica só como sugestão', async () => {
    await entrevista('natalia-entrevista')
    const { sugestao } = (await obterDefinicao('natalia-entrevista'))!
    expect(sugestao).toMatchObject({ citado: 'incapacidade-permanente', sugerido: 'incapacidade-temporaria' })
    await definirBeneficio('natalia-entrevista', { beneficio: 'incapacidade-permanente', conferi: true })
    const ficha = (await obterFicha('natalia-exemplo'))!
    expect(ficha.historico.slice(-2).map((e) => e.oQue)).toEqual([
      'Definiu o benefício do caso (D1.12): Aposentadoria por Incapacidade Permanente · o que citou na entrevista (G3)',
      'Manteve o que citou na entrevista; a IA sugeria Auxílio por Incapacidade Temporária (G3)',
    ])
  })

  it('CA3 e CA6 · recusar a sugestão vai ao histórico; a decisão guarda quem, o citado, o sugerido e as fontes', async () => {
    await entrevista('josefa-entrevista')
    await expect(definirBeneficio('josefa-entrevista', { beneficio: 'nao-sei', conferi: true })).rejects.toThrow('Escolha o benefício')
    await expect(definirBeneficio('josefa-entrevista', { beneficio: 'loas-idoso' } as never)).rejects.toThrow('Escolha o benefício')
    const { ficha } = await definirBeneficio('josefa-entrevista', { beneficio: 'loas-idoso', conferi: true, motivoDaRecusa: 'tem 65 anos e a renda da casa é baixa' })
    expect(ficha.beneficioDefinido).toEqual({
      beneficio: 'loas-idoso',
      agendamentoId: 'josefa-entrevista',
      quem: 'Você (Advogada)',
      quando: AGORA.toISOString(),
      sugerido: 'incapacidade-temporaria',
      fontes: ['acervo-0118', 'acervo-0342', 'acervo-0455'],
      recusouSugestao: true,
      motivoDaRecusa: 'tem 65 anos e a renda da casa é baixa',
    })
    expect(ficha.historico.at(-1)?.oQue).toBe('Recusou a sugestão da IA (Auxílio por Incapacidade Temporária): tem 65 anos e a renda da casa é baixa')
    expect(tarefasDaAdvogada().map((t) => t.acao)).not.toContain('Definir benefício')
  })

  it('CA8 · um benefício só: trocar substitui, com o anterior no histórico, sem criar processo', async () => {
    await entrevista('josefa-entrevista')
    await definirBeneficio('josefa-entrevista', { beneficio: 'incapacidade-temporaria', conferi: true })
    const { ficha } = await definirBeneficio('josefa-entrevista', { beneficio: 'loas-idoso', conferi: true })
    expect(ficha.beneficioDefinido?.beneficio).toBe('loas-idoso')
    expect(ficha.processos).toEqual([])
    expect(ficha.historico.map((e) => e.oQue)).toContain('Trocou o benefício do caso: «Auxílio por Incapacidade Temporária» → «LOAS Idoso»')
  })
})
