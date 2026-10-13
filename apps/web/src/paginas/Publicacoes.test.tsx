import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LerPublicacao } from './LerPublicacao.tsx'
import { PainelVigilia } from './PainelVigilia.tsx'
import { PublicacoesDoProcesso } from './PublicacoesDoProcesso.tsx'

const ID = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const CASO = '11111111-1111-4111-8111-111111111111'
const prazo = { inicio: '2026-10-07', fim: '2026-10-27', regra: 'Lei 11.419', versao: 1 }
const rodada = (situacao: string, extra = {}) => ({
  id: crypto.randomUUID(),
  fonte: 'exemplo',
  previstaPara: '2026-10-05T11:00:00.000Z',
  situacao,
  inicio: null,
  fim: null,
  capturadas: 0,
  erro: null,
  reprocessadaPor: null,
  reprocessadaEm: null,
  ...extra,
})
const painel = {
  dia: '2026-10-05',
  situacaoDoDia: 'incompleta',
  rodadas: [rodada('falhou', { fim: '2026-10-05T11:01:00.000Z', erro: 'tempo esgotado' }), rodada('ok', { previstaPara: '2026-10-05T16:00:00.000Z' })],
  previstas: 3,
  concluidas: 1,
  falhas: 1,
  fila: [
    {
      id: ID,
      fonte: 'aasp',
      disponibilizadaEm: '2026-10-05',
      texto: 'Intimação sem número.',
      partes: 'Joana x INSS',
      numeroCnj: null,
      motivo: 'número CNJ não informado na publicação',
      idadeEmDias: 2,
      prazoMinimo: prazo,
      diasUteisAtePrazo: 2,
    },
  ],
  descartes: [],
  podeReprocessar: true,
  podeCasar: true,
}
const publicacao = {
  id: ID,
  casoId: CASO,
  cliente: 'Otávio Lima',
  numeroCnj: '00012349620264036301',
  fonte: 'aasp',
  disponibilizadaEm: '2026-10-05',
  texto: 'Intime-se para juntar laudo em 15 dias.',
  classe: null,
  classificadaPor: null,
  classificadaEm: null,
  prazo: null,
  feriadosCadastrados: false,
  podeClassificar: true,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Painel da vigília (GGVP-30, GGVP-26)', () => {
  it('CA1, CA4, CA5 · mostra a contagem, "vigília incompleta", a falha com o horário e o botão de reprocessar', async () => {
    servidor(painel)
    render(<PainelVigilia />)
    expect((await screen.findByText(/Rodadas hoje 1 de 3/)).textContent).toContain('Falhas 1')
    expect(screen.getByLabelText('Situação do dia').textContent).toContain('Vigília incompleta')
    expect(screen.getByText(/Vigília falhou às 08:01: tempo esgotado/)).toBeTruthy()
    expect(screen.getByText(/Rodada OK, nenhuma publicação/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Reprocessar' })).toHaveLength(1)
  })

  it('CA12 · dia útil sem nada: "Dia sem publicação: conferir na fonte"', async () => {
    servidor({ ...painel, situacaoDoDia: 'sem_publicacao', fila: [] })
    render(<PainelVigilia />)
    expect((await screen.findByLabelText('Situação do dia')).textContent).toBe('Dia sem publicação: conferir na fonte.')
  })

  it('GGVP-26 CA7, CA8 · item da fila com motivo, prazo e idade; vincular exige CNJ válido', async () => {
    const fetch = servidor(painel)
    render(<PainelVigilia />)
    expect((await screen.findByText(/número CNJ não informado/)).textContent).toContain('há 2 dias na fila')
    fireEvent.change(screen.getByLabelText('Número CNJ do processo'), { target: { value: '0001234-55.2026.4.03.6301' } })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular ao processo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Número CNJ inválido. Confira os 20 dígitos.')
    expect(fetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })

  it('a advogada vê as rodadas, sem fila nem reprocessar', async () => {
    servidor({ ...painel, podeReprocessar: false, podeCasar: false, fila: [] })
    render(<PainelVigilia />)
    await screen.findByText(/Rodadas hoje/)
    expect(screen.queryByRole('button', { name: 'Reprocessar' })).toBeNull()
    expect(screen.queryByLabelText('Fila de revisão')).toBeNull()
  })
})

describe('Ler publicação (GGVP-74, GGVP-34)', () => {
  it('GGVP-34 e GGVP-74 (IA) · ao abrir, a sugestão aparece marcada, com o resumo e o alerta, e já preenche o formulário; quem classifica é a pessoa', async () => {
    const sugestao = { classe: 'exigencia', dias: 15, resumo: 'O juiz pede o laudo em 15 dias.', chamadaId: '22222222-2222-4222-8222-222222222222', modelo: 'gpt-4.1-mini', alerta: 'entrada com instrução suspeita' }
    const fetch = servidor(publicacao, [200, { sugestao, motivo: null }])
    render(<LerPublicacao publicacaoId={ID} />)
    expect(await screen.findByText('Sugestão da IA · confira antes de usar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sugerir com a IA|Usar a sugestão/ })).toBeNull()
    expect(screen.getByText(/prazo de 15 dias escrito na decisão/)).toBeTruthy()
    expect(screen.getByText('Resumo: O juiz pede o laudo em 15 dias.')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('entrada com instrução suspeita')
    expect((screen.getByLabelText('Intimação ou exigência') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Prazo da publicação (dias)') as HTMLInputElement).value).toBe('15')
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/classificacao'))).toHaveLength(0)
  })

  it('GGVP-34 (IA) · sem sugestão, mostra o motivo e o formulário segue manual', async () => {
    servidor(publicacao, [200, { sugestao: null, motivo: 'A IA não respondeu agora: classifique pela leitura.' }])
    render(<LerPublicacao publicacaoId={ID} />)
    expect(await screen.findByText('A IA não respondeu agora: classifique pela leitura.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Classificar' })).toBeTruthy()
  })

  it('CA4 · exigência pede os dias ou "sem prazo na decisão"', async () => {
    servidor(publicacao)
    render(<LerPublicacao publicacaoId={ID} />)
    fireEvent.click(await screen.findByLabelText('Intimação ou exigência'))
    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"')
  })

  it('CA3 · classificada, mostra o prazo com a regra e a versão; a pergunta vira "A classificação está certa?"', async () => {
    servidor({ ...publicacao, classe: 'exigencia', classificadaPor: 'Gabi', prazo })
    render(<LerPublicacao publicacaoId={ID} />)
    expect((await screen.findByText(/Prazo: de 07\/10\/2026/)).textContent).toContain('27/10/2026')
    expect(screen.getByText(/regra versão 1/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'A classificação está certa?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reclassificar' })).toBeTruthy()
  })

  it('classificar diz o que o sistema abriu', async () => {
    servidor(publicacao)
    render(<LerPublicacao publicacaoId={ID} />)
    fireEvent.click(await screen.findByLabelText('Decisão de mérito'))
    fireEvent.click(screen.getByLabelText('Sem prazo na decisão (5 dias)'))
    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    expect((await screen.findByRole('status')).textContent).toContain('Confirmar desfecho')
  })

  it('GGVP-59 CA1 · nomeação de perito: sem prazo no despacho são 15 dias, e a tarefa dos quesitos vai à Central da advogada', async () => {
    const fetch = servidor(publicacao)
    render(<LerPublicacao publicacaoId={ID} />)
    fireEvent.click(await screen.findByLabelText('Nomeação de perito'))
    fireEvent.click(screen.getByLabelText('Sem prazo na decisão (15 dias)'))
    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'Nomeação de perito. Aberta a tarefa "Quesitos e assistente técnico" na Central da advogada, com o prazo.',
    )
    const [, init] = fetch.mock.calls.find(([url]) => String(url).endsWith('/classificacao'))!
    expect(JSON.parse(String(init?.body))).toMatchObject({ classe: 'nomeacao_perito', semPrazoNaDecisao: true })
  })

  it('GGVP-64 parte 2 CA1 · a IA sugere a vara e o juiz escritos na publicação; a pessoa confere, e eles vão com a classificação', async () => {
    const sugestao = {
      classe: 'exigencia',
      dias: 15,
      resumo: 'O juiz pede o laudo.',
      vara: '1ª Vara-Gabinete do JEF de São Paulo',
      juiz: 'Dra. Exemplo',
      chamadaId: '22222222-2222-4222-8222-222222222222',
      modelo: 'gpt-4.1-mini',
      alerta: null,
    }
    const fetch = servidor(publicacao, [200, { sugestao, motivo: null }])
    render(<LerPublicacao publicacaoId={ID} />)
    await screen.findByText('Sugestão da IA · confira antes de usar')
    expect((screen.getByLabelText('Vara') as HTMLInputElement).value).toBe('1ª Vara-Gabinete do JEF de São Paulo')
    fireEvent.change(screen.getByLabelText('Juiz'), { target: { value: 'Dra. Exemplo da Silva' } })
    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    await screen.findByRole('status')
    const [, init] = fetch.mock.calls.find(([url]) => String(url).endsWith('/classificacao'))!
    expect(JSON.parse(String(init?.body))).toMatchObject({ classe: 'exigencia', vara: '1ª Vara-Gabinete do JEF de São Paulo', juiz: 'Dra. Exemplo da Silva' })
  })
})

describe('Publicações do processo (GGVP-74 CA5, CA7)', () => {
  it('lista com classe e prazo, as não lidas primeiro; o filtro mostra só os andamentos', async () => {
    servidor({
      casoId: CASO,
      cliente: 'Otávio Lima',
      publicacoes: [
        { id: ID, disponibilizadaEm: '2026-10-05', fonte: 'aasp', trecho: 'Autos conclusos.', classe: 'andamento', classificadaPor: 'Gabi', prazo: null },
        { id: CASO, disponibilizadaEm: '2026-10-05', fonte: 'aasp', trecho: 'Intime-se.', classe: null, classificadaPor: null, prazo: null },
      ],
    })
    render(<PublicacoesDoProcesso casoId={CASO} />)
    const itens = await screen.findAllByRole('listitem')
    expect(itens.map((li) => li.textContent?.includes('Não lida'))).toEqual([true, false])
    fireEvent.click(screen.getByLabelText('Só as lidas como "só andamento"'))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Reclassificar' }).getAttribute('href')).toBe(`/publicacoes/${ID}`)
  })
})
