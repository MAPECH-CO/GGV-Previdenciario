import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAdvogada } from '../paginas/CentralAdvogada.tsx'
import { PaginaDoCaso } from '../paginas/PaginaDoCaso.tsx'
import { ChatDoPortal } from './ChatDoPortal.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('')
})

function chat(funcao = 'Advogada') {
  render(<ChatDoPortal exemplo="Ex.:" sugestoes={['Criar tarefa']} funcao={funcao} />)
}

function enviar(texto: string, arquivos: string[] = []) {
  if (arquivos.length) fireEvent.change(screen.getByLabelText('+ Anexar arquivo'), { target: { files: arquivos.map((n) => new File([n], n)) } })
  fireEvent.change(screen.getByLabelText('✦ Pergunte ou peça'), { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
}

describe('GGVP-82 · o chat que consulta (Figma 2107:2, 2186:631, 2107:667, 2186:2)', () => {
  it('CA1 · a resposta cita o caso e o passo, com o link para abrir', async () => {
    chat()
    enviar('O que falta no caso do Antônio Exemplo?')
    expect(await screen.findByText(/^Antônio Exemplo \(aposentadoria por incapacidade permanente\) está em Vigília · exigência do juiz/)).toBeTruthy()
    const link = within(screen.getByRole('list', { name: 'Tarefas sugeridas' })).getByRole('link')
    expect(link.getAttribute('href')).toBe('/casos/antonio-exemplo-1')
    expect(link.textContent).toContain('Vigília · exigência do juiz')
  })

  it('CA2 · o Atendimento pede o valor da prestação de contas: não tem acesso e o valor não aparece', async () => {
    iniciarPerfil('?perfil=atendimento')
    chat('Atendimento')
    enviar('Qual o valor da prestação de contas da Lúcia Exemplo?')
    expect(await screen.findByText(/não tem acesso a esse valor/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/R\$|18\.900/)
  })

  it('CA10 · jurimetria com os números do sistema, o número de casos, sem amostra mínima, e as fontes', async () => {
    chat()
    enviar('Como o Dr. A. Prado avalia?')
    expect(await screen.findByText(/71% · 24 de 34 laudos favoráveis/)).toBeTruthy()
    expect(screen.getByText(/^Fontes: regra do sistema jurimetria calculada pelo sistema, sem amostra mínima/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/amostra insuficiente/i)
  })
})

describe('GGVP-82 · o chat que executa (Figma 2176:388, 2186:405, 2186:211)', () => {
  it('CA3, CA5, CA7, CA9 · só o setor: o chat pergunta quem; o cartão tem Responsável e Trocar; criada, aparece na Central e no caso "pelo chat"', async () => {
    chat()
    enviar('Cria uma tarefa para a Documentação cobrar o laudo que falta do Antônio Exemplo até amanhã')
    expect(await screen.findByText('Quem do setor Documentação · ADM fica com a tarefa?')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('group', { name: 'Escolha' })).getByRole('button', { name: 'Jéssica (exemplo)' }))
    const cartao = await screen.findByRole('group', { name: 'Ação para confirmar · Antônio Exemplo · Cobrar documento' })
    expect(cartao.textContent).toContain('Responsável: Jéssica (exemplo)')
    expect(cartao.textContent).toContain('1 Criar a tarefa «Antônio Exemplo · Cobrar documento» na Central de Jéssica (exemplo), para 08/10')

    // Trocar o responsável.
    fireEvent.click(within(cartao).getByRole('button', { name: 'Trocar' }))
    fireEvent.change(within(cartao).getByLabelText('Quem fica com a tarefa'), { target: { value: 'Bruna (exemplo)' } })
    expect(cartao.textContent).toContain('Responsável: Bruna (exemplo)')
    fireEvent.click(within(cartao).getByRole('button', { name: 'Confirmar e criar a tarefa' }))
    expect(await screen.findByText(/✓ Feito: tarefa «Antônio Exemplo · Cobrar documento» criada para Bruna \(exemplo\)\./)).toBeTruthy()

    cleanup()
    iniciarPerfil('?perfil=atendimento')
    const { CentralAtendimento } = await import('../paginas/CentralAtendimento.tsx')
    render(<CentralAtendimento />)
    expect(screen.getAllByRole('link', { name: /Antônio Exemplo · Cobrar documento/ }).some((l) => l.closest('li')!.textContent!.includes('criada pelo chat por Dra. Paula (exemplo)'))).toBe(true)

    cleanup()
    iniciarPerfil('?perfil=advogada')
    render(<PaginaDoCaso processoId="antonio-exemplo-1" />)
    const linha = await screen.findByRole('list', { name: 'Linha · Vigília' })
    expect(linha.textContent).toContain('Dra. Paula (exemplo): Criou a tarefa «Antônio Exemplo · Cobrar documento» para Bruna (exemplo) · feito pelo chat')
  })

  it('CA3 · cancelar não faz nada', async () => {
    chat()
    enviar('Cria uma tarefa para a Jéssica cobrar o laudo que falta do Antônio Exemplo')
    const cartao = await screen.findByRole('group', { name: /Ação para confirmar/ })
    fireEvent.click(within(cartao).getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('Cancelado: nada foi feito.')).toBeTruthy()
    cleanup()
    iniciarPerfil('?perfil=documentacao')
    const { CentralAtendimento } = await import('../paginas/CentralAtendimento.tsx')
    render(<CentralAtendimento />)
    expect(screen.queryByText(/criada pelo chat/)).toBeNull()
  })

  it('CA4 · protocolar sem o OK do sênior: recusa e mostra o portão', async () => {
    chat()
    enviar('Protocola o pedido da Nair Exemplo no INSS')
    expect(await screen.findByText('Não dá para protocolar: falta o OK do sênior (G2). Nada vai ao INSS sem ele.')).toBeTruthy()
    expect(screen.getByText('Portão G2')).toBeTruthy()
    expect(screen.queryByRole('group', { name: /Ação para confirmar/ })).toBeNull()
  })

  it('CA8 · o Atendimento pede uma petição: "Fora do seu perfil" e "Criar tarefa para a Dra. Paula"', async () => {
    iniciarPerfil('?perfil=atendimento')
    chat('Atendimento')
    enviar('Faz a petição do BPC da Rita Exemplo.')
    expect(await screen.findByText('Seu perfil (Atendimento) não gera peça jurídica: isso é da advogada do caso. Posso criar a tarefa para a Dra. Paula.')).toBeTruthy()
    const cartao = screen.getByRole('group', { name: 'Fora do seu perfil · Rita Exemplo · Pedir petição' })
    fireEvent.click(within(cartao).getByRole('button', { name: 'Criar tarefa para a Dra. Paula' }))
    expect(await screen.findByText(/✓ Feito: tarefa «Rita Exemplo · Pedir petição» criada para Dra\. Paula/)).toBeTruthy()
    cleanup()
    iniciarPerfil('?perfil=advogada')
    render(<CentralAdvogada />)
    expect(screen.getByRole('link', { name: /Rita Exemplo · Pedir petição/ })).toBeTruthy()
  })

  it('CA12 · comprovante de RPV no Financeiro: o cartão lista os passos e as travas (G19, G8)', async () => {
    iniciarPerfil('?perfil=financeiro')
    chat('Financeiro')
    enviar('comprovante do RPV da Lúcia Exemplo', ['rpv_lucia.pdf'])
    const cartao = await screen.findByRole('group', { name: 'Ação para confirmar · Lúcia Exemplo · Lançar prestação de contas' })
    expect(within(cartao).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      '1 Subir rpv_lucia.pdf na pasta do processo',
      '2 Lançar na prestação de contas o valor que está no comprovante: você confere',
      '3 Pedir o OK da advogada na prestação de contas (tarefa «Lúcia Exemplo · Aprovar prestação de contas»)',
    ])
    expect(cartao.textContent).toContain('O valor vem do comprovante; a IA não calcula honorários (G19)')
    expect(cartao.textContent).toContain('O aviso ao cliente só sai depois do OK da advogada (G8)')
    fireEvent.click(within(cartao).getByRole('button', { name: 'Confirmar e lançar' }))
    expect(await screen.findByText(/✓ Feito: o comprovante está na pasta/)).toBeTruthy()
  })

  it('CA12 · lote de PDFs para o acervo, na sênior', async () => {
    iniciarPerfil('?perfil=senior')
    chat('Sênior')
    enviar('Sobe esses processos antigos no acervo', ['proc-1.pdf', 'proc-2.pdf'])
    const cartao = await screen.findByRole('group', { name: 'Ação para confirmar · Acervo · 2 processos' })
    expect(cartao.textContent).toContain('O acervo não guarda dado pessoal do cliente')
    fireEvent.click(within(cartao).getByRole('button', { name: 'Confirmar e guardar no acervo' }))
    expect(await screen.findByText('✓ Pronto: 2 processos entraram no acervo e já contam na jurimetria.')).toBeTruthy()
  })

  it('a advogada pede a peça: o cartão da minuta, com a conferência dela (G6)', async () => {
    chat()
    enviar('Gera a manifestação do Antônio Exemplo sobre a exigência do juiz')
    const cartao = await screen.findByRole('group', { name: 'Ação para confirmar · Antônio Exemplo · Manifestar no processo' })
    expect(cartao.textContent).toContain('Você confere e assina (G6)')
    expect(within(cartao).getByRole('button', { name: 'Confirmar e pedir a minuta' })).toBeTruthy()
  })
})

describe('GGVP-82 CA6 · o Suporte nas outras telas', () => {
  it('na página do processo, o Suporte abre o chat do caso: a pergunta sem nome é sobre ele', async () => {
    iniciarPerfil('?perfil=advogada')
    window.history.pushState({}, '', '/casos/pedro-exemplo-1')
    render(<PaginaDoCaso processoId="pedro-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    fireEvent.click(screen.getByRole('button', { name: '✦ Suporte' }))
    const suporte = screen.getByRole('dialog', { name: 'Suporte interno' })
    expect(within(suporte).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Resumo do caso', 'Perícias da semana']))
    fireEvent.change(within(suporte).getByLabelText('✦ Pergunte ou peça'), { target: { value: 'O que falta aqui?' } })
    fireEvent.click(within(suporte).getByRole('button', { name: 'Enviar' }))
    expect(await within(suporte).findByText(/^Pedro Exemplo \(loas idoso\) está em INSS/)).toBeTruthy()
    fireEvent.change(within(suporte).getByLabelText('✦ Pergunte ou peça'), { target: { value: 'O que é o G8?' } })
    fireEvent.click(within(suporte).getByRole('button', { name: 'Enviar' }))
    expect(await within(suporte).findByText(/^G8: O aviso ao cliente só nasce depois do OK da advogada/)).toBeTruthy()
    window.history.pushState({}, '', '/')
  })
})
