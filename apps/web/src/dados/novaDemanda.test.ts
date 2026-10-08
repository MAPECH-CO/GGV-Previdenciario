import { beforeEach, describe, expect, it } from 'vitest'
import { marcarEntrevista, registrarResultado } from './agenda.ts'
import { registrarFechamento, tarefasDeFechamento } from './fechamento.ts'
import { abrirDemanda, tarefasDeNovaDemanda } from './novaDemanda.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'
import type { EnvioDaDemanda, Marcacao } from './tipos.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

const envio = (resto: Partial<EnvioDaDemanda> = {}): EnvioDaDemanda => ({
  pretende: 'auxílio-acidente pelo braço que não fecha',
  beneficio: 'auxilio-acidente',
  tipo: 'outro-pedido',
  abertaPor: 'atendimento',
  ...resto,
})
const marcacao: Marcacao = {
  tipo: 'presencial',
  data: '2026-10-06',
  hora: '10:30',
  duracao: 45,
  com: 'paula',
  gravar: true,
  levar: true,
  pedirFicha: false,
  confirmarHorarioOcupado: true,
}

async function entrevistaFeita() {
  const r = await marcarEntrevista('antonio-exemplo', marcacao)
  if (r.resultado !== 'marcado') throw new Error(r.resultado)
  await registrarResultado(r.agendamento.id, 'realizado')
}

describe('GGVP-124 · nova demanda de quem já é cliente · servidor de exemplo', () => {
  it('CA1 · a demanda nasce na mesma ficha, com o pedido e o benefício, sem cadastro novo', async () => {
    const fichas = ler().fichas.length
    const { ficha, demanda } = await abrirDemanda('antonio-exemplo', envio())
    expect(demanda).toMatchObject({ beneficio: 'auxilio-acidente', tipo: 'outro-pedido', data: '2026-10-05', situacao: 'aberta', quem: 'Você (Atendimento)' })
    expect(ficha).toMatchObject({ id: 'antonio-exemplo', situacao: 'cliente', desde: '03/2023', beneficioInteresse: 'auxilio-acidente' })
    expect(ficha.historico.at(-1)?.oQue).toBe(
      'Nova demanda (outro pedido): auxílio-acidente pelo braço que não fecha · Auxílio Acidentário. Na mesma ficha, sem cadastro novo',
    )
    expect(ler().fichas).toHaveLength(fichas)
  })

  it('CA8 · recurso e defesa seguem no mesmo processo; lead e demanda já aberta não abrem outra', async () => {
    await expect(abrirDemanda('antonio-exemplo', envio({ tipo: 'recurso-ou-defesa' }))).rejects.toThrow('Recurso e defesa seguem no mesmo processo')
    await expect(abrirDemanda('josefa-exemplo', envio())).rejects.toThrow('Nova demanda é para quem já é cliente.')
    await abrirDemanda('antonio-exemplo', envio())
    await expect(abrirDemanda('antonio-exemplo', envio())).rejects.toThrow('Já há uma nova demanda aberta')
  })

  it('CA9 · aberta pela advogada, o Atendimento liga até a entrevista ser marcada', async () => {
    await abrirDemanda('antonio-exemplo', envio({ tipo: 'tentar-de-novo', abertaPor: 'advogada' }))
    expect(tarefasDeNovaDemanda()).toEqual([
      {
        id: 'ligar-demanda-antonio-exemplo-1',
        codigo: 'D1.01',
        cliente: { id: 'antonio-exemplo', nome: 'Antônio Exemplo' },
        acao: 'Ligar para o cliente',
        detalhe: 'nova demanda da advogada: tentar de novo depois de perder · Auxílio Acidentário · (11) 90000-0001',
        prazo: 'hoje',
        href: '/clientes/antonio-exemplo/nova-demanda',
      },
    ])
    expect((await obterFicha('antonio-exemplo'))?.historico.at(-1)?.quem).toBe('Você (Advogada)')
    await marcarEntrevista('antonio-exemplo', marcacao)
    expect(tarefasDeNovaDemanda()).toEqual([])
  })

  it('CA2 e CA3 · com a entrevista feita, "Fechou com o escritório?" abre o caso novo na mesma ficha', async () => {
    await abrirDemanda('antonio-exemplo', envio())
    expect(tarefasDeFechamento()).toEqual([])
    await entrevistaFeita()
    expect(tarefasDeFechamento()).toEqual([
      expect.objectContaining({
        acao: 'Registrar fechamento',
        detalhe: 'Auxílio Acidentário · entrevista em 06/10 · nova demanda de quem já é cliente',
        href: '/clientes/antonio-exemplo/fechamento',
      }),
    ])
    const { ficha } = await registrarFechamento('antonio-exemplo', { fechou: true })
    expect(ficha.demandas?.[0].situacao).toBe('fechou')
    expect(ficha).toMatchObject({ situacao: 'cliente', desde: '03/2023' })
    expect(ficha.fechamento).toBeUndefined()
    expect(ficha.historico.at(-1)?.oQue).toBe('Fechou Auxílio Acidentário: caso novo na mesma ficha; segue para o kit do benefício (D1.15)')
    expect(tarefasDeFechamento()).toEqual([])
  })

  it('não fechou: a demanda se encerra com o motivo, sem recontato, e o cliente segue nos outros processos (G16)', async () => {
    await abrirDemanda('antonio-exemplo', envio())
    await entrevistaFeita()
    const naoFechou = { fechou: false as const, motivo: 'preco', detalhe: 'vai pensar', papel: 'atendimento' as const }
    await expect(registrarFechamento('antonio-exemplo', { ...naoFechou, recontatar: { data: '20/10/2026' } })).rejects.toThrow(
      'A nova demanda não tem recontato',
    )
    const { ficha } = await registrarFechamento('antonio-exemplo', { ...naoFechou, recontatar: null })
    expect(ficha.demandas?.[0]).toMatchObject({ situacao: 'nao-fechou', motivo: 'preco', detalhe: 'vai pensar' })
    expect(ficha).toMatchObject({ situacao: 'cliente', processos: [expect.objectContaining({ beneficio: 'incapacidade-permanente' })] })
    expect(ficha.fechamento).toBeUndefined()
    expect(ficha.historico.at(-1)?.oQue).toBe('Nova demanda não fechou: Preço (vai pensar). Segue cliente nos outros processos (G16)')
    await expect(registrarFechamento('antonio-exemplo', { fechou: true })).rejects.toThrow('Não há nova demanda aberta')
  })
})
