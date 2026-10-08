import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { MensagemAoCliente } from './MensagemAoCliente.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})

async function abrir(fichaId: string, modeloInicial?: 'pericia-orientacao' | 'resultado-favoravel' | 'boas-vindas', aoEnviar = vi.fn()) {
  render(comSessao(<MensagemAoCliente ficha={(await obterFicha(fichaId))!} modeloInicial={modeloInicial} aoFechar={() => {}} aoEnviar={aoEnviar} />))
  await screen.findByRole('region', { name: 'Na central do Chatwoot' })
  return aoEnviar
}

const texto = () => screen.getByRole('textbox') as HTMLTextAreaElement
const enviar = () => screen.getByRole('button', { name: /Enviar pelo Chatwoot|Tentar de novo/ }) as HTMLButtonElement

describe('Mensagem ao cliente · janela (GGVP-102)', () => {
  it('CA1, CA6 e CA9 · o modelo da perícia preenchido, o contato e a conversa no Chatwoot; enviada, o status e a hora', async () => {
    const aoEnviar = await abrir('maria-exemplo', 'pericia-orientacao')
    expect(screen.getByRole('heading', { name: 'Mensagem ao cliente · Maria Exemplo' })).toBeTruthy()
    expect(texto().value).toMatch(/^Olá, Maria! Sua perícia no INSS é sexta, 02\/10\. Chegue 30 minutos antes\./)
    const chatwoot = screen.getByRole('region', { name: 'Na central do Chatwoot' })
    expect(within(chatwoot).getByText(/Maria Exemplo/)).toBeTruthy()
    expect(within(chatwoot).getByRole('radio', { name: /Conversa #5004 · 2 mensagens · aberta · GGV PREV/ }).getAttribute('aria-checked')).toBe('true')
    expect(within(chatwoot).getByRole('link', { name: 'Abrir a conversa' }).getAttribute('href')).toMatch(/\/conversations\/5004$/)
    expect(within(chatwoot).getByRole('button', { name: 'Copiar a mensagem' })).toBeTruthy()
    fireEvent.click(enviar())
    expect(await screen.findByText(/✓ Entregue no Chatwoot às 14:32/)).toBeTruthy()
    expect(aoEnviar).toHaveBeenCalled()
    expect((await obterFicha('maria-exemplo'))!.contatos.at(-1)?.canal).toBe('Chatwoot · 14:32 · entregue')
  })

  it('CA3, CA9 e G9 · a IA aponta o termo jurídico; o que esconde a situação ou pede a senha não sai', async () => {
    await abrir('maria-exemplo', 'pericia-orientacao')
    fireEvent.change(texto(), { target: { value: 'O pedido foi indeferido. Não conte ao perito que voltou a trabalhar.' } })
    expect(within(screen.getByRole('list', { name: 'A IA aponta' })).getByText('• Termo jurídico "indeferido": diga "negado".')).toBeTruthy()
    expect(screen.getByText('Nunca oriente a esconder ou mudar a situação real (G11).')).toBeTruthy()
    expect(enviar().disabled).toBe(true)
    fireEvent.change(texto(), { target: { value: 'Mande a sua senha do gov.br por aqui.' } })
    expect(screen.getByText('O escritório nunca pede a senha do gov.br por mensagem (G9).')).toBeTruthy()
    expect(enviar().disabled).toBe(true)
  })

  it('CA7 · o aviso favorável: com o OK da advogada, o texto revisado não muda; sem o OK, travado (G8)', async () => {
    await abrir('lucia-exemplo', 'resultado-favoravel')
    expect(screen.getByText('Mensagem aprovada pelo Jurídico (não muda)')).toBeTruthy()
    expect(texto().readOnly).toBe(true)
    expect(texto().value).toMatch(/^Olá, Lúcia! Boa notícia/)
    fireEvent.change(screen.getByRole('combobox', { name: 'Modelo' }), { target: { value: 'resultado-desfavoravel' } })
    expect(await screen.findByText('Falta o texto aprovado pelo Jurídico: o aviso usa só esse texto, sem estratégia interna.')).toBeTruthy()
    render(comSessao(<MensagemAoCliente ficha={(await obterFicha('antonio-exemplo'))!} modeloInicial="resultado-favoravel" aoFechar={() => {}} />))
    expect(await screen.findByText('Falta o OK da advogada na prestação de contas: o aviso só sai depois dele (G8).')).toBeTruthy()
  })

  it('CA6 · com mais de uma conversa, a de mais mensagens primeiro; escolher outra muda o "Abrir a conversa"', async () => {
    await abrir('antonio-exemplo', 'boas-vindas')
    const conversas = within(screen.getByRole('radiogroup', { name: 'Conversas do cliente' })).getAllByRole('radio')
    expect(conversas.map((c) => c.textContent)).toEqual(['Conversa #4102 · 14 mensagens · aberta · GGV PREV', 'Conversa #4101 · 3 mensagens · resolvida · GGV PREV'])
    expect(screen.getByText('2 conversas: a de mais mensagens vem primeiro.')).toBeTruthy()
    fireEvent.click(conversas[1])
    expect(screen.getByRole('link', { name: 'Abrir a conversa' }).getAttribute('href')).toMatch(/\/conversations\/4101$/)
  })

  it('CA5 · a falha do canal aparece na tela, fica no histórico e só sai de novo com "Tentar de novo"', async () => {
    await abrir('nair-exemplo', 'boas-vindas')
    fireEvent.click(enviar())
    expect(await screen.findByText('A mensagem não saiu pelo Chatwoot: o WhatsApp recusou: o número não tem WhatsApp. Ficou no histórico do cliente; nada foi reenviado sozinho.')).toBeTruthy()
    expect(enviar().textContent).toBe('Tentar de novo')
    expect((await obterFicha('nair-exemplo'))!.historico.at(-1)?.oQue).toMatch(/não saiu pelo Chatwoot/)
  })

  it('sem telefone, o Chatwoot não acha o contato', async () => {
    await abrir('marta-exemplo', 'boas-vindas')
    expect(screen.getByText('O Chatwoot não achou o contato deste telefone: confira o telefone na ficha.')).toBeTruthy()
  })

  it('GGVP-138 · a API recusa: a janela diz por quê e nada sai, sem erro solto', async () => {
    const ficha = (await obterFicha('maria-exemplo'))!
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Ficha não encontrada.' }), { status: 404 })))
    render(comSessao(<MensagemAoCliente ficha={ficha} modeloInicial="boas-vindas" aoFechar={() => {}} aoEnviar={vi.fn()} />))
    expect((await screen.findByRole('alert')).textContent).toBe('Ficha não encontrada.')
    expect(enviar().disabled).toBe(true)
    vi.unstubAllGlobals()
  })
})
