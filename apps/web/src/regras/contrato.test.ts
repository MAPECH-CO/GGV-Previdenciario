import { describe, expect, it } from 'vitest'
import { BENEFICIOS } from '../dados/catalogos.ts'
import { CPF_DE_TESTE } from '../dados/exemplo.ts'
import {
  DIAS_ENTRE_TENTATIVAS_DE_ASSINATURA,
  INSS,
  KITS,
  TENTATIVAS_DE_ASSINATURA,
  cobrancaDaAssinatura,
  entrevistaDoCaso,
  mensagemDoLink,
  papelNaHora,
  MODELOS,
  SEM_CONDICOES,
  camposDoModelo,
  caminhoDoModelo,
  datasDoKit,
  erroDoCampo,
  faltando,
  honorariosDoModelo,
  identificadorDoModelo,
  linhaDoBeneficio,
  modeloPorId,
  montarKit,
  motivoParadoDoGerar,
  normalizarCampo,
  preencherModelo,
  restosDoModelo,
  type FichaParaOModelo,
} from './contrato.ts'

const ids = (beneficio: string, condicoes = SEM_CONDICOES) => montarKit(beneficio, condicoes)?.documentos.map((d) => d.id)
const BASE = ['contrato', 'procuracao', 'hipossuficiencia', 'residencia', 'termo-inss', 'codigo-penal']

describe('GGVP-65 · kit de documentos por benefício', () => {
  describe('CA4 · cada benefício da tabela leva exatamente os documentos dela, nem mais nem menos', () => {
    it('Aposentadorias: o kit completo, com o Termo INSS de aposentadorias, CTC e recursos', () => {
      for (const b of ['aposentadoria-especial', 'aposentadoria-contribuicao', 'aposentadoria-idade', 'aposentadoria-rural', 'aposentadoria-pcd', 'aposentadoria-pcd-idade']) {
        expect(ids(b), b).toEqual(BASE)
      }
      expect(montarKit('aposentadoria-pcd')?.documentos.find((d) => d.id === 'termo-inss')?.detalhe).toBe('aposentadorias, CTC, recursos')
    })

    it('Auxílio acidentário: o kit completo, com o Termo INSS de auxílio-acidente e acréscimo de 25%', () => {
      expect(ids('auxilio-acidente')).toEqual(BASE)
      expect(montarKit('auxilio-acidente')?.documentos.find((d) => d.id === 'termo-inss')?.detalhe).toBe('auxílio-acidente, acréscimo de 25%')
    })

    it('Auxílio incapacidade: o kit completo, com o Termo INSS de incapacidade temporária e permanente', () => {
      for (const b of ['incapacidade-temporaria', 'incapacidade-permanente', 'incapacidade-permanente-acidentaria']) expect(ids(b), b).toEqual(BASE)
      expect(montarKit('incapacidade-temporaria')?.documentos.find((d) => d.id === 'termo-inss')?.detalhe).toBe('incapacidade temporária e permanente, 25%')
    })

    it('LOAS idoso ou deficiente: o kit completo e a ficha de grupo familiar', () => {
      for (const b of ['loas-idoso', 'loas-deficiente']) expect(ids(b), b).toEqual([...BASE, 'grupo-familiar'])
      expect(montarKit('loas-idoso')?.assinam).toEqual(['o cliente'])
    })

    it('LOAS representado (genitor): o mesmo kit do LOAS, assinado pelo representado e pelo genitor ou genitora (CA2)', () => {
      const kit = montarKit('loas-deficiente', { ...SEM_CONDICOES, representado: true })
      expect(kit?.nome).toBe('LOAS representado (genitor)')
      expect(kit?.documentos.map((d) => d.id)).toEqual([...BASE, 'grupo-familiar'])
      expect(kit?.assinam).toEqual(['o representado (cliente)', 'o genitor ou a genitora (representante legal)'])
    })

    it('Curatela: sem Termo INSS e sem Código Penal (CA3)', () => {
      expect(ids('curatela')).toEqual(['contrato', 'procuracao', 'hipossuficiencia', 'residencia'])
    })

    it('Isenção de IR: sem hipossuficiência, na ordem da tabela (CA3)', () => {
      expect(ids('isencao-ir')).toEqual(['contrato', 'procuracao', 'termo-inss', 'codigo-penal', 'residencia'])
      expect(montarKit('isencao-ir')?.documentos.find((d) => d.id === 'termo-inss')?.detalhe).toBe('isenção de IR')
    })

    it('Empréstimo fraudulento: contrato, procuração e hipossuficiência da ação contra o banco (CA3)', () => {
      const kit = montarKit('emprestimo-indevido')
      expect(kit?.documentos.map((d) => d.id)).toEqual(['contrato', 'procuracao', 'hipossuficiencia'])
      expect(kit?.documentos[2].detalhe).toBe('ação contra o banco')
    })

    it('Seguro de vida: contrato, procuração e hipossuficiência da ação contra a seguradora (CA3)', () => {
      const kit = montarKit('seguro-vida')
      expect(kit?.documentos.map((d) => d.id)).toEqual(['contrato', 'procuracao', 'hipossuficiencia'])
      expect(kit?.documentos[2].detalhe).toBe('ação contra a seguradora')
    })
  })

  it('CA5 · o modelo é o da coluna "Modelo": Contrato Completo 2026 ou os modelos 6, 7, 8 e 10', () => {
    expect(montarKit('aposentadoria-idade')?.modelo).toBe('contrato-completo-2026')
    expect(montarKit('loas-idoso')?.modelo).toBe('contrato-completo-2026')
    expect(montarKit('curatela')?.modelo).toBe('modelo-6')
    expect(montarKit('isencao-ir')?.modelo).toBe('modelo-7')
    expect(montarKit('emprestimo-indevido')?.modelo).toBe('modelo-8')
    expect(montarKit('seguro-vida')?.modelo).toBe('modelo-10')
    for (const k of KITS) expect(MODELOS.some((m) => m.id === k.modelo), k.id).toBe(true)
  })

  it('CA6 · todo benefício da tabela é do catálogo único, e nenhum está em duas linhas', () => {
    const todos = KITS.flatMap((k) => k.beneficios)
    for (const b of todos) expect(BENEFICIOS.some((c) => c.id === b), b).toBe(true)
    expect(new Set(todos).size).toBe(todos.length)
  })

  it('benefício fora da tabela, ou ainda não definido, não tem kit: nada é gerado', () => {
    expect(montarKit('nao-sei')).toBeNull()
    expect(montarKit('pensao-morte')).toBeNull()
    expect(linhaDoBeneficio('divorcio')).toBeUndefined()
  })

  it('CA8 · as declarações do LOAS entram só quando a condição do caso pede', () => {
    expect(ids('loas-idoso', { ...SEM_CONDICOES, moradia: true })).toEqual([...BASE, 'grupo-familiar', 'declaracao-moradia'])
    expect(ids('loas-idoso', { representado: false, moradia: true, uniaoEstavel: true, separacaoDeFato: true })).toEqual([
      ...BASE,
      'grupo-familiar',
      'declaracao-moradia',
      'declaracao-uniao-estavel',
      'declaracao-separacao',
    ])
    expect(montarKit('loas-idoso', { ...SEM_CONDICOES, uniaoEstavel: true })?.documentos.at(-1)).toMatchObject({ condicional: true, detalhe: 'vive em união estável' })
  })

  it('CA2 e CA8 · fora do LOAS, as condições não mudam o kit', () => {
    const tudo = { representado: true, moradia: true, uniaoEstavel: true, separacaoDeFato: true }
    expect(ids('aposentadoria-idade', tudo)).toEqual(BASE)
    expect(montarKit('aposentadoria-idade', tudo)?.assinam).toEqual(['o cliente'])
  })
})

const antonio: FichaParaOModelo = {
  nome: 'Antônio Exemplo',
  cpf: CPF_DE_TESTE,
  telefone: '11900000001',
  estadoCivil: 'Casado',
  profissao: 'porteiro',
  documentos: [{ nome: 'RG' }, { nome: 'CPF' }],
  arquivos: [],
}
const campos = (ficha: FichaParaOModelo, beneficio: string, extra: Partial<Parameters<typeof camposDoModelo>[0]> = {}) =>
  camposDoModelo({ ficha, beneficio, nomeDoBeneficio: 'Benefício', condicoes: SEM_CONDICOES, dados: {}, corrigidos: [], ...extra })

describe('GGVP-69 · preencher o contrato pelo modelo e conferir', () => {
  it('CA1 e CA5 · o modelo traz os dados do cliente e do processo, cada um com de onde veio', () => {
    const lista = campos(antonio, 'aposentadoria-idade', { dados: { rg: '12.345.678-X' } })
    expect(lista.map((c) => [c.rotulo, c.valor, c.origem])).toEqual([
      ['Nome completo', 'Antônio Exemplo', 'cadastro'],
      ['Estado civil', 'Casado', 'cadastro'],
      ['Profissão', 'porteiro', 'cadastro'],
      ['CPF', '000.000.001-91', 'documento'],
      ['RG', '12.345.678-X', 'documento'],
      ['Endereço', '', 'cadastro'],
      ['Telefone', '(11) 90000-0001', 'cadastro'],
      ['Benefício', 'Benefício', 'caso'],
      ['Parte contrária', INSS, 'caso'],
    ])
    expect(faltando(lista)).toEqual(['endereco'])
  })

  it('CA5 · com a ficha de atendimento preenchida no portal, os dados dela vêm da ficha; o que se corrigiu aqui aparece', () => {
    const lista = campos({ ...antonio, documentos: [], fichaAtendimento: {} }, 'aposentadoria-idade', { corrigidos: ['estadoCivil'] })
    expect(lista.find((c) => c.campo === 'nome')?.origem).toBe('ficha')
    expect(lista.find((c) => c.campo === 'cpf')?.origem).toBe('ficha')
    expect(lista.find((c) => c.campo === 'estadoCivil')?.origem).toBe('corrigido')
  })

  it('CA1 e CA9 · o representante só aparece no LOAS representado', () => {
    expect(campos(antonio, 'loas-deficiente').some((c) => c.campo.startsWith('representante'))).toBe(false)
    const comRepresentante = campos(antonio, 'loas-deficiente', {
      condicoes: { ...SEM_CONDICOES, representado: true },
      dados: { representanteNome: 'Maria Exemplo', representanteParentesco: 'genitora' },
    })
    expect(comRepresentante.filter((c) => c.campo.startsWith('representante')).map((c) => [c.rotulo, c.valor])).toEqual([
      ['Nome do representante', 'Maria Exemplo'],
      ['CPF do representante', ''],
      ['RG do representante', ''],
      ['Parentesco do representante', 'Genitora'],
    ])
    const fora = campos(antonio, 'aposentadoria-idade', { condicoes: { ...SEM_CONDICOES, representado: true } })
    expect(fora.some((c) => c.campo.startsWith('representante'))).toBe(false)
  })

  it('CA1 · a parte contrária: o INSS nos kits do INSS, escrita no empréstimo e no seguro, nenhuma na curatela', () => {
    expect(campos(antonio, 'loas-idoso').find((c) => c.campo === 'parteContraria')?.valor).toBe(INSS)
    expect(campos(antonio, 'emprestimo-indevido').find((c) => c.campo === 'parteContraria')?.valor).toBe('')
    const seguro = campos(antonio, 'seguro-vida', { dados: { parteContraria: 'Seguradora Exemplo' } })
    expect(seguro.find((c) => c.campo === 'parteContraria')?.valor).toBe('Seguradora Exemplo')
    expect(campos(antonio, 'curatela').some((c) => c.campo === 'parteContraria')).toBe(false)
  })

  it('CA3 e CA7 · cada campo corrigido passa pela biblioteca campos', () => {
    expect(erroDoCampo('cpf', '000.000.001-92')).toBe('CPF inválido: confira os 11 números.')
    expect(erroDoCampo('cpf', '000.000.001-91')).toBeUndefined()
    expect(erroDoCampo('nome', 'Ant0nio')).toBe('Escreva o nome completo, só com letras.')
    expect(erroDoCampo('telefone', '90000-0001')).toBe('Telefone com DDD: 10 ou 11 números.')
    expect(erroDoCampo('rg', '12')).toBe('RG com 5 a 20 letras e números.')
    expect(erroDoCampo('rg', '12.345.678-X')).toBeUndefined()
    expect(erroDoCampo('endereco', '   ')).toBe('Preencha este campo.')
    expect(erroDoCampo('estadoCivil', 'x'.repeat(41))).toBe('Preencha este campo.')
    expect(erroDoCampo('representanteParentesco', 'tia')).toBe('Escolha genitora ou genitor.')
    expect(normalizarCampo('cpf', '000.000.001-91')).toBe(CPF_DE_TESTE)
    expect(normalizarCampo('telefone', '(11) 90000-0001')).toBe('11900000001')
  })

  it('CA6 e CA7 · "Gerar contrato" só com a decisão, o que corrigir no "Não", sem campo vazio e as quatro conferências', () => {
    const todas = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
    const motivo = (aprovados: boolean | null, oQueCorrigir: string, faltam: Parameters<typeof motivoParadoDoGerar>[0]['faltam'] = [], conferencias = todas) =>
      motivoParadoDoGerar({ aprovados, oQueCorrigir, conferencias, faltam })
    expect(motivo(null, '')).toBe('Responda se os documentos foram aprovados.')
    expect(motivo(false, '')).toBe('Escreva o que corrigir.')
    expect(motivo(true, '', ['cpf', 'rg', 'endereco'])).toBe('Falta: CPF, RG e Endereço.')
    expect(motivo(true, '', [], { ...todas, codigoPenal: false })).toBe('Marque as quatro conferências.')
    expect(motivo(true, '')).toBeNull()
    expect(motivo(false, 'o RG')).toBeNull()
  })

  it('CA4 · no papel as datas saem em branco, menos o contrato de honorários; no ZapSign, a data da assinatura', () => {
    const kit = montarKit('aposentadoria-idade')!
    const papel = datasDoKit(kit, 'papel', '2026-10-05')
    expect(papel[0]).toEqual({ documento: 'Contrato de honorários', data: '05/10/2026' })
    expect(papel.slice(1).every((d) => d.data === 'em branco, à mão na assinatura')).toBe(true)
    expect(datasDoKit(kit, 'digital', '2026-10-05').every((d) => d.data === 'data da assinatura no ZapSign')).toBe(true)
  })

  it('CA8 · a verificação acha campo do modelo sem valor e dado do cliente de exemplo', () => {
    const modelo = 'CONTRATO. {{nome}}, CPF {{cpf}}, contra {{parteContraria}}. Testemunha: Fulana Exemplo do Modelo.'
    const texto = preencherModelo(modelo, { nome: 'Antônio Exemplo', cpf: '000.000.001-91', parteContraria: '' })
    expect(texto).toBe('CONTRATO. Antônio Exemplo, CPF 000.000.001-91, contra {{parteContraria}}. Testemunha: Fulana Exemplo do Modelo.')
    expect(restosDoModelo(texto, ['fulana exemplo do modelo'])).toEqual(['{{parteContraria}}', 'fulana exemplo do modelo'])
    expect(restosDoModelo('CONTRATO. Antônio Exemplo.', ['Fulana Exemplo do Modelo'])).toEqual([])
  })

  it('CA10 · o modelo tem o mesmo identificador na pasta e no ZapSign', () => {
    const m = modeloPorId('contrato-completo-2026')
    expect(identificadorDoModelo(m)).toBe('contrato-completo-2026-v1')
    expect(caminhoDoModelo(m)).toBe('MODELOS ZAPSIGN · PREV/contrato-completo-2026-v1')
    expect(new Set(MODELOS.map(identificadorDoModelo)).size).toBe(MODELOS.length)
  })

  it('CA11 · os honorários vêm do modelo, sem campo para digitar', () => {
    expect(honorariosDoModelo(modeloPorId('contrato-completo-2026'))).toBe('20% do êxito (ad exitum)')
    expect(honorariosDoModelo(modeloPorId('modelo-8'))).toBe('os do modelo 8')
  })
})

describe('GGVP-72 · assinatura digital pelo ZapSign', () => {
  it('CA11 · a regra: 2 tentativas, com 3 dias entre elas', () => {
    expect(TENTATIVAS_DE_ASSINATURA).toBe(2)
    expect(DIAS_ENTRE_TENTATIVAS_DE_ASSINATURA).toBe(3)
  })

  it('CA2 e CA11 · depois do link, a próxima tentativa é 3 dias depois; com a segunda, o limite foi atingido', () => {
    expect(cobrancaDaAssinatura([], '2026-10-05')).toEqual({ feitas: 0, lembrar: false, noLimite: false })
    expect(cobrancaDaAssinatura([{ data: '2026-10-05' }], '2026-10-07')).toEqual({ feitas: 1, proximaEm: '2026-10-08', lembrar: false, noLimite: false })
    expect(cobrancaDaAssinatura([{ data: '2026-10-05' }], '2026-10-08')).toMatchObject({ lembrar: true })
    expect(cobrancaDaAssinatura([{ data: '2026-09-26' }], '2026-10-05')).toMatchObject({ proximaEm: '2026-09-29', lembrar: true })
    expect(cobrancaDaAssinatura([{ data: '2026-09-26' }, { data: '2026-10-05' }], '2026-10-05')).toEqual({ feitas: 2, lembrar: false, noLimite: true })
  })

  it('CA12 · a mensagem do WhatsApp leva o link; o lembrete leva o mesmo link', () => {
    expect(mensagemDoLink('Nair Exemplo', 'https://zapsign.exemplo/assinar/x', false)).toBe(
      'Olá, Nair! Aqui está o link para assinar o contrato do escritório pelo celular: https://zapsign.exemplo/assinar/x. Leva poucos minutos. Assim que assinar, a cópia chega para você aqui pelo WhatsApp.',
    )
    expect(mensagemDoLink('Nair Exemplo', 'https://zapsign.exemplo/assinar/x', true)).toContain('O link é o mesmo: https://zapsign.exemplo/assinar/x.')
  })
})

describe('GGVP-77 · assinatura em papel na entrevista', () => {
  it('CA4 · papel na hora só quando a entrevista foi presencial', () => {
    expect(entrevistaDoCaso([{ oQue: 'Entrevista', data: '2026-10-04', tipo: 'video' }])).toBe('video')
    expect(entrevistaDoCaso([{ oQue: 'Entrevista', data: '2026-10-05', tipo: 'presencial' }])).toBe('presencial')
    expect(
      entrevistaDoCaso([
        { oQue: 'Entrevista', data: '2026-10-01', tipo: 'presencial' },
        { oQue: 'Entrevista', data: '2026-10-03', tipo: 'telefone' },
        { oQue: 'Entrevista', data: '2026-10-04', tipo: 'presencial', estado: 'remarcado' },
        { oQue: 'Retirada da cópia do contrato', data: '2026-10-05', tipo: 'presencial' },
      ]),
    ).toBe('telefone')
    expect(entrevistaDoCaso([])).toBe('presencial')
    expect(papelNaHora('presencial')).toBe(true)
    expect(papelNaHora('video')).toBe(false)
    expect(papelNaHora('telefone')).toBe(false)
  })

  it('CA1 · o kit impresso sai com as datas em branco, menos o contrato de honorários', () => {
    const datas = datasDoKit(montarKit('loas-idoso')!, 'papel', '2026-10-05')
    expect(datas.filter((d) => d.data !== 'em branco, à mão na assinatura')).toEqual([{ documento: 'Contrato de honorários', data: '05/10/2026' }])
  })
})
