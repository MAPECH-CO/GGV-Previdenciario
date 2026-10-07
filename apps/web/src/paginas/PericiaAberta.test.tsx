import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { iniciarPericia } from '../dados/pericia.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralJuridicoAdm } from './CentralJuridicoAdm.tsx'
import { PericiaAberta } from './PericiaAberta.tsx'
import { ProcessoPericia } from './ProcessoPericia.tsx'
import { CasoEmAndamento } from '../componentes/CasoEmAndamento.tsx'
import { obterFicha } from '../dados/servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('')
})

describe('GGVP-49 · Tarefa de perícia aberta pelo sistema (Figma 14:534)', () => {
  it('CA1, CA3 · o que o sistema fez, o que veio preenchido e "Sem trava"', async () => {
    render(<PericiaAberta processoId="maria-exemplo-1" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Tarefa de perícia aberta pelo sistema' })).toBeTruthy()
    expect(screen.getByText('Maria Exemplo · perícia médica')).toBeTruthy()
    expect(screen.getByText(/O sistema abriu sozinho a tarefa «Marcar a perícia» para o Jurídico administrativo/)).toBeTruthy()
    const preenchido = within(screen.getByRole('list', { name: 'Preenchido pelo sistema' })).getAllByRole('listitem').map((l) => l.textContent)
    expect(preenchido).toEqual([
      '• Quem pediu: D2 · necessidade inicial · Dra. Paula (exemplo)',
      '• Tipo: Perícia médica',
      '• Instância: INSS',
      '• O que a perícia pede: ainda não se sabe; vem com a marcação',
    ])
    expect(screen.getByText(/Sem trava: o sistema abre a tarefa sozinho/)).toBeTruthy()
  })

  it('Lucas, 02/10 · a próxima ação, a data em que foi aberta, os prazos máximos e o botão até a tarefa', async () => {
    render(<PericiaAberta processoId="maria-exemplo-1" />)
    await screen.findByRole('heading', { name: 'O que acontece agora' })
    expect(screen.getByText(/O Jurídico administrativo marca a perícia médica de Maria pelo Meu INSS \(senha no cofre, G9\)/)).toBeTruthy()
    const prazos = screen.getByRole('heading', { name: 'Datas e prazos máximos' }).closest('section')!.textContent
    expect(prazos).toContain('Tarefa aberta em06/10/2026 16:10, pelo sistema')
    expect(prazos).toContain('liberado em 07/10/2026 08:00 (D2.E1)')
    expect(prazos).toContain('tentativa diária; a próxima é hoje')
    expect(prazos).toContain('até 10 dias antes da perícia')
    expect(prazos).toContain('até 3 dias antes da perícia')
    expect(screen.getByRole('link', { name: 'Ver a tarefa aberta' }).getAttribute('href')).toBe('/casos/maria-exemplo-1/pericia/marcar')
  })

  it('CA4 · o histórico diz que foi o sistema, quando e a decisão de quem', async () => {
    render(<PericiaAberta processoId="maria-exemplo-1" />)
    const historico = await screen.findByRole('list', { name: 'Histórico da perícia' })
    const linhas = within(historico).getAllByRole('listitem').map((l) => l.textContent)
    expect(linhas[1]).toBe(
      '06/10/2026 16:10Sistema · Abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de Dra. Paula (exemplo) (D2 · necessidade inicial)DP.01',
    )
  })

  it('CA2 · pedida no D2 e ainda sem a liberação do INSS: o botão espera e diz por quê', async () => {
    await iniciarPericia('rita-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Dra. Paula (exemplo)' })
    render(<PericiaAberta processoId="rita-exemplo-1" />)
    expect(((await screen.findByRole('button', { name: 'Ver a tarefa aberta' })) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/quando o INSS liberar o agendamento \(D2.E1\)/)).toBeTruthy()
  })
})

describe('GGVP-49 · Central do Jurídico administrativo (Figma 2051:173 e 2107:892)', () => {
  it('CA2 · "<nome> · Marcar perícia" na fila e "Perícias para marcar" no chat', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<CentralJuridicoAdm />)
    expect(screen.getByRole('link', { name: 'Maria Exemplo · Marcar perícia' }).getAttribute('href')).toBe('/casos/maria-exemplo-1/pericia/marcar')
    expect(screen.getByRole('link', { name: 'Pedro Exemplo · Marcar perícia' })).toBeTruthy()
    expect(screen.getByText('Jurídico administrativo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Perícias para marcar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByText('Duas perícias esperam você. Marque no portal do INSS e suba o comprovante: eu leio data, hora, local e tipo.')).toBeTruthy()
    const itens = within(screen.getByRole('list', { name: 'Tarefas sugeridas' })).getAllByRole('link')
    expect(itens.map((i) => i.textContent)).toEqual([
      'Maria Exemplo · Marcar perícia ›o INSS já liberou o agendamento · hoje',
      'Pedro Exemplo · Marcar perícia ›o INSS já liberou o agendamento · atrasada desde 05/10',
    ])
  })
})

describe('GGVP-49 · o caso "Em perícia" (Figma 2179:2 e a ficha)', () => {
  it('CA1 · a ficha mostra "Em perícia" com o diagrama de origem e leva à página do processo', async () => {
    const ficha = (await obterFicha('maria-exemplo'))!
    render(<CasoEmAndamento ficha={ficha} />)
    const caso = screen.getByRole('link', { name: /Em perícia/ })
    expect(caso.getAttribute('href')).toBe('/casos/maria-exemplo-1/pericia')
    expect(caso.textContent).toContain('Em perícia · pedido ao INSS (D2) · perícia médica')
    expect(caso.textContent).toContain('A perícia está com o Jurídico administrativo.')
  })

  it('CA1, CA4 · a página do processo: perícia em andamento, a linha com o DP.01 do sistema e "Ver a perícia"', async () => {
    render(<ProcessoPericia processoId="maria-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Perícias' })
    expect(screen.getByText('Administrativo · perícia')).toBeTruthy()
    expect(screen.getByRole('link', { name: '▶ Perícia INSS' }).getAttribute('aria-current')).toBe('step')
    const linha = within(screen.getByRole('list', { name: 'Linha da perícia' })).getAllByRole('listitem').map((l) => l.textContent)
    expect(linha).toContain(
      '06/10O sistema: abriu a tarefa de perícia para o Jurídico administrativo, a partir da decisão de Dra. Paula (exemplo) (D2 · necessidade inicial)DP.01',
    )
    expect(screen.getByRole('link', { name: 'Ver a perícia' }).getAttribute('href')).toBe('/casos/maria-exemplo-1/pericia/marcar')
    // Dado de saúde só para o Jurídico: a advogada vê o atalho do parecer médico.
    expect(screen.getByRole('button', { name: 'Parecer médico' })).toBeTruthy()
  })

  it('dado de saúde por perfil: a Documentação não vê o atalho do parecer', async () => {
    iniciarPerfil('?perfil=documentacao')
    render(<ProcessoPericia processoId="maria-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Perícias' })
    expect(screen.queryByRole('button', { name: 'Parecer médico' })).toBeNull()
  })
})
