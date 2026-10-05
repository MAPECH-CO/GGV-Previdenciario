import { beforeEach, describe, expect, it } from 'vitest'
import { fecharContrato, obterContrato, salvarCondicoes, tarefasDoContrato } from './contrato.ts'
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
