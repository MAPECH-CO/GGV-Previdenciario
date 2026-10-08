import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { instalarRelacionamentoFalso } from './relacionamento/rotas.ts'

// O Relacionamento com o cliente já fala só com a API (GGVP-138): nos testes, o servidor falso dele, com a semente.
beforeEach(() => {
  instalarRelacionamentoFalso()
})

afterEach(() => {
  cleanup()
})
