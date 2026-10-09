import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { complementoAberto } from '../dados/complemento.ts'
import { enviarArquivos } from '../dados/documentos.ts'
import { obterParecer, type ParecerNaTela } from '../dados/parecer.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { DarParecer } from './DarParecer.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

async function abrir(processoId = 'rita-exemplo-1') {
  render(comSessao(<DarParecer processoId={processoId} />))
  await screen.findByRole('heading', { level: 1, name: /Dar parecer médico/ })
}

const registrar = () => screen.getByRole('button', { name: 'Registrar parecer' }) as HTMLButtonElement
const conferir = (item: RegExp, valor = 'confere') => fireEvent.change(screen.getByRole('combobox', { name: item }), { target: { value: valor } })

/** Confere todos os itens como a IA achou. */
function conferirTudo() {
  for (const select of screen.getAllByRole('combobox', { name: /^Conferência:/ })) fireEvent.change(select, { target: { value: 'confere' } })
}

describe('Dar parecer médico · tela da advogada', () => {
  it('CA1 · a matriz da Rita: cada item com o status e, quando presente, o documento, a página e o trecho', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rita Exemplo · Dar parecer médico')
    expect(screen.getByText('LOAS Deficiente · suficiência da documentação médica')).toBeTruthy()
    const obrigatorios = within(screen.getByRole('list', { name: 'Itens obrigatórios' })).getAllByRole('listitem')
    expect(obrigatorios).toHaveLength(5)
    expect(obrigatorios[0].textContent).toContain('Laudo médico · 20/08/2026 · pág. 1 — “(exemplo) Impedimento físico de longo prazo, com sequela motora.”')
    expect(obrigatorios[2].textContent).toContain('A IA não achou nos documentos.')
    expect(obrigatorios[2].textContent).toContain('ausente')
    expect(screen.getByRole('list', { name: 'Contradições que bloqueiam' }).textContent).toContain('não encontrada')
    expect(screen.getByText(/BPC\/LOAS Deficiente, versão 1/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'ver o roteiro' }).getAttribute('href')).toBe('/roteiros/loas-deficiente')
  })

  it('CA3, CA5 e CA8 · item a item, Insuficiente com o campo do G20 sugerido pela IA; registra e abre a pendência', async () => {
    await abrir()
    expect(registrar().disabled).toBe(true)
    expect(screen.getByText('Confira cada item: confirme o que a IA achou ou corrija.')).toBeTruthy()
    conferirTudo()
    expect(screen.getByText('Responda: a documentação médica é suficiente para o benefício?')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Suficiente — liberar' }))
    expect(screen.getByText('Para "Suficiente", todo item obrigatório tem de estar presente.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Insuficiente — pedir complemento' }))
    const abordar = screen.getByRole('textbox', { name: /O que o documento deve abordar/ }) as HTMLTextAreaElement
    expect(abordar.value).toBe(
      'O relatório médico precisa responder:\n• Qual a previsão de duração do quadro?\n• O paciente depende de outra pessoa, de acompanhamento contínuo, de transporte ou de tratamento? Com que frequência?',
    )
    fireEvent.change(abordar, { target: { value: 'Informar o CID G80' } })
    expect(screen.getAllByText('Tire o código de doença (CID): a orientação não sugere diagnóstico (G20).').length).toBeGreaterThan(0)
    expect(registrar().disabled).toBe(true)
    fireEvent.change(abordar, { target: { value: 'O relatório precisa responder: qual a previsão de duração do quadro?' } })
    expect(registrar().disabled).toBe(false)
    fireEvent.click(registrar())
    expect(await screen.findByRole('heading', { name: '✓ Parecer registrado: Insuficiente' })).toBeTruthy()
    expect(screen.getByText(/Dra\. Paula \(exemplo\) em 06\/10\/2026 15:10 · roteiro BPC\/LOAS Deficiente, versão 1/)).toBeTruthy()
    expect(screen.getByText(/A pendência «Pedir complemento ao médico» foi para o Atendimento/)).toBeTruthy()
    expect(complementoAberto(ler(), 'rita-exemplo-1')?.abordar).toBe('O relatório precisa responder: qual a previsão de duração do quadro?')
    expect(screen.getByRole('list', { name: 'Histórico do parecer' }).textContent).toContain('Insuficiente Dra. Paula (exemplo) · 06/10/2026 15:10 · roteiro BPC/LOAS Deficiente, versão 1')
  })

  it('CA3 · a advogada corrige um item: o prognóstico estava no laudo, e o Suficiente registra com a correção no histórico', async () => {
    await abrir()
    conferirTudo()
    conferir(/^Conferência: Prognóstico/, 'presente')
    conferir(/^Conferência: Barreiras/, 'presente')
    fireEvent.click(screen.getByRole('radio', { name: 'Suficiente — liberar' }))
    fireEvent.click(registrar())
    expect(await screen.findByRole('heading', { name: '✓ Parecer registrado: Suficiente' })).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toBe('Registrou o parecer médico do LOAS Deficiente: Suficiente (G17); corrigiu 2 itens da IA')
  })

  it('CA2 · a contradição conferida tira o "Suficiente" e o parecer fica Contraditório', async () => {
    await enviarArquivos('cleide-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'laudo incapacidade total.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '8'.padStart(64, '0') }],
    })
    await abrir('cleide-exemplo-1')
    conferirTudo()
    expect((screen.getByRole('radio', { name: 'Suficiente — liberar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Há contradição conferida: o parecer fica Contraditório e o caso não avança (G18).')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Insuficiente — pedir complemento' }))
    fireEvent.click(registrar())
    expect(await screen.findByRole('heading', { name: '✓ Parecer registrado: Contraditório' })).toBeTruthy()
  })

  it('CA4 e CA6 · o laudo novo do Antônio: o aviso com os atalhos, o que mudou, e manter o parecer limpa o "Laudo novo"', async () => {
    await abrir('antonio-exemplo-1')
    expect(screen.getByRole('heading', { name: 'Laudo novo · enviado pelo Atendimento em 29/09' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir o laudo novo' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/laudo-novo')
    expect(screen.getByRole('link', { name: 'Comparar com o anterior' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/laudo-novo#comparacao')
    expect(screen.getByRole('list', { name: 'O que mudou' }).textContent).toContain('Documento novo: Laudo médico · 29/09/2026')
    conferirTudo()
    fireEvent.click(screen.getByRole('radio', { name: 'Suficiente — liberar' }))
    fireEvent.click(registrar())
    expect(await screen.findByText(/O laudo novo de 29\/09 foi conferido e saiu da ficha e do processo/)).toBeTruthy()
    expect((await obterFicha('antonio-exemplo'))?.laudoNovoEm).toBeUndefined()
  })

  it('GGVP-93 CA3 · benefício sem roteiro: o aviso e a conferência manual obrigatória', async () => {
    await enviarArquivos('lucia-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'laudo.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '6'.padStart(64, '0') }],
    })
    await abrir('lucia-exemplo-1')
    expect(screen.getByText(/Pensão por Morte não tem roteiro de laudos cadastrado/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Suficiente — liberar' }))
    expect(registrar().disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'O que você conferiu nos documentos *' }), { target: { value: 'Li o laudo e conferi as datas do pedido.' } })
    expect(registrar().disabled).toBe(false)
  })

  it('dado de saúde · o Atendimento não vê a matriz; vê o resultado na janela', async () => {
    entrarComo('atendimento')
    await abrir()
    expect(screen.queryByRole('list', { name: 'Itens obrigatórios' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver o resultado do parecer' }))
    expect(await screen.findByRole('heading', { name: 'Parecer médico de suficiência' })).toBeTruthy()
  })
})

describe('BPC/LOAS de menor de 16 anos · o parecer da criança (GGVP-50)', () => {
  it('CA1 · o Davi, de 7 anos: a matriz com o roteiro infantil, a participação e os cuidados ausentes', async () => {
    await abrir('davi-exemplo-1')
    expect(screen.getByText(/BPC\/LOAS Deficiente · menor de 16 anos, versão 1/)).toBeTruthy()
    const obrigatorios = within(screen.getByRole('list', { name: 'Itens obrigatórios' })).getAllByRole('listitem')
    expect(obrigatorios.map((li) => li.textContent?.split('(exemplo)')[0].split('A IA')[0])).toEqual([
      'Natureza do impedimento (físico, mental, intelectual ou sensorial)Laudo médico · 20/08/2026 · pág. 1 — “',
      'Data de início e se o quadro persisteLaudo médico · 20/08/2026 · pág. 1 — “',
      'Prognóstico: duração prevista ou permanenteLaudo médico · 20/08/2026 · pág. 1 — “',
      'Impacto na participação social e nas atividades próprias da idade (escola, brincar, convívio)',
      'Necessidade de cuidados que limitam o trabalho dos responsáveis',
    ])
    expect(await screen.findByText('roteiro infantil · 7 anos')).toBeTruthy()
  })

  it('CA2 · a advogada marca a condição e as terapias, e vê os relatórios que o checklist vai pedir', async () => {
    await abrir('davi-exemplo-1')
    const cartao = (await screen.findByRole('heading', { name: 'Criança · condição e terapias' })).closest('section')!
    const relatorios = () => within(within(cartao).getByRole('list', { name: 'Relatórios que o caso pede' })).queryAllByRole('listitem').map((li) => li.textContent)
    expect(relatorios()).toEqual([])
    expect(within(cartao).getByText('Sem a condição marcada, o checklist fica travado: os relatórios dependem dela.')).toBeTruthy()
    fireEvent.click(within(cartao).getByRole('checkbox', { name: /Paralisia cerebral, má formação ou parecido/ }))
    fireEvent.click(within(cartao).getByRole('checkbox', { name: 'Fonoaudiologia' }))
    fireEvent.click(within(cartao).getByRole('checkbox', { name: 'Terapia ocupacional' }))
    fireEvent.click(within(cartao).getByRole('checkbox', { name: /Frequenta escola ou creche/ }))
    fireEvent.click(within(cartao).getByRole('button', { name: 'Salvar a condição' }))
    expect(await within(cartao).findByText('Condição salva: o checklist pede os relatórios dela.')).toBeTruthy()
    expect(relatorios()).toEqual(['Relatório escolar', 'Relatório da neurologia', 'Relatório de fonoaudiologia', 'Relatório de terapia ocupacional'])
    expect(within(cartao).getByRole('link', { name: 'Abrir o checklist' }).getAttribute('href')).toBe('/casos/davi-exemplo-1/checklist')
    expect((await obterFicha('davi-exemplo'))?.historico.at(-1)?.oQue).toBe('Marcou a condição e as terapias da criança (roteiro infantil)')
  })

  it('a Rita, adulta, não tem o cartão da criança', async () => {
    await enviarArquivos('rita-exemplo', { origem: 'card', arquivos: [{ nome: 'laudo.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '4'.padStart(64, '0') }] })
    await abrir()
    await screen.findByText(/BPC\/LOAS Deficiente, versão 1/)
    expect(screen.queryByRole('heading', { name: 'Criança · condição e terapias' })).toBeNull()
  })
})


describe('GGVP-134 · a sugestão da IA de verdade na tela do parecer (caso do servidor)', () => {
  const CASO = '9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d'

  /** O servidor falso responde o parecer da Rita, como o de verdade, com o que a IA deixou na análise. */
  async function doServidor(daIa: Partial<NonNullable<NonNullable<ParecerNaTela['juridico']>['analise']>>) {
    const rita = (await obterParecer('rita-exemplo-1', 'juridico'))!
    const naTela: ParecerNaTela = { ...rita, processo: { ...rita.processo, id: CASO }, juridico: { ...rita.juridico!, analise: { ...rita.juridico!.analise!, ...daIa } } }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(naTela), { status: 200 })))
    configurarExemplo({ servidor: true })
  }
  afterEach(() => {
    configurarExemplo({ servidor: false })
    vi.unstubAllGlobals()
  })

  it('CA4 · a sugestão vem marcada como da IA, com o alerta e as fontes', async () => {
    await doServidor({ ia: { modelo: 'gpt-4.1-mini', chamadas: ['c1'], alertas: ['documento com instrução suspeita'], fontes: ['Laudo médico · 20/08/2026'] } })
    await abrir(CASO)
    expect(screen.getByText('Sugestão da IA · quem registra o parecer é você (G17)')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Atenção: documento com instrução suspeita.')
    expect(screen.getByText('Fontes: Laudo médico · 20/08/2026 (gpt-4.1-mini)')).toBeTruthy()
  })

  it('CA5 · sem a IA, a tela diz o motivo e segue manual, sem o selo de sugestão', async () => {
    await doServidor({ motivo: 'A IA está desligada: confira cada item pela sua leitura dos documentos.' })
    await abrir(CASO)
    expect(screen.getByText('A IA está desligada: confira cada item pela sua leitura dos documentos.')).toBeTruthy()
    expect(screen.queryByText(/Sugestão da IA/)).toBeNull()
    expect(screen.getAllByRole('combobox', { name: /^Conferência:/ }).length).toBeGreaterThan(0)
  })
})
