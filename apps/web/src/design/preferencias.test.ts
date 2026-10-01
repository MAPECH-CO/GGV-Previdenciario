import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarPreferencias, lerPreferencias, mudarPreferencias } from './preferencias.ts'

beforeEach(() => {
  window.localStorage.clear()
  iniciarPreferencias('')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('preferências de aparência', () => {
  it('começa no tema claro e na fonte padrão', () => {
    expect(lerPreferencias('')).toEqual({ tema: 'claro', fonte: 'padrao' })
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(document.documentElement.dataset.fonte).toBe('padrao')
  })

  it('lê tema e fonte do endereço', () => {
    expect(lerPreferencias('?tema=escuro&fonte=grande')).toEqual({ tema: 'escuro', fonte: 'grande' })
  })

  it('ignora valor inválido no endereço', () => {
    expect(lerPreferencias('?tema=roxo&fonte=enorme')).toEqual({ tema: 'claro', fonte: 'padrao' })
  })

  it('usa o que a pessoa salvou, e o endereço vence o salvo', () => {
    window.localStorage.setItem('ggv.preferencias', JSON.stringify({ tema: 'escuro', fonte: 'grande' }))
    expect(lerPreferencias('')).toEqual({ tema: 'escuro', fonte: 'grande' })
    expect(lerPreferencias('?tema=claro')).toEqual({ tema: 'claro', fonte: 'grande' })
  })

  it('mudar aplica no html e salva', () => {
    mudarPreferencias({ tema: 'escuro' })
    expect(document.documentElement.dataset.tema).toBe('escuro')
    expect(document.documentElement.dataset.fonte).toBe('padrao')
    expect(JSON.parse(window.localStorage.getItem('ggv.preferencias') ?? '{}')).toEqual({
      tema: 'escuro',
      fonte: 'padrao',
    })
  })

  it('segue com o padrão quando o navegador bloqueia o armazenamento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(lerPreferencias('')).toEqual({ tema: 'claro', fonte: 'padrao' })
    expect(() => mudarPreferencias({ fonte: 'grande' })).not.toThrow()
    expect(document.documentElement.dataset.fonte).toBe('grande')
  })
})
