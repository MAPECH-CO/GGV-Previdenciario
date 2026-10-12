import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CalculoCnis } from './CalculoCnis.tsx'
const mudar = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
function preencher() {
  mudar('Início do vínculo 1', '01/01/2018')
  mudar('Fim do vínculo 1', '31/01/2018')
  mudar('Tempo do vínculo 1', 'conferido')
  mudar('Carência do vínculo 1', 'conferido')
}
describe('digitação do CNIS', () => {
  it('mostra a memória, invalida o resultado ao editar e não promete gravar', () => {
    render(<CalculoCnis nascimento="1970-01-01" hoje="2026-10-11" />)
    preencher()
    fireEvent.click(screen.getByRole('button', { name: 'Calcular prévia' }))
    expect(screen.getByRole('status').textContent).toContain('31 dias, sem duplicar sobreposições')
    expect(screen.getByRole('status').textContent).toContain('1 competências conferidas')
    expect((screen.getByRole('button', { name: /Salvar cálculo/ }) as HTMLButtonElement).disabled).toBe(true)
    mudar('Fim do vínculo 1', '30/01/2018')
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('pendências produzem aviso de prévia parcial, nunca uma conferência automática', () => {
    render(<CalculoCnis nascimento="1970-01-01" hoje="2026-10-11" />)
    mudar('Início do vínculo 1', '01/01/2020')
    mudar('Fim do vínculo 1', '31/01/2020')
    fireEvent.click(screen.getByRole('button', { name: 'Calcular prévia' }))
    expect(screen.getByRole('status').textContent).toContain('Prévia parcial')
    expect(screen.getByRole('status').textContent).toContain('Pendentes: 01/2020')
  })
  it('valida datas pela biblioteca campos e aplica exceção mensal', () => {
    render(<CalculoCnis nascimento="1970-01-01" hoje="2026-10-11" />)
    preencher()
    mudar('Fim do vínculo 1', '31/02/2018')
    fireEvent.click(screen.getByRole('button', { name: 'Calcular prévia' }))
    expect(screen.getByRole('alert').textContent).toContain('Data inválida')
    mudar('Fim do vínculo 1', '31/01/2018')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar competência com exceção' }))
    mudar('Competência da exceção 1', '01/2018')
    mudar('Tempo da exceção 1', 'nao-conta')
    mudar('Carência da exceção 1', 'nao-conta')
    fireEvent.click(screen.getByRole('button', { name: 'Calcular prévia' }))
    expect(screen.getByRole('status').textContent).toContain('0 competências conferidas')
  })
  it('nova montagem perde o rascunho conforme o aviso e não usa armazenamento do navegador', () => {
    const { unmount } = render(<CalculoCnis nascimento="1970-01-01" hoje="2026-10-11" />)
    preencher(); unmount()
    render(<CalculoCnis nascimento="1980-02-03" hoje="2026-10-11" />)
    expect((screen.getByLabelText('Início do vínculo 1') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Nascimento para o cálculo') as HTMLInputElement).value).toBe('03/02/1980')
  })
})
