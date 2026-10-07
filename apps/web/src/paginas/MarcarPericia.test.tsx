import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DetalhePericia } from '../componentes/DetalhePericia.tsx'
import { eventosDaAgenda } from '../dados/agenda.ts'
import { lerComprovante, obterPericia, registrarMarcacao, remarcarPericia } from '../dados/pericia.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAdvogada } from './CentralAdvogada.tsx'
import { CentralJuridicoAdm } from './CentralJuridicoAdm.tsx'
import { MarcarPericia } from './MarcarPericia.tsx'
import { ProcessoPericia } from './ProcessoPericia.tsx'

let agora = new Date(2026, 9, 7, 10, 0)

beforeEach(() => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('?perfil=juridico-adm')
})

const pdf = (nome: string) => new File([`conteúdo de ${nome}`], nome, { type: 'application/pdf' })

async function abrir(remarcar = false) {
  render(<MarcarPericia processoId="maria-exemplo-1" remarcar={remarcar} />)
  await screen.findByRole('heading', { level: 1, name: /Maria Exemplo · (Remarcar|Marcar) perícia/ })
}

describe('GGVP-53 · Marcar a perícia (Figma 10:374)', () => {
  it('CA1 · "Não, tentar de novo" pede o dia e o que aconteceu; a tentativa fica e a próxima é amanhã', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maria Exemplo · Marcar perícia')
    expect(screen.getByText('perícia médica · no INSS; subir o comprovante')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Não, tentar de novo' }))
    const registrar = screen.getByRole('button', { name: 'Registrar a tentativa' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Informe o dia da tentativa (dd/mm/aaaa).')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Dia da tentativa/), { target: { value: '07/10/2026' } })
    fireEvent.change(screen.getByLabelText(/O que aconteceu/), { target: { value: 'Meu INSS sem vaga na agência próxima' } })
    fireEvent.click(registrar)
    expect(await screen.findByText('Tentativa registrada: a tarefa continua com você e volta amanhã.')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Tentativas de marcar' })).getByRole('listitem').textContent).toBe(
      '1ª · 07/10 · Meu INSS sem vaga na agência próxima · Igor (exemplo)',
    )
    expect(screen.getByText('Próxima tentativa: amanhã (uma por dia).')).toBeTruthy()
  })

  it('CA2, CA3, CA4 · o comprovante lido para conferir, sem perito; "Registrar" só com a decisão; registrado, vai à agenda', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, marcado' }))
    const registrar = screen.getByRole('button', { name: 'Registrar a perícia' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Anexe o comprovante do INSS (PDF).')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Comprovante do INSS \(PDF\)/), { target: { files: [pdf('comprovante_maria.pdf')] } })
    const lido = await screen.findByRole('group', { name: 'Lido do comprovante · confira' })
    expect((within(lido).getByLabelText(/Data/) as HTMLInputElement).value).toBe('21/10/2026')
    expect((within(lido).getByLabelText('Hora') as HTMLInputElement).value).toBe('08:30')
    expect((within(lido).getByLabelText('Local') as HTMLInputElement).value).toBe('Agência INSS Santo Amaro (exemplo)')
    expect(within(lido).getByText('perícia médica · presencial · perito não consta no comprovante')).toBeTruthy()
    expect(screen.getByText(/comprovante_maria\.pdf · 1 KB · anexado/)).toBeTruthy()
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Responda se a perícia pede documento novo.')).toBeTruthy()
    // A pessoa confere e corrige a hora antes de registrar (CA3).
    fireEvent.change(within(lido).getByLabelText('Hora'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Sim: atribuir à Documentação' }))
    expect(registrar.disabled).toBe(false)
    fireEvent.click(registrar)
    expect(await screen.findByRole('heading', { name: '✓ Perícia registrada' })).toBeTruthy()
    expect(screen.getByText('quarta, 21/10, 09:00 · Agência INSS Santo Amaro (exemplo) · perícia médica · presencial')).toBeTruthy()
    expect(screen.getByText(/A perícia pede documento novo: a Documentação reúne até 11\/10 \(10 dias antes\)/)).toBeTruthy()
    expect(screen.getByText(/Lembrete da véspera: 20\/10, pelo Chatwoot, revisado pelo Jurídico/)).toBeTruthy()
    const evento = (await eventosDaAgenda('2026-10-21', '2026-10-21')).find((e) => e.categoria === 'pericias')
    expect(evento?.hora).toBe('09:00')
  })

  it('CA6 · marcado sem comprovante: pede a resposta do documento novo e deixa a tarefa esperando', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Marcado, sem comprovante ainda' }))
    const esperar = screen.getByRole('button', { name: 'Esperar o comprovante' }) as HTMLButtonElement
    expect(esperar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Não: seguir para ligar e orientar' }))
    fireEvent.click(esperar)
    expect(await screen.findByText('A tarefa espera o comprovante, com lembrete diário.')).toBeTruthy()
    expect(screen.getByText(/o comprovante ainda não saiu \(DP\.E1\)/)).toBeTruthy()
    expect((await obterPericia('maria-exemplo-1'))?.situacao).toBe('aguardando-comprovante')
  })

  it('CA7 · na véspera, "Enviar o lembrete" abre o Chatwoot com a mensagem para conferir', async () => {
    const lido = await lerComprovante('maria-exemplo-1', 'c.pdf')
    await registrarMarcacao('maria-exemplo-1', { comprovante: { nome: 'c.pdf' }, lido, pedeDocumentoNovo: false }, 'Igor (exemplo)')
    await abrir()
    expect((screen.getByRole('button', { name: 'Enviar o lembrete da véspera' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('O lembrete abre na véspera, 20/10.')).toBeTruthy()
  })

  it('CA8, CA9 · remarcar pede o motivo e conta no limite (G15)', async () => {
    const lido = await lerComprovante('maria-exemplo-1', 'c.pdf')
    await registrarMarcacao('maria-exemplo-1', { comprovante: { nome: 'c.pdf' }, lido, pedeDocumentoNovo: false }, 'Igor (exemplo)')
    await abrir(true)
    expect(screen.getByText(/A remarcação conta no limite de 2: já foram 0/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Motivo da remarcação/), { target: { value: 'cliente internada no dia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a remarcação' }))
    expect(await screen.findByText('Remarcação registrada: a tarefa de marcar volta para você.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Maria Exemplo · Remarcar perícia')
    expect(screen.getByText('perícia médica · no INSS; subir o comprovante · 1ª remarcação')).toBeTruthy()
  })

  it('G9 · sem campo de senha: a marcação é pelo Meu INSS, com a senha do cofre', async () => {
    await abrir()
    expect(screen.queryByLabelText(/senha/i)).toBeNull()
    expect(screen.getByText(/A marcação é pelo Meu INSS, com a senha do cofre \(G9\)/)).toBeTruthy()
  })
})

describe('GGVP-53 · o comprovante pelo chat (Figma 2085:2)', () => {
  it('CA5 · a IA lê e identifica a cliente; nada acontece antes de "Confirmar e marcar"', async () => {
    render(<CentralJuridicoAdm />)
    fireEvent.change(screen.getByLabelText('+ Anexar arquivo'), { target: { files: [pdf('comprovante_pericia_maria.pdf')] } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Esse aqui é o comprovante da perícia da Maria Exemplo. Marcar.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    const card = await screen.findByRole('group', { name: 'Ação para confirmar · Marcar a perícia · Maria Exemplo' })
    expect(screen.getByText(/identifiquei o cliente: Maria Exemplo \(auxílio por incapacidade temporária\)/)).toBeTruthy()
    expect(within(card).getByText('2 Agendar: perícia médica em 21/10, 08:30, Agência INSS Santo Amaro (exemplo)')).toBeTruthy()
    expect(within(card).getByText(/A IA não escolhe nem sugere o perito/)).toBeTruthy()
    expect((await obterPericia('maria-exemplo-1'))?.situacao).toBe('marcar')
    const confirmar = within(card).getByRole('button', { name: 'Confirmar e marcar' }) as HTMLButtonElement
    expect(confirmar.disabled).toBe(true)
    fireEvent.click(within(card).getByRole('radio', { name: 'Não' }))
    fireEvent.click(confirmar)
    expect(await screen.findByText(/✓ Feito: a perícia de Maria Exemplo está na agenda e na ficha; o lembrete da véspera sai em 20\/10/)).toBeTruthy()
    await waitFor(async () => expect((await obterPericia('maria-exemplo-1'))?.situacao).toBe('agendada'))
  })
})

describe('GGVP-53 · agenda, página do processo e o limite na Central da Advogada', () => {
  it('CA2 · o evento da perícia na agenda: abrir o processo e remarcar com o Jurídico administrativo (Figma 2164:513)', async () => {
    const [evento] = (await eventosDaAgenda('2026-10-16', '2026-10-16')).filter((e) => e.categoria === 'pericias')
    render(<DetalhePericia evento={evento} aoFechar={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Antônio Exemplo · Perícia médica' })).toBeTruthy()
    expect(screen.getByText('DP.04')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir o processo' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia')
    expect(screen.getByRole('link', { name: 'Remarcar' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia/marcar?remarcar=1')
    expect(screen.getByText(/Remarcar a perícia é com o Jurídico administrativo/)).toBeTruthy()
  })

  it('judicial · a página do processo diz que a data veio da publicação, e os prazos que ela define', async () => {
    iniciarPerfil('?perfil=advogada')
    render(<ProcessoPericia processoId="antonio-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Perícias' })
    expect(screen.getByText('data lida da publicação')).toBeTruthy()
    expect(screen.getByText(/O sistema leu a data na publicação do juízo e pôs na agenda e na ficha: sexta, 16\/10, às 10:30/)).toBeTruthy()
    const prazos = screen.getByRole('heading', { name: 'Prazos' }).closest('section')!.textContent
    expect(prazos).toContain('13/10Orientar o cliente (até 3 dias antes)')
    expect(prazos).toContain('15/10Lembrete da véspera')
  })

  it('CA9 · passou do limite: a advogada responsável vê "Decidir a perícia" e autoriza com justificativa', async () => {
    for (const motivo of ['cliente doente', 'agência fechada', 'cliente viajou']) {
      const lido = await lerComprovante('maria-exemplo-1', 'c.pdf')
      await registrarMarcacao('maria-exemplo-1', { comprovante: { nome: 'c.pdf' }, lido, pedeDocumentoNovo: false }, 'Igor (exemplo)')
      await remarcarPericia('maria-exemplo-1', motivo, 'Igor (exemplo)')
    }
    iniciarPerfil('?perfil=advogada')
    const { unmount } = render(<CentralAdvogada />)
    expect(screen.getByRole('link', { name: 'Maria Exemplo · Decidir a perícia' }).getAttribute('href')).toBe('/casos/maria-exemplo-1/pericia')
    unmount()
    render(<ProcessoPericia processoId="maria-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Decisão da advogada responsável (G15)' })
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'Cliente internada; o médico dá alta na semana que vem.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar mais uma remarcação' }))
    expect(await screen.findByText('Remarcação autorizada: a tarefa de marcar volta para o Jurídico administrativo.')).toBeTruthy()
  })
})
