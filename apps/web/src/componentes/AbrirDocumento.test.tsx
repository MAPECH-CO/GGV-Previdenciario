import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { configurarExemplo } from '../dados/servidor.ts'
import { AbrirDocumento, hrefDaPasta } from './AbrirDocumento.tsx'

const PESSOA = '3f0c1e2a-1b2c-4d5e-8f90-123456789abc'
const HASH = 'a'.repeat(64)

afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.restoreAllMocks()
})

describe('AbrirDocumento (GGVP-81 CA17)', () => {
  it('abre o próprio arquivo numa janela do navegador, e não segue o link', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    render(<AbrirDocumento href="/api/casos/c/documentos/d" nome="RG" />)
    const link = screen.getByRole('link', { name: 'Abrir RG' })
    expect(fireEvent.click(link)).toBe(false)
    expect(abrir).toHaveBeenCalledWith('/api/casos/c/documentos/d', 'documento', 'popup,width=900,height=1000')
  })

  it('com a janela bloqueada, segue o link, que abre numa aba', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    render(<AbrirDocumento href="/api/casos/c/documentos/d" nome="RG" />)
    expect(fireEvent.click(screen.getByRole('link', { name: 'Abrir RG' }))).toBe(true)
  })

  it('sem arquivo no portal, diz isso no lugar do link', () => {
    render(<AbrirDocumento nome="RG" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('sem arquivo no portal')).toBeTruthy()
  })

  it('o arquivo da pasta vai pela pessoa e pelo hash; a ficha de exemplo e o arquivo sem hash não têm arquivo', () => {
    configurarExemplo({ servidor: true })
    expect(hrefDaPasta(PESSOA, { hash: HASH })).toBe(`/api/pessoas/${PESSOA}/documentos/${HASH}`)
    expect(hrefDaPasta(PESSOA, {})).toBeUndefined()
    expect(hrefDaPasta('rita-exemplo', { hash: HASH })).toBeUndefined()
  })
})
