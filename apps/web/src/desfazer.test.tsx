import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { instalarDesfazer } from './desfazer.ts'

let desligar: () => void
beforeEach(() => {
  desligar = instalarDesfazer()
})
afterEach(() => desligar())

/** A máscara de data: o React reescreve o valor a cada tecla, como nos campos de data, telefone e CPF. */
const mascara = (v: string) =>
  v
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2}\/\d{2})(\d)/, '$1/$2')

/** Um campo com máscara e um de texto livre. */
function Campos() {
  const [data, setData] = useState('')
  const [texto, setTexto] = useState('')
  return (
    <>
      <input aria-label="Data" value={data} onChange={(e) => setData(mascara(e.target.value))} />
      <textarea aria-label="Observação" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <input aria-label="Senha" type="password" defaultValue="" />
      <p>valor: {data}</p>
    </>
  )
}

/** Como a pessoa digita: o navegador avisa antes ("beforeinput") e depois muda o valor. */
function digitar(campo: HTMLElement, valor: string) {
  campo.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true }))
  fireEvent.change(campo, { target: { value: valor } })
}

const ctrlZ = (campo: HTMLElement) => fireEvent.keyDown(campo, { key: 'z', ctrlKey: true })

describe('Ctrl+Z em todo campo de escrita (GGVP-84, CA9)', () => {
  it('volta o que foi digitado, passo a passo, também no campo com máscara, e o React fica com o valor de volta', () => {
    render(<Campos />)
    const data = screen.getByLabelText('Data') as HTMLInputElement
    digitar(data, '07')
    digitar(data, '0710')
    digitar(data, '07102026')
    expect(data.value).toBe('07/10/2026')
    ctrlZ(data)
    expect(data.value).toBe('07/10')
    expect(screen.getByText('valor: 07/10')).toBeTruthy()
    ctrlZ(data)
    expect(data.value).toBe('07')
    ctrlZ(data)
    expect(data.value).toBe('')
    // Sem nada para voltar, o Ctrl+Z fica com o navegador.
    expect(fireEvent.keyDown(data, { key: 'z', ctrlKey: true })).toBe(true)
  })

  it('cada campo tem a sua pilha; Ctrl+Shift+Z não é desfazer', () => {
    render(<Campos />)
    const data = screen.getByLabelText('Data') as HTMLInputElement
    const texto = screen.getByLabelText('Observação') as HTMLTextAreaElement
    digitar(data, '01')
    digitar(texto, 'Ligou')
    digitar(texto, 'Ligou hoje')
    fireEvent.keyDown(texto, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(texto.value).toBe('Ligou hoje')
    ctrlZ(texto)
    expect(texto.value).toBe('Ligou')
    expect(data.value).toBe('01')
  })

  it('a senha não entra na pilha (G9)', () => {
    render(<Campos />)
    const senha = screen.getByLabelText('Senha') as HTMLInputElement
    digitar(senha, 'Teste#1')
    digitar(senha, 'Teste#12')
    ctrlZ(senha)
    expect(senha.value).toBe('Teste#12')
  })
})
