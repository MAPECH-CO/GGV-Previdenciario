import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from '../dados/documentos.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { AnalisarLaudoNovo } from './AnalisarLaudoNovo.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

async function abrir(processoId = 'antonio-exemplo-1') {
  render(comSessao(<AnalisarLaudoNovo processoId={processoId} />))
  await screen.findByRole('heading', { level: 1, name: /Analisar laudo novo/ })
}

describe('Analisar laudo novo · tela da advogada', () => {
  it('CA6 e CA7 · o Antônio do Figma: resumo da IA, a comparação com o que mudou em destaque e "Ir para o parecer"', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Antônio Exemplo · Analisar laudo novo')
    expect(screen.getByText('Aposentadoria por Incapacidade Permanente · enviado pelo Atendimento em 29/09')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Resumo da IA · laudo novo de 29/09' })).toBeTruthy()
    expect(screen.getByText('Mantém os mesmos CIDs (M54.5 e G56.0); a IA não sugere CID novo.')).toBeTruthy()
    const tabela = screen.getByRole('table', { name: 'Comparação com o último laudo (18/09)' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['O que compara', 'Último laudo · 18/09', 'Laudo novo · 29/09'])
    const mudaram = [...tabela.querySelectorAll('[data-mudou]')].map((c) => c.textContent)
    expect(mudaram).toEqual(['Raio-X de coluna lombar e ressonância magnética (22/09)', 'Carregar peso, ficar em pé e dirigir'])
    expect(screen.getByText('A IA só compara: não sugere CID, grau nem conclusão (G20). Quem confirma o laudo e o parecer de suficiência (G17) é a advogada.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para o parecer (D1.21M)' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/parecer')
  })

  it('CA6 · diante do roteiro: o relatório da Rita passa a cobrir o prognóstico e as barreiras, e nada mais falta', async () => {
    await enviarArquivos('rita-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'relatorio medico.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '7'.padStart(64, '0') }],
    })
    await abrir('rita-exemplo-1')
    const roteiro = screen.getByRole('heading', { name: 'Diante do roteiro · BPC/LOAS Deficiente, versão 1' }).closest('section')!
    expect(roteiro.textContent).toContain('Passa a cobrirPrognóstico: duração prevista ou permanente; Barreiras')
    expect(roteiro.textContent).toContain('Ainda faltaNada: todos os itens obrigatórios estão cobertos.')
  })

  it('dado de saúde · quem não é do Jurídico não vê o laudo nem a comparação', async () => {
    entrarComo('atendimento')
    await abrir()
    expect(screen.getByRole('status').textContent).toContain('O laudo e a comparação são do Jurídico')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('sem laudo novo esperando, leva ao parecer', async () => {
    await abrir('sebastiao-exemplo-1')
    expect(screen.getByRole('heading', { name: 'Nenhum laudo novo esperando a análise' })).toBeTruthy()
  })
})
