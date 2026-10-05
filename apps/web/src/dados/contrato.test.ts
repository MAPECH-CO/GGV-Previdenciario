import { beforeEach, describe, expect, it } from 'vitest'
import { CLIENTE_DO_EXEMPLO_DOS_MODELOS, fecharContrato, gerarContrato, obterContrato, salvarCondicoes, tarefasDoContrato, type EnvioDoContrato } from './contrato.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

describe('GGVP-65 · kit de documentos por benefício · servidor de exemplo', () => {
  it('CA1 · a semente: a Cleide fechou a Aposentadoria PCD e o Atendimento tem "Preparar contrato" com o kit', async () => {
    const tarefa = tarefasDoContrato().find((t) => t.processoId === 'cleide-exemplo-1')
    expect(tarefa).toMatchObject({
      codigo: 'D1.16',
      cliente: { id: 'cleide-exemplo', nome: 'Cleide Exemplo' },
      acao: 'Preparar contrato',
      detalhe: 'PCD Aposentadoria por Contribuição · kit Aposentadorias · Contrato Completo 2026',
      href: '/contrato/cleide-exemplo-1/preparar',
    })
    const caso = await obterContrato('cleide-exemplo-1')
    expect(caso?.contrato.kit?.documentos.map((d) => d.nome)).toEqual([
      'Contrato de honorários',
      'Procuração',
      'Declaração de hipossuficiência',
      'Declaração de residência',
      'Termo INSS',
      'Código Penal',
    ])
    expect(await obterContrato('antonio-exemplo-1')).toBeNull()
  })

  it('CA1 e CA8 · o lead que fecha o LOAS vira cliente, ganha o processo e o kit com a ficha de grupo familiar', async () => {
    const { ficha, processo, contrato } = await fecharContrato('josefa-exemplo', 'loas-idoso')
    expect(ficha).toMatchObject({ situacao: 'cliente', desde: '10/2026' })
    expect(processo).toMatchObject({ id: 'josefa-exemplo-1', beneficio: 'loas-idoso', etapa: 'Contrato · preparar' })
    expect(contrato.kit?.documentos.map((d) => d.id)).toContain('grupo-familiar')
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Fechou LOAS Idoso: processo novo com o kit LOAS idoso ou deficiente (7 documentos, Contrato Completo 2026)',
    )
    expect(tarefasDoContrato().map((t) => t.cliente?.nome)).toContain('Josefa Exemplo')
  })

  it('CA9 · quem já é cliente e fecha outro benefício ganha processo e kit novos, com contrato e procuração', async () => {
    const { processo, contrato } = await fecharContrato('antonio-exemplo', 'isencao-ir')
    expect(processo.id).toBe('antonio-exemplo-2')
    expect(contrato.kit?.documentos.map((d) => d.id)).toEqual(['contrato', 'procuracao', 'termo-inss', 'codigo-penal', 'residencia'])
    expect((await obterFicha('antonio-exemplo'))?.processos).toHaveLength(2)
    expect(tarefasDoContrato().filter((t) => t.cliente?.id === 'antonio-exemplo')).toHaveLength(1)
  })

  it('benefício fora do catálogo ou "Não sei ainda" não fecha; fora da tabela fecha sem kit', async () => {
    await expect(fecharContrato('antonio-exemplo', 'nao-sei')).rejects.toThrow('catálogo')
    await expect(fecharContrato('antonio-exemplo', 'inventado')).rejects.toThrow('catálogo')
    const { contrato } = await fecharContrato('antonio-exemplo', 'pensao-morte')
    expect(contrato.kit).toBeNull()
    expect(tarefasDoContrato().find((t) => t.processoId === contrato.processoId)?.detalhe).toBe('Pensão por Morte · benefício sem kit cadastrado')
  })

  it('CA2 e CA8 · as condições do LOAS montam o kit de novo e ficam no histórico', async () => {
    const { processo } = await fecharContrato('josefa-exemplo', 'loas-idoso')
    const contrato = await salvarCondicoes(processo.id, { representado: true, moradia: true, uniaoEstavel: false, separacaoDeFato: false })
    expect(contrato.kit?.nome).toBe('LOAS representado (genitor)')
    expect(contrato.kit?.documentos.at(-1)?.id).toBe('declaracao-moradia')
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Condições do kit de LOAS Idoso: representado por genitor(a), comprovante de residência em nome de outra pessoa',
    )
  })
})

const TODAS = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
const aprovado: EnvioDoContrato = { aprovados: true, conferencias: TODAS, correcoes: {} }
const corrigir = (correcoes: EnvioDoContrato['correcoes'], oQueCorrigir = 'faltavam o RG e o endereço'): EnvioDoContrato => ({
  aprovados: false,
  oQueCorrigir,
  conferencias: TODAS,
  correcoes,
})

describe('GGVP-69 · preencher o contrato pelo modelo e conferir · servidor de exemplo', () => {
  it('CA7 · com campo obrigatório vazio, o contrato não segue para a assinatura', async () => {
    expect(await gerarContrato('cleide-exemplo-1', aprovado)).toEqual({ resultado: 'faltam', campos: ['estadoCivil', 'profissao', 'cpf', 'rg', 'endereco'] })
    expect((await obterContrato('cleide-exemplo-1'))?.contrato.etapa).toBe('preparar')
  })

  it('CA3 e CA7 · corrigir grava, registra no histórico, gera de novo e o contrato vai colher a assinatura', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    const r = await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1 · São Paulo/SP' }))
    expect(r.resultado).toBe('gerado')
    const caso = await obterContrato(processo.id)
    expect(caso?.contrato).toMatchObject({ etapa: 'assinatura', dados: { rg: '12.345.678-X' }, corrigidos: ['rg', 'endereco'] })
    expect(caso?.contrato.documento?.versao).toBe(1)
    expect(caso?.contrato.versoes).toEqual([{ versao: 1, geradoEm: expect.any(String), motivo: 'corrigido: faltavam o RG e o endereço' }])
    expect(caso?.ficha.endereco).toBe('Rua Exemplo, 1 · São Paulo/SP')
    expect(caso?.processo).toMatchObject({ etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' })
    expect(caso?.ficha.historico.slice(-2).map((e) => e.oQue)).toEqual([
      'Corrigiu no contrato: RG e Endereço (faltavam o RG e o endereço)',
      'Gerou o contrato de Aposentadoria por Idade pelo modelo contrato-completo-2026-v1 (versão 1): conferiu os campos, as datas à mão, a ficha LOAS e a página do Código Penal',
    ])
    expect(tarefasDoContrato().find((t) => t.processoId === processo.id)).toMatchObject({
      codigo: 'D1.17',
      acao: 'Colher assinatura',
      href: `/contrato/${processo.id}/assinatura`,
    })
  })

  it('CA8 · o texto gerado tem o cliente e não sobra nada do modelo', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' }))
    const textos = (await obterContrato(processo.id))!.contrato.documento!.textos
    expect(textos).toHaveLength(6)
    expect(textos[0].texto).toContain('Antônio Exemplo, Casado, Trabalhador rural (2018–2020) · porteiro (2021–2025), CPF 000.000.001-91, RG 12.345.678-X')
    expect(textos[0].texto).toContain('Honorários: 20% do êxito (ad exitum). Parte contrária: Instituto Nacional do Seguro Social (INSS).')
    for (const t of textos) {
      expect(t.texto, t.documento).not.toMatch(/\{\{|\}\}/)
      for (const d of CLIENTE_DO_EXEMPLO_DOS_MODELOS) expect(t.texto).not.toContain(d)
    }
  })

  it('CPF de outra ficha não grava', async () => {
    const r = await gerarContrato('cleide-exemplo-1', corrigir({ cpf: CPF_DE_TESTE }, 'faltava o CPF'))
    expect(r).toEqual({ resultado: 'cpf-de-outra-ficha', nome: 'Antônio Exemplo' })
    expect((await obterFicha('cleide-exemplo'))?.cpf).toBeUndefined()
  })

  it('CA1 e CA9 · no LOAS representado, os dados do representante são obrigatórios', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'loas-deficiente')
    await salvarCondicoes(processo.id, { representado: true, moradia: false, uniaoEstavel: false, separacaoDeFato: false })
    const r = await gerarContrato(processo.id, corrigir({ rg: '12.345.678-X', endereco: 'Rua Exemplo, 1', representanteNome: 'Maria Exemplo' }))
    expect(r).toEqual({ resultado: 'faltam', campos: ['representanteCpf', 'representanteRg', 'representanteParentesco'] })
  })

  it('CA6 · o servidor valida de novo a decisão, o que corrigir, as conferências e cada campo', async () => {
    await expect(gerarContrato('cleide-exemplo-1', { ...aprovado, conferencias: { ...TODAS, datas: false } })).rejects.toThrow('conferências')
    await expect(gerarContrato('cleide-exemplo-1', corrigir({}, ''))).rejects.toThrow('o que corrigir')
    await expect(gerarContrato('cleide-exemplo-1', corrigir({ cpf: '000.000.001-92' }))).rejects.toThrow('inválida')
    await expect(gerarContrato('cleide-exemplo-1', corrigir({ beneficio: 'curatela' }))).rejects.toThrow('inválida')
  })
})
