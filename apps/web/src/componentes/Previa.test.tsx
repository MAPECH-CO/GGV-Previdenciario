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

describe('o balão do "i" da tarefa (Pedro, 16/10)', () => {
  const noFimDaLinha = (top: number) => ({ left: 1000, right: 1032, top, bottom: top + 32, width: 32, height: 32, x: 1000, y: top, toJSON: () => ({}) })
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(380)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  })

  function abrirNoI(top: number) {
    render(
      <Previa balao rotulo="Maria · Cobrar documento" conteudo={conteudo}>
        <button type="button">Maria</button>
      </Previa>,
    )
    vi.spyOn(gatilho(), 'getBoundingClientRect').mockReturnValue(noFimDaLinha(top) as DOMRect)
    act(() => gatilho().focus())
    return screen.getByRole('tooltip')
  }

  it('abre embaixo do "i", para a esquerda dele, e o contorno começa na ponta, que aponta para o "i"', () => {
    const balao = abrirNoI(300)
    expect([balao.style.left, balao.style.top]).toEqual(['664px', '344px'])
    expect(balao.querySelector('path')?.getAttribute('d')).toMatch(/^M352 0 L345 8 /)
    expect(balao.hasAttribute('data-acima')).toBe(false)
  })

  it('na tarefa do fim da tela, sem espaço embaixo, abre em cima, com o desenho virado', () => {
    const balao = abrirNoI(700)
    expect(balao.style.top).toBe('528px')
    expect(balao.hasAttribute('data-acima')).toBe(true)
  })

  it('no toque, sem mouse, o clique abre; tocar fora fecha', () => {
    aparelho(false)
    render(
      <Previa balao rotulo="Maria · Cobrar documento" conteudo={conteudo}>
        <button type="button">Maria</button>
      </Previa>,
    )
    fireEvent.click(gatilho())
    expect(screen.getByRole('tooltip')).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
