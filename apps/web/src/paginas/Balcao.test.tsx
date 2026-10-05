import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configurarExemplo, tarefasDoSetor, zerarExemplo } from '../dados/servidor.ts'
import { Balcao } from './Balcao.tsx'
import { CentralAtendimento } from './CentralAtendimento.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

function buscar(termo: string) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }), { target: { value: termo } })
}

const encaminhar = () => screen.getByRole('button', { name: 'Encaminhar' })

async function escolherPessoa(termo: string, nome: string) {
  buscar(termo)
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(nome) }))
}

describe('Balcão · Receber quem chegou', () => {
  it('abre com o título do Figma e o "Encaminhar" parado até escolher alguém', () => {
    render(<Balcao />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Balcão · Receber quem chegou')
    expect(screen.getByText('Recepção · sem processo ainda')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antes de concluir' })).toBeTruthy()
    expect((encaminhar() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Busque e escolha quem chegou.')).toBeTruthy()
  })

  it('CA10 · parte do nome, com ou sem acento, mostra nome completo e etapa', async () => {
    render(<Balcao />)
    buscar('natali')
    const natalia = await screen.findByRole('button', { name: /Natália Exemplo/ })
    expect(natalia.textContent).toContain('Lead · contato prévio')
    buscar('Nat')
    expect(await screen.findByRole('button', { name: /Natália Exemplo/ })).toBeTruthy()
  })

  it('CA1 · pelo CPF, o cliente aparece com o caso, a etapa e o agendamento do dia', async () => {
    render(<Balcao />)
    buscar('000.000.001-91')
    const antonio = await screen.findByRole('button', { name: /Antônio Exemplo/ })
    expect(antonio.textContent).toContain('Cliente')
    expect(antonio.textContent).toContain('◆ Aposentadoria por incapacidade permanente · Judicial · exigência')
    expect(antonio.textContent).toContain('Sem agendamento hoje')
    buscar('cleide')
    const cleide = await screen.findByRole('button', { name: /Cleide Exemplo/ })
    expect(cleide.textContent).toContain('Hoje 16:00 · Retirada da cópia do contrato')
  })

  it('CA2 e CA5 · pelo telefone, o lead aparece com o agendamento e a ficha de atendimento', async () => {
    render(<Balcao />)
    buscar('(11) 90000-0002')
    const josefa = await screen.findByRole('button', { name: /Josefa Exemplo/ })
    expect(josefa.textContent).toContain('Lead')
    expect(josefa.textContent).toContain('Hoje 15:30 · Entrevista com Dra. Paula · ficha de atendimento ainda não preenchida')
    fireEvent.click(josefa)
    expect(screen.getByText('Resposta: Não, é lead.')).toBeTruthy()
    expect(screen.getByText('Resposta: Sim, confirmar o agendamento.')).toBeTruthy()
  })

  it('CA3 · quem não está no sistema: o portal oferece "Novo cliente"', async () => {
    render(<Balcao />)
    buscar('Ivone Teste')
    expect(await screen.findByText(/Ninguém com esse nome, CPF ou telefone/)).toBeTruthy()
    expect(screen.getByRole('link', { name: '+ Novo cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.getByText('Resposta: Não, lead novo.')).toBeTruthy()
  })

  it('CA7 · "Outra etapa" sem o setor não habilita o "Encaminhar"', async () => {
    render(<Balcao />)
    await escolherPessoa('antonio', 'Antônio Exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Outra etapa' }))
    expect((encaminhar() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Escolha o setor responsável pela etapa.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Financeiro' }))
    expect((encaminhar() as HTMLButtonElement).disabled).toBe(false)
  })

  it('CA4 · encaminhar à Documentação cria a tarefa, que aparece na Central do Atendimento', async () => {
    const { unmount } = render(<Balcao />)
    await escolherPessoa('antonio', 'Antônio Exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Outra etapa' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Documentação · ADM' }))
    expect(screen.getByText('O setor Documentação · ADM recebe a tarefa com a ficha e o agendamento.')).toBeTruthy()
    fireEvent.click(encaminhar())
    expect(await screen.findByRole('heading', { name: '✓ Encaminhado ao setor Documentação · ADM às 14:32' })).toBeTruthy()
    expect(tarefasDoSetor('Documentação · ADM')).toHaveLength(1)
    unmount()

    render(<CentralAtendimento />)
    const fila = within(screen.getByRole('tabpanel'))
    expect(fila.getAllByRole('listitem')).toHaveLength(17)
    expect(fila.getByRole('link', { name: 'Antônio Exemplo · Atender quem chegou' }).getAttribute('href')).toBe(
      '/clientes/antonio-exemplo',
    )
  })

  it('entrevista agendada vai ao Jurídico, com a advogada da agenda; sem entrevista hoje, oferece marcar', async () => {
    render(<Balcao />)
    await escolherPessoa('josefa', 'Josefa Exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Entrevista agendada' }))
    expect(screen.getByText(/A Dra. Paula \(Jurídico\) recebe o aviso com a ficha e o agendamento das 15:30/)).toBeTruthy()
    expect(screen.getByText(/a cliente preenche pelo link antes de entrar/)).toBeTruthy()

    await escolherPessoa('nair', 'Nair Exemplo')
    expect((encaminhar() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('link', { name: 'Marcar a entrevista' }).getAttribute('href')).toBe('/agenda/marcar/nair-exemplo')

    await escolherPessoa('josefa', 'Josefa Exemplo')
    fireEvent.click(encaminhar())
    const feito = within(await screen.findByRole('region', { name: '✓ Encaminhado ao Jurídico às 14:32' }))
    expect(feito.getByRole('link', { name: 'Abrir a ficha do cliente' }).getAttribute('href')).toBe('/clientes/josefa-exemplo')
  })

  it('CA17 · "Nova demanda" só para quem já é cliente, e segue para o processo novo na mesma ficha', async () => {
    const navegar = vi.fn()
    render(<Balcao navegar={navegar} />)
    await escolherPessoa('josefa', 'Josefa Exemplo')
    expect(screen.queryByRole('radio', { name: 'Nova demanda' })).toBeNull()
    await escolherPessoa('antonio', 'Antônio Exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Nova demanda' }))
    fireEvent.click(encaminhar())
    expect(navegar).toHaveBeenCalledWith('/clientes/antonio-exemplo/nova-demanda')
  })

  it('GGVP-17 CA1 · "Entregar documento" dá a tarefa à Documentação, com o nome, e oferece abrir a tarefa', async () => {
    const navegar = vi.fn()
    render(<Balcao navegar={navegar} />)
    await escolherPessoa('rita', 'Rita Exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Entregar documento' }))
    expect(screen.getByText('Quem veio entregar documento vai para a Documentação e o scanner.')).toBeTruthy()
    fireEvent.click(encaminhar())
    expect(await screen.findByRole('heading', { name: '✓ Encaminhado ao setor Documentação · ADM às 14:32' })).toBeTruthy()
    expect(screen.getByText(/recebeu a tarefa "Receber documento" de Rita Exemplo/)).toBeTruthy()
    const [tarefa] = tarefasDoSetor('Documentação · ADM')
    expect(tarefa).toMatchObject({ acao: 'Receber documento', cliente: { nome: 'Rita Exemplo' } })
    expect(screen.getByRole('link', { name: 'Abrir a tarefa' }).getAttribute('href')).toBe(`/balcao/documento/${tarefa.id}`)
    expect(navegar).not.toHaveBeenCalled()
  })
})
