import { describe, expect, it } from 'vitest'
import {
  AnalisarExigenciaJuiz,
  AprovarVersao,
  AutorizarDilacao,
  ClassificarPublicacao,
  Despachar,
  EncerrarSemProva,
  NaoVouConseguir,
  PedirPeticao,
  ProtocolarManifestacao,
  RegistrarIndisponibilidade,
  RegistrarTentativa,
  SubirInformacao,
  VincularPublicacao,
} from './justica.ts'

const erro = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message
const CNJ_VALIDO = '0001234-96.2026.4.03.6301'

describe('GGVP-34 · classificar a publicação', () => {
  it('andamento não pede prazo', () => {
    expect(ClassificarPublicacao.parse({ classe: 'andamento' })).toEqual({ classe: 'andamento', dias: null })
  })

  it('exigência e mérito pedem os dias; sem prazo na decisão vira 5 (CPC, art. 218, §3º)', () => {
    expect(ClassificarPublicacao.parse({ classe: 'exigencia', dias: '15' })).toEqual({ classe: 'exigencia', dias: 15 })
    expect(ClassificarPublicacao.parse({ classe: 'merito', semPrazoNaDecisao: true })).toEqual({ classe: 'merito', dias: 5 })
    expect(erro(ClassificarPublicacao.safeParse({ classe: 'exigencia' }))).toBe(
      'Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"',
    )
    expect(erro(ClassificarPublicacao.safeParse({ classe: 'merito', dias: '0' }))).toBe(
      'Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"',
    )
    expect(erro(ClassificarPublicacao.safeParse({}))).toBe('Escolha o tipo de ato')
  })
})

describe('GGVP-26 CA8 · vincular um item da fila', () => {
  it('vincular exige CNJ válido e guarda só os dígitos', () => {
    expect(VincularPublicacao.parse({ decisao: 'vincular', numeroCnj: CNJ_VALIDO })).toEqual({ decisao: 'vincular', numeroCnj: '00012349620264036301' })
    expect(erro(VincularPublicacao.safeParse({ decisao: 'vincular', numeroCnj: '0001234-55.2026.4.03.6301' }))).toBe(
      'Número CNJ inválido. Confira os 20 dígitos.',
    )
  })

  it('ou registra que não é do escritório', () => {
    expect(VincularPublicacao.parse({ decisao: 'fora_do_escritorio' })).toEqual({ decisao: 'fora_do_escritorio' })
  })
})

describe('GGVP-79 · analisar a exigência do juiz', () => {
  const item = { setor: 'documentacao', descricao: 'Trazer laudo atualizado', prazoInterno: '20/10/2026' }

  it('só ciência não pede nada; precisa cumprir pede ao menos um item ou a perícia', () => {
    expect(AnalisarExigenciaJuiz.parse({ decisao: 'ciencia' })).toEqual({ decisao: 'ciencia' })
    expect(erro(AnalisarExigenciaJuiz.safeParse({ decisao: 'cumprir' }))).toBe('Inclua ao menos um item ou a perícia')
    expect(AnalisarExigenciaJuiz.parse({ decisao: 'cumprir', tiposPericia: ['medica'] })).toMatchObject({ itens: [], tiposPericia: ['medica'] })
  })

  it('cada item tem setor, o que cumprir e prazo interno; a prova esperada é opcional', () => {
    expect(AnalisarExigenciaJuiz.parse({ decisao: 'cumprir', itens: [item] })).toEqual({
      decisao: 'cumprir',
      itens: [{ setor: 'documentacao', descricao: 'Trazer laudo atualizado', provaEsperada: null, prazoInterno: '2026-10-20' }],
      tiposPericia: [],
    })
    expect(erro(AnalisarExigenciaJuiz.safeParse({ decisao: 'cumprir', itens: [{ ...item, descricao: ' ' }] }))).toBe('Descreva o que o setor deve cumprir')
    expect(erro(AnalisarExigenciaJuiz.safeParse({ decisao: 'cumprir', itens: [{ ...item, prazoInterno: '' }] }))).toBe(
      'Informe o prazo interno de cada item (dd/mm/aaaa)',
    )
    expect(erro(AnalisarExigenciaJuiz.safeParse({ decisao: 'cumprir', itens: [{ ...item, setor: 'financeiro' }] }))).toBe('Escolha o setor de cada item')
  })
})

describe('GGVP-83 · laço do setor', () => {
  it('tentativa pede canal e resultado; "não vou conseguir" pede o motivo', () => {
    expect(RegistrarTentativa.parse({ canal: 'telefone', resultado: ' Não atendeu ' })).toEqual({ canal: 'telefone', resultado: 'Não atendeu' })
    expect(erro(RegistrarTentativa.safeParse({ canal: 'telefone', resultado: '' }))).toBe('Escreva o resultado da tentativa')
    expect(erro(RegistrarTentativa.safeParse({ resultado: 'x' }))).toBe('Escolha o canal da tentativa')
    expect(erro(NaoVouConseguir.safeParse({ motivo: ' ' }))).toBe('Escreva por que não vai conseguir')
  })
})

describe('GGVP-87 · manifestar e protocolar', () => {
  it('aprovar pede a marcação (G6); protocolar pede a data, não futura', () => {
    expect(erro(AprovarVersao.safeParse({ aprovei: false }))).toBe('Marque "Aprovei a versão da manifestação (G6)"')
    expect(ProtocolarManifestacao.parse({ dataProtocolo: '05/10/2026' })).toEqual({ dataProtocolo: '2026-10-05' })
    expect(erro(ProtocolarManifestacao.safeParse({ dataProtocolo: '01/01/2099' }))).toBe('A data do protocolo não pode ser no futuro')
  })

  it('dilação pede o motivo; a indisponibilidade pede a data da volta', () => {
    expect(erro(AutorizarDilacao.safeParse({ motivo: '' }))).toBe('Escreva o motivo da dilação')
    expect(RegistrarIndisponibilidade.parse({ voltouEm: '27/10/2026' })).toEqual({ voltouEm: '2026-10-27' })
  })
})

describe('GGVP-87 · manifestar sem uma prova (ajuste de 06/10)', () => {
  it('pede o item ou a perícia e o motivo', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(EncerrarSemProva.parse({ alvo: 'pericia', id, motivo: ' Cliente faleceu antes da perícia ' })).toEqual({ alvo: 'pericia', id, motivo: 'Cliente faleceu antes da perícia' })
    expect(erro(EncerrarSemProva.safeParse({ alvo: 'item', id, motivo: '' }))).toBe('Escreva por que vai manifestar sem essa prova')
    expect(erro(EncerrarSemProva.safeParse({ alvo: 'item', motivo: 'x' }))).toBe('Escolha o item ou a perícia')
  })
})

describe('GGVP-54 · despachar', () => {
  it('CA3 · "nada falta" segue sem itens', () => {
    expect(Despachar.parse({ decisao: 'nada_falta' })).toEqual({ decisao: 'nada_falta' })
  })

  it('CA2, CA6 · cada setor com o que obter; "Essa tarefa tem prazo?" Sim pede a data, Não vai sem prazo', () => {
    expect(
      Despachar.parse({
        decisao: 'acionar',
        itens: [
          { setor: 'documentacao', descricao: ' Laudo atualizado ', temPrazo: true, prazo: '20/10/2026' },
          { setor: 'atendimento', descricao: 'Quem mora com a cliente', temPrazo: false },
        ],
      }),
    ).toEqual({
      decisao: 'acionar',
      itens: [
        { setor: 'documentacao', descricao: 'Laudo atualizado', prazo: '2026-10-20' },
        { setor: 'atendimento', descricao: 'Quem mora com a cliente', prazo: null },
      ],
      tiposPericia: [],
    })
    expect(erro(Despachar.safeParse({ decisao: 'acionar', itens: [{ setor: 'documentacao', descricao: 'Laudo', temPrazo: true }] }))).toBe('Informe a data de entrega (dd/mm/aaaa)')
    expect(erro(Despachar.safeParse({ decisao: 'acionar', itens: [{ setor: 'documentacao', descricao: ' ', temPrazo: false }] }))).toBe('Escreva o que o setor deve obter')
    expect(erro(Despachar.safeParse({ decisao: 'acionar', itens: [{ setor: 'documentacao', descricao: 'Laudo' }] }))).toBe('Responda "Essa tarefa tem prazo?"')
  })

  it('CA2, CA5 · acionar pede ao menos um setor ou a perícia; a perícia sozinha vale', () => {
    expect(erro(Despachar.safeParse({ decisao: 'acionar', itens: [] }))).toBe('Marque ao menos um setor ou a perícia')
    expect(Despachar.parse({ decisao: 'acionar', tiposPericia: ['medica'] })).toEqual({ decisao: 'acionar', itens: [], tiposPericia: ['medica'] })
    expect(erro(Despachar.safeParse({}))).toBe('Escolha "Nada falta" ou o que falta')
  })

  it('CA2, CA6 · cada setor recebe um pedido só (ajuste de 06/10)', () => {
    const pedido = (setor: string) => ({ setor, descricao: 'teste', temPrazo: false })
    expect(erro(Despachar.safeParse({ decisao: 'acionar', itens: [pedido('atendimento'), pedido('atendimento')] }))).toBe('Cada setor recebe um pedido só')
  })
})

describe('GGVP-58 · laços dos setores no despacho', () => {
  it('CA1, CA7 · a informação do Atendimento é obrigatória e vem aparada', () => {
    expect(SubirInformacao.parse({ informacao: ' Mora com o filho e a nora ' })).toEqual({ informacao: 'Mora com o filho e a nora' })
    expect(erro(SubirInformacao.safeParse({ informacao: '' }))).toBe('Escreva a informação que conseguiu com o cliente')
  })
})

describe('GGVP-63 · pedir a petição', () => {
  const DOC = '33333333-3333-4333-8333-333333333333'

  it('CA9 · o texto da versão 1 é obrigatório; instruções e opções vêm com o padrão', () => {
    expect(erro(PedirPeticao.safeParse({ texto: '  ' }))).toBe('Escreva ou cole o texto da petição (versão 1)')
    expect(PedirPeticao.parse({ texto: ' Excelentíssimo ' })).toEqual({
      instrucoes: '',
      opcoes: { tutelaUrgencia: false, precedentes: false, anexarCitados: true },
      citados: [],
      texto: 'Excelentíssimo',
    })
  })

  it('CA6 · cada citado é um documento do caso ou o nome do que falta, na ordem', () => {
    expect(PedirPeticao.parse({ texto: 'x', citados: [{ documentoId: DOC }, { nome: ' Laudo do INSS ' }] }).citados).toEqual([
      { documentoId: DOC, nome: '' },
      { documentoId: null, nome: 'Laudo do INSS' },
    ])
    expect(erro(PedirPeticao.safeParse({ texto: 'x', citados: [{ nome: ' ' }] }))).toBe('Escreva o nome do documento que falta')
  })
})

