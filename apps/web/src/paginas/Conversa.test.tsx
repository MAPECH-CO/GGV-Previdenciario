import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirConversa, finalizarConversa, gravarConversa, transcreverConversa } from '../dados/conversa.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { LEMBRETE_DA_IDENTIDADE } from '../regras/seguranca.ts'
import { Conversa } from './Conversa.tsx'

/** A senha que a cliente fala em voz alta na conversa de exemplo: não pode aparecer na tela (G9). */
const SENHA_DITA = 'Exemplo@2026'
/** Um segundo de gravação em 5 ms. */
const PASSO = 5
/** A máquina lenta pede folga nos testes que esperam o relógio. */
const ESPERA = { timeout: 15000 }
const LONGO = 30000
const BRUNA = { quem: 'Ana (exemplo)', perfil: 'atendimento' as const }

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

async function abrirPresencial() {
  const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }, BRUNA)
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

  it(
    'CA6 e CA9 · transcrição em tempo real sem a senha dita, o cofre pausa, e "Finalizar conversa" guarda o áudio e transcreve',
    async () => {
      const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }, BRUNA)
      await gravarConversa(c.id, { avisei: true })
      // A página abre com a gravação já começada: volta pausada (recarregou no meio).
      render(comSessao(<Conversa conversaId={c.id} passo={PASSO} />))
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
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' }, BRUNA)
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
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'escrito', registro: 'Perguntou o que levar na perícia.' }, BRUNA)
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
    const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' }, BRUNA)
    await gravarConversa(c.id, { avisei: true })
    await finalizarConversa(c.id, { aos: 116 })
    await transcreverConversa(c.id)
    return c
  }

  it('CA2, CA5 e GGVP-76 CA9 · o que mudou, os dados novos, o que precisa atualizar, a observação e o combinado; o Atendimento não vê o fato de saúde', async () => {
    const c = await transcrita()
    render(comSessao(<Conversa conversaId={c.id} />))
    const quadro = await screen.findByRole('region', { name: 'O que a IA encontrou na conversa' })
    const mudou = within(quadro).getByRole('list', { name: 'O que mudou' })
    expect(within(mudou).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '• Ficha · telefone de contato: (11) 90000-0004 → (11) 90000-0044 (dito às 14:32)«Não, troquei de número: agora é (11) 90000-0044.»',
      '• Processo · data da perícia do INSS: 02/10/2026 → 16/10/2026 (dito às 14:32)«Mandou: remarcaram a perícia para 16/10, às 8h30.»',
    ])
    const novos = within(quadro).getByRole('list', { name: 'Dados novos' })
    expect(within(novos).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '• Ficha · endereço: Rua Exemplo das Acácias, 45 (dito às 14:32)«Mudei de casa. Agora moro na Rua Exemplo das Acácias, 45.»',
      '• Processo · fato novo de saúde · só o Jurídico vê',
      // O trecho é a mesma fala do fato de saúde: o Atendimento não vê.
      '• Processo · documento citado: Relatório da alta hospitalar (dito às 14:33)',
    ])
    expect(within(quadro).getByText('✓ Ficha do cliente').getAttribute('data-marcado')).toBe('true')
    expect(within(quadro).getByText('✓ Campos do processo')).toBeTruthy()
    expect(within(quadro).getByText(/A senha do gov.br foi dita em voz alta/)).toBeTruthy()
    expect(within(quadro).getByText('Documentação: receber e digitalizar o relatório da alta hospitalar.')).toBeTruthy()
    expect(within(quadro).getByRole('link', { name: 'Conferir e atualizar (D5.04)' }).getAttribute('href')).toBe(`/conversas/${c.id}/conferir`)
    expect(screen.getByText('A transcrição completa fica só para o Jurídico: a conversa tem dado de saúde.')).toBeTruthy()
    expect(quadro.textContent).not.toMatch(/hospital no fim de setembro/i)
  })

  it('a advogada vê o fato de saúde e a transcrição', async () => {
    const c = await transcrita()
    entrarComo('advogada')
    render(comSessao(<Conversa conversaId={c.id} />))
    const quadro = await screen.findByRole('region', { name: 'O que a IA encontrou na conversa' })
    expect(within(quadro).getByText(/Processo · fato novo: Três dias no hospital no fim de setembro/)).toBeTruthy()
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
