import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Indicador, PainelDeResultados } from '@ggv/contratos'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Resultados } from './Resultados.tsx'

const ind = (chave: string, rotulo: string, casos: number, valor: number | null, unidade: Indicador['unidade'], situacao: Indicador['situacao']): Indicador => ({
  chave,
  rotulo,
  casos,
  valor,
  unidade,
  situacao,
})
const painel: PainelDeResultados = {
  periodo: { de: '2026-01-01', ate: '2026-10-07' },
  indicadores: [
    ind('deferimento_inss', 'Deferimento no INSS', 11, 8 / 11, 'taxa', 'ok'),
    ind('procedencia', 'Procedência na Justiça', 1, 1, 'taxa', 'ok'),
    ind('extincoes', 'Extinções sem mérito', 1, 1, 'casos', 'ok'),
    ind('exigencias_no_prazo', 'Exigências cumpridas no prazo', 0, null, 'taxa', 'sem_dados'),
    ind('pareceres_dispensados', 'Pareceres dispensados', 0, 0, 'casos', 'ok'),
    ind('dias_ate_sentenca', 'Tempo até a sentença', 2, 90.4, 'dias', 'ok'),
    ind('dias_ate_receber', 'Tempo até o dinheiro', 1, 60, 'dias', 'ok'),
  ],
  recorte: null,
  extincoes: { casos: 1, decididos: 12, porCausa: [{ causa: 'Não cumpriu determinação do juízo (exemplo)', casos: 1 }] },
  pareceres: {
    dispensados: 0,
    exitoComDispensa: ind('exito_com_dispensa', 'Êxito com parecer dispensado', 0, null, 'taxa', 'sem_dados'),
    exitoComSuficiente: ind('exito_com_suficiente', 'Êxito com parecer suficiente', 0, null, 'taxa', 'sem_dados'),
  },
  motivos: {
    indeferimento: [
      { motivo: 'Falta de qualidade de segurado (exemplo)', casos: 3 },
      { motivo: 'sem motivo registrado', casos: 1 },
    ],
    derrota: [],
  },
  totais: { honorariosRecebidos: '4500.00', recebimentos: 1 },
  operacao: 'com_dados',
  baseDoAcervo: { situacao: 'sem_dados' },
}

function servidor(corpo: object) {
  const chamada = vi.fn(async (_url: string) => new Response(JSON.stringify(corpo), { status: 200 }))
  vi.stubGlobal('fetch', chamada)
  return chamada
}
const itens = async (nome: string) => within(await screen.findByRole('list', { name: nome })).getAllByRole('listitem').map((i) => i.textContent)
afterEach(() => vi.unstubAllGlobals())

describe('Resultados do escritório (GGVP-75)', () => {
  it('CA1, CA8 · cada taxa com o número de casos e a data da base; sem amostra mínima (G22 de 07/10)', async () => {
    servidor(painel)
    render(<Resultados />)
    expect(await itens('Indicadores do escritório')).toEqual([
      'Deferimento no INSS: 73% em 11 casos · base de 07/10/2026',
      'Procedência na Justiça: 100% em 1 caso · base de 07/10/2026',
      'Extinções sem mérito: 1 caso',
      'Exigências cumpridas no prazo: sem dados ainda',
      'Pareceres dispensados: 0 casos',
      'Tempo até a sentença: 90 dias em 2 casos · base de 07/10/2026',
      'Tempo até o dinheiro: 60 dias em 1 caso · base de 07/10/2026',
    ])
    expect((screen.getByLabelText('De') as HTMLInputElement).value).toBe('01/01/2026')
  })

  it('CA2 · a extinção sem mérito em destaque, com a causa', async () => {
    servidor(painel)
    render(<Resultados />)
    expect(await itens('Extinções por causa')).toEqual(['Não cumpriu determinação do juízo (exemplo) · 1 caso'])
    expect(screen.getByText('1 de 12 decididos no período')).toBeTruthy()
  })

  it('CA3 · com as duas amostras, a diferença de êxito entre os dispensados e os "Suficiente", em pontos', async () => {
    const pareceres = {
      dispensados: 12,
      exitoComDispensa: ind('exito_com_dispensa', 'Êxito com parecer dispensado', 12, 7 / 12, 'taxa', 'ok'),
      exitoComSuficiente: ind('exito_com_suficiente', 'Êxito com parecer suficiente', 86, 61 / 86, 'taxa', 'ok'),
    }
    servidor({ ...painel, pareceres })
    render(<Resultados />)
    expect(await itens('Pareceres dispensados')).toEqual([
      'Dispensados pela Sênior no período: 12',
      'Êxito com parecer dispensado: 58% em 12 casos · base de 07/10/2026',
      'Êxito com parecer suficiente: 71% em 86 casos · base de 07/10/2026',
      'Diferença: -13 pontos',
    ])
  })

  it('CA4 · os valores aparecem quando o servidor os manda; sem os totais, a tela não mostra valor nenhum', async () => {
    servidor(painel)
    const { unmount } = render(<Resultados />)
    expect(await itens('Valores do escritório')).toEqual(['Honorários recebidos: R$ 4.500,00 · 1 recebimento'])
    unmount()
    servidor({ ...painel, totais: null })
    render(<Resultados />)
    await screen.findByRole('list', { name: 'Indicadores do escritório' })
    expect(screen.queryByRole('list', { name: 'Valores do escritório' })).toBeNull()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('GGVP-149 CA3 · os motivos de indeferimento e de derrota mais comuns, cada um com o número de casos', async () => {
    servidor(painel)
    render(<Resultados />)
    expect(await itens('Motivos de indeferimento')).toEqual(['Falta de qualidade de segurado (exemplo) · 3 casos', 'sem motivo registrado · 1 caso'])
    expect(screen.getByText('Nenhuma derrota no período.')).toBeTruthy()
  })

  it('CA5, CA6 · sem caso decidido, a operação diz "sem dados ainda"; o Raio-X de 979 processos e a base do acervo aparecem', async () => {
    servidor({ ...painel, operacao: 'sem_dados' })
    render(<Resultados />)
    expect(await screen.findByText('Sem dados ainda: nenhum caso decidido no período.')).toBeTruthy()
    expect(screen.getByText('979 processos lidos, gerado em 21/09/2026. Só os agregados.')).toBeTruthy()
    expect(await itens('Raio-X Previdenciário')).toHaveLength(6)
    expect((await itens('O que o cartório mais cobra na inicial'))[0]).toBe('Comprovante de residência: 286')
    expect((await itens('Onde julgam'))[0]).toBe('JEF São Paulo: 479 processos · êxito 22%')
    expect(screen.getByRole('heading', { name: 'Base do acervo' }).nextElementSibling?.textContent).toBe('Sem dados ainda.')
  })

  it('o período pela biblioteca campos e o recorte vão ao servidor; data inválida nem sai da tela', async () => {
    const chamada = servidor(painel)
    render(<Resultados />)
    await screen.findByRole('list', { name: 'Indicadores do escritório' })
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '01022026' } })
    fireEvent.change(screen.getByLabelText('Recorte'), { target: { value: 'juizo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultados' }))
    await waitFor(() => expect(chamada).toHaveBeenLastCalledWith('/api/gestao/resultados?de=01%2F02%2F2026&ate=07%2F10%2F2026&recorte=juizo', expect.anything()))
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '31/02/2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultados' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Informe as datas em dd/mm/aaaa.')
    expect(chamada).toHaveBeenCalledTimes(2)
  })

  it('GGVP-55 CA3 · a base do acervo com os totais, os que aguardam conferência fora das contas e a data da base', async () => {
    servidor({ ...painel, baseDoAcervo: { situacao: 'com_dados', processos: 8, conferidos: 3, aguardandoConferencia: 4, dataDaBase: '2026-10-02' } })
    render(<Resultados />)
    await screen.findByRole('list', { name: 'Indicadores do escritório' })
    expect(screen.getByRole('heading', { name: 'Base do acervo' }).nextElementSibling?.textContent).toBe(
      '8 processos · 3 conferidos, nas contas · 4 aguardando conferência, fora das contas · base de 02/10/2026',
    )
  })

  it('CA1 · o recorte mostra os indicadores de cada grupo', async () => {
    servidor({ ...painel, recorte: { por: 'beneficio', grupos: [{ nome: 'BPC/LOAS Deficiente', indicadores: [ind('deferimento_inss', 'Deferimento no INSS', 8, 0.75, 'taxa', 'ok')] }] } })
    render(<Resultados />)
    expect(await screen.findByRole('heading', { name: 'Por benefício' })).toBeTruthy()
    expect(await itens('BPC/LOAS Deficiente')).toEqual(['BPC/LOAS Deficiente', 'Deferimento no INSS: 75% em 8 casos · base de 07/10/2026'])
  })
})
