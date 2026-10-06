import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { registrarConfirmacao } from '../dados/confirmacao.ts'
import { registrarTentativaDoComplemento } from '../dados/complemento.ts'
import { obterParecer, pedirDispensa, registrarParecer } from '../dados/parecer.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAdvogada } from './CentralAdvogada.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

describe('Central da Advogada', () => {
  it('GGVP-101 CA7 · a cobrança do Antônio, no limite, chega à sênior como "Decidir cobrança"', () => {
    render(<CentralAdvogada />)
    expect(screen.getByRole('link', { name: 'Antônio Exemplo · Decidir cobrança' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/cobranca/decidir')
  })

  it('GGVP-20 · o laudo novo do Antônio e o parecer da Rita nascem do caso, com a tela de cada um', () => {
    render(<CentralAdvogada />)
    const laudo = screen.getByRole('link', { name: 'Antônio Exemplo · Analisar laudo novo' })
    expect(laudo.getAttribute('href')).toBe('/casos/antonio-exemplo-1/laudo-novo')
    expect(laudo.closest('li')?.textContent).toContain('enviado pelo Atendimento em 29/09 · resumo e comparação da IA prontos')
    const parecer = screen.getByRole('link', { name: 'Rita Exemplo · Dar parecer médico' })
    expect(parecer.getAttribute('href')).toBe('/casos/rita-exemplo-1/parecer')
    expect(parecer.closest('li')?.textContent).toContain('LOAS Deficiente · a IA sugere Insuficiente · confira item a item (G17)')
  })

  it('GGVP-29 CA3 · o pedido de complemento que passou do limite chega à sênior como "Decidir complemento"', async () => {
    const p = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!
    const conferidos = Object.fromEntries(p.analise!.itens.map((i) => [i.id, i.situacao]))
    await registrarParecer('rita-exemplo-1', { analise: p.analise!.quando, conferidos, decisao: 'insuficiente', abordar: p.abordarSugerido }, { perfil: 'advogada', nome: 'Dra. Paula' })
    await registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'chatwoot', resultado: 'sem-resposta' })
    configurarExemplo({ agora: () => new Date(2026, 9, 8, 10, 0) })
    await registrarTentativaDoComplemento('rita-exemplo-1', { canal: 'ligacao', resultado: 'sem-resposta' })
    render(<CentralAdvogada />)
    expect(screen.getByRole('link', { name: 'Rita Exemplo · Decidir complemento' }).getAttribute('href')).toBe('/casos/rita-exemplo-1/complemento')
  })

  it('GGVP-33 CA2 · o pedido de dispensa chega à outra sênior como "Aprovar dispensa do parecer"', async () => {
    await pedirDispensa('rita-exemplo-1', 'Prazo do juiz vence e o médico só atende em novembro.', { perfil: 'senior', nome: 'Dra. Renata (exemplo)' })
    render(<CentralAdvogada />)
    expect(screen.getByRole('link', { name: 'Rita Exemplo · Aprovar dispensa do parecer' }).getAttribute('href')).toBe('/casos/rita-exemplo-1/parecer/dispensa')
  })

  it('mostra a fila, as abas e os atalhos do chat da advogada', () => {
    render(<CentralAdvogada />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
    // GGVP-50: o parecer do Davi, de 7 anos, entra na fila.
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (8)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tarefas do setor (12)' })).toBeTruthy()
    for (const nome of ['Resumo do caso', 'Criar tarefa', 'Perícias da semana', 'Como o perito avalia?', 'Gerar peça']) {
      expect(screen.getByRole('button', { name: nome })).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/advogada')
    expect(screen.getByText('Advogada')).toBeTruthy()
  })

  it('GGVP-32 CA1 · a entrevista de hoje aparece com os pontos de atenção', async () => {
    await registrarConfirmacao('josefa-entrevista', { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    render(<CentralAdvogada />)
    const preparar = screen.getByRole('link', { name: 'Josefa Exemplo · Preparar entrevista' })
    expect(preparar.getAttribute('href')).toBe('/entrevista/josefa-entrevista/preparar')
    expect(preparar.closest('li')?.textContent).toContain('LOAS Idoso · entrevista hoje 15:30 · ficha em papel · atenção: sem senha do gov.br e ficha não preenchida')
  })
})
