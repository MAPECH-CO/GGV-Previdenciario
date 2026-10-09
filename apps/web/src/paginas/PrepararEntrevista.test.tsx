import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, gravar, ler, zerarExemplo } from '../dados/servidor.ts'
import { PrepararEntrevista } from './PrepararEntrevista.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(id = 'josefa-entrevista') {
  render(<PrepararEntrevista agendamentoId={id} />)
  await screen.findByRole('heading', { level: 1, name: /Preparar entrevista/ })
}

function mudarJosefa(mudar: (josefa: ReturnType<typeof ler>['fichas'][number]) => void) {
  const banco = ler()
  mudar(banco.fichas.find((f) => f.id === 'josefa-exemplo')!)
  gravar(banco)
}

describe('Preparar entrevista · tela do passo', () => {
  it('CA3 · "Resumo da ficha" (não é IA), a ficha completa e o painel do Figma', async () => {
    mudarJosefa((j) => {
      j.fichaAtendimentoPreenchida = true
      j.fichaAtendimento = { data: '2026-10-05', origem: 'papel', modelo: 'GGV', ultimaAtividade: 'diarista', emBranco: [] }
    })
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Preparar entrevista')
    expect(screen.getByText('entrevista hoje 15:30 · ler a ficha')).toBeTruthy()
    const ia = within(screen.getByRole('region', { name: 'Resumo da ficha' }))
    expect(ia.getByText('O portal juntou o que a ficha diz. Confira antes de entrevistar.')).toBeTruthy()
    expect(screen.queryByText(/A IA sugere/)).toBeNull()
    expect(ia.getByText('lida')).toBeTruthy()
    expect(ia.getByText('última atividade: diarista · procura LOAS Idoso')).toBeTruthy()
    expect(ia.getByRole('link', { name: 'Abrir a ficha completa' }).getAttribute('href')).toBe('/clientes/josefa-exemplo/ficha-de-atendimento')
    expect(screen.getByText('O que o BPMN (Miro) pede no passo D1.06.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/advogada')
  })

  it('CA2 · sem senha, o alerta e se o Atendimento já tentou renovar', async () => {
    mudarJosefa((j) => {
      j.renovacao = { resultado: 'nao-conseguiu', motivo: 'o celular cadastrado não é mais dela', quem: 'Você (Atendimento)', quando: '' }
    })
    await abrir()
    const pontos = within(screen.getByRole('region', { name: 'Pontos de atenção' }))
    expect(pontos.getByText(/Sem senha do gov.br · o Atendimento tentou renovar e não conseguiu: o celular cadastrado não é mais dela/)).toBeTruthy()
    expect(pontos.getByText(/Benefício que o cliente procura: LOAS Idoso/)).toBeTruthy()
  })

  it('CA4 · no cofre, a situação e a última vez que funcionou, nunca a senha', async () => {
    mudarJosefa((j) => {
      j.senhaGov = { situacao: 'no-cofre', atualizadaEm: '2026-10-01T10:00:00.000Z', por: 'Você (Atendimento)', funcionouEm: '2026-09-15' }
    })
    await abrir()
    expect(screen.getByText(/Senha do gov.br no cofre · funcionou pela última vez em 15\/09/)).toBeTruthy()
    expect(document.querySelector('input')).toBeNull()
  })

  it('CA5 · a anotação do primeiro contato; "Iniciar entrevista" espera a análise da ficha', async () => {
    await abrir()
    const contato = within(screen.getByRole('region', { name: 'Anotação do Atendimento no primeiro contato' }))
    expect(contato.getByText('Perguntou do LOAS; marcou a entrevista.')).toBeTruthy()
    expect(contato.getByText('29/09 · WhatsApp')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Iniciar entrevista (Transcrição)' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Analise a ficha antes: pode ser auxílio acidentário?')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Analisar a ficha' }).getAttribute('href')).toBe('/entrevista/josefa-entrevista/analisar')
  })

  it('entrevista que não existe avisa', async () => {
    render(<PrepararEntrevista agendamentoId="nao-existe" />)
    expect(await screen.findByRole('heading', { name: 'Entrevista não encontrada' })).toBeTruthy()
  })
})
