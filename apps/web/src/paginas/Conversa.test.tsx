import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirConversa, gravarConversa } from '../dados/conversa.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { Conversa } from './Conversa.tsx'

/** A senha que a cliente fala em voz alta na conversa de exemplo: não pode aparecer na tela (G9). */
const SENHA_DITA = 'Exemplo@2026'
/** Um segundo de gravação em 5 ms. */
const PASSO = 5
/** A máquina lenta pede folga nos testes que esperam o relógio. */
const ESPERA = { timeout: 15000 }
const LONGO = 30000
const BRUNA = { quem: 'Bruna (exemplo)', perfil: 'atendimento' as const }

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  iniciarPerfil('')
})

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

async function abrirPresencial() {
  const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }, BRUNA)
  render(<Conversa conversaId={c.id} passo={PASSO} />)
  await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Registrar conversa' })
  return c
}

describe('Registrar conversa · tela do passo (GGVP-76)', () => {
  it('o topo do passo D5.01: o canal escolhido, o aviso G10 e G9 e "Antes de concluir"', async () => {
    await abrirPresencial()
    expect(screen.getByText('D5.01')).toBeTruthy()
    expect(screen.getByText('Auxílio por Incapacidade Temporária · veio ao escritório · presencial, com cliente')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Aviso de gravação (G10) · senha no cofre (G9)' })).toBeTruthy()
    const canal = screen.getByRole('radiogroup', { name: 'Canal da conversa' })
    expect(within(canal).getByRole('radio', { name: 'Presencial — conversar e gravar' }).getAttribute('aria-checked')).toBe('true')
    expect(within(canal).getByRole('radio', { name: 'Telefone — subir a gravação da ligação' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('heading', { name: 'Antes de concluir' })).toBeTruthy()
  })

  it('CA1 e CA5 · "Gravar" lembra o aviso; só grava depois de "Avisei", com a hora do aviso (G10)', async () => {
    await abrirPresencial()
    expect(screen.getByText('Antes de gravar · avise o cliente (G10)')).toBeTruthy()
    fireEvent.click(botao('Gravar'))
    expect(screen.getByText('“Maria, esta conversa vai ser gravada e transcrita para atualizar a sua ficha. Tudo bem?”')).toBeTruthy()
    expect(botao('Começar a gravar').disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei que a conversa será gravada' }))
    fireEvent.click(botao('Começar a gravar'))
    expect((await screen.findByText(/● Gravando/)).textContent).toMatch(/● Gravando · 00:00:\d\d · aviso de gravação feito às 14:32 \(G10\)/)
  })

  it(
    'CA6 e CA9 · transcrição em tempo real sem a senha dita, o cofre pausa, e "Finalizar conversa" guarda o áudio e transcreve',
    async () => {
      const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }, BRUNA)
      await gravarConversa(c.id, { avisei: true })
      // A página abre com a gravação já começada: volta pausada (recarregou no meio).
      render(<Conversa conversaId={c.id} passo={PASSO} />)
      expect(await screen.findByText(/A página recarregou: a gravação ficou pausada/)).toBeTruthy()
      fireEvent.click(botao('Retomar'))
      await screen.findByText(/Mudei de casa/, undefined, ESPERA)
      fireEvent.click(botao('🔒 Abrir o cofre (pausa a gravação)'))
      expect(await screen.findByText(/Pausada para a senha do gov.br/)).toBeTruthy()
      fireEvent.click(botao('Fechar o cofre e retomar'))
      await screen.findByText(/senha retirada: vai ao cofre/, undefined, ESPERA)
      expect(document.body.textContent).not.toContain(SENHA_DITA)
      fireEvent.click(botao('Finalizar conversa'))
      await screen.findByRole('heading', { name: /✓ Conversa finalizada/ })
      expect(await screen.findByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeTruthy()
      expect(screen.getByText(/O áudio ficou guardado no card do cliente: conversa-maria-exemplo-2026-10-07.webm/)).toBeTruthy()
      expect(document.body.textContent).not.toContain(SENHA_DITA)
      expect(ler().gravacoes.at(-1)!.acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou', 'pausou', 'retomou', 'abriu-cofre', 'retomou', 'encerrou'])
    },
    LONGO,
  )

  it('CA2 · a ligação da Central: anexar o áudio pede o aviso na gravação; o áudio fica no card e vai para a transcrição', async () => {
    render(<Conversa conversaId="conversa-pedro-ligacao" passo={PASSO} />)
    await screen.findByRole('heading', { level: 1, name: 'Pedro Exemplo · Registrar conversa' })
    expect(screen.getByText('LOAS Idoso · ligou com informação nova sobre a exigência do INSS · ligação, com cliente')).toBeTruthy()
    const audio = new File([new Uint8Array(2048)], 'ligacao-pedro.ogg', { type: 'audio/ogg' })
    fireEvent.change(screen.getByLabelText(/Áudio da ligação/), { target: { files: [audio] } })
    expect(botao('Anexar e transcrever').disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'A ligação começou com o aviso de que seria gravada (G10)' }))
    fireEvent.click(botao('Anexar e transcrever'))
    await screen.findByRole('heading', { name: '✓ Gravação da ligação anexada' })
    expect(await screen.findByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeTruthy()
    expect((await obterFicha('pedro-exemplo'))!.historico.map((e) => e.oQue)).toContain('Subiu a gravação da ligação (ligacao-pedro.ogg); o áudio ficou no card e foi para a transcrição')
  })

  it('a transcrição falha: o aviso, o áudio guardado e "Tentar de novo"', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' }, BRUNA)
    render(<Conversa conversaId={c.id} passo={PASSO} simular="falha-da-transcricao" />)
    await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Registrar conversa' })
    fireEvent.change(screen.getByLabelText(/Áudio da ligação/), { target: { files: [new File(['x'], 'ligacao.mp3', { type: 'audio/mpeg' })] } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'A ligação começou com o aviso de que seria gravada (G10)' }))
    fireEvent.click(botao('Anexar e transcrever'))
    expect(await screen.findByText('A transcrição falhou: o serviço de transcrição não respondeu. O áudio está guardado; nada se perdeu.')).toBeTruthy()
    fireEvent.click(botao('Tentar de novo'))
    expect(await screen.findByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeTruthy()
  })

  it('o registro escrito aparece como "só registro"', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'escrito', registro: 'Perguntou o que levar na perícia.' }, BRUNA)
    render(<Conversa conversaId={c.id} />)
    expect(await screen.findByRole('heading', { name: 'Registro escrito · só registro' })).toBeTruthy()
    expect(screen.getByText('Perguntou o que levar na perícia.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '✓ Conversa registrada sem áudio' })).toBeTruthy()
  })

  it('conversa que não existe avisa', async () => {
    render(<Conversa conversaId="nao-existe" />)
    expect(await screen.findByRole('heading', { name: 'Conversa não encontrada' })).toBeTruthy()
  })
})
