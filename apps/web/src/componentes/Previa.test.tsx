import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Previa } from './Previa.tsx'

// A prévia só abre em aparelho com mouse: o teste fixa o que o navegador responderia para (hover: hover) and (pointer: fine).
function aparelho(comMouse: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((consulta: string) => ({
      matches: comMouse,
      media: consulta,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const conteudo = vi.fn(() => <p>Dois processos em andamento</p>)

function desenhar() {
  return render(
    <Previa rotulo="Maria das Graças" conteudo={conteudo}>
      <button type="button">Maria</button>
    </Previa>,
  )
}

const gatilho = () => screen.getByRole('button', { name: 'Maria' })

beforeEach(() => {
  conteudo.mockClear()
  aparelho(true)
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('Previa', () => {
  it('abre na hora com o foco pelo teclado e liga o cartão ao gatilho', () => {
    desenhar()
    act(() => gatilho().focus())
    const cartao = screen.getByRole('tooltip')
    expect(cartao.textContent).toContain('Dois processos em andamento')
    expect(gatilho().getAttribute('aria-describedby')).toBe(cartao.id)
  })

  it('Esc fecha o cartão e tira a ligação com o gatilho', () => {
    desenhar()
    act(() => gatilho().focus())
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(gatilho().getAttribute('aria-describedby')).toBeNull()
  })

  it('perder o foco fecha o cartão', () => {
    desenhar()
    act(() => gatilho().focus())
    act(() => gatilho().blur())
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('sem mouse (toque) não abre: nem com o foco, nem com a passagem do ponteiro', () => {
    aparelho(false)
    vi.useFakeTimers()
    desenhar()
    act(() => gatilho().focus())
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.mouseEnter(gatilho())
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(conteudo).not.toHaveBeenCalled()
  })

  it('o conteúdo só monta quando a prévia abre', () => {
    desenhar()
    expect(conteudo).not.toHaveBeenCalled()
    act(() => gatilho().focus())
    expect(conteudo).toHaveBeenCalled()
  })

  it('com o mouse, abre só depois de uns 400 ms e fecha ao sair com folga', () => {
    vi.useFakeTimers()
    desenhar()
    fireEvent.mouseEnter(gatilho())
    act(() => vi.advanceTimersByTime(200))
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => vi.advanceTimersByTime(250))
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.mouseLeave(gatilho())
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByRole('tooltip')).toBeTruthy()
    act(() => vi.advanceTimersByTime(100))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('com uma prévia aberta, a próxima abre quase na hora e fecha a anterior: uma de cada vez', () => {
    vi.useFakeTimers()
    render(
      <>
        <Previa rotulo="Primeira" conteudo={() => <p>um</p>}>
          <button type="button">Um</button>
        </Previa>
        <Previa rotulo="Segunda" conteudo={() => <p>dois</p>}>
          <button type="button">Dois</button>
        </Previa>
      </>,
    )
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Um' }))
    act(() => vi.advanceTimersByTime(450))
    fireEvent.mouseLeave(screen.getByRole('button', { name: 'Um' }))
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Dois' }))
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getAllByRole('tooltip').map((c) => c.getAttribute('aria-label'))).toEqual(['Segunda'])
  })
})

describe('Previa ao lado (o balão da tarefa, Pedro, 16/10)', () => {
  const linha = { left: 100, right: 600, top: 300, bottom: 350, width: 500, height: 50, x: 100, y: 300, toJSON: () => ({}) }
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  })

  function abrirAoLado(largura: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: largura })
    render(
      <Previa lado="direita" rotulo="Maria · Cobrar documento" conteudo={conteudo}>
        <button type="button">Maria</button>
      </Previa>,
    )
    vi.spyOn(gatilho(), 'getBoundingClientRect').mockReturnValue(linha as DOMRect)
    act(() => gatilho().focus())
    return screen.getByRole('tooltip')
  }

  it('abre à direita da linha, centrado nela, e o contorno começa na ponta, que aponta para o meio da linha', () => {
    const balao = abrirAoLado(1280)
    expect([balao.style.left, balao.style.top]).toEqual(['614px', '245px'])
    expect(balao.querySelector('path')?.getAttribute('d')).toMatch(/^M0 80 L8 73 /)
  })

  it('sem espaço à direita da linha, o balão encosta na borda da tela, por cima do fim da linha', () => {
    const balao = abrirAoLado(700)
    expect([balao.style.left, balao.style.top]).toEqual(['372px', '245px'])
    expect(balao.querySelector('path')).toBeTruthy()
  })

  it('na tela mais estreita que o balão, vira o cartão de baixo, sem a ponta', () => {
    const balao = abrirAoLado(300)
    expect(balao.querySelector('svg')).toBeNull()
    expect(balao.style.top).toBe('358px')
  })
})
