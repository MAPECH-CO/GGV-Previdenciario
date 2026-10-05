import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CPF_DE_TESTE, telefoneDeExemplo } from '../dados/exemplo.ts'
import { salvarFichaDeAtendimento } from '../dados/fichaAtendimento.ts'
import { configurarExemplo, criarFicha, encaminhar, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { MENSAGEM } from '../regras/formularios.ts'
import { FichaCliente } from './FichaCliente.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(id: string) {
  render(<FichaCliente id={id} />)
  await screen.findByRole('heading', { level: 2, name: /Exemplo/ })
}

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
const digitar = (rotulo: string, valor: string) => fireEvent.change(campo(rotulo), { target: { value: valor } })
const historico = () => within(screen.getByRole('list', { name: 'Histórico' }))

describe('Ficha do cliente · visão do Atendimento', () => {
  it('mostra os blocos do Figma 73:199, nada de petição nem valores, e da senha só a situação', async () => {
    await abrir('antonio-exemplo')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Cliente')
    expect(screen.getByText('cliente desde 03/2023')).toBeTruthy()
    expect(screen.getByText('Atendimento não vê petição nem valores')).toBeTruthy()
    expect(screen.getByText('62 anos · trabalhador rural aposentando · São Paulo/SP')).toBeTruthy()
    expect(screen.getByText('WhatsApp preferido')).toBeTruthy()
    expect(screen.getByText('Laudo novo · 29/09')).toBeTruthy()

    const caso = screen.getByRole('link', { name: /Aposentadoria por Incapacidade Permanente/ })
    expect(caso.textContent).toContain('Judicial · exigência')
    expect(caso.textContent).toContain('vence em 2 dias')
    expect(within(screen.getByRole('list', { name: 'Documentos pessoais' })).getAllByRole('listitem')).toHaveLength(6)
    expect(within(screen.getByRole('list', { name: 'Últimos contatos' })).getAllByRole('listitem')[0].textContent).toContain('27/09')
    expect(screen.getByText(/Laudo novo de 29\/09 enviado ao Jurídico: aguarda a análise/)).toBeTruthy()
    expect(screen.getByText('Próxima: nenhuma marcada.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Marcar entrevista' }).getAttribute('href')).toBe('/agenda/marcar/antonio-exemplo')

    for (const nome of ['Transcrições (2)', 'Trocar foto', 'Registrar contato', 'Marcar e iniciar reunião (com transcrição)']) {
      expect(screen.getByRole('button', { name: nome }).getAttribute('aria-disabled'), String(nome)).toBe('true')
    }
    // GGVP-24: a ficha mostra só a situação da senha do gov.br, nunca a senha nem campo para ela.
    expect(document.body.textContent?.match(/senha|cofre/gi)).toEqual(['senha', 'cofre'])
    expect(screen.getByText('gov.br: senha no cofre · atualizada em 12/07/2025 por Atendimento (G9)')).toBeTruthy()
    expect(document.querySelector('input[type="password"]')).toBeNull()
  })

  it('GGVP-24 CA4 e CA6 · o cartão "Ficha de atendimento" mostra as respostas, o que ficou em branco e leva à ficha', async () => {
    await salvarFichaDeAtendimento('antonio-exemplo', {
      nome: 'Antônio Exemplo',
      cpf: CPF_DE_TESTE,
      nascimento: '10/03/1964',
      telefone: '11900000001',
      beneficioInteresse: 'nao-sei',
      pessoasNaCasa: 2,
      ultimaAtividade: 'porteiro, até 2025',
      origem: 'papel',
      modelo: 'GGV',
    })
    await abrir('antonio-exemplo')
    const cartao = within(screen.getByRole('region', { name: 'Ficha de atendimento' }))
    expect(cartao.getByText('Preenchida em 05/10/2026 · papel GGV')).toBeTruthy()
    expect(cartao.getByText('porteiro, até 2025')).toBeTruthy()
    expect(cartao.getByText('Em branco: Endereço, Desde quando está sem trabalhar, O que já pediu ao INSS.')).toBeTruthy()
    expect(cartao.getByRole('link', { name: 'Abrir a ficha de atendimento' }).getAttribute('href')).toBe('/clientes/antonio-exemplo/ficha-de-atendimento')
  })

  it('CA8 · o encaminhamento do balcão aparece no histórico com quem, data, hora e setor', async () => {
    await encaminhar({ fichaId: 'antonio-exemplo', motivo: 'outra-etapa', setor: 'Documentação · ADM' })
    await abrir('antonio-exemplo')
    const [linha] = historico().getAllByRole('listitem')
    expect(linha.textContent).toContain('05/10/2026 14:32')
    expect(linha.textContent).toContain('Você (Atendimento)')
    expect(linha.textContent).toContain('Encaminhou ao setor Documentação · ADM')
  })

  it('CA13 · a anotação do balcão está em "Últimos contatos" do lead recém-criado', async () => {
    const pretende = 'Quer saber da aposentadoria por idade.'
    const resposta = await criarFicha({
      nome: 'Rosa Exemplo',
      idade: 58,
      pretende,
      telefone: telefoneDeExemplo(51),
      beneficioInteresse: 'nao-sei',
      outraPessoa: false,
    })
    if (resposta.resultado !== 'criada') throw new Error(resposta.resultado)
    await abrir(resposta.id)
    expect(screen.getByText('lead desde 10/2026')).toBeTruthy()
    const [contato] = within(screen.getByRole('list', { name: 'Últimos contatos' })).getAllByRole('listitem')
    expect(contato.textContent).toBe(`05/10Presencial (balcão)${pretende}`)
    expect(screen.getByText(/Nenhum caso aberto ainda/)).toBeTruthy()
    expect(historico().getByText('Criou a ficha no balcão (lead)')).toBeTruthy()
    expect(campo('CPF').value).toBe('')
  })

  it('CA15 · letra não entra no CPF nem no telefone; CPF errado, telefone sem DDD e data futura não salvam', async () => {
    await abrir('antonio-exemplo')
    digitar('CPF *', `${CPF_DE_TESTE.slice(0, 3)}a`)
    expect(campo('CPF *').value).toBe(CPF_DE_TESTE.slice(0, 3))
    digitar('Telefone / WhatsApp *', 'x11')
    expect(campo('Telefone / WhatsApp *').value).toBe('11')

    digitar('CPF *', `${CPF_DE_TESTE.slice(0, 10)}2`)
    fireEvent.blur(campo('CPF *'))
    expect(screen.getByText(MENSAGEM.cpf)).toBeTruthy()
    digitar('Telefone / WhatsApp *', '91234-5678')
    fireEvent.blur(campo('Telefone / WhatsApp *'))
    expect(screen.getByText(MENSAGEM.telefone)).toBeTruthy()
    digitar('Data de nascimento', '06/10/2026')
    fireEvent.blur(campo('Data de nascimento'))
    expect(screen.getByText(MENSAGEM.data)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Confira os campos marcados em vermelho.')).toBeTruthy()
    expect((await obterFicha('antonio-exemplo'))?.historico).toEqual([])
  })

  it('CA16 · dois cliques em "Salvar alterações" gravam uma vez só, e o que mudou vai para o histórico', async () => {
    await abrir('antonio-exemplo')
    digitar('Estado civil', 'Viúvo')
    const salvar = screen.getByRole('button', { name: 'Salvar alterações' })
    fireEvent.click(salvar)
    expect(salvar.textContent).toBe('salvando…')
    expect((salvar as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(salvar)

    expect(await screen.findByText('Alterações salvas. Ficaram no histórico.')).toBeTruthy()
    expect(historico().getAllByText('Alterou estado civil')).toHaveLength(1)
    expect((await obterFicha('antonio-exemplo'))?.historico).toHaveLength(1)
  })

  it('CPF que já está em outra ficha não salva e diz de quem é', async () => {
    await abrir('josefa-exemplo')
    expect(screen.getByText('Próxima: hoje 15:30 · Entrevista com Dra. Paula.')).toBeTruthy()
    digitar('CPF', CPF_DE_TESTE)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Este CPF já está na ficha de Antônio Exemplo.')).toBeTruthy()
  })

  it('GGVP-17 CA6, CA9 e CA14 · laudo solto na ficha vai para a subpasta do processo, marca "Laudo novo" e o Atendimento só vê que foi', async () => {
    await abrir('antonio-exemplo')
    fireEvent.drop(screen.getByRole('button', { name: /Solte os documentos do cliente aqui/ }), {
      dataTransfer: { files: [new File(['laudo'], 'laudo_ortopedia_set2026.pdf')] },
    })
    const janela = within(screen.getByRole('dialog', { name: 'Conferir e enviar' }))
    const enviar = janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }) as HTMLButtonElement
    await waitFor(() => expect(enviar.disabled).toBe(false))
    fireEvent.click(enviar)

    expect(await screen.findByText('1 arquivo enviado para a pasta do cliente. Laudo novo enviado ao Jurídico.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Laudo novo · 05/10')).toBeTruthy()
    expect(screen.getByText(/Laudo novo de 05\/10 enviado ao Jurídico: aguarda a análise/)).toBeTruthy()
    const subpasta = within(screen.getByRole('list', { name: 'Subpasta Aposentadoria por Incapacidade Permanente' }))
    expect(subpasta.getByText('laudo_ortopedia_set2026.pdf')).toBeTruthy()
    expect(subpasta.getByText('Laudo médico · aguarda a leitura')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Resumo simulado/)
  })

  it('GGVP-17 CA12 e CA14 · clicar na área abre a janela; documento pessoal vira miniatura em Documentos pessoais', async () => {
    await abrir('antonio-exemplo')
    fireEvent.click(screen.getByRole('button', { name: /Solte os documentos do cliente aqui/ }))
    const janela = within(screen.getByRole('dialog', { name: 'Conferir e enviar' }))
    fireEvent.change(janela.getByLabelText(/Solte mais arquivos aqui/), { target: { files: [new File(['rg'], 'rg.jpg')] } })
    const enviar = janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }) as HTMLButtonElement
    await waitFor(() => expect(enviar.disabled).toBe(false))
    fireEvent.click(enviar)
    expect(await screen.findByText('1 arquivo enviado para a pasta do cliente.')).toBeTruthy()
    const miniaturas = within(screen.getByRole('list', { name: 'Documentos pessoais' })).getAllByRole('listitem')
    expect(miniaturas).toHaveLength(7)
    expect(miniaturas.at(-1)?.textContent).toBe('▤Documento pessoal (RG)05/10')
  })

  it('GGVP-17 CA15 · a ficha que o scanner criou sem telefone mostra "completar telefone"', async () => {
    await abrir('marta-exemplo')
    expect(screen.getByText('completar telefone')).toBeTruthy()
    expect(campo('Telefone / WhatsApp *').value).toBe('')
  })
})
