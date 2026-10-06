import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { complementoAberto } from '../dados/complemento.ts'
import { enviarArquivos } from '../dados/documentos.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { DarParecer } from './DarParecer.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('')
})

async function abrir(processoId = 'rita-exemplo-1') {
  render(<DarParecer processoId={processoId} />)
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
    iniciarPerfil('?perfil=atendimento')
    await abrir()
    expect(screen.queryByRole('list', { name: 'Itens obrigatórios' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver o resultado do parecer' }))
    expect(await screen.findByRole('heading', { name: 'Parecer médico de suficiência' })).toBeTruthy()
  })
})
