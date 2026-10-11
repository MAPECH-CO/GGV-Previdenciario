import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { iniciarPreferencias, lerPreferencias, mudarPreferencias } from './preferencias.ts'

beforeEach(() => {
  window.localStorage.clear()
  iniciarPreferencias('')
})

afterEach(() => {
  vi.restoreAllMocks()
})

const html = () => document.documentElement

describe('preferências de aparência', () => {
  it('começa no tema claro e em 100%, sem zoom', () => {
    expect(lerPreferencias('')).toEqual({ tema: 'claro', escala: 100 })
    expect(html().dataset.tema).toBe('claro')
    expect(html().style.zoom).toBe('')
  })

  it('lê tema e tamanho do endereço; o "fonte=grande" de antes vira 125%', () => {
    expect(lerPreferencias('?tema=escuro&escala=130')).toEqual({ tema: 'escuro', escala: 130 })
    expect(lerPreferencias('?fonte=grande')).toEqual({ tema: 'claro', escala: 125 })
  })

  it('ignora valor inválido ou fora da faixa de 70% a 200%', () => {
    expect(lerPreferencias('?tema=roxo&escala=enorme')).toEqual({ tema: 'claro', escala: 100 })
    expect(lerPreferencias('?escala=40')).toEqual({ tema: 'claro', escala: 100 })
    expect(lerPreferencias('?escala=250')).toEqual({ tema: 'claro', escala: 100 })
  })

  it('usa o que a pessoa salvou (também o "grande" de antes), e o endereço vence o salvo', () => {
    window.localStorage.setItem('ggv.preferencias', JSON.stringify({ tema: 'escuro', escala: 120 }))
    expect(lerPreferencias('')).toEqual({ tema: 'escuro', escala: 120 })
    expect(lerPreferencias('?tema=claro')).toEqual({ tema: 'claro', escala: 120 })
    window.localStorage.setItem('ggv.preferencias', JSON.stringify({ tema: 'claro', fonte: 'grande' }))
    expect(lerPreferencias('')).toEqual({ tema: 'claro', escala: 125 })
  })

  it('mudar aplica no html (o tema e o zoom de tudo) e salva', () => {
    mudarPreferencias({ tema: 'escuro', escala: 150 })
    expect(html().dataset.tema).toBe('escuro')
    expect(html().style.zoom).toBe('1.5')
    expect(html().style.getPropertyValue('--zoom')).toBe('1.5')
    expect(JSON.parse(window.localStorage.getItem('ggv.preferencias') ?? '{}')).toEqual({ tema: 'escuro', escala: 150 })
    mudarPreferencias({ escala: 100 })
    expect(html().style.zoom).toBe('')
  })

  it('mudar não passa da faixa', () => {
    mudarPreferencias({ escala: 500 })
    expect(html().style.zoom).toBe('2')
    mudarPreferencias({ escala: 10 })
    expect(html().style.zoom).toBe('0.7')
  })

  it('segue com o padrão quando o navegador bloqueia o armazenamento', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(lerPreferencias('')).toEqual({ tema: 'claro', escala: 100 })
    expect(() => mudarPreferencias({ escala: 120 })).not.toThrow()
    expect(html().style.zoom).toBe('1.2')
  })
})
