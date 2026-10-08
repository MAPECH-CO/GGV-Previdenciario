import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { obterParecer, pedirDispensa, registrarParecer, responderDispensa } from '../dados/parecer.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { ParecerMedico } from './ParecerMedico.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

async function abrir(processoId: string, funcao: string) {
  render(comSessao(<ParecerMedico processoId={processoId} funcao={funcao} aoFechar={() => {}} />))
  await screen.findByRole('status')
}

describe('Parecer médico de suficiência · janela', () => {
  it('o Sebastião do Figma, na visão do Jurídico: Suficiente, quem confirmou, os documentos e o roteiro aplicado', async () => {
    await abrir('sebastiao-exemplo-1', 'Advogada')
    expect(screen.getByRole('heading', { name: 'Parecer médico de suficiência' })).toBeTruthy()
    const resultado = screen.getByRole('status')
    expect(resultado.textContent).toContain('SUFICIENTE')
    expect(resultado.textContent).toContain('A documentação médica cobre o que o Auxílio Acidentário exige.')
    expect(resultado.textContent).toContain('Sugerido pela IA em 14/07 · confirmado por pessoa: Dra. Paula, 15/07 (G17). Só a sênior dispensa o parecer, com justificativa.')
    const docs = within(screen.getByRole('list', { name: 'Documentos analisados' })).getAllByRole('listitem')
    expect(docs.map((d) => d.textContent)).toContain('PDFLaudo médico · 09/2025Dr. Ortopedista Exemplo · sequela consolidada, redução da capacidade')
    const roteiro = screen.getByRole('list', { name: 'Roteiro aplicado' })
    expect(roteiro.textContent).toContain('Consolidação das lesões')
    expect(roteiro.textContent).toContain('Sem contradição: Lesão ainda não consolidadanão encontrada')
    expect(screen.getByRole('link', { name: 'Abrir o parecer' }).getAttribute('href')).toBe('/casos/sebastiao-exemplo-1/parecer')
  })

  it('dado de saúde · a Documentação vê o resultado, os documentos e o que falta pedir, sem o conteúdo', async () => {
    const analise = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!.analise!
    await registrarParecer(
      'rita-exemplo-1',
      { analise: analise.quando, conferidos: Object.fromEntries(analise.itens.map((i) => [i.id, i.situacao])), decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' },
      { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' },
    )
    await abrir('rita-exemplo-1', 'Documentação')
    expect(screen.getByRole('status').textContent).toContain('INSUFICIENTE')
    expect(screen.queryByRole('list', { name: 'Roteiro aplicado' })).toBeNull()
    expect(screen.getByRole('list', { name: 'Documentos analisados' }).textContent).toBe('PDFLaudo médico · 08/2026Dra. Exemplo Neurologista')
    expect(within(screen.getByRole('list', { name: 'O que falta pedir' })).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      '• Qual a previsão de duração do quadro?',
      '• O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
    ])
    expect(document.body.textContent).not.toContain('(exemplo) Impedimento')
    expect(screen.getByRole('link', { name: 'Pedir complemento ao médico' }).getAttribute('href')).toBe('/casos/rita-exemplo-1/complemento')
    expect(screen.queryByRole('link', { name: 'Abrir o parecer' })).toBeNull()
  })

  it('antes da conferência da advogada, o Atendimento vê que o Jurídico ainda confere', async () => {
    await abrir('rita-exemplo-1', 'Atendimento')
    expect(screen.getByRole('status').textContent).toContain('A IA analisou os documentos; falta a conferência do Jurídico (G17).')
    expect(screen.getByText('Nada por enquanto: o Jurídico ainda confere.')).toBeTruthy()
  })

  it('GGVP-33 · para a sênior, "Dispensar o parecer"; a dispensa aparece com a justificativa', async () => {
    entrarComo('senior')
    await abrir('rita-exemplo-1', 'Sênior')
    expect(screen.getByRole('link', { name: 'Dispensar o parecer' }).getAttribute('href')).toBe('/casos/rita-exemplo-1/parecer/dispensa')
  })

  it('GGVP-33 CA2 · a dispensa aprovada aparece no card do Atendimento, com as duas sêniores e a justificativa', async () => {
    await pedirDispensa('rita-exemplo-1', 'Prazo do juiz vence e o médico só atende em novembro.', { perfil: 'senior', nome: 'Dra. Renata (exemplo)' })
    await responderDispensa('rita-exemplo-1', true, { perfil: 'senior-2', nome: 'Dr. Otávio (exemplo)' })
    await abrir('rita-exemplo-1', 'Atendimento')
    expect(screen.getByRole('status').textContent).toContain('DISPENSADO')
    expect(screen.getByRole('heading', { name: 'Dispensa do parecer (G17)' }).closest('section')!.textContent).toContain(
      'Pedida por Dra. Renata (exemplo) em 06/10 · aprovada por Dr. Otávio (exemplo) em 06/10. Justificativa: Prazo do juiz vence e o médico só atende em novembro.',
    )
    expect(screen.queryByRole('link', { name: 'Dispensar o parecer' })).toBeNull()
  })
})
