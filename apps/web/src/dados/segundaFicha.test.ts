import { beforeEach, describe, expect, it } from 'vitest'
import { respostasVazias } from '../regras/segundaFicha.ts'
import { lerSegundaFichaEmPapel, registrarAnalise, salvarSegundaFicha } from './segundaFicha.ts'
import { configurarExemplo, ler, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

const respostas = { ...respostasVazias(), historico: 'Prendeu a mão na máquina.', doencas: 'dor na mão' }

describe('Segunda ficha · servidor de exemplo', () => {
  it('CA1 e CA4 · "Sim" grava a decisão com a autora e o horário e abre "Preencher segunda ficha" até a entrevista', async () => {
    const { tarefas } = await registrarAnalise('josefa-entrevista', { acidentario: true })
    const josefa = await obterFicha('josefa-exemplo')
    expect(josefa?.analise).toEqual({ acidentario: true, quem: 'Você (Advogada)', quando: AGORA.toISOString() })
    expect(josefa?.historico.at(-1)).toEqual({ quando: AGORA.toISOString(), quem: 'Você (Advogada)', oQue: 'Analisou a ficha: pode ser auxílio acidentário' })
    expect(tarefas[0]).toMatchObject({ codigo: 'D1.07', acao: 'Preencher segunda ficha', prazo: 'até 15:30', href: '/clientes/josefa-exemplo/segunda-ficha' })
    // A Josefa está sem senha: o Atendimento também renova (GGVP-36).
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).toEqual(['Preencher segunda ficha', 'Renovar senha do gov.br'])
  })

  it('CA4 · "Não" também fica no histórico e não abre a segunda ficha', async () => {
    const { tarefas } = await registrarAnalise('josefa-entrevista', { acidentario: false })
    expect(tarefas.map((t) => t.acao)).toEqual(['Renovar senha do gov.br'])
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe('Analisou a ficha: não é auxílio acidentário')
  })

  it('CA6, CA7 e CA8 · o papel no scanner: a imagem na pasta, a senha no cofre e a seção médica só para o Jurídico', async () => {
    const leitura = await lerSegundaFichaEmPapel('josefa-exemplo')
    expect(leitura.arquivo).toMatchObject({ nome: 'Ficha de atendimento AUXILIO ACIDENTE - Josefa Exemplo - 2026-10-05.pdf', tipo: 'ficha-acidente', local: 'pessoais' })
    expect(leitura.respostas).toMatchObject({ empresa: 'Exemplo Indústria Ltda', cat: 'sim', lado: 'direito', doencas: '', tratamento: '', laudos: '' })
    expect(leitura.senhaLida).toBe(true)
    expect((await obterFicha('josefa-exemplo'))?.senhaGov).toMatchObject({ situacao: 'no-cofre', conferir: true })
    expect(JSON.stringify((await obterFicha('josefa-exemplo'))?.historico)).not.toContain('dor e perda de força')

    // O Atendimento confere e salva sem ver a seção médica; ela entra pela leitura.
    const { ficha } = await salvarSegundaFicha('josefa-exemplo', leitura.respostas, 'papel')
    expect(ficha.segundaFicha?.respostas).toMatchObject({ doencas: 'dor e perda de força na mão', tratamento: 'fisioterapia', empresa: 'Exemplo Indústria Ltda' })
    expect(ler().leiturasMedicas).toEqual([])
  })

  it('CA2 e CA3 · salvar conclui a pendência, guarda o que ficou em branco e a data; no tablet, quem salva é a cliente', async () => {
    await registrarAnalise('josefa-entrevista', { acidentario: true })
    const { ficha } = await salvarSegundaFicha('josefa-exemplo', { ...respostas, acidenteEm: '01092026' }, 'tablet')
    expect(ficha.segundaFicha).toMatchObject({ data: '2026-10-05', origem: 'tablet' })
    expect(ficha.segundaFicha?.respostas.acidenteEm).toBe('01/09/2026')
    expect(ficha.segundaFicha?.emBranco).toContain('Empresa')
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Cliente (tablet)', oQue: 'Salvou a segunda ficha (auxílio acidentário, tablet)' })
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).toEqual(['Renovar senha do gov.br'])
  })

  it('sem o histórico do caso, com data futura ou NB errado, não salva', async () => {
    await expect(salvarSegundaFicha('josefa-exemplo', { ...respostas, historico: '' }, 'papel')).rejects.toThrow('inválida')
    await expect(salvarSegundaFicha('josefa-exemplo', { ...respostas, der: '06/10/2026' }, 'papel')).rejects.toThrow('inválida')
    await expect(salvarSegundaFicha('josefa-exemplo', { ...respostas, nb: '123' }, 'papel')).rejects.toThrow('inválida')
  })
})
