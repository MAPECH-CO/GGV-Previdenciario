import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { SessaoContexto } from '../sessao.ts'
import { CampoDeValorPendente } from './CampoDeValorPendente.tsx'
afterEach(cleanup)
it.each(['advogada', 'financeiro', 'socio'])('mostra somente o campo indisponível para %s', perfil => {
  render(<SessaoContexto value={{ nome: 'Pessoa Inventada', email: 'inventada@example.test', perfis: [perfil], perfilAtivo: perfil, trocarSenha: false }}><CampoDeValorPendente tipo="causa" /><CampoDeValorPendente tipo="loas" /></SessaoContexto>)
  for (const rotulo of ['Valor da causa', 'Renda por pessoa do LOAS']) {
    const campo = screen.getByRole('textbox', { name: rotulo }) as HTMLInputElement
    expect(campo.disabled).toBe(true)
    expect(campo.value).toBe('')
  }
})
it.each(['atendimento', 'atendimento_lider', 'documentacao', 'juridico_adm', 'senior'])('não oferece o campo ao perfil %s', perfil => {
  render(<SessaoContexto value={{ nome: 'Pessoa Inventada', email: 'inventada@example.test', perfis: [perfil], perfilAtivo: perfil, trocarSenha: false }}><CampoDeValorPendente tipo="loas" /></SessaoContexto>)
  expect(screen.queryByLabelText('Renda por pessoa do LOAS')).toBeNull()
})
it('não oferece o campo sem sessão', () => {
  render(<CampoDeValorPendente tipo="causa" />)
  expect(screen.queryByLabelText('Valor da causa')).toBeNull()
})
