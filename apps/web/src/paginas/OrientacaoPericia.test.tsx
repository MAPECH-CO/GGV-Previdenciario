import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { recusasDoChat } from '../dados/pericia.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAtendimento } from './CentralAtendimento.tsx'
import { CentralJuridicoAdm } from './CentralJuridicoAdm.tsx'
import { ProcessoPericia } from './ProcessoPericia.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('?perfil=advogada')
})

describe('GGVP-61 · a orientação na página do processo (Figma 2179:664) e a jurimetria (2184:2)', () => {
  it('CA2, CA9, CA12 · pelo perfil do perito, com a versão; a jurimetria com os números do sistema', async () => {
    render(<ProcessoPericia processoId="antonio-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Perícias' })
    expect(screen.getByText('pelo perfil de Dr. A. Prado (exemplo), versão 34 (IA e acervo)')).toBeTruthy()
    expect(screen.getByText(/O perfil de Dr\. A\. Prado \(exemplo\) está na base e a orientação já segue esse perfil \(DP\.05\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver a orientação' }))
    expect(screen.getByLabelText('Texto da orientação').textContent).toContain('O que Dr. A. Prado costuma observar')
    expect(screen.getByText(/Verificada antes de chegar ao Jurídico administrativo/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver a jurimetria do perito' }))
    const janela = screen.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' })
    expect(within(janela).getByText('amostra suficiente (G22)')).toBeTruthy()
    expect(within(janela).getByText('71% · 24 de 34')).toBeTruthy()
    // Por assunto, a coluna tem menos de 10 laudos: amostra insuficiente (G22).
    expect(within(janela).getByText('amostra insuficiente (8 laudos)')).toBeTruthy()
    expect(within(janela).getByRole('link', { name: /Antônio Exemplo · perícia 16\/10, 10:30/ }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia')
  })

  it('CA5, CA6 · sem perito: vale a padrão e a pergunta de um clique liga o perito; a orientação sai pelo perfil', async () => {
    render(<ProcessoPericia processoId="pedro-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Quem é o perito?' })
    expect(screen.getByText('padrão: o comprovante do INSS não traz o perito: informe quando o nome chegar')).toBeTruthy()
    expect(screen.getByText(/Nada trava: vale a orientação padrão e a jurimetria não foi feita/)).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: 'Ligar o perito' })).getByRole('button', { name: 'Sra. L. Assis (exemplo) · Assistente social do INSS' }))
    expect(await screen.findByText('Perito ligado: Sra. L. Assis (exemplo). A orientação foi montada de novo pelo perfil dele.')).toBeTruthy()
    expect(screen.getByText('pelo perfil de Sra. L. Assis (exemplo), versão 12 (IA e acervo)')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Quem é o perito?' })).toBeNull()
  })

  it('"Ver o perfil do perito" do chat abre a página com a jurimetria', async () => {
    render(<ProcessoPericia processoId="antonio-exemplo-1" abrirPerito />)
    expect(await screen.findByRole('dialog', { name: 'Dr. A. Prado (exemplo)' })).toBeTruthy()
  })
})

describe('GGVP-61 · o chat (Figma 2186:857) e a recusa do G11', () => {
  it('"Dica para a perícia": o perfil do perito, os números e a tarefa de orientar', async () => {
    iniciarPerfil('?perfil=juridico-adm')
    render(<CentralJuridicoAdm />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Qual a orientação para a perícia do Antônio com o Dr. A. Prado?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText(/Pelo perfil de Dr\. A\. Prado \(34 laudos, 71% favoráveis\)/)).toBeTruthy()
    const itens = within(screen.getByRole('list', { name: 'Tarefas sugeridas' })).getAllByRole('link')
    expect(itens.map((i) => i.getAttribute('href'))).toEqual(['/casos/antonio-exemplo-1/pericia?perito=1', '/casos/antonio-exemplo-1/pericia/orientar'])
    expect(screen.getByRole('link', { name: 'Antônio Exemplo · Orientar para a perícia' })).toBeTruthy()
  })

  it('CA11 · em qualquer Central, pedir para esconder ou mudar a situação real é recusado e fica registrado', () => {
    iniciarPerfil('?perfil=atendimento')
    render(<CentralAtendimento />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Como faço para esconder a renda do filho na avaliação social?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByRole('status').textContent).toBe(
      'Não posso orientar a esconder, mudar ou simular a situação real: isso é fraude e põe o processo e o escritório em risco (G11). O pedido ficou registrado.',
    )
    expect(recusasDoChat()).toMatchObject([{ quem: 'Bruna (exemplo)', texto: 'Como faço para esconder a renda do filho na avaliação social?' }])
  })
})
