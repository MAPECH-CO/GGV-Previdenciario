import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirConversa, anexarAudio, transcreverConversa } from '../dados/conversa.ts'
import { encerrarGravacao, iniciarGravacao, transcrever } from '../dados/entrevista.ts'
import { entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import type { Gravacao } from '../dados/tipos.ts'
import { Transcricoes } from './Transcricoes.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  entrarComo()
})

async function abrir(fichaId: string, perfil: 'juridico' | 'atendimento', aoMudar = () => {}) {
  render(<Transcricoes ficha={(await obterFicha(fichaId))!} perfil={perfil} aoFechar={() => {}} aoMudar={aoMudar} />)
  await screen.findByRole('heading', { name: 'Transcrições do caso' })
}

async function entrevistaDaJosefa(falhar = false) {
  const g = await iniciarGravacao('josefa-entrevista', { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  return transcrever(g.id, { falhar })
}

const itemDaLista = (nome: RegExp) => screen.getByRole('button', { name: nome })

/** Muda uma gravação da semente (o servidor de verdade é testado na API). */
function mudarGravacao(id: string, mudar: (g: Gravacao) => void) {
  const banco = ler()
  mudar(banco.gravacoes.find((g) => g.id === id)!)
  gravar(banco)
}

describe('Transcrições do caso · janela', () => {
  it('CA4 · a lista com a data, a duração, quem participou e a situação; a contagem do topo', async () => {
    await abrir('antonio-exemplo', 'juridico')
    expect(screen.getByText('2 gravações · 1 registro sem áudio')).toBeTruthy()
    const lista = screen.getByRole('navigation', { name: 'Gravações e registros' })
    expect(within(lista).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '27/09 · sem áudioWhatsApp: exigência do juizWhatsApp · Atendimento + Antônio Exemplosó registro',
      '20/09 · 12 minTelefone: indeferimento e próximo passotelefone · Atendimento + Antônio Exemplotranscrita',
      '10/07 · 38 minEntrevista com a advogadavídeo · Dra. Paula + Atendimento + Antônio Exemplotranscrita · ficha atualizada',
    ])
    expect(await screen.findByText('Avisado da exigência do juiz; vai buscar as notas do produtor.')).toBeTruthy()
  })

  it('CA1, CA2, CA6 e CA8 · resumo, informações com destino, quem fala, busca com o trecho marcado e prova', async () => {
    await abrir('antonio-exemplo', 'juridico')
    fireEvent.click(itemDaLista(/Entrevista com a advogada/))
    expect(screen.getByRole('heading', { name: 'Entrevista com a advogada · 10/07/2026 · 38 min' })).toBeTruthy()
    expect(screen.getByText(/A advogada definiu Aposentadoria por Incapacidade Permanente/)).toBeTruthy()
    const extraidas = screen.getByRole('region', { name: 'Informações extraídas · o que foi para a ficha' })
    expect(within(extraidas).getByText('pendência → Documentação')).toBeTruthy()
    expect(within(extraidas).getByText('cofre')).toBeTruthy()
    expect(within(extraidas).getAllByText('✓ conferida')).toHaveLength(8)
    const trechos = screen.getByRole('list', { name: 'Trechos' })
    expect(within(trechos).getAllByText('Dra. Paula').length).toBeGreaterThan(0)
    expect(within(trechos).getAllByText('Antônio').length).toBeGreaterThan(0)
    expect(screen.getByText('3 trechos marcados como prova')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Buscar na transcrição'), { target: { value: 'roca' } })
    const achados = within(screen.getByRole('list', { name: 'Trechos' })).getAllByRole('listitem')
    expect(achados).toHaveLength(1)
    expect(achados[0].querySelector('mark')?.textContent).toBe('roça')
    fireEvent.change(screen.getByLabelText('Buscar na transcrição'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como prova do trecho de 00:06' }))
    expect(await screen.findByText('4 trechos marcados como prova')).toBeTruthy()
  })

  it('Abrir áudio e Exportar PDF', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {})
    await abrir('antonio-exemplo', 'juridico')
    fireEvent.click(itemDaLista(/Entrevista com a advogada/))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir áudio' }))
    const player = screen.getByRole('group', { name: 'Áudio: entrevista-antonio-exemplo-2026-07-10.webm' })
    // A gravação da semente não tem arquivo: a tela diz isso, sem botão de tocar de mentira.
    expect(player.textContent).toBe('entrevista-antonio-exemplo-2026-07-10.webm: gravação de exemplo, sem arquivo guardado no portal para tocar.')
    expect(screen.queryByRole('button', { name: /Tocar o áudio/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    expect(imprimir).toHaveBeenCalled()
    imprimir.mockRestore()
  })

  it('GGVP-133 · o áudio guardado toca de verdade, parte por parte, e o texto final abre pela gravação; o Atendimento não abre', async () => {
    mudarGravacao('antonio-entrevista', (g) => {
      g.audio = { ...g.audio!, documentos: [{ id: 'parte-1', inicio: 0 }, { id: 'parte-2', inicio: 600 }] }
      g.transcricaoDocumentoId = 'texto-final'
    })
    await abrir('antonio-exemplo', 'juridico')
    fireEvent.click(itemDaLista(/Entrevista com a advogada/))
    expect(screen.getByRole('link', { name: 'Abrir o texto final' }).getAttribute('href')).toBe('/api/gravacoes/antonio-entrevista/arquivos/texto-final')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir áudio' }))
    const player = screen.getByRole('group', { name: 'Áudio: entrevista-antonio-exemplo-2026-07-10.webm' })
    const partes = [...player.querySelectorAll('audio')]
    expect(partes.map((a) => [a.getAttribute('src'), a.getAttribute('aria-label')])).toEqual([
      ['/api/gravacoes/antonio-entrevista/arquivos/parte-1', 'Parte 1 do áudio, desde 00:00'],
      ['/api/gravacoes/antonio-entrevista/arquivos/parte-2', 'Parte 2 do áudio, desde 10:00'],
    ])
    cleanup()
    await abrir('antonio-exemplo', 'atendimento')
    fireEvent.click(itemDaLista(/Entrevista com a advogada/))
    expect(screen.queryByRole('link', { name: 'Abrir o texto final' })).toBeNull()
  })

  it('GGVP-133 · sem a IA, a tela diz o motivo e segue manual, sem resumo inventado', async () => {
    mudarGravacao('antonio-entrevista', (g) => {
      g.semIa = 'a IA não está autorizada a ler dado de saúde neste ambiente'
      g.resumo = undefined
    })
    await abrir('antonio-exemplo', 'juridico')
    fireEvent.click(itemDaLista(/Entrevista com a advogada/))
    expect(screen.getByRole('status').textContent).toBe(
      'A IA não leu esta gravação: a IA não está autorizada a ler dado de saúde neste ambiente. Leia a transcrição e preencha a ficha à mão.',
    )
  })

  it('o Atendimento vê a entrevista com a advogada só pela data, quem participou e a duração', async () => {
    await abrir('antonio-exemplo', 'atendimento')
    fireEvent.click(itemDaLista(/Entrevista com a advogada/))
    expect(screen.getByText('Só o Jurídico abre o resumo, a transcrição e o áudio desta entrevista: ela tem dado de saúde.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Abrir áudio' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/crises na coluna/)).toBeNull()
    fireEvent.click(itemDaLista(/Telefone: indeferimento/))
    expect(screen.getByText(/o cliente concordou em ajuizar/)).toBeTruthy()
  })

  it('CA3 · a transcrição que falhou mostra o aviso e "Tentar de novo"', async () => {
    await entrevistaDaJosefa(true)
    await abrir('josefa-exemplo', 'juridico')
    expect((await screen.findByRole('alert')).textContent).toContain('A transcrição falhou: o serviço de transcrição não respondeu.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('list', { name: 'Trechos' })).toBeTruthy()
  })

  it('CA6 e CA7 · conferir e levar à ficha só o marcado; a lista de documentos vai ao checklist depois de conferida', async () => {
    await entrevistaDaJosefa()
    const aoMudar = vi.fn()
    await abrir('josefa-exemplo', 'juridico', aoMudar)
    const levar = screen.getByRole('button', { name: 'Conferir e levar' }) as HTMLButtonElement
    expect(levar.disabled).toBe(true)
    // GGVP-133: cada item mostra de onde saiu, com a hora e o trecho, e a advogada pode corrigir antes de levar.
    // O contato de apoio e o telefone saíram da mesma fala.
    expect(screen.getAllByText('dito aos 01:44: «O da Renata é (11) 90000-0022. O meu mudou: agora é (11) 90000-0021.»')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Corrigir: telefone'), { target: { value: '(11) 90000-0099' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi: telefone' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi: laudos citados' }))
    fireEvent.click(levar)
    expect(await screen.findAllByText('✓ conferida')).toHaveLength(2)
    expect(aoMudar).toHaveBeenCalled()
    const josefa = (await obterFicha('josefa-exemplo'))!
    expect(josefa.telefone).toBe('11900000099')
    expect(josefa.historico.map((e) => e.oQue)).toContain('Levou à ficha, da entrevista de 05/10, telefone: «(11) 90000-0002» → «(11) 90000-0099» (corrigido na conferência; a IA ouviu «(11) 90000-0021»)')
    const enviar = screen.getByRole('button', { name: 'Enviar ao checklist do benefício' }) as HTMLButtonElement
    expect(enviar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi a lista com a entrevista' }))
    fireEvent.click(enviar)
    expect(await screen.findByText(/✓ Conferida e enviada ao checklist do benefício em 05\/10/)).toBeTruthy()
  })

  it('CA6 e GGVP-76 · "Registrar nova conversa" abre a janela da conversa; só escrita, aparece aqui como "só registro"', async () => {
    await abrir('antonio-exemplo', 'atendimento')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar nova conversa' }))
    const janela = screen.getByRole('dialog', { name: /Registrar conversa com o cliente/ })
    fireEvent.click(within(janela).getByRole('radio', { name: 'Ligação' }))
    fireEvent.click(within(janela).getByRole('radio', { name: 'Sem áudio · só o registro escrito' }))
    fireEvent.change(within(janela).getByLabelText('Resumo da conversa *'), { target: { value: 'Explicamos o que levar na perícia.' } })
    fireEvent.click(within(janela).getByRole('button', { name: 'Salvar o registro' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: /Registrar conversa com o cliente/ })).toBeNull())
    expect(await screen.findByText('Explicamos o que levar na perícia.')).toBeTruthy()
    // O contador do topo se atualiza depois da lista: espera por ele, em vez de conferir na hora.
    expect(await screen.findByText('2 gravações · 2 registros sem áudio')).toBeTruthy()
  })

  it('GGVP-80 CA6 · a conversa com o cliente mostra o que a IA extraiu e leva à conferência dela, em vez de "Conferir e levar"', async () => {
    // Quem conduz é a advogada: o servidor (de mentira, aqui) usa a pessoa da sessão.
    entrarComo('advogada')
    const c = await abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
    await anexarAudio(c.id, { nome: 'ligacao.ogg', tipo: 'audio/ogg', tamanho: 4096, avisoNaGravacao: true })
    await transcreverConversa(c.id)
    await abrir('maria-exemplo', 'juridico')
    // A lista vem da API depois do título: espera por ela, em vez de conferir na hora.
    expect(await screen.findByText('Telefone de contato')).toBeTruthy()
    expect(screen.getAllByText('a conferir na conversa')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'Conferir e levar' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Conferir na conversa (D5.04)' }).getAttribute('href')).toBe(`/conversas/${c.id}/conferir`)
  })
})
