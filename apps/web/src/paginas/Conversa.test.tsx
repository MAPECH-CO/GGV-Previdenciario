import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirConversa, finalizarConversa, gravarConversa, transcreverConversa } from '../dados/conversa.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { LEMBRETE_DA_IDENTIDADE } from '../regras/seguranca.ts'
import { Conversa } from './Conversa.tsx'

/** A senha que a cliente fala em voz alta na conversa de exemplo: não pode aparecer na tela (G9). */
const SENHA_DITA = 'Exemplo@2026'
/** Um segundo de gravação em 5 ms. */
const PASSO = 5
// GGVP-133: o microfone é de mentira. Por padrão ele fica abrindo (a gravação segue); o teste sem microfone diz o motivo.
const abrirMicrofone = vi.hoisted(() => vi.fn())
/** A máquina lenta pede folga nos testes que esperam o servidor falso. */
const ESPERA = { timeout: 15000 }
vi.mock('../dados/audio.ts', () => ({ abrirMicrofone, ouvirAoVivo: vi.fn(async () => null) }))

beforeEach(() => {
  abrirMicrofone.mockImplementation(() => new Promise(() => {}))
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

async function abrirPresencial() {
  const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
  render(comSessao(<Conversa conversaId={c.id} passo={PASSO} />))
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

  it('CA9 · a página recarregou no meio: a gravação volta pausada e o cofre pausa de novo (G9)', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
    await gravarConversa(c.id, { avisei: true })
    render(comSessao(<Conversa conversaId={c.id} passo={PASSO} />))
    expect(await screen.findByText(/A página recarregou: a gravação ficou pausada/)).toBeTruthy()
    fireEvent.click(botao('Retomar'))
    await screen.findByText(/● Gravando/)
    fireEvent.click(botao('🔒 Abrir o cofre (pausa a gravação)'))
    expect(await screen.findByText(/Pausada para a senha do gov.br/)).toBeTruthy()
    fireEvent.click(botao('Fechar o cofre e retomar'))
    await screen.findByText(/● Gravando/)
    expect(ler().gravacoes.at(-1)!.acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou', 'pausou', 'retomou', 'abriu-cofre', 'retomou'])
  })

  it('GGVP-133 · sem microfone: o aviso com o motivo, nenhuma fala de exemplo, e a conversa fica registrada sem áudio', async () => {
    abrirMicrofone.mockResolvedValue({ erro: 'o navegador não deu permissão ao microfone' })
    await abrirPresencial()
    fireEvent.click(botao('Gravar'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei que a conversa será gravada' }))
    fireEvent.click(botao('Começar a gravar'))
    expect(await screen.findByRole('heading', { name: 'Sem microfone: o navegador não deu permissão ao microfone' }, ESPERA)).toBeTruthy()
    expect(screen.getByText('Sem microfone: nada está sendo gravado nem transcrito.')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Falas' })).toBeNull()
    expect(document.body.textContent).not.toContain('Mudei de casa')
    expect(await screen.findByLabelText('Subir o áudio gravado fora', undefined, ESPERA)).toBeTruthy()
    fireEvent.click(botao('Registrar como sem áudio'))
    fireEvent.change(screen.getByLabelText('O que foi conversado *'), { target: { value: 'Contou que mudou de casa; traz o comprovante.' } })
    fireEvent.click(botao('Registrar sem áudio'))
    expect(await screen.findByRole('heading', { name: '✓ Conversa registrada sem áudio' }, ESPERA)).toBeTruthy()
    expect(ler().gravacoes.at(-1)!.acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou', 'falhou', 'sem-audio'])
    expect(ler().gravacoes.at(-1)!.audio).toBeUndefined()
  })

  it('CA2 · a ligação da Central: anexar o áudio pede o aviso na gravação; o áudio fica no card e vai para a transcrição', async () => {
    render(comSessao(<Conversa conversaId="conversa-pedro-ligacao" passo={PASSO} />))
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
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
    render(comSessao(<Conversa conversaId={c.id} passo={PASSO} simular="falha-da-transcricao" />))
    await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Registrar conversa' })
    fireEvent.change(screen.getByLabelText(/Áudio da ligação/), { target: { files: [new File(['x'], 'ligacao.mp3', { type: 'audio/mpeg' })] } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'A ligação começou com o aviso de que seria gravada (G10)' }))
    fireEvent.click(botao('Anexar e transcrever'))
    expect(await screen.findByText('A transcrição falhou: o serviço de transcrição não respondeu. O áudio está guardado; nada se perdeu.')).toBeTruthy()
    fireEvent.click(botao('Tentar de novo'))
    expect(await screen.findByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeTruthy()
  })

  it('o registro escrito aparece como "só registro"', async () => {
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'escrito', registro: 'Perguntou o que levar na perícia.' })
    render(comSessao(<Conversa conversaId={c.id} />))
    expect(await screen.findByRole('heading', { name: 'Registro escrito · só registro' })).toBeTruthy()
    expect(screen.getByText('Perguntou o que levar na perícia.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '✓ Conversa registrada sem áudio' })).toBeTruthy()
  })

  it('conversa que não existe avisa', async () => {
    render(comSessao(<Conversa conversaId="nao-existe" />))
    expect(await screen.findByRole('heading', { name: 'Conversa não encontrada' })).toBeTruthy()
  })
})

describe('Transcrever e identificar o que mudou · tela (GGVP-80)', () => {
  async function transcrita() {
    const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
    await gravarConversa(c.id, { avisei: true })
    await finalizarConversa(c.id, { aos: 116 })
    await transcreverConversa(c.id)
    return c
  }

  it('CA2, CA5 e GGVP-76 CA9 · o que mudou, os dados novos, o que precisa atualizar, a observação e o combinado; quem conversou vê tudo', async () => {
    const c = await transcrita()
    render(comSessao(<Conversa conversaId={c.id} />))
    const quadro = await screen.findByRole('region', { name: 'O que a IA encontrou na conversa' })
    const mudou = within(quadro).getByRole('list', { name: 'O que mudou' })
    expect(within(mudou).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '• Ficha · telefone de contato: (11) 90000-0004 → (11) 90000-0044 (dito às 14:32)«Não, troquei de número: agora é (11) 90000-0044.»',
      '• Processo · data da perícia do INSS: 02/10/2026 → 16/10/2026 (dito às 14:32)«Mandou: remarcaram a perícia para 16/10, às 8h30.»',
    ])
    const novos = within(quadro).getByRole('list', { name: 'Dados novos' })
    const itens = within(novos).getAllByRole('listitem')
    expect(itens.map((li) => li.textContent?.split(':')[0])).toEqual(['• Ficha · endereço', '• Processo · fato novo', '• Processo · documento citado'])
    expect(itens[0].textContent).toBe('• Ficha · endereço: Rua Exemplo das Acácias, 45 (dito às 14:32)«Mudei de casa. Agora moro na Rua Exemplo das Acácias, 45.»')
    // O que a conversa registrou não é dado de saúde (Pedro, 08/10): quem conversou vê cada mudança com o trecho dela.
    expect(itens.every((li) => li.textContent?.includes('«'))).toBe(true)
    expect(within(quadro).getByText('✓ Ficha do cliente').getAttribute('data-marcado')).toBe('true')
    expect(within(quadro).getByText('✓ Campos do processo')).toBeTruthy()
    expect(within(quadro).getByText(/A senha do gov.br foi dita em voz alta/)).toBeTruthy()
    expect(within(quadro).getByText('Documentação: receber e digitalizar o relatório da alta hospitalar.')).toBeTruthy()
    expect(within(quadro).getByRole('link', { name: 'Conferir e atualizar (D5.04)' }).getAttribute('href')).toBe(`/conversas/${c.id}/conferir`)
    expect(within(screen.getByRole('list', { name: 'Falas' })).getAllByRole('listitem').length).toBeGreaterThan(5)
    // A senha dita em voz alta não aparece no texto final (G9).
    expect(document.body.textContent).not.toContain(SENHA_DITA)
  })

  it('a advogada também vê a análise e a transcrição', async () => {
    const c = await transcrita()
    entrarComo('advogada')
    render(comSessao(<Conversa conversaId={c.id} />))
    const quadro = await screen.findByRole('region', { name: 'O que a IA encontrou na conversa' })
    expect(within(quadro).getByText(/^• Processo · fato novo: /)).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Falas' })).getAllByRole('listitem').length).toBeGreaterThan(5)
  })
})

describe('Roteiro de segurança na conversa (GGVP-111)', () => {
  it('CA3 e CA7 · na ligação, antes de passar dado do caso, confirmar a identidade ou retornar pelo contato cadastrado', async () => {
    render(comSessao(<Conversa conversaId="conversa-pedro-ligacao" passo={PASSO} />))
    await screen.findByRole('heading', { level: 1, name: 'Pedro Exemplo · Registrar conversa' })
    const roteiro = within(screen.getByRole('region', { name: 'Roteiro de segurança · quem está falando?' }))
    expect(roteiro.getByText(LEMBRETE_DA_IDENTIDADE)).toBeTruthy()
    expect(roteiro.getByText(/^Sem a verificação, não passe dado do caso\. Diga só: "Vou retornar pelo contato cadastrado", e ligue para \(11\) 90000-0008\.$/)).toBeTruthy()
  })

  it('CA8 · presencial com o próprio cliente, no escritório: sem o roteiro', async () => {
    await abrirPresencial()
    expect(screen.queryByRole('region', { name: 'Roteiro de segurança · quem está falando?' })).toBeNull()
  })
})
