import { beforeEach, describe, expect, it } from 'vitest'
import { etapaDaPericia, iniciarPericia, liberarAgendamento, obterPericia, tarefasDoJuridicoAdm } from './pericia.ts'
import { configurarExemplo, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 7, 10, 0)

beforeEach(() => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

describe('GGVP-49 · iniciar a tarefa de perícia', () => {
  it('CA1 · o sistema abre a tarefa para o Jurídico administrativo e o caso mostra "Em perícia" com a origem', async () => {
    const p = await iniciarPericia('cleide-exemplo-1', {
      origem: 'd3-despacho',
      tipo: 'medica',
      instancia: 'juizo',
      pedidaPor: 'Dra. Renata (exemplo)',
    })
    expect(p).toMatchObject({ processoId: 'cleide-exemplo-1', fichaId: 'cleide-exemplo', tipo: 'medica', instancia: 'juizo' })
    expect(etapaDaPericia('cleide-exemplo-1')).toBe('Em perícia · despacho da sênior (D3) · perícia médica')
    expect(tarefasDoJuridicoAdm().map((t) => `${t.cliente?.nome} · ${t.acao}`)).toContain('Cleide Exemplo · Marcar perícia')
  })

  it('CA2 · no D2 a tarefa só aparece quando o INSS libera o agendamento, com o título "<nome> · Marcar perícia"', async () => {
    await iniciarPericia('rita-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Dra. Paula (exemplo)' })
    expect((await obterPericia('rita-exemplo-1'))?.situacao).toBe('aguardando-inss')
    expect(tarefasDoJuridicoAdm().some((t) => t.cliente?.id === 'rita-exemplo')).toBe(false)

    agora = new Date(2026, 9, 8, 9, 0)
    await liberarAgendamento('rita-exemplo-1')
    const tarefa = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'rita-exemplo')!
    expect(tarefa).toMatchObject({ codigo: 'DP.02', acao: 'Marcar perícia', prazo: 'hoje', href: '/casos/rita-exemplo-1/pericia/marcar' })
  })

  it('CA2 · na semente, a Maria (pedida ontem, liberada hoje) e o Pedro já estão na Central', () => {
    const linhas = tarefasDoJuridicoAdm().map((t) => `${t.cliente?.nome} · ${t.acao}`)
    expect(linhas).toEqual(expect.arrayContaining(['Maria Exemplo · Marcar perícia', 'Pedro Exemplo · Marcar perícia']))
    const maria = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'maria-exemplo')!
    expect(maria.detalhe).toBe('Auxílio por Incapacidade Temporária · perícia médica · o INSS já liberou o agendamento · no Meu INSS (senha no cofre); subir o comprovante')
  })

  it('CA3 · a tarefa vem preenchida: quem pediu, tipo, instância e o que a perícia pede', async () => {
    const pedro = (await obterPericia('pedro-exemplo-1'))!
    expect(pedro.pericia).toMatchObject({
      origem: 'd2-exigencia',
      pedidaPor: 'Dra. Paula (exemplo)',
      tipo: 'social',
      instancia: 'inss',
      oQuePede: 'avaliação social pedida pelo INSS na exigência: visita à casa e composição do grupo familiar',
    })
    expect(pedro.beneficio).toBe('LOAS Idoso')
  })

  it('CA4 · o histórico diz que foi o sistema que abriu, quando, e a decisão de quem', async () => {
    const maria = (await obterPericia('maria-exemplo-1'))!
    const [pedido, aberta, liberada] = maria.pericia.historico
    expect(pedido).toMatchObject({ quem: 'Dra. Paula (exemplo)', passo: 'D2.03', oQue: 'Pediu a perícia médica (D2 · necessidade inicial)' })
    expect(aberta).toMatchObject({
      quem: 'Sistema',
      passo: 'DP.01',
      oQue: 'Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de Dra. Paula (exemplo) (D2 · necessidade inicial)',
    })
    expect(new Date(aberta.quando)).toEqual(new Date(2026, 9, 6, 16, 10))
    expect(liberada).toMatchObject({ quem: 'Sistema', passo: 'D2.E1' })
    expect(new Date(liberada.quando)).toEqual(new Date(2026, 9, 7, 8, 0))
  })
})
