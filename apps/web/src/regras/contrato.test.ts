import { describe, expect, it } from 'vitest'
import { BENEFICIOS } from '../dados/catalogos.ts'
import { KITS, MODELOS, SEM_CONDICOES, linhaDoBeneficio, montarKit } from './contrato.ts'

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
