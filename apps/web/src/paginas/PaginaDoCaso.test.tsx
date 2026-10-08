import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { CasoEmAndamento } from '../componentes/CasoEmAndamento.tsx'
import { CabecalhoCliente } from '../componentes/CabecalhoCliente.tsx'
import { PaginaDoCaso } from './PaginaDoCaso.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

const etapas = () => within(screen.getByRole('navigation', { name: 'Etapas do processo' })).getAllByRole('listitem')

describe('GGVP-86 · o caso numa linha só (Figma 72:2)', () => {
  it('CA1, CA2 · as cinco etapas, a atual em destaque e o "Em perícia" na etapa que pediu', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(etapas().map((e) => e.textContent?.replace(/\s+/g, ' '))).toEqual([
      '✓ Entrevista (D1 · feita)',
      '✓ INSS (D2 · feita)',
      '✓ Justiça (D3 · feita)',
      '▶ Vigíliaexigência do juiz (D3a · agora)Em períciaAgendada'.replace('Agendada', etapas()[3].textContent!.split('Em perícia')[1]),
      'Desfecho (D3b · ainda não chegou)',
    ])
    const vigilia = etapas()[3]
    expect(within(vigilia).getByText('Vigília', { exact: false }).closest('[aria-current]')?.getAttribute('aria-current')).toBe('step')
    expect(within(vigilia).getByRole('link', { name: /Em perícia/ }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia')
  })

  it('CA1 · deferido no INSS: Justiça, vigília e desfecho apagados', async () => {
    entrarComo('atendimento')
    render(comSessao(<PaginaDoCaso processoId="marta-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(etapas().slice(2).map((e) => e.textContent)).toEqual([
      'Justiçanão se aplica (D3 · não se aplica)',
      'Vigílianão se aplica (D3a · não se aplica)',
      'Desfechonão se aplica (D3b · não se aplica)',
    ])
  })

  it('CA3, CA8, CA9 · setores que não subiram o card, quem de fora estamos esperando e as tarefas por setor', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    const setores = (await screen.findByRole('heading', { name: 'Esperando os setores' })).closest('section')!
    expect(within(setores).getAllByText('ainda não subiu o card')).toHaveLength(2)
    expect(within(setores).getByText(/subiu o card 27\/09/)).toBeTruthy()
    const fora = screen.getByRole('heading', { name: 'Esperando alguém de fora' }).closest('section')!.textContent
    expect(fora).toContain('Cliente')
    expect(fora).toContain('desde 26/09 · prazo 09/10')
    expect(fora).toContain('Justiça')
    const tarefas = screen.getByRole('heading', { name: 'Tarefas em andamento' }).closest('section')!
    expect(within(tarefas).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Documentação', 'Jurídico', 'Jurídico administrativo'])
    expect(tarefas.textContent).toContain('responsável: Jéssica (exemplo) · em paralelo')
    expect(tarefas.textContent).toContain('Antônio Exemplo · Orientar para a perícia')
  })

  it('CA4 · clicar num passo feito mostra quem fez, quando e os documentos', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    fireEvent.click(await screen.findByRole('button', { name: '✓ Entrevista' }))
    const detalhe = screen.getByRole('heading', { name: /Entrevista · feita/ }).closest('section')!
    expect(detalhe.textContent).toContain('Dra. Paula (exemplo) (pessoa)')
    expect(detalhe.textContent).toContain('D1.09')
    expect(detalhe.textContent).toContain('Documentos desta etapa: transcricao-entrevista.pdf, contrato-zapsign.pdf, cnis.pdf')
  })

  it('CA5 · laudo novo no cabeçalho do processo e na ficha, levando à análise do laudo', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    expect((await screen.findByRole('link', { name: 'Laudo novo · 29/09' })).getAttribute('href')).toBe('/casos/antonio-exemplo-1/laudo-novo')
    const ficha = (await obterFicha('antonio-exemplo'))!
    render(comSessao(<CabecalhoCliente ficha={ficha} hoje="2026-10-07" laudoHref="/casos/antonio-exemplo-1/laudo-novo" />))
    expect(screen.getAllByRole('link', { name: 'Laudo novo · 29/09' })).toHaveLength(2)
  })

  it('CA6 · o nome do juízo e do perito abrem a jurimetria sem sair do caso, com o número de casos', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Vara Federal de Santo Amaro (exemplo)' }))
    const juizo = screen.getByRole('dialog', { name: 'Vara Federal de Santo Amaro (exemplo)' })
    expect(juizo.textContent).toContain('58% · 7 de 12')
    expect(juizo.textContent).toContain('25% · 1 de 4')
    expect(juizo.textContent).not.toMatch(/amostra/i)
    fireEvent.click(within(juizo).getAllByRole('button', { name: 'Fechar' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Dr. A. Prado (exemplo)' }))
    expect(screen.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' }).textContent).toContain('71% · 24 de 34')
  })

  it('CA7 · perito não conhecido: identificar em um clique, sem travar nada', async () => {
    entrarComo('juridico-adm')
    render(comSessao(<PaginaDoCaso processoId="pedro-exemplo-1" />))
    const grupo = await screen.findByRole('group', { name: 'Identificar o perito' })
    fireEvent.click(within(grupo).getByRole('button', { name: /Sra\. L\. Assis/ }))
    expect(await screen.findByText(/Perito identificado: Sra\. L\. Assis/)).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Identificar o perito' })).toBeNull()
  })

  it('CA10, CA11 · a linha com quem fez e o passo; o documento abre com a origem e a data', async () => {
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    const vigilia = await screen.findByRole('list', { name: 'Linha · Vigília' })
    expect(vigilia.textContent).toContain('IA Vigília (IA): Publicação lida')
    expect(vigilia.textContent).toContain('D3a.01')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Publicação no diário' }))
    const doc = screen.getByRole('dialog', { name: 'Publicação no diário' })
    expect(doc.textContent).toContain('Origem: Diário (vigília)')
    expect(doc.textContent).toContain('Data: 26/09')
  })

  it('CA12, CA13 · só os prazos da fase e a identificação pela fase', async () => {
    render(comSessao(<PaginaDoCaso processoId="pedro-exemplo-1" />))
    expect(await screen.findByRole('heading', { level: 1, name: /^NB\s*456\.123\.789-6$/ })).toBeTruthy()
    const prazos = screen.getByRole('heading', { name: 'Prazos' }).closest('section')!.textContent
    expect(prazos).toContain('Vigília do Meu INSS')
    expect(prazos).not.toContain('Vigília das publicações')
  })

  it('CA12, CA13 · judicial: CNJ e a vigília das publicações', async () => {
    render(comSessao(<PaginaDoCaso processoId="lucia-exemplo-1" />))
    expect(await screen.findByRole('heading', { level: 1, name: /^Processo \(CNJ\)\s*0000002-70\.2026\.4\.03\.6100$/ })).toBeTruthy()
    const prazos = screen.getByRole('heading', { name: 'Prazos' }).closest('section')!.textContent
    expect(prazos).toContain('Vigília das publicações')
    expect(prazos).not.toContain('Vigília do Meu INSS')
  })

  it('Permissão · o Atendimento vê o caso sem petição, estratégia, valores, saúde nem jurimetria', async () => {
    entrarComo('atendimento')
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    const tudo = document.body.textContent!
    expect(tudo).not.toMatch(/R\$|Petição inicial|Estratégia|Saúde \(Jurídico\)/)
    expect(screen.getByText('Petição, estratégia e valores não aparecem para o Atendimento.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Vara Federal de Santo Amaro (exemplo)' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Laudo médico' }))
    expect(screen.getByRole('dialog', { name: 'Laudo médico' }).textContent).toContain('O conteúdo do laudo é só do Jurídico')
  })

  it('Valores · a advogada vê o valor da causa; a sênior não', async () => {
    entrarComo('advogada')
    const { unmount } = render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    expect(await screen.findByText('R$ 21.480,00 (exemplo)')).toBeTruthy()
    unmount()
    entrarComo('senior')
    render(comSessao(<PaginaDoCaso processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Linha do processo · completa' })
    expect(document.body.textContent).not.toContain('R$')
  })

  it('A ficha leva ao caso: o processo fora da perícia abre /casos/:id', async () => {
    const ficha = (await obterFicha('nair-exemplo'))!
    render(comSessao(<CasoEmAndamento ficha={ficha} />))
    expect(screen.getByRole('link', { name: /Processo ainda sem número/ }).getAttribute('href')).toBe('/casos/nair-exemplo-1')
  })
})
