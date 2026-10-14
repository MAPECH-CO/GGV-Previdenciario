import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from '../dados/servidor.ts'
import { CartaoDadosBancarios } from './CartaoDadosBancarios.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})

const cartao = () => within(screen.getByRole('region', { name: 'Dados bancários para o repasse' }))
const botao = (nome: string) => cartao().getByRole('button', { name: nome }) as HTMLButtonElement
const digitar = (rotulo: string, valor: string) => fireEvent.change(cartao().getByLabelText(rotulo), { target: { value: valor } })

describe('Dados bancários para o repasse (GGVP-111)', () => {
  it('CA9 (Pedro, 14/10) · a agência e a conta ganham o traço sozinhas: a pessoa digita só os números', async () => {
    render(comSessao(<CartaoDadosBancarios fichaId="lucia-exemplo" aoMudar={vi.fn()} />))
    fireEvent.click(await cartao().findByRole('button', { name: 'Mudar dados bancários' }))
    digitar('Agência *', '00019')
    digitar('Conta com dígito *', '123456')
    expect((cartao().getByLabelText('Agência *') as HTMLInputElement).value).toBe('0001-9')
    expect((cartao().getByLabelText('Conta com dígito *') as HTMLInputElement).value).toBe('12345-6')
    expect(cartao().queryByText('Conta com os números e o dígito: 12345-6.')).toBeNull()
  })

  it('CA1 e CA5 · só pede a mudança com o cliente verificado e em contrato novo; quem pediu não confirma; outra pessoa confirma e o Atendimento recebe a tarefa de avisar o cliente', async () => {
    const aoMudar = vi.fn()
    // A sessão desde o começo: a troca de quem está logado mantém o cartão aberto (rerender).
    entrarComo('atendimento')
    const { rerender } = render(comSessao(<CartaoDadosBancarios fichaId="lucia-exemplo" aoMudar={aoMudar} />))
    expect(await cartao().findByText(/^Banco Exemplo · agência 0001 · conta 12345-6 · Pix: o telefone cadastrado · desde/)).toBeTruthy()

    fireEvent.click(botao('Mudar dados bancários'))
    digitar('Banco *', 'Banco Exemplo Dois')
    digitar('Agência *', '0002')
    digitar('Conta com dígito *', '65432-1')
    expect(botao('Pedir a mudança').disabled).toBe(true)
    expect(cartao().getByText('Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.')).toBeTruthy()
    fireEvent.click(cartao().getByRole('radio', { name: 'Cliente no escritório' }))
    fireEvent.click(cartao().getByRole('checkbox', { name: 'A alteração vai em contrato novo' }))
    expect(botao('Pedir a mudança').disabled).toBe(false)
    fireEvent.click(botao('Pedir a mudança'))

    const pedido = within(await cartao().findByRole('group', { name: 'Mudança dos dados bancários' }))
    expect(pedido.getByText(/Banco Exemplo Dois · agência 0002 · conta 65432-1 · cliente no escritório; em contrato novo\./)).toBeTruthy()
    expect(cartao().getByRole('status').textContent).toBe('Mudança pedida: espera a segunda confirmação.')
    fireEvent.click(botao('Confirmar a mudança (segunda pessoa)'))
    expect((await cartao().findByRole('alert')).textContent).toBe('A segunda confirmação é de outra pessoa, não de quem pediu.')

    entrarComo('atendimento-lider')
    rerender(comSessao(<CartaoDadosBancarios fichaId="lucia-exemplo" aoMudar={aoMudar} />))
    fireEvent.click(botao('Confirmar a mudança (segunda pessoa)'))
    expect(await cartao().findByText('Dados bancários mudados. O Atendimento recebeu a tarefa de avisar o cliente, com o aviso pronto para conferir e enviar.')).toBeTruthy()
    expect(cartao().getByText(/^Banco Exemplo Dois · agência 0002 · conta 65432-1 · desde 07\/10\/2026/)).toBeTruthy()
    expect(aoMudar).toHaveBeenCalled()
    // CA5 (opção B, 14/10): nada sai sozinho para o cliente; o Atendimento recebe a tarefa, com o link da mensagem pronta.
    const lucia = (await obterFicha('lucia-exemplo'))!
    expect(lucia.contatos.some((c) => c.texto.includes('Se não foi você'))).toBe(false)
    expect(tarefasDoSetor('Atendimento').find((t) => t.acao === 'Avisar o cliente da mudança bancária')).toMatchObject({
      href: '/clientes/lucia-exemplo?mensagem=aviso-de-mudanca',
      urgente: true,
    })
    expect(tarefasDoSetor('Jurídico')).toHaveLength(1)
  })

  it('agência e conta erradas não seguem; cancelar volta ao cartão', async () => {
    render(comSessao(<CartaoDadosBancarios fichaId="maria-exemplo" aoMudar={() => {}} />))
    expect(await cartao().findByText('Nenhum dado bancário cadastrado.')).toBeTruthy()
    fireEvent.click(botao('Mudar dados bancários'))
    digitar('Banco *', 'Banco Exemplo')
    digitar('Agência *', '1')
    digitar('Conta com dígito *', '65432-1')
    expect(cartao().getByText('Agência com 4 números (e o dígito, se houver): 0001 ou 0001-9.')).toBeTruthy()
    expect(botao('Pedir a mudança').disabled).toBe(true)
    fireEvent.click(botao('Cancelar'))
    expect(botao('Mudar dados bancários')).toBeTruthy()
  })

  it('GGVP-138 · a ficha fora do banco: a API recusa e o cartão fica sem dados, sem erro solto', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ erro: 'Ficha não encontrada.' }), { status: 404 }))
    vi.stubGlobal('fetch', fetch)
    render(comSessao(<CartaoDadosBancarios fichaId="fora-do-banco" aoMudar={() => {}} />))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/fichas/fora-do-banco/dados-bancarios', expect.anything()))
    expect(cartao().getByText('Nenhum dado bancário cadastrado.')).toBeTruthy()
    expect(cartao().queryByRole('alert')).toBeNull()
    vi.unstubAllGlobals()
  })
})
