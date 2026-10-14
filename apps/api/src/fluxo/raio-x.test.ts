import { describe, expect, it } from 'vitest'
import { analisarRaioX, indicadoresDoRaioX, relatorioDoRaioX } from './raio-x.ts'

// GGVP-158 P7.7 (GGVP-148): a leitura da planilha do Raio-X e os indicadores, com uma base inventada (números CNJ válidos,
// pessoas e peritos de mentira).
const A = '5000101-36.2023.4.03.6301'
const B = '5000202-73.2023.4.03.6301'
const C = '5000303-67.2021.4.03.6338'
const D = '5000404-21.2021.4.03.6301'
const E = '5000505-24.2022.4.03.6301'
const F = '5000606-61.2022.4.03.6301'
const digitos = (cnj: string) => cnj.replace(/\D/g, '')

const PLANILHA = [
  'cnj;Nome;CPF;Telefone;beneficio;desfecho;data_decisao;perito;vara;juiz;falha_nossa;laudo;extinto_por_determinacao;faltou_pericia;recurso;cartorio_cobrou',
  `${A};Fulana de Tal;52998224725;11987654321;BPC/LOAS Idoso;Procedente;05/10/2026;Dra. Ana Souza;1ª Vara do JEF;Carlos Lima;não;sim;não;não;;"Comprovante de residência; Procuração"`,
  ';Beltrano;11144477735;11911112222;BPC/LOAS Idoso;Improcedente;01/09/2026;Dr. Paulo Reis;2ª Vara do JEF;Carlos Lima;sim;não;não;não;;',
  `${C};Ciclana;;;Auxílio por Incapacidade Temporária;improcedente;20/08/2025;Dr. Paulo Reis;Vara de Mauá;Rita Alves;sim;não;não;sim;provido_parcial;Comprovante de residência`,
].join('\n')

describe('GGVP-158 P7.7 · a leitura da planilha do Raio-X', () => {
  it('a linha sem número recusa; as colunas pessoais são ignoradas e nada delas entra; os peritos, os juízes, as varas e a data de corte', () => {
    const analise = analisarRaioX(PLANILHA, new Set())
    expect(analise.erros).toEqual([{ linha: 3, motivo: 'sem o número do processo.' }])
    expect(analise.colunasIgnoradas).toEqual(['Nome', 'CPF', 'Telefone'])
    expect(analise.novos.map((p) => p.numeroCnj)).toEqual([digitos(A), digitos(C)])
    expect(analise.novos[0]).toEqual({
      numeroCnj: digitos(A),
      beneficio: 'bpc_loas_idoso',
      desfecho: 'procedente_total',
      dataDecisao: '2026-10-05',
      perito: 'Dra. Ana Souza',
      vara: '1ª Vara do JEF',
      juiz: 'Carlos Lima',
      falhaNossa: false,
      laudoFavoravel: true,
      extintoPorDeterminacao: false,
      faltouPericia: false,
      resultadoRecurso: null,
      cartorioCobrou: ['Comprovante de residência', 'Procuração'],
    })
    for (const pessoal of ['Fulana', 'Ciclana', '52998224725', '11987654321']) expect(JSON.stringify(analise.novos)).not.toContain(pessoal)

    const r = relatorioDoRaioX(analise)
    expect(r).toMatchObject({
      processos: { novos: 2, jaNoAcervo: 0 },
      peritos: ['Dr. Paulo Reis', 'Dra. Ana Souza'],
      juizes: ['Carlos Lima', 'Rita Alves'],
      varas: ['1ª Vara do JEF', 'Vara de Mauá'],
      dataDeCorte: '2026-10-05',
      colunasIgnoradas: ['Nome', 'CPF', 'Telefone'],
    })
    expect(r.conferido).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(r)).not.toContain('Beltrano')
  })

  it('o número que já está no acervo fica; o repetido na planilha, o desfecho e o "sim ou não" desconhecidos recusam; sem a coluna cnj, nada', () => {
    const repetida = [
      'cnj,desfecho,laudo,data_decisao',
      `${A},Procedente em parte,talvez,31/02/2026`,
      `${B},Ganhou,,`,
      `${D},acordo,s,`,
      `${D},acordo,s,`,
    ].join('\n')
    const analise = analisarRaioX(repetida, new Set([digitos(A)]))
    expect(analise.erros).toEqual([
      { linha: 2, motivo: 'data da decisão inválida (use dd/mm/aaaa); laudo favorável: use sim ou não.' },
      { linha: 3, motivo: 'desfecho desconhecido.' },
      { linha: 5, motivo: 'CNJ repetido na linha 4.' },
    ])
    expect([analise.novos.map((p) => [p.numeroCnj, p.desfecho, p.laudoFavoravel]), analise.jaNoAcervo]).toEqual([[[digitos(D), 'acordo', true]], 0])
    expect(analisarRaioX(`cnj,desfecho\n${A},procedente`, new Set([digitos(A)]))).toMatchObject({ novos: [], jaNoAcervo: 1, erros: [] })
    expect(analisarRaioX('numero,desfecho\n1,procedente', new Set()).erros).toEqual([{ linha: 1, motivo: 'Falta a coluna: cnj.' }])
  })
})

describe('GGVP-158 P7.7 · as palavras de desfecho do Raio-X (tarefa 7.16)', () => {
  it('Êxito, Acordo, Perdido(s) no mérito e Extinto(s) sem mérito viram o desfecho do acervo; Em andamento entra sem desfecho', () => {
    const planilha = ['cnj;desfecho', `${A};Êxito`, `${B};Acordo`, `${C};Perdido no mérito`, `${D};Perdidos no mérito`, `${E};Extintos sem mérito`, `${F};Em andamento`].join('\n')
    const analise = analisarRaioX(planilha, new Set())
    expect(analise.erros).toEqual([])
    expect(analise.novos.map((p) => p.desfecho)).toEqual(['procedente_total', 'acordo', 'improcedente', 'improcedente', 'extinto_sem_merito', null])
  })
})

describe('GGVP-158 P7.7 · os indicadores do Raio-X', () => {
  const registro = (numeroCnj: string, r: Partial<Parameters<typeof indicadoresDoRaioX>[0][number]> = {}) => ({
    numeroCnj: digitos(numeroCnj),
    desfecho: null,
    dataDecisao: null,
    falhaNossa: null,
    laudoFavoravel: null,
    extintoPorDeterminacao: null,
    faltouPericia: null,
    resultadoRecurso: null,
    cartorioCobrou: null,
    ...r,
  })

  it('cada indicador com o número de casos, no total e por safra; o cartório e o foro; a data da base', () => {
    const base = [
      registro(A, { desfecho: 'procedente_total', dataDecisao: '2026-10-05', laudoFavoravel: true, cartorioCobrou: ['Comprovante de residência', 'Procuração'] }),
      registro(B, { desfecho: 'improcedente', dataDecisao: '2026-09-01', laudoFavoravel: false, falhaNossa: true, resultadoRecurso: 'nao_provido' }),
      registro(C, { desfecho: 'acordo', dataDecisao: '2025-08-20', falhaNossa: false, faltouPericia: true, cartorioCobrou: ['comprovante de residência'] }),
      registro(D, { desfecho: 'desistencia', resultadoRecurso: 'provido_parcial' }),
    ]
    const r = indicadoresDoRaioX(base)
    expect([r.processos, r.dataDaBase]).toEqual([4, '2026-10-05'])
    const taxa = (chave: string) => r.indicadores.find((i) => i.chave === chave)
    // A desistência não é decisão: o êxito é sobre três decididos (dois deles com êxito).
    expect(taxa('exito')).toEqual({
      chave: 'exito',
      rotulo: 'Êxito nos decididos',
      casos: 3,
      valor: 2 / 3,
      porSafra: [
        { safra: '2021', casos: 1, valor: 1 },
        { safra: '2023', casos: 2, valor: 0.5 },
      ],
    })
    expect(taxa('falha_nossa')).toMatchObject({ casos: 2, valor: 0.5 })
    expect(taxa('laudo_favoravel')).toMatchObject({ casos: 2, valor: 0.5 })
    expect(taxa('faltou_pericia')).toMatchObject({ casos: 1, valor: 1 })
    expect(taxa('extinto_por_determinacao')).toMatchObject({ casos: 0, valor: null, porSafra: [] })
    expect(taxa('recurso_provido')).toMatchObject({ casos: 2, valor: 0.5 })
    expect(r.cartorioCobra).toEqual({ processos: 2, itens: [{ item: 'Comprovante de residência', vezes: 2 }, { item: 'Procuração', vezes: 1 }] })
    expect(r.ondeJulgam).toEqual([
      { foro: 'TRF3 · 6301', processos: 3, decididos: 2, exito: 0.5 },
      { foro: 'TRF3 · 6338', processos: 1, decididos: 1, exito: 1 },
    ])
  })

  it('sem base, vazio', () => {
    const r = indicadoresDoRaioX([])
    expect([r.processos, r.dataDaBase, r.cartorioCobra, r.ondeJulgam]).toEqual([0, null, { processos: 0, itens: [] }, []])
    expect(r.indicadores.every((i) => i.casos === 0 && i.valor === null && i.porSafra.length === 0)).toBe(true)
  })
})
