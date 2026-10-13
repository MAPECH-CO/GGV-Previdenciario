import { describe, expect, it } from 'vitest'
import { falasAoVivoSeguras, SENHA_RETIRADA } from './entrevista.ts'

describe('proteção da senha antes de exibir a transcrição ao vivo', () => {
  it('não exibe texto parcial, inclusive antes de terminar a palavra senha', () => {
    const falas = [{ id: '1', texto: 'A minha sen', final: false }]
    expect(falasAoVivoSeguras(falas)[0].texto).toBe('Ouvindo…')
    expect(falas[0].texto).toBe('A minha sen')
  })
  it('retira a fala com senha e a resposta seguinte por extenso', () => {
    const falas = [
      { id: '1', texto: 'Qual a senha do gov.br?', final: true },
      { id: '2', texto: 'Palavra inventada para este teste', final: true },
      { id: '3', texto: 'Agora vamos conferir os vínculos.', final: true },
    ]
    expect(falasAoVivoSeguras(falas).map(f => f.texto)).toEqual([SENHA_RETIRADA, SENHA_RETIRADA, falas[2].texto])
  })
  it('retira também a senha na própria fala, mantendo o identificador', () => {
    expect(falasAoVivoSeguras([{ id: '1', texto: 'Minha senha é uma frase inventada', final: true }]))
      .toEqual([{ id: '1', texto: SENHA_RETIRADA, final: true }])
  })
})
