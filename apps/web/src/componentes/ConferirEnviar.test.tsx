import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConferirEnviar } from './ConferirEnviar.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

const arquivo = (nome: string, conteudo = nome) => new File([conteudo], nome)

function abrir(fichaId: string, iniciais: File[]) {
  const aoEnviar = vi.fn()
  const aoFechar = vi.fn()
  render(<ConferirEnviar fichaId={fichaId} origem="card" iniciais={iniciais} aoEnviar={aoEnviar} aoFechar={aoFechar} />)
  return { aoEnviar, aoFechar }
}

const enviar = () => screen.getByRole('button', { name: 'Enviar para a pasta do cliente' }) as HTMLButtonElement
const tipo = (nome: string) => screen.getByRole('combobox', { name: `Tipo de ${nome}` }) as HTMLSelectElement

describe('Conferir e enviar', () => {
  it('CA12 · mostra o tipo que a IA disse, a pessoa troca, e PDF, JPG ou PNG de até 20 MB seguem', async () => {
    const grande = arquivo('exame.pdf')
    Object.defineProperty(grande, 'size', { value: 20 * 1024 * 1024 + 1 })
    const { aoEnviar } = abrir('antonio-exemplo', [arquivo('laudo_ortopedia_set2026.pdf'), arquivo('rg_frente_verso.jpg'), arquivo('planilha.xlsx'), grande])
    expect(screen.getByRole('dialog', { name: 'Conferir e enviar' })).toBeTruthy()
    expect(tipo('laudo_ortopedia_set2026.pdf').value).toBe('laudo')
    expect(tipo('rg_frente_verso.jpg').value).toBe('rg')
    const lista = within(screen.getByRole('list', { name: 'Arquivos para enviar' }))
    expect(lista.getByText('Não segue: Só PDF, JPG ou PNG.')).toBeTruthy()
    expect(lista.getByText('Não segue: Passa de 20 MB.')).toBeTruthy()
    expect(screen.getByText(/Se for laudo, o portal marca «Laudo novo»/)).toBeTruthy()

    fireEvent.change(tipo('rg_frente_verso.jpg'), { target: { value: 'cpf' } })
    await waitFor(() => expect(enviar().disabled).toBe(false))
    fireEvent.click(enviar())
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1))
    const resposta = aoEnviar.mock.calls[0][0]
    expect(resposta.arquivos.map((a: { nome: string; tipo: string }) => [a.nome, a.tipo])).toEqual([
      ['laudo_ortopedia_set2026.pdf', 'laudo'],
      ['rg_frente_verso.jpg', 'cpf'],
    ])
    expect(resposta.laudoNovo).toBe(true)
    expect((await obterFicha('antonio-exemplo'))?.laudoNovoEm).toBe('2026-10-05')
  })

  it('CA13 · enviar de novo o mesmo arquivo entra como "(2)" e fica repetido; dois cliques enviam uma vez só', async () => {
    const primeiro = abrir('rita-exemplo', [arquivo('rg.pdf', 'mesmo papel')])
    await waitFor(() => expect(enviar().disabled).toBe(false))
    const botao = enviar()
    fireEvent.click(botao)
    expect(botao.textContent).toBe('enviando…')
    fireEvent.click(botao)
    await waitFor(() => expect(primeiro.aoEnviar).toHaveBeenCalledTimes(1))
    cleanup()

    const segundo = abrir('rita-exemplo', [arquivo('rg.pdf', 'mesmo papel')])
    await waitFor(() => expect(enviar().disabled).toBe(false))
    fireEvent.click(enviar())
    await waitFor(() => expect(segundo.aoEnviar).toHaveBeenCalledTimes(1))
    expect(segundo.aoEnviar.mock.calls[0][0].arquivos[0]).toMatchObject({ nome: 'rg (2).pdf', repetido: true })
    expect((await obterFicha('rita-exemplo'))?.arquivos).toHaveLength(2)
  })

  it('CA11 · ficha sem pasta e sem CPF não envia e diz o que fazer; "Cancelar" fecha', async () => {
    const { aoEnviar, aoFechar } = abrir('natalia-exemplo', [arquivo('rg.pdf')])
    await waitFor(() => expect(enviar().disabled).toBe(false))
    fireEvent.click(enviar())
    expect((await screen.findByRole('alert')).textContent).toContain('pasta nova só nasce com o CPF')
    expect(aoEnviar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(aoFechar).toHaveBeenCalled()
  })
})
