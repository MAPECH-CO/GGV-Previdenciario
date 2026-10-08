import { beforeEach, describe, expect, it } from 'vitest'
import {
  criarCompromissoInterno,
  eventosDaAgenda,
  marcarEntrevista,
  prepararConvite,
  registrarConvite,
  registrarResultado,
  tarefasDeConfirmar,
} from './agenda.ts'
import { configurarExemplo, encaminhar, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'
import type { Marcacao } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)
const AMANHA = '2026-10-06'
const ONTEM = '2026-10-04'

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

const marcacao = (resto: Partial<Marcacao> = {}): Marcacao => ({
  tipo: 'video',
  data: AMANHA,
  hora: '10:30',
  duracao: 45,
  com: 'paula',
  gravar: true,
  levar: true,
  pedirFicha: true,
  confirmarHorarioOcupado: false,
  ...resto,
})

describe('Agenda · servidor de exemplo', () => {
  it('CA1 e CA5 · a entrevista marcada vai para a agenda com tipo e responsável', async () => {
    const resposta = await marcarEntrevista('natalia-exemplo', marcacao())
    expect(resposta.resultado).toBe('marcado')
    const [natalia] = await eventosDaAgenda(AMANHA, AMANHA)
    expect(natalia).toMatchObject({ titulo: 'Natália Exemplo', oQue: 'Fazer entrevista', tipo: 'video', responsavel: 'Dra. Paula', estado: 'agendado' })
    expect((await obterFicha('natalia-exemplo'))?.historico.at(-1)?.oQue).toBe('Marcou a entrevista para 06/10 às 10:30 (vídeo (meet)) com Dra. Paula')
  })

  it('CA2 · com quem só pode ser a advogada; o servidor recusa o resto', async () => {
    await expect(marcarEntrevista('natalia-exemplo', marcacao({ com: 'atendimento' }))).rejects.toThrow('Marcação inválida')
    await expect(marcarEntrevista('natalia-exemplo', marcacao({ data: ONTEM }))).rejects.toThrow('Marcação inválida')
  })

  it('CA3 · horário ocupado avisa quem está lá e marca se a pessoa confirmar', async () => {
    await marcarEntrevista('natalia-exemplo', marcacao())
    const aviso = await marcarEntrevista('antonio-exemplo', marcacao({ hora: '10:30' }))
    expect(aviso.resultado === 'ocupado' && aviso.conflitos.map((c) => c.titulo)).toEqual(['Natália Exemplo'])
    expect((await marcarEntrevista('antonio-exemplo', marcacao({ confirmarHorarioOcupado: true }))).resultado).toBe('marcado')
    expect(await eventosDaAgenda(AMANHA, AMANHA)).toHaveLength(2)
  })

  it('CA4 · o convite sai pronto e, enviado no Chatwoot, fica em "Últimos contatos"', async () => {
    const resposta = await marcarEntrevista('josefa-exemplo', marcacao({ hora: '14:00' }))
    if (resposta.resultado !== 'marcado') throw new Error(resposta.resultado)
    const { mensagem } = await prepararConvite(resposta.agendamento.id)
    expect(mensagem).toContain('Olá, Josefa! Sua conversa com o escritório GGV está marcada para terça, 06/10, às 14h, por vídeo.')
    expect(mensagem).toContain(`Link: meet.google.com/ggv-${resposta.agendamento.id}.`)
    expect(mensagem).toContain('ficha de atendimento em papel')
    await registrarConvite(resposta.agendamento.id, mensagem)
    const josefa = await obterFicha('josefa-exemplo')
    expect(josefa?.contatos.at(-1)).toMatchObject({ canal: 'Chatwoot', data: '2026-10-05' })
    expect(josefa?.agendamentos.at(-1)?.conviteEnviadoEm).toBe(AGORA.toISOString())
  })

  it('CA5 · compromisso interno, sem cliente, entra na agenda com o responsável', async () => {
    const interno = await criarCompromissoInterno({ titulo: 'Gravação do vídeo do escritório', data: AMANHA, hora: '17:00', duracao: 60, responsavel: 'atendimento' })
    expect(interno).toMatchObject({ titulo: 'Gravação do vídeo do escritório', oQue: 'Compromisso interno', responsavel: 'Você (Atendimento)' })
    expect(interno.fichaId).toBeUndefined()
    expect((await eventosDaAgenda(AMANHA, AMANHA)).map((e) => e.titulo)).toEqual(['Gravação do vídeo do escritório'])
    await expect(criarCompromissoInterno({ titulo: 'x', data: AMANHA, hora: '17:00', duracao: 60, responsavel: 'atendimento' })).rejects.toThrow()
  })

  it('CA8 · a entrevista de ontem sem registro fica "confirmar" e a Central lembra', async () => {
    const [natalia] = await eventosDaAgenda(ONTEM, ONTEM)
    expect(natalia).toMatchObject({ titulo: 'Natália Exemplo', estado: 'confirmar' })
    expect(tarefasDeConfirmar()).toEqual([expect.objectContaining({ acao: 'Confirmar se a entrevista aconteceu', cliente: { id: 'natalia-exemplo', nome: 'Natália Exemplo' } })])
  })

  it('CA6 · "Realizado" conclui a tarefa da entrevista e o lead segue para "Cadastrar lead"', async () => {
    await encaminhar({ fichaId: 'josefa-exemplo', motivo: 'entrevista', setor: 'Jurídico' })
    expect(tarefasDoSetor('Jurídico').map((t) => t.acao)).toEqual(['Receber para a entrevista'])
    await registrarResultado('josefa-entrevista', 'realizado')
    expect(tarefasDoSetor('Jurídico').map((t) => t.acao)).toEqual(['Cadastrar lead'])
    expect((await eventosDaAgenda('2026-10-05', '2026-10-05')).find((e) => e.id === 'josefa-entrevista')?.estado).toBe('realizado')
    await expect(registrarResultado('josefa-entrevista', 'faltou')).rejects.toThrow('já foi registrado')
  })

  it('CA7, CA8 e CA9 · "Faltou" e remarcar com motivo, que vai para "Últimos contatos"; na terceira, sobe para a sênior', async () => {
    await registrarResultado('natalia-entrevista', 'faltou')
    expect(tarefasDeConfirmar()).toEqual([])
    const remarcar = (agendamentoId: string, motivo = 'Estava sem internet na hora') => marcarEntrevista('natalia-exemplo', marcacao({ remarcar: { agendamentoId, motivo } }))
    await expect(remarcar('natalia-entrevista', '')).rejects.toThrow('Marcação inválida')

    const primeira = await remarcar('natalia-entrevista')
    if (primeira.resultado !== 'marcado') throw new Error(primeira.resultado)
    expect(primeira.agendamento.remarcacoes).toBe(1)
    const natalia = await obterFicha('natalia-exemplo')
    expect(natalia?.agendamentos.find((a) => a.id === 'natalia-entrevista')?.estado).toBe('remarcado')
    expect(natalia?.contatos.at(-1)).toEqual({ data: '2026-10-05', canal: 'Remarcação', texto: 'Estava sem internet na hora' })
    expect((await eventosDaAgenda(ONTEM, AMANHA)).filter((e) => e.fichaId === 'natalia-exemplo').map((e) => e.id)).toEqual([primeira.agendamento.id])

    const segunda = await remarcar(primeira.agendamento.id)
    if (segunda.resultado !== 'marcado') throw new Error(segunda.resultado)
    expect(segunda.agendamento.remarcacoes).toBe(2)
    expect(await remarcar(segunda.agendamento.id)).toEqual({ resultado: 'limite' })
  })
})
