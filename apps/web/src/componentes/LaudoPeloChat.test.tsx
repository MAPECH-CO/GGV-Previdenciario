import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from '../dados/servidor.ts'
import { LEMBRETE_DA_IDENTIDADE } from '../regras/seguranca.ts'
import { LaudoPeloChat } from './LaudoPeloChat.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

function pedir(texto: string, nomeDoArquivo: string) {
  render(<LaudoPeloChat exemplo="Ex.:" sugestoes={['Subir laudo novo']} />)
  fireEvent.change(screen.getByLabelText('+ Anexar arquivo'), { target: { files: [new File(['laudo'], nomeDoArquivo)] } })
  expect(screen.getByRole('button', { name: `Tirar o anexo ${nomeDoArquivo}` })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('✦ Pergunte ou peça'), { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('Chat · Subir laudo novo', () => {
  it('CA8 · identifica o cliente, mostra o card e só sobe o laudo depois de "Confirmar"', async () => {
    pedir('Esse aqui é o laudo do Antônio. Atualizar.', 'laudo_antonio_ortopedia.pdf')
    expect(await screen.findByText(/Li o arquivo e identifiquei o cliente: Antônio Exemplo/)).toBeTruthy()
    const card = screen.getByRole('region', { name: 'Atualizar o laudo · Antônio Exemplo' })
    expect(card.textContent).toContain('Subir laudo_antonio_ortopedia.pdf na pasta do cliente')
    expect(card.textContent).toContain('Marcar «Laudo novo» na ficha e no processo')
    expect(card.textContent).toContain('Avisar a advogada responsável (D1.21M)')
    expect((await obterFicha('antonio-exemplo'))?.arquivos).toEqual([])
    expect(tarefasDoSetor('Jurídico')).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e enviar ao Jurídico' }))
    expect((await screen.findByRole('status')).textContent).toContain('✓ Feito')
    const antonio = await obterFicha('antonio-exemplo')
    expect(antonio?.laudoNovoEm).toBe('2026-10-05')
    expect(antonio?.arquivos[0]).toMatchObject({ nome: 'laudo_antonio_ortopedia.pdf', tipo: 'laudo', origem: 'chat' })
    expect(tarefasDoSetor('Jurídico')).toHaveLength(1)
  })

  it('CA8 · "Cancelar" não faz nada', async () => {
    pedir('laudo do Antônio', 'laudo.pdf')
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Cancelado: nada foi feito.')).toBeTruthy()
    await waitFor(async () => expect((await obterFicha('antonio-exemplo'))?.arquivos).toEqual([]))
  })

  it('sem identificar o cliente, pede o nome completo e não mostra o card', async () => {
    pedir('atualizar, por favor', 'laudo.pdf')
    expect(await screen.findByText(/Não identifiquei de quem é o laudo/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: /Atualizar o laudo/ })).toBeNull()
  })
})

function perguntar(texto: string) {
  render(<LaudoPeloChat exemplo="Ex.:" sugestoes={[]} />)
  const campo = screen.getByLabelText('✦ Pergunte ou peça') as HTMLTextAreaElement
  fireEvent.change(campo, { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  return campo
}

describe('Chat · o cliente ligou (GGVP-111)', () => {
  it('CA7 · a próxima tarefa vem com o lembrete de confirmar a identidade', async () => {
    perguntar('A Maria Exemplo me ligou, qual é a próxima tarefa?')
    const resposta = await screen.findByText(/^A próxima tarefa de Maria \(Administrativo · perícia em 02\/10\) é cobrar o laudo que a perícia pede/)
    expect(resposta.textContent).toContain(LEMBRETE_DA_IDENTIDADE)
  })

  it('fora do laudo e da ligação, o chat avisa que não está ligado e mantém o texto', () => {
    const campo = perguntar('Qual é a próxima tarefa da Josefa?')
    expect(screen.getByRole('status').textContent).toContain('ainda não está ligado')
    expect(campo.value).toBe('Qual é a próxima tarefa da Josefa?')
  })
})
