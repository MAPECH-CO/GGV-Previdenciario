import { beforeEach, describe, expect, it } from 'vitest'
import { eventosDaAgenda, registrarResultado } from './agenda.ts'
import { clienteFechou, registrarFechamento, registrarRecontato, tarefasDeFechamento } from './fechamento.ts'
import { buscarNoBalcao, configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 5, 14, 32)

beforeEach(async () => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
  // A entrevista da Natália, de ontem, aconteceu: ela é o lead entrevistado da semente.
  await registrarResultado('natalia-entrevista', 'realizado')
})

const naoFechou = (recontatar: { data: string; espera?: 'pensar' | 'esperar' } | null, motivo = 'preco') => ({
  fechou: false as const,
  motivo,
  detalhe: 'achou o valor alto',
  papel: 'atendimento' as const,
  recontatar,
})

describe('GGVP-60 · registrar por que não virou cliente e recontatar · servidor de exemplo', () => {
  it('CA5 · depois da entrevista, o Atendimento recebe "Registrar fechamento"', () => {
    expect(tarefasDeFechamento()).toEqual([
      {
        id: 'fechamento-natalia-exemplo',
        codigo: 'D1.14',
        cliente: { id: 'natalia-exemplo', nome: 'Natália Exemplo' },
        acao: 'Registrar fechamento',
        detalhe: 'Auxílio por Incapacidade Temporária · entrevista em 04/10',
        prazo: 'hoje',
        href: '/clientes/natalia-exemplo/fechamento',
      },
    ])
  })

  it('CA5 · "Sim, fechou": vira cliente e segue para o kit; a tarefa sai', async () => {
    const { ficha } = await registrarFechamento('natalia-exemplo', { fechou: true })
    expect(ficha).toMatchObject({ situacao: 'cliente', desde: '10/2026', fechamento: { situacao: 'fechou' } })
    expect(ficha.historico.at(-1)?.oQue).toBe('Fechou com o escritório: Auxílio por Incapacidade Temporária; virou cliente e segue para o kit do benefício (D1.15)')
    expect(tarefasDeFechamento()).toEqual([])
  })

  it('clienteFechou: a ligação com o contrato, com o benefício do catálogo', async () => {
    await expect(clienteFechou('josefa-exemplo', 'nao-sei')).rejects.toThrow('catálogo')
    const { ficha } = await clienteFechou('josefa-exemplo', 'loas-idoso')
    expect(ficha.situacao).toBe('cliente')
    expect(ficha.processos).toEqual([])
  })

  it('CA1 e CA6 · "Não fechou" sem motivo não grava (G16)', async () => {
    await expect(registrarFechamento('natalia-exemplo', naoFechou(null, ''))).rejects.toThrow('G16')
    await expect(registrarFechamento('natalia-exemplo', naoFechou(null, 'inventado'))).rejects.toThrow('G16')
    expect((await obterFicha('natalia-exemplo'))?.fechamento).toBeUndefined()
  })

  it('CA2, CA8, CA9 e CA12 · vale recontatar: o recontato entra na agenda e a tarefa nasce na data, atrasada depois dela', async () => {
    const { ficha } = await registrarFechamento('natalia-exemplo', naoFechou({ data: '20/10/2026', espera: 'pensar' }))
    expect(ficha.fechamento).toMatchObject({ situacao: 'recontatar', motivo: 'preco', detalhe: 'achou o valor alto', espera: 'pensar', recontatarEm: '2026-10-20' })
    expect(ficha.historico.at(-1)?.oQue).toBe('Não fechou: Preço (achou o valor alto). Recontatar em 20/10')
    const agenda = await eventosDaAgenda('2026-10-20', '2026-10-20')
    expect(agenda).toMatchObject([{ titulo: 'Natália Exemplo', oQue: 'Recontatar lead', categoria: 'retornos', passo: 'D1.14 · Recontatar lead' }])
    expect(tarefasDeFechamento()).toEqual([])
    agora = new Date(2026, 9, 20, 9, 0)
    expect(tarefasDeFechamento()).toMatchObject([
      { acao: 'Recontatar lead', detalhe: 'motivo: preço · último cálculo: nenhum registrado · (11) 90000-0003', prazo: 'hoje', urgente: false },
    ])
    agora = new Date(2026, 9, 22, 9, 0)
    expect(tarefasDeFechamento()).toMatchObject([{ acao: 'Recontatar lead', prazo: 'atrasado desde 20/10', urgente: true }])
  })

  it('CA4 e CA7 · não vale recontatar: arquivado com o motivo, fora das filas ativas e pesquisável', async () => {
    expect(ler().tarefas.some((t) => t.cliente?.id === 'natalia-exemplo' && !t.concluida)).toBe(true)
    await registrarFechamento('natalia-exemplo', naoFechou(null, 'outro-escritorio'))
    expect(ler().tarefas.some((t) => t.cliente?.id === 'natalia-exemplo' && !t.concluida)).toBe(false)
    expect(tarefasDeFechamento()).toEqual([])
    const [natalia] = await buscarNoBalcao('natalia')
    expect(natalia.etapa).toBe('Lead arquivado · Foi a outro escritório · 05/10')
  })

  it('CA11 · "Recusado pelo escritório" só pelo Atendimento sênior ou pela advogada do atendimento', async () => {
    await expect(registrarFechamento('natalia-exemplo', naoFechou(null, 'recusado'))).rejects.toThrow('Atendimento sênior')
    const { ficha } = await registrarFechamento('natalia-exemplo', { ...naoFechou(null, 'recusado'), papel: 'atendimento-senior' })
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Você (Atendimento sênior)' })
  })

  it('CA3 e CA10 · o recontato volta ao cálculo, e o fechamento é pedido de novo', async () => {
    await registrarFechamento('natalia-exemplo', naoFechou({ data: '20/10/2026' }, 'sem-direito'))
    agora = new Date(2026, 9, 20, 9, 0)
    const { ficha } = await registrarRecontato('natalia-exemplo', { resultado: 'calculo' })
    expect(ficha.fechamento?.situacao).toBe('recalcular')
    expect(ficha.agendamentos.find((a) => a.oQue === 'Recontatar lead')?.estado).toBe('realizado')
    expect(ficha.historico.at(-1)?.oQue).toBe('Recontatou: o caso volta ao cálculo de tempo e pontos (D1.13)')
    expect(tarefasDeFechamento()).toMatchObject([{ acao: 'Registrar fechamento', detalhe: 'Auxílio por Incapacidade Temporária · entrevista em 04/10 · voltou do recontato ao cálculo' }])
  })

  it('CA10 · o recontato ganha uma nova data, ou arquiva com o motivo', async () => {
    await registrarFechamento('natalia-exemplo', naoFechou({ data: '20/10/2026' }))
    agora = new Date(2026, 9, 20, 9, 0)
    await expect(registrarRecontato('natalia-exemplo', { resultado: 'nova-data', data: '19/10/2026' })).rejects.toThrow('inválida')
    const { ficha } = await registrarRecontato('natalia-exemplo', { resultado: 'nova-data', data: '19/11/2026', espera: 'esperar' })
    expect(ficha.fechamento).toMatchObject({ situacao: 'recontatar', recontatarEm: '2026-11-19', espera: 'esperar' })
    expect(ficha.agendamentos.filter((a) => a.oQue === 'Recontatar lead').map((a) => a.estado)).toEqual(['remarcado', undefined])
    agora = new Date(2026, 10, 19, 9, 0)
    const arquivada = await registrarRecontato('natalia-exemplo', { resultado: 'arquivar', motivo: 'desistiu', papel: 'atendimento' })
    expect(arquivada.ficha.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'desistiu' })
    expect(arquivada.ficha.contatos.at(-1)).toEqual({ data: '2026-11-19', canal: 'Recontato', texto: 'Não vai seguir: Desistiu.' })
  })
})
