import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { DispensarParecer } from './DispensarParecer.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

async function abrir(perfil: string) {
  entrarComo(perfil)
  render(comSessao(<DispensarParecer processoId="rita-exemplo-1" />))
  await screen.findByRole('heading', { level: 1, name: /Dispensar o parecer médico/ })
}

const JUSTIFICATIVA = 'Prazo do juiz vence em dois dias e o médico só atende em novembro.'

describe('Dispensar o parecer médico · tela da sênior', () => {
  it('CA2 · a Dra. Renata pede com a justificativa; ela mesma não aprova; o Dr. Otávio aprova e o parecer fica dispensado', async () => {
    await abrir('senior')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rita Exemplo · Dispensar o parecer médico')
    expect(screen.getByRole('heading', { name: 'Situação do parecer' }).closest('section')!.textContent).toContain('Pendente sem confirmação do Jurídico')
    const pedir = screen.getByRole('button', { name: 'Pedir a dispensa (1ª sênior)' }) as HTMLButtonElement
    expect(pedir.disabled).toBe(true)
    expect(screen.getByText('A justificativa é obrigatória: por que seguir sem a prova médica (G17).')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /Justificativa: por que seguir sem a prova médica/ }), { target: { value: JUSTIFICATIVA } })
    fireEvent.click(pedir)
    expect(await screen.findByText('Pedido registrado: falta a aprovação de outra sênior.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Aprovar a dispensa (2ª sênior)' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Uma pessoa sozinha não dispensa o parecer: a segunda aprovação é de outra sênior (G17).')).toBeTruthy()

    cleanup()
    await abrir('senior-2')
    expect(screen.getByText(new RegExp(`Dra\\. Renata \\(exemplo\\) pediu a dispensa em 06/10/2026 15:10\\. Justificativa: ${JUSTIFICATIVA}`))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar a dispensa (2ª sênior)' }))
    expect(await screen.findByRole('heading', { name: '✓ Parecer dispensado' })).toBeTruthy()
    expect(screen.getByText(/aprovado por Dr\. Otávio \(exemplo\) em 06\/10\/2026 15:10/)).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.quem).toBe('Dr. Otávio (exemplo)')
  })

  it('quem não é sênior não dispensa', async () => {
    await abrir('advogada')
    expect(screen.getByText(/Só a sênior dispensa o parecer médico\. Você está como Advogada responsável\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Pedir a dispensa (1ª sênior)' })).toBeNull()
  })
})
