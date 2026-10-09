import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from '../dados/documentos.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { DarParecer } from './DarParecer.tsx'
import { LinhaDaDeficiencia } from './LinhaDaDeficiencia.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

async function abrir() {
  render(comSessao(<LinhaDaDeficiencia processoId="cleide-exemplo-1" />))
  await screen.findByRole('heading', { level: 1, name: /Linha do tempo da deficiência/ })
}

describe('Linha do tempo da deficiência · tela da advogada', () => {
  it('CA1 e CA3 · a Cleide: cada vínculo com os períodos com e sem deficiência, o indicador PCD e o período sem prova da época', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Cleide Exemplo · Linha do tempo da deficiência')
    expect(screen.getByText(/CNIS baixado do Meu INSS · extraído em 30\/06\/2026 · deficiência desde 10\/06\/2014/)).toBeTruthy()
    const vinculos = within(screen.getByRole('list', { name: 'Vínculos do CNIS' })).getAllByRole('listitem').filter((li) => li.parentElement?.getAttribute('aria-label') === 'Vínculos do CNIS')
    expect(vinculos).toHaveLength(3)
    expect(vinculos[1].textContent).toContain('Exemplo Metalúrgica Ltda · 08/2013 a 12/2019indicador PCD no CNISatividade insalubre')
    const metalurgica = within(screen.getByRole('list', { name: 'Períodos em Exemplo Metalúrgica Ltda' })).getAllByRole('listitem')
    expect(metalurgica.map((p) => p.textContent)).toEqual([
      '01/08/2013 a 09/06/2014 · 10 meses e 13 dias · sem deficiência',
      '10/06/2014 a 28/02/2019 · 4 anos, 8 meses e 25 dias · com deficiência · leveDa época: Laudo da neurologia (exemplo) (20/04/2015)',
      '01/03/2019 a 31/12/2019 · 10 meses e 6 dias · com deficiência · moderadasem prova da época',
    ])
    expect(screen.getByText(/1 período com deficiência sem prova da época/)).toBeTruthy()
    expect(screen.getByText(/2 períodos com deficiência em atividade insalubre/)).toBeTruthy()
  })

  // Ano de 365 e mês de 30 dias: 2648 dias moderados = 7 anos, 3 meses e 3 dias.
  it('CA4 · o enquadramento calculado por código: grau, fatores, mínimo e o que falta', async () => {
    await abrir()
    expect(screen.getByText('grau moderada · 16 anos, 3 meses e 10 dias convertidos · mínimo de 24 anos · calculado por código (G19)')).toBeTruthy()
    const linhas = within(screen.getByRole('table', { name: 'Enquadramento dos períodos PCD (G19)' })).getAllByRole('row').slice(1)
    expect(linhas.map((l) => l.textContent)).toEqual([
      'moderada7 anos, 3 meses e 3 dias1,007 anos, 3 meses e 3 dias',
      'leve4 anos, 8 meses e 25 dias0,864 anos e 24 dias',
      'sem deficiência6 anos, 2 meses e 10 dias0,804 anos, 11 meses e 18 dias',
    ])
  })

  it('Lucas, 07/10 · os três cenários da entrevista e o tempo como pessoa com deficiência, com o mínimo de 15 anos', async () => {
    await abrir()
    const cenarios = within(screen.getByRole('table', { name: 'Todos os cenários' })).getAllByRole('row').slice(1)
    expect(cenarios.map((l) => l.querySelector('th')?.textContent)).toEqual(['leve', 'moderada', 'grave'])
    expect(cenarios.map((l) => l.querySelectorAll('td')[1]?.textContent)).toEqual(['28 anos', '24 anos', '20 anos'])
    expect(screen.getByText('Tempo como pessoa com deficiência (mínimo de 15 anos)')).toBeTruthy()
  })

  it('CA2 · registrar um agravamento: a trava pede o grau mais grave, e o salvo recalcula a linha e o enquadramento', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: '+ Agravamento' }))
    const datas = screen.getAllByRole('textbox', { name: 'Data do agravamento' })
    fireEvent.change(datas[1], { target: { value: '01/01/2023' } })
    const graus = screen.getAllByRole('combobox', { name: 'Novo grau' })
    fireEvent.change(graus[1], { target: { value: 'leve' } })
    const salvar = screen.getByRole('button', { name: 'Salvar os dados da deficiência' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)
    expect(screen.getByText('O agravamento leva a um grau mais grave que o anterior.')).toBeTruthy()
    fireEvent.change(graus[1], { target: { value: 'grave' } })
    fireEvent.click(salvar)
    expect(await screen.findByText('Dados da deficiência salvos: a linha do tempo e o enquadramento foram recalculados.')).toBeTruthy()
    const servicos = within(screen.getByRole('list', { name: 'Períodos em Exemplo Serviços Ltda' })).getAllByRole('listitem')
    expect(servicos.map((p) => p.textContent?.split(' · ')[0])).toEqual(['01/02/2020 a 31/12/2022', '01/01/2023 a 30/06/2026'])
    expect(servicos[1].textContent).toContain('com deficiência · grave')
  })

  it('dado de saúde · quem não é do Jurídico não vê a linha do tempo', async () => {
    entrarComo('atendimento')
    await abrir()
    expect(screen.getByRole('status').textContent).toContain('A linha do tempo da deficiência é do Jurídico')
    expect(screen.queryByRole('list', { name: 'Vínculos do CNIS' })).toBeNull()
  })

  it('GGVP-137 · o Jurídico administrativo abre a linha do tempo só para ler: sem salvar nem mudar os dados', async () => {
    entrarComo('juridico-adm')
    await abrir()
    expect(screen.getByRole('list', { name: 'Vínculos do CNIS' })).toBeTruthy()
    expect(screen.getByText('Só leitura: quem registra os dados da deficiência é a advogada ou a sênior.')).toBeTruthy()
    expect((screen.getByRole('textbox', { name: /Início da deficiência/ }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('combobox', { name: /Grau no início/ }) as HTMLSelectElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Salvar os dados da deficiência' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ Agravamento' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tirar' })).toBeNull()
  })

  it('CA4 · o mesmo enquadramento aparece no parecer da Aposentadoria PCD, com o atalho para a linha do tempo', async () => {
    await enviarArquivos('cleide-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'laudo neurologia.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '5'.padStart(64, '0') }],
    })
    render(comSessao(<DarParecer processoId="cleide-exemplo-1" />))
    const cartao = (await screen.findByRole('heading', { name: 'Enquadramento dos períodos PCD' })).closest('section')!
    expect(cartao.textContent).toContain('grau moderada · 16 anos, 3 meses e 10 dias convertidos · mínimo de 24 anos · calculado por código (G19)')
    expect(within(cartao).getByRole('link', { name: 'Linha do tempo da deficiência' }).getAttribute('href')).toBe('/casos/cleide-exemplo-1/deficiencia')
  })
})
