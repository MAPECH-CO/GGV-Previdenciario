import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encerrarGravacao, iniciarGravacao, transcrever } from '../dados/entrevista.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { Transcricoes } from './Transcricoes.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
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
    expect(screen.getByRole('group', { name: 'Áudio: entrevista-antonio-exemplo-2026-07-10.webm' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    expect(imprimir).toHaveBeenCalled()
    imprimir.mockRestore()
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi: telefone' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi: laudos citados' }))
    fireEvent.click(levar)
    expect(await screen.findAllByText('✓ conferida')).toHaveLength(2)
    expect(aoMudar).toHaveBeenCalled()
    expect((await obterFicha('josefa-exemplo'))!.telefone).toBe('11900000021')
    const enviar = screen.getByRole('button', { name: 'Enviar ao checklist do benefício' }) as HTMLButtonElement
    expect(enviar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi a lista com a entrevista' }))
    fireEvent.click(enviar)
    expect(await screen.findByText(/✓ Conferida e enviada ao checklist do benefício em 05\/10/)).toBeTruthy()
  })

  it('CA6 · registrar uma conversa sem áudio', async () => {
    await abrir('antonio-exemplo', 'atendimento')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar nova conversa' }))
    fireEvent.change(screen.getByLabelText('Data *'), { target: { value: '04/10/2026' } })
    fireEvent.change(screen.getByLabelText('Por onde *'), { target: { value: 'Telefone' } })
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'dúvida sobre a perícia' } })
    fireEvent.change(screen.getByLabelText('Quem participou *'), { target: { value: 'Atendimento, Antônio' } })
    fireEvent.change(screen.getByLabelText('O que foi conversado *'), { target: { value: 'Explicamos o que levar na perícia.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar conversa' }))
    expect(await screen.findByText('Explicamos o que levar na perícia.')).toBeTruthy()
    expect(screen.getByText('2 gravações · 2 registros sem áudio')).toBeTruthy()
  })
})
