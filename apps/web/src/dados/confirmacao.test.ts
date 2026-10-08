import { beforeEach, describe, expect, it } from 'vitest'
import { marcarEntrevista } from './agenda.ts'
import {
  obterConfirmacao,
  registrarConfirmacao,
  registrarMensagemDeConfirmacao,
  tarefasDeConfirmarAgendamento,
} from './confirmacao.ts'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'

let agora = new Date(2026, 9, 5, 14, 32)
const JOSEFA = 'josefa-entrevista'

beforeEach(() => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

/** Uma entrevista da Natália na sexta, para as duas tentativas caberem antes dela. */
async function entrevistaDaNatalia(): Promise<string> {
  const r = await marcarEntrevista('natalia-exemplo', {
    tipo: 'video',
    data: '2026-10-09',
    hora: '10:30',
    duracao: 45,
    com: 'paula',
    gravar: true,
    levar: true,
    pedirFicha: true,
    confirmarHorarioOcupado: false,
  })
  if (r.resultado !== 'marcado') throw new Error('não marcou')
  return r.agendamento.id
}

describe('Confirmação do agendamento · servidor de exemplo', () => {
  it('CA1 e CA4 · a Central tem uma tarefa por entrevista de lead ainda não confirmada', async () => {
    expect(tarefasDeConfirmarAgendamento()).toEqual([
      {
        id: `confirmar-agendamento-${JOSEFA}`,
        codigo: 'D1.04',
        cliente: { id: 'josefa-exemplo', nome: 'Josefa Exemplo' },
        acao: 'Confirmar agendamento',
        detalhe: 'LOAS Idoso · entrevista hoje 15:30',
        prazo: '15:30',
        urgente: true,
        href: `/agenda/confirmar/${JOSEFA}`,
      },
    ])
    await entrevistaDaNatalia()
    expect(tarefasDeConfirmarAgendamento().map((t) => [t.cliente?.nome, t.prazo])).toEqual([
      ['Josefa Exemplo', '15:30'],
      ['Natália Exemplo', '09/10'],
    ])
  })

  it('CA1 e CA8 · a tela recebe a tentativa e a mensagem com o que levar do LOAS e a ficha em papel', async () => {
    const dados = await obterConfirmacao(JOSEFA)
    expect(dados?.tentativa).toBe(1)
    expect(dados?.ficha.fichaAtendimentoPreenchida).toBe(false)
    expect(dados?.mensagem).toContain('segunda, 05/10, às 15h30, aqui no escritório')
    expect(dados?.mensagem).toContain('preencha a ficha de atendimento em papel')
    expect(dados?.mensagem).toContain('Traga RG e CPF de todos da casa, comprovante de renda e CadÚnico; sem CadÚnico, vá ao CRAS antes.')
    expect(await obterConfirmacao('nao-existe')).toBeNull()
  })

  it('CA1 · a mensagem enviada pelo Chatwoot fica em "Últimos contatos"', async () => {
    await registrarMensagemDeConfirmacao(JOSEFA, 'Olá, Josefa! Confirma?')
    const josefa = await obterFicha('josefa-exemplo')
    expect(josefa?.contatos.at(-1)).toEqual({ data: '2026-10-05', canal: 'Chatwoot', texto: 'Confirmação da entrevista de hoje às 15:30: Olá, Josefa! Confirma?' })
    expect(josefa?.historico.at(-1)?.oQue).toBe('Mandou a mensagem de confirmação da entrevista pelo Chatwoot')
  })

  it('CA2, CA5 e CA7 · confirmou sem ficha: grava quando, quem e o canal e abre "Preencher ficha" até a hora da entrevista', async () => {
    const r = await registrarConfirmacao(JOSEFA, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: false })
    expect(r).toMatchObject({ tentativa: 1, naSenior: false, tarefa: { acao: 'Preencher ficha', prazo: 'até 15:30', setor: 'Atendimento' } })
    const josefa = await obterFicha('josefa-exemplo')
    expect(josefa?.agendamentos[0].confirmacao?.tentativas).toEqual([
      { quando: agora.toISOString(), quem: 'Você (Atendimento)', canal: 'ligacao', resultado: 'confirmou' },
    ])
    expect(josefa?.contatos.at(-1)).toEqual({ data: '2026-10-05', canal: 'Ligação', texto: 'Confirmou a entrevista de hoje às 15:30.' })
    expect(josefa?.historico.map((e) => e.oQue)).toContain('Confirmou a entrevista de hoje às 15:30 (ligação, tentativa 1)')
    expect(tarefasDoSetor('Atendimento')).toMatchObject([
      { codigo: 'D1.05', cliente: { nome: 'Josefa Exemplo' }, href: '/clientes/josefa-exemplo/ficha-de-atendimento', urgente: true },
    ])
    expect(tarefasDeConfirmarAgendamento()).toEqual([])
    await expect(registrarConfirmacao(JOSEFA, { resultado: 'sem-resposta', canal: 'ligacao' })).rejects.toThrow('não espera confirmação')
  })

  it('CA3 · confirmou com ficha: o Jurídico recebe "Preparar entrevista"', async () => {
    await registrarConfirmacao(JOSEFA, { resultado: 'confirmou', canal: 'mensagem', jaPreencheuFicha: true })
    expect(tarefasDoSetor('Jurídico')).toMatchObject([
      { codigo: 'D1.06', acao: 'Preparar entrevista', prazo: 'antes das 15:30', href: `/entrevista/${JOSEFA}/preparar` },
    ])
    expect(tarefasDoSetor('Atendimento')).toEqual([])
  })

  it('CA6 · sem resposta: tentativa 1 de 2, a próxima em 3 dias; na segunda, a advogada sênior', async () => {
    const id = await entrevistaDaNatalia()
    const primeira = await registrarConfirmacao(id, { resultado: 'sem-resposta', canal: 'mensagem' })
    expect(primeira).toEqual({ tentativa: 1, proximaEm: '2026-10-08', naSenior: false })
    expect(tarefasDeConfirmarAgendamento().find((t) => t.cliente?.nome === 'Natália Exemplo')).toMatchObject({
      prazo: 'nova tentativa 08/10',
      detalhe: 'Auxílio por Incapacidade Temporária · entrevista 09/10 10:30 · tentativa 2 de 2',
    })
    await expect(registrarConfirmacao(id, { resultado: 'sem-resposta', canal: 'ligacao' })).rejects.toThrow('A próxima tentativa é em 08/10')

    agora = new Date(2026, 9, 8, 9, 0)
    const segunda = await registrarConfirmacao(id, { resultado: 'sem-resposta', canal: 'ligacao' })
    expect(segunda).toMatchObject({ tentativa: 2, naSenior: true, tarefa: { acao: 'Confirmar agendamento', setor: 'Jurídico' } })
    expect(tarefasDeConfirmarAgendamento().some((t) => t.cliente?.nome === 'Natália Exemplo')).toBe(false)
    expect(tarefasDoSetor('Jurídico').map((t) => t.detalhe)).toEqual(['2 tentativas sem resposta · a advogada sênior resolve e entra em contato com o lead'])
    const historico = (await obterFicha('natalia-exemplo'))?.historico.map((e) => e.oQue)
    expect(historico).toContain('Tentativa 1 de 2 sem resposta (mensagem pelo Chatwoot); nova tentativa em 08/10')
    expect(historico).toContain('Tentativa 2 sem resposta (ligação): passou para a advogada sênior')

    // A sênior confirma: a tarefa dela sai.
    await registrarConfirmacao(id, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    expect(tarefasDoSetor('Jurídico').map((t) => t.acao)).toEqual(['Preparar entrevista'])
  })

  it('só a entrevista de lead em aberto espera confirmação; registro sem canal não passa', async () => {
    await expect(registrarConfirmacao('cleide-retirada', { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })).rejects.toThrow(
      'não espera confirmação',
    )
    await expect(registrarConfirmacao(JOSEFA, { resultado: 'sem-resposta', canal: 'fax' as 'ligacao' })).rejects.toThrow('Registro inválido')
  })
})
