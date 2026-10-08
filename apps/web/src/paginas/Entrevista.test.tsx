import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, gravar, ler, zerarExemplo } from '../dados/servidor.ts'
import { Entrevista } from './Entrevista.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir() {
  render(<Entrevista agendamentoId="josefa-entrevista" />)
  await screen.findByRole('heading', { level: 1, name: /Fazer entrevista/ })
}

function audio(nome: string, tipo: string, megas: number): File {
  const arquivo = new File(['áudio'], nome, { type: tipo })
  Object.defineProperty(arquivo, 'size', { value: megas * 1024 * 1024 })
  return arquivo
}

describe('Fazer entrevista · tela do passo', () => {
  it('o título, o aviso do G10 e "Iniciar entrevista" depois da análise da ficha', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Fazer entrevista')
    expect(screen.getByText('entrevista inicial · gravada · hoje 15:30')).toBeTruthy()
    expect(screen.getByText('A gravação começa com o aviso ao cliente (G10).')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Iniciar entrevista (Transcrição)' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Analise a ficha antes: pode ser auxílio acidentário?')).toBeTruthy()
  })

  it('com a ficha analisada, "Iniciar entrevista" leva à gravação', async () => {
    const banco = ler()
    banco.fichas.find((f) => f.id === 'josefa-exemplo')!.analise = { acidentario: false, quem: 'Você (Advogada)', quando: '' }
    gravar(banco)
    await abrir()
    expect(screen.getByRole('link', { name: 'Iniciar entrevista (Transcrição)' }).getAttribute('href')).toBe('/entrevista/josefa-entrevista/gravacao')
  })

  it('CA9 e CA10 · áudio de fora, de qualquer formato e tamanho, vai para a transcrição em partes', async () => {
    await abrir()
    const entrada = screen.getByLabelText('Escolher o áudio')
    fireEvent.change(entrada, { target: { files: [audio('laudo.pdf', 'application/pdf', 1)] } })
    expect((await screen.findByRole('alert')).textContent).toBe('Esse arquivo não é de áudio.')
    fireEvent.change(entrada, { target: { files: [audio('ligacao-chatwoot.opus', '', 300)] } })
    const recebido = await screen.findByRole('status')
    expect(recebido.textContent).toContain('✓ Áudio recebido: ligacao-chatwoot.opus (300 MB, em 13 partes)')
    expect(recebido.textContent).toContain('Foi para a transcrição (D1.11)')
    expect(screen.getByRole('link', { name: 'Abrir a entrevista' }).getAttribute('href')).toBe('/entrevista/josefa-entrevista/gravacao')
  })
})
