// GGVP-139: a IA de verdade nas telas da Perícia. O servidor aqui é de mentira e responde como a NOSSA API (não como a
// OpenAI): a tela mostra a sugestão com o selo, as fontes e o alerta; sem IA, o motivo, e a pessoa preenche.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarPericia, mudancas, naTela, type PericiaNaTela } from '../regras/periciaNoCaso.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { MarcarPericia } from './MarcarPericia.tsx'
import { OrientarPericia } from './OrientarPericia.tsx'
import { ResultadoPericia } from './ResultadoPericia.tsx'

const AGORA = new Date(2026, 9, 8, 10, 0)
const CASO = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'

function daApi(marcada = false, compareceu = false): PericiaNaTela {
  const ficha: Ficha = {
    id: '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c',
    situacao: 'cliente',
    desde: '10/2026',
    nome: 'Ivone Teste',
    telefone: '11900000050',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [{ id: CASO, beneficio: 'loas-deficiente', etapa: 'administrativa' }],
    agendamentos: [],
    contatos: [],
    documentos: [],
    transcricoes: 0,
    historico: [],
    arquivos: [],
  }
  const mundo = { fichas: [ficha], pericias: [], peritos: [] }
  const p = criarPericia(mundo, CASO, { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Gabi' }, AGORA, AGORA, '8b3e4d5c-6f70-4b81-8c9d-2e3f4a5b6c7d')
  if (marcada) {
    const lido = { data: '2026-10-22', hora: '08:30', local: 'Agência INSS Santo Amaro', modalidade: 'presencial', tipo: 'medica' as const }
    mudancas.marcacao({ mundo, pericia: p, agora: AGORA }, { comprovante: { nome: 'comprovante.pdf' }, lido, pedeDocumentoNovo: false }, 'Igor')
  }
  if (compareceu) mudancas.comparecimento({ mundo, pericia: p, agora: new Date(2026, 9, 22, 12, 0) }, { compareceu: true }, 'Igor')
  return naTela(mundo, p, AGORA)
}

const SUGESTAO = { chamadaId: '9c4f5e6d-7081-4c92-9dae-3f4a5b6c7d8e', sugestao: true, texto: '{}', fontes: [{ tipo: 'documento', referencia: 'pericia:x', trecho: 'Comprovante do INSS (comprovante.pdf)' }], modelo: 'gpt-4.1-mini', geradaEm: AGORA.toISOString() }

function servidor(leitura: unknown, marcada = false, compareceu = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === `/api/processos/${CASO}/pericia` && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(daApi(marcada, compareceu)))
      if (url === `/api/processos/${CASO}/pericia/comprovante/leitura`) return new Response(JSON.stringify(leitura))
      if (url === `/api/processos/${CASO}/pericia/orientacao/sugestao`) return new Response(JSON.stringify(leitura))
      if (url === `/api/processos/${CASO}/pericia/resultado`) return new Response(JSON.stringify(daApi(marcada, compareceu)))
      if (url === `/api/processos/${CASO}/pericia/laudo/leitura`) return new Response(JSON.stringify(leitura))
      return new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })
    }),
  )
  configurarExemplo({ servidor: true })
}

async function anexar() {
  render(comSessao(<MarcarPericia processoId={CASO} />))
  await screen.findByRole('heading', { level: 1, name: 'Ivone Teste · Marcar perícia' })
  fireEvent.click(screen.getByRole('radio', { name: 'Sim, marcado' }))
  fireEvent.change(screen.getByLabelText(/Comprovante do INSS \(PDF\)/), { target: { files: [new File(['%PDF'], 'comprovante.pdf', { type: 'application/pdf' })] } })
  return screen.findByRole('group', { name: 'Lido do comprovante · confira' })
}

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo('juridico-adm')
})
afterEach(() => {
  cleanup()
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-139 · o comprovante lido pela IA, na tela de marcar', () => {
  it('CA1, CA5 · a leitura chega como sugestão da IA, com a fonte e o alerta, nos campos para conferir', async () => {
    const lido = { data: '2026-10-22', hora: '08:30', local: 'Agência INSS Santo Amaro', modalidade: 'presencial', tipo: 'medica' }
    servidor({ lido, sugestao: { ...SUGESTAO, alerta: 'documento com instrução suspeita' }, motivo: null })
    const grupo = await anexar()
    expect(within(grupo).getByText('Leitura da IA · confira com o PDF antes de registrar')).toBeTruthy()
    expect(within(grupo).getByRole('alert').textContent).toBe('Atenção: documento com instrução suspeita.')
    expect(within(grupo).getByText('Fontes: Comprovante do INSS (comprovante.pdf) (gpt-4.1-mini)')).toBeTruthy()
    expect((within(grupo).getByLabelText(/Data/) as HTMLInputElement).value).toBe('22/10/2026')
    expect((within(grupo).getByLabelText('Local') as HTMLInputElement).value).toBe('Agência INSS Santo Amaro')
  })

  it('CA6 · sem IA, a tela mostra o motivo e os campos vêm vazios para a pessoa preencher', async () => {
    servidor({ lido: null, sugestao: null, motivo: 'A IA não leu o comprovante agora: confira o PDF e preencha a data, a hora e o local.' })
    const grupo = await anexar()
    expect(within(grupo).getByText(/A IA não leu o comprovante agora/)).toBeTruthy()
    expect(within(grupo).queryByText(/Leitura da IA/)).toBeNull()
    expect((within(grupo).getByLabelText(/Data/) as HTMLInputElement).value).toBe('')
    expect((within(grupo).getByLabelText('Local') as HTMLInputElement).value).toBe('')
  })
})

describe('GGVP-139 · a orientação escrita pela IA, na tela de orientar', () => {
  it('CA2, CA5 · a sugestão entra no lugar da orientação montada, com o selo e a fonte; a pessoa revisa antes de enviar', async () => {
    const texto = 'Olá, Ivone! Sua perícia é na quinta, 22/10, às 08:30. Fale sempre a verdade.'
    servidor({ texto, sugestao: { ...SUGESTAO, texto, fontes: [{ tipo: 'regra', referencia: 'pericia:x', trecho: 'Orientação padrão do escritório' }], alerta: null }, motivo: null }, true)
    render(comSessao(<OrientarPericia processoId={CASO} />))
    expect(await screen.findByText('Orientação escrita pela IA · revise antes de enviar')).toBeTruthy()
    expect((screen.getByLabelText(/Orientação para Ivone/) as HTMLTextAreaElement).value).toBe(texto)
    expect(screen.getByText('Fontes: Orientação padrão do escritório (gpt-4.1-mini)')).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'Revisei a orientação' }) as HTMLInputElement).checked).toBe(false)
  })

  it('CA6 · sem IA, fica a orientação que o código montou, com o motivo', async () => {
    servidor({ texto: null, sugestao: null, motivo: 'A IA não escreveu a orientação agora: revise a que o sistema montou.' }, true)
    render(comSessao(<OrientarPericia processoId={CASO} />))
    expect(await screen.findByText(/A IA não escreveu a orientação agora/)).toBeTruthy()
    expect((screen.getByLabelText(/Orientação para Ivone/) as HTMLTextAreaElement).value).toContain('Quando: quinta, 22/10, às 08:30.')
  })
})

describe('GGVP-139 · o laudo resumido pela IA, na tela do resultado', () => {
  const anexarLaudo = async () => {
    entrarComo('advogada')
    render(comSessao(<ResultadoPericia processoId={CASO} />))
    fireEvent.change(await screen.findByLabelText(/Laudo ou registro do GERID/), { target: { files: [new File(['%PDF'], 'laudo.pdf', { type: 'application/pdf' })] } })
  }

  it('CA3, CA5 · o resumo chega marcado como sugestão da IA, com a fonte; o resultado é a advogada quem marca', async () => {
    const leitura = { favoravel: true, resumo: 'O perito concluiu incapacidade.', conclusao: 'Favorável · incapacidade', coerencia: 'Atende o benefício.', pontoDeAtencao: '', assunto: 'coluna', observou: [], perguntou: [], pediu: [] }
    servidor({ leitura, sugestao: { ...SUGESTAO, fontes: [{ tipo: 'documento', referencia: 'pericia:x', trecho: 'Laudo da perícia (laudo.pdf)' }], alerta: null }, motivo: null }, true, true)
    await anexarLaudo()
    const resumo = await screen.findByRole('region', { name: 'Resumo do laudo pela IA' })
    expect(within(resumo).getByText('Sugestão da IA · quem decide o resultado é você')).toBeTruthy()
    expect(within(resumo).getByText('O perito concluiu incapacidade.')).toBeTruthy()
    expect(within(resumo).getByText('Fontes: Laudo da perícia (laudo.pdf) (gpt-4.1-mini)')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Favorável — seguir' }).getAttribute('aria-checked')).toBe('false')
  })

  it('CA6 · sem IA, o motivo; a advogada lê o PDF e registra pela leitura dela', async () => {
    servidor({ leitura: null, sugestao: null, motivo: 'A IA não leu o laudo agora: leia o PDF e registre o resultado pela sua leitura.' }, true, true)
    await anexarLaudo()
    expect(await screen.findByText(/A IA não leu o laudo agora/)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Resumo do laudo pela IA' })).toBeNull()
  })
})
