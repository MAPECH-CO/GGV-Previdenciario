import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { CasoEmAndamento } from './CasoEmAndamento.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 32), latencia: 0 })
  zerarExemplo()
})
afterEach(() => configurarExemplo({ servidor: false }))

async function abrir(fichaId: string, perfil?: string) {
  entrarComo(perfil)
  render(comSessao(<CasoEmAndamento ficha={(await obterFicha(fichaId))!} />))
}
const atalhos = () => screen.queryAllByRole('list', { name: /^Atalhos do caso/ }).flatMap((l) => within(l).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]))

describe('GGVP-135 · o que cada perfil abre do caso pela ficha, por clique', () => {
  it('P12 · a Sênior dispensa o parecer da Rita pela ficha; o Atendimento e a advogada não veem o link', async () => {
    await abrir('rita-exemplo', 'senior')
    expect(atalhos()).toEqual([['Dispensar o parecer', '/casos/rita-exemplo-1/parecer/dispensa']])
    cleanup()
    await abrir('rita-exemplo', 'atendimento')
    expect(atalhos()).toEqual([])
    cleanup()
    await abrir('rita-exemplo', 'advogada')
    expect(atalhos()).toEqual([])
  })

  it('P12 · com o parecer suficiente, não há o que dispensar', async () => {
    await abrir('antonio-exemplo', 'senior')
    expect(atalhos()).toEqual([])
  })

  it('P13 · a linha do tempo da deficiência da Cleide abre pela ficha para o Jurídico, só no processo PCD', async () => {
    await abrir('cleide-exemplo', 'advogada')
    expect(atalhos()).toEqual([['Linha do tempo da deficiência', '/casos/cleide-exemplo-1/deficiencia']])
    cleanup()
    await abrir('cleide-exemplo', 'atendimento')
    expect(atalhos()).toEqual([])
  })

  it('P13 · o caso do servidor leva ao histórico do processo, para quem vê o caso', async () => {
    configurarExemplo({ servidor: true })
    const id = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
    const ficha = { id: 'b1e2c3d4-0000-4000-8000-000000000001', nome: 'Benedito Teste', situacao: 'cliente', processos: [{ id, beneficio: 'aposentadoria-idade', etapa: 'Conferência da Sênior' }] } as unknown as Ficha
    entrarComo('senior')
    render(comSessao(<CasoEmAndamento ficha={ficha} />))
    expect(atalhos()).toEqual([['Histórico do processo', `/casos/${id}/historico`]])
    cleanup()
    entrarComo(undefined)
    render(comSessao(<CasoEmAndamento ficha={ficha} />))
    expect(atalhos()).toEqual([])
  })

  it('GGVP-137 · no caso do servidor, a linha do tempo da deficiência (Jurídico) e a dispensa do parecer (Sênior) também abrem pela ficha', async () => {
    configurarExemplo({ servidor: true })
    const id = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
    const ficha = { id: 'b1e2c3d4-0000-4000-8000-000000000002', nome: 'Cleide Teste', situacao: 'cliente', processos: [{ id, beneficio: 'aposentadoria-pcd', etapa: 'Documentação' }] } as unknown as Ficha
    const historico = ['Histórico do processo', `/casos/${id}/historico`]
    const deficiencia = ['Linha do tempo da deficiência', `/casos/${id}/deficiencia`]
    for (const perfil of ['advogada', 'juridico-adm']) {
      entrarComo(perfil)
      render(comSessao(<CasoEmAndamento ficha={ficha} />))
      expect([perfil, atalhos()]).toEqual([perfil, [historico, deficiencia]])
      cleanup()
    }
    entrarComo('atendimento')
    render(comSessao(<CasoEmAndamento ficha={ficha} />))
    expect(atalhos()).toEqual([historico])
    cleanup()
    // O parecer do caso do servidor chega pela sincronização da documentação médica; insuficiente, a Sênior pode dispensar.
    const banco = ler()
    banco.documentacaoMedica = { tarefas: [], portoes: { [id]: { situacao: 'insuficiente' } } }
    gravar(banco)
    entrarComo('senior')
    render(comSessao(<CasoEmAndamento ficha={ficha} />))
    expect(atalhos()).toEqual([historico, deficiencia, ['Dispensar o parecer', `/casos/${id}/parecer/dispensa`]])
  })
})

describe('GGVP-130 · as pendências de documento aparecem em cada processo da ficha', () => {
  it('o processo do Antônio, com a cobrança aberta, diz o que falta; a Rita, sem cobrança, não', async () => {
    await abrir('antonio-exemplo', 'documentacao')
    expect(screen.getByRole('link', { name: /Judicial · exigência/ }).textContent).toContain('Documentos pendentes: Notas do produtor rural e Certidão.')
    cleanup()
    await abrir('rita-exemplo', 'documentacao')
    expect(screen.queryByText(/Documentos pendentes/)).toBeNull()
  })
})
