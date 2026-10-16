import { fireEvent, render, screen } from '@testing-library/react'
import type { PainelDaVigilia } from '@ggv/contratos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { PainelVigilia } from './PainelVigilia.tsx'

// GGVP-158 I18, I19: o painel da vigília diz a falha como falha e o dia sem fonte como sem fonte (G13).
const RODADA = '11111111-1111-4111-8111-111111111111'
const base: PainelDaVigilia = {
  dia: '2026-10-05',
  situacaoDoDia: 'incompleta',
  rodadas: [
    { id: RODADA, fonte: 'aasp', previstaPara: '2026-10-05T11:00:00.000Z', situacao: 'falhou', inicio: null, fim: '2026-10-05T11:01:00.000Z', capturadas: 0, erro: 'api: a AASP respondeu 503', reprocessadaPor: null, reprocessadaEm: null },
  ],
  previstas: 1,
  concluidas: 0,
  falhas: 1,
  fila: [],
  descartes: [],
  podeReprocessar: true,
  podeCasar: false,
}

function servidor(painel: PainelDaVigilia, reprocessar: object = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? reprocessar : painel), { status: 200 })),
  )
}

beforeEach(() => entrarComo('senior'))
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

describe('GGVP-158 · o painel da vigília', () => {
  it('I19 · sem fonte ligada, o dia diz que nenhuma publicação chega, e não "em andamento"', async () => {
    servidor({ ...base, situacaoDoDia: 'sem_fonte', rodadas: [], previstas: 0, falhas: 0 })
    render(comSessao(<PainelVigilia />))
    expect((await screen.findByLabelText('Situação do dia')).textContent).toBe('Vigília sem fonte ligada: nenhuma publicação chega ao portal. O suporte técnico precisa ligar a fonte.')
  })

  it('I18 · o reprocessamento que falha de novo aparece como erro, e não na caixa de sucesso', async () => {
    servidor(base, { situacao: 'falhou', erro: 'api: a AASP respondeu 503' })
    render(comSessao(<PainelVigilia />))
    fireEvent.click(await screen.findByRole('button', { name: 'Reprocessar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Falhou de novo: api: a AASP respondeu 503')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
