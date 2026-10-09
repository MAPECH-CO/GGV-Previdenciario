import { describe, expect, it } from 'vitest'
import type { Arquivo } from '../dados/tipos.ts'
import {
  complementaresDoCaso,
  contratoAssinadoDo,
  documentosDoCaso,
  listaDoKit,
  montarChecklist,
  motivoParaNaoLiberar,
  type EntradaDoChecklist,
  type ListaDoBeneficio,
} from './checklist.ts'

const LOAS: ListaDoBeneficio = {
  obrigatorios: ['rg', 'grupo-familiar'],
  condicionais: [
    { tipo: 'declaracao-moradia', quando: 'moradia' },
    { tipo: 'declaracao-uniao-estavel', quando: 'uniao-estavel' },
    { tipo: 'declaracao-separacao', quando: 'separacao-de-fato' },
  ],
}

const entrada = (resto: Partial<EntradaDoChecklist> = {}): EntradaDoChecklist => ({
  lista: LOAS,
  condicoes: [],
  daEntrevista: [],
  documentos: [],
  contratoAssinado: true,
  ...resto,
})

const situacoes = (e: EntradaDoChecklist) => montarChecklist(e).itens.map((i) => [i.tipo, i.situacao, i.motivo])

describe('Checklist do benefício (GGVP-91)', () => {
  it('CA1 · cada documento com recebido, pendente ou com problema, e o contrato do kit no topo', () => {
    expect(situacoes(entrada({ documentos: [{ tipo: 'rg' }, { tipo: 'grupo-familiar', quarentena: true }] }))).toEqual([
      ['contrato', 'recebido', undefined],
      ['rg', 'recebido', undefined],
      ['grupo-familiar', 'problema', 'chegou, mas está em quarentena: confira de quem é'],
    ])
    expect(montarChecklist(entrada()).itens[1].nome).toBe('Documento pessoal (RG)')
  })

  it('CA2 · sem assinatura ou com data em branco, o item fica pendente (G1); contrato sem assinar também', () => {
    const e = entrada({ contratoAssinado: false, documentos: [{ tipo: 'rg', dataEmBranco: true }, { tipo: 'grupo-familiar', semAssinatura: true }] })
    expect(situacoes(e)).toEqual([
      ['contrato', 'pendente', 'falta a assinatura do cliente (D1.17)'],
      ['rg', 'pendente', 'chegou com a data em branco (G1)'],
      ['grupo-familiar', 'pendente', 'chegou sem assinatura (G1)'],
    ])
    // Chegou outra via, assinada: vale.
    expect(situacoes(entrada({ documentos: [{ tipo: 'grupo-familiar', semAssinatura: true }, { tipo: 'grupo-familiar' }] }))[2][1]).toBe('recebido')
  })

  it('CA3 e CA5 · "completo" é calculado; incompleto não libera e diz o que falta', () => {
    const incompleto = montarChecklist(entrada({ documentos: [{ tipo: 'rg' }] }))
    expect(incompleto.completo).toBe(false)
    expect(incompleto.faltam).toEqual(['Ficha de grupo familiar'])
    expect(motivoParaNaoLiberar(incompleto, 'LOAS Deficiente')).toBe('O checklist está incompleto. Falta: Ficha de grupo familiar.')
    const completo = montarChecklist(entrada({ documentos: [{ tipo: 'rg' }, { tipo: 'grupo-familiar' }] }))
    expect(completo.completo).toBe(true)
    expect(motivoParaNaoLiberar(completo, 'LOAS Deficiente')).toBeNull()
  })

  it('CA6 · benefício sem lista aprovada nunca fica completo e explica o bloqueio', () => {
    const semLista = montarChecklist(entrada({ lista: undefined }))
    expect(semLista).toMatchObject({ temLista: false, completo: false, faltam: [] })
    expect(motivoParaNaoLiberar(semLista, 'Auxílio Acidentário')).toBe(
      'Auxílio Acidentário ainda não tem lista de documentos obrigatórios aprovada pelo escritório (configuração, GGVP-104): o caso não pode ser liberado.',
    )
  })

  it('CA7 · as declarações do LOAS entram só quando a condição do caso pede', () => {
    expect(montarChecklist(entrada()).itens.map((i) => i.tipo)).toEqual(['contrato', 'rg', 'grupo-familiar'])
    const moradia = montarChecklist(entrada({ condicoes: ['moradia'] })).itens.at(-1)
    expect(moradia).toMatchObject({ tipo: 'declaracao-moradia', de: 'condicao', condicao: 'moradia', situacao: 'pendente' })
  })

  it('CA8 · os documentos da entrevista entram junto, sem repetir o que a lista já pede', () => {
    const itens = montarChecklist(entrada({ daEntrevista: ['laudo', 'rg'] })).itens
    expect(itens.map((i) => [i.tipo, i.de])).toEqual([
      ['contrato', 'contrato'],
      ['rg', 'beneficio'],
      ['grupo-familiar', 'beneficio'],
      ['laudo', 'entrevista'],
    ])
    // Sem lista, a entrevista ainda aparece, e o caso continua sem poder liberar.
    expect(montarChecklist(entrada({ lista: undefined, daEntrevista: ['laudo'] })).itens.map((i) => i.tipo)).toEqual(['contrato', 'laudo'])
  })

  it('CA10 · a regra usa a lista que receber: o escritório muda a lista sem mudar código', () => {
    const outra: ListaDoBeneficio = { obrigatorios: ['cnis'], condicionais: [] }
    expect(montarChecklist(entrada({ lista: outra, documentos: [{ tipo: 'cnis' }] })).completo).toBe(true)
  })
})

describe('Checklist do Auxílio-Acidente (GGVP-47)', () => {
  const BASE: ListaDoBeneficio = { obrigatorios: ['laudo'], condicionais: [] }
  const acidente = (resto: Partial<EntradaDoChecklist> = {}) =>
    entrada({
      lista: BASE,
      complementares: [
        { tipo: 'cat', exigencia: 'obrigatorio', aplica: true, recusado: false },
        { tipo: 'boletim-ocorrencia', exigencia: 'desejavel', aplica: true, recusado: false },
        { tipo: 'prontuario', exigencia: 'condicional', aplica: false, recusado: false },
      ],
      ...resto,
    })

  it('CA1 · os complementares entram depois da lista, cada um com a exigência e o status próprio', () => {
    const c = montarChecklist(acidente({ documentos: [{ tipo: 'laudo' }] }))
    expect(c.itens.map((i) => [i.tipo, i.exigencia, i.situacao, i.motivo, i.naoConta])).toEqual([
      ['contrato', undefined, 'recebido', undefined, undefined],
      ['laudo', undefined, 'recebido', undefined, undefined],
      ['cat', 'obrigatorio', 'pendente', 'falta', undefined],
      ['boletim-ocorrencia', 'desejavel', 'pendente', 'falta', true],
      ['prontuario', 'condicional', 'pendente', 'só se houve auxílio por incapacidade temporária antes: não se aplica', true],
    ])
  })

  it('CA3 · completo com todos os obrigatórios e os condicionais que se aplicam; o desejável não conta', () => {
    expect(montarChecklist(acidente({ documentos: [{ tipo: 'laudo' }] }))).toMatchObject({ completo: false, faltam: ['CAT (Comunicação de Acidente de Trabalho)'] })
    expect(montarChecklist(acidente({ documentos: [{ tipo: 'laudo' }, { tipo: 'cat' }] }))).toMatchObject({ completo: true, faltam: [] })
  })

  it('CA3 · a CAT recusada pelo empregador vira pendência que não trava', () => {
    const c = montarChecklist(acidente({ documentos: [{ tipo: 'laudo' }], complementares: [{ tipo: 'cat', exigencia: 'obrigatorio', aplica: true, recusado: true }] }))
    expect(c.itens.at(-1)).toMatchObject({ tipo: 'cat', situacao: 'pendente', motivo: 'o empregador recusou: pendência que não trava', naoConta: true })
    expect(c.completo).toBe(true)
  })

  it('CA2 · o bloqueio da categoria trava o completo e é o motivo para não liberar', () => {
    const c = montarChecklist(acidente({ documentos: [{ tipo: 'laudo' }, { tipo: 'cat' }], bloqueio: 'Facultativo não tem direito ao auxílio-acidente: o caso trava na categoria.' }))
    expect([c.completo, c.faltam]).toEqual([false, []])
    expect(motivoParaNaoLiberar(c, 'Auxílio Acidentário')).toBe('Facultativo não tem direito ao auxílio-acidente: o caso trava na categoria.')
  })
})

describe('GGVP-125 · bloco 5c: o que as telas e o servidor calculam igual', () => {
  const kitDaSemente = [
    ...['documento_de_identidade', 'cpf', 'comprovante_de_residencia', 'cadunico', 'ficha_de_grupo_familiar'].map((tipoDocumento) => ({ tipoDocumento, obrigatorio: true })),
    ...['declaracao_de_moradia', 'declaracao_de_uniao_estavel', 'declaracao_de_separacao_de_fato'].map((tipoDocumento) => ({ tipoDocumento, obrigatorio: false })),
    { tipoDocumento: 'cnis', obrigatorio: false },
  ]

  it('o kit do escritório vira a lista das telas: os nomes do banco traduzidos, as declarações condicionais e o opcional fora', () => {
    expect(listaDoKit(kitDaSemente)).toEqual({
      obrigatorios: ['rg', 'cpf', 'comprovante-residencia', 'cadunico', 'grupo-familiar'],
      condicionais: [
        { tipo: 'declaracao-moradia', quando: 'moradia' },
        { tipo: 'declaracao-uniao-estavel', quando: 'uniao-estavel' },
        { tipo: 'declaracao-separacao', quando: 'separacao-de-fato' },
      ],
    })
    // Kit vazio: o benefício não tem lista aprovada (CA6).
    expect(listaDoKit([])).toBeUndefined()
  })

  it('o RG que o card grava com o nome da tela conta como o documento de identidade do kit', () => {
    const c = montarChecklist({ lista: listaDoKit(kitDaSemente), condicoes: [], daEntrevista: [], documentos: [{ tipo: 'rg' }, { tipo: 'cpf' }], contratoAssinado: true })
    expect(c.itens.filter((i) => i.situacao === 'recebido').map((i) => i.tipo)).toEqual(['contrato', 'rg', 'cpf'])
    expect(c.faltam).toHaveLength(3)
  })

  it('os documentos do caso: a pasta pessoal e a do processo, só o que já foi lido, o G1 da leitura e a quarentena', () => {
    const arquivo = (nome: string, tipo: string, local: string, aguardaLeitura = false): Arquivo => ({ nome, tipo, local, data: '2026-10-09', origem: 'card', repetido: false, aguardaLeitura })
    const ficha = {
      documentos: [{ nome: 'CPF', detalhe: '' }],
      arquivos: [
        arquivo('RG.pdf', 'rg', 'pessoais'),
        arquivo('Moradia.pdf', 'declaracao-moradia', 'caso-1'),
        arquivo('CNIS.pdf', 'cnis', 'caso-2'),
        arquivo('CadUnico.pdf', 'cadunico', 'pessoais', true),
      ],
    }
    const leituras = [
      { arquivo: 'Moradia.pdf', tipo: 'declaracao-moradia', situacao: 'arquivado' as const, semAssinatura: true },
      { arquivo: 'Outro.pdf', tipo: 'grupo-familiar', situacao: 'quarentena' as const },
    ]
    expect(documentosDoCaso(ficha, leituras, 'caso-1', ['laudo'])).toEqual([
      { tipo: 'cpf' },
      { tipo: 'rg', semAssinatura: undefined, dataEmBranco: undefined },
      { tipo: 'declaracao-moradia', semAssinatura: true, dataEmBranco: undefined },
      { tipo: 'laudo' },
      { tipo: 'grupo-familiar', quarentena: true },
    ])
  })

  it('o contrato assinado: da leitura em diante; sem contrato no portal, vale a etapa do processo', () => {
    expect(contratoAssinadoDo({ etapa: 'assinatura' }, 'Contrato · assinatura')).toBe(false)
    expect(contratoAssinadoDo({ etapa: 'leitura' }, 'Contrato · leitura')).toBe(true)
    expect(contratoAssinadoDo(undefined, 'Contrato · gerar')).toBe(false)
    expect(contratoAssinadoDo(undefined, 'Documentação')).toBe(true)
  })

  it('os complementares: sem a circunstância do acidente ou a condição da criança, o checklist espera', () => {
    expect(complementaresDoCaso({ beneficio: 'auxilio-acidente', infantil: false })).toEqual({ bloqueio: 'Marque a circunstância do acidente: o que é obrigatório depende dela.' })
    const transito = complementaresDoCaso({
      beneficio: 'auxilio-acidente',
      infantil: false,
      acidente: { circunstancia: 'transito', categoria: 'empregado', acidenteEm: '2026-01-10', auxilioAnterior: false, recusados: [] },
    })
    expect(transito.bloqueio).toBeUndefined()
    expect(transito.complementares?.map((c) => c.tipo)).toEqual(['boletim-ocorrencia', 'fotos-acidente', 'ficha-pronto-socorro', 'prontuario', 'exame-imagem-epoca', 'exame-pos-alta'])
    expect(complementaresDoCaso({ beneficio: 'loas-deficiente', infantil: true })).toEqual({
      complementares: [],
      bloqueio: 'A advogada marca a condição da criança no parecer: os relatórios que o caso pede dependem dela.',
    })
    expect(complementaresDoCaso({ beneficio: 'loas-idoso', infantil: false })).toEqual({})
  })
})
