import { fireEvent, render, screen, within } from '@testing-library/react'
import { TIPO_DO_DOCX } from '@ggv/contratos'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as contrato from '../dados/contrato.ts'
import { configurarExemplo, gravar, ler, zerarExemplo } from '../dados/servidor.ts'
import * as impressao from '../impressao.ts'
import { ColherAssinatura } from './ColherAssinatura.tsx'

// GGVP-136 · colher a assinatura sem o ZapSign e imprimir o kit de verdade. O servidor de exemplo não tem ZapSign desligado nem
// PDF: o que o servidor oferece (`servicosDoContrato`), o arquivo do kit (`baixarKit`) e o contrato do servidor (`kitDeVerdade`)
// entram por aqui; a impressão do navegador, por `impressao`.
vi.mock('../dados/contrato.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../dados/contrato.ts')>()
  return { ...real, servicosDoContrato: vi.fn(real.servicosDoContrato), kitDeVerdade: vi.fn(() => false), baixarKit: vi.fn() }
})
vi.mock('../impressao.ts', () => ({ imprimirPdf: vi.fn(), baixarArquivo: vi.fn() }))

const NOME_DO_PDF = 'Kit do contrato - versão 1.pdf'
const NOME_DO_WORD = 'Kit do contrato - versão 1.docx'
const pdf = () => ({ blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }), nome: NOME_DO_PDF, pdf: true })
const word = () => ({ blob: new Blob(['docx'], { type: TIPO_DO_DOCX }), nome: NOME_DO_WORD, pdf: false })

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  vi.clearAllMocks()
  vi.mocked(contrato.kitDeVerdade).mockReturnValue(false)
  vi.mocked(contrato.servicosDoContrato).mockResolvedValue({ zapsign: false, pdf: false })
  URL.createObjectURL = vi.fn(() => 'blob:kit')
  URL.revokeObjectURL = vi.fn()
})

/** O Antônio fecha a Aposentadoria por Idade e o contrato é gerado: fica para colher a assinatura. */
async function contratoGerado() {
  const { processo } = await contrato.fecharContrato('antonio-exemplo', 'aposentadoria-idade')
  const todas = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
  await contrato.gerarContrato(processo.id, { aprovados: false, oQueCorrigir: 'faltavam o RG e o endereço', conferencias: todas, correcoes: { rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' } })
  return processo.id
}

async function abrir(processoId: string) {
  render(<ColherAssinatura processoId={processoId} />)
  await screen.findByRole('heading', { level: 1, name: /Colher assinatura/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

describe('GGVP-136 CA8 · sem o ZapSign contratado, a opção do celular não aparece', () => {
  it('a tela só oferece o papel, já escolhido, e não tem "Enviar para assinatura"', async () => {
    const id = await contratoGerado()
    await abrir(id)
    expect(screen.queryByRole('radio', { name: 'ZapSign (digital)' })).toBeNull()
    expect(screen.getByText('assinar · em papel')).toBeTruthy()
    const papel = within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'Em papel' })
    expect(papel.getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Enviar para assinatura' })).toBeNull()
    expect(botao('Imprimir o kit')).toBeTruthy()
    expect(botao('Concluir a assinatura').disabled).toBe(true)
  })

  it('no painel de decisões também não há o celular, nem as travas do ZapSign', async () => {
    await abrir(await contratoGerado())
    const painel = screen.getByRole('complementary')
    expect(within(painel).queryByRole('radio', { name: 'ZapSign (digital)' })).toBeNull()
    expect(within(painel).getByRole('radio', { name: 'Em papel' })).toBeTruthy()
    expect(within(painel).queryByText(/Pendente: Documento assinado devolvido pelo ZapSign/)).toBeNull()
    expect(within(painel).queryByText(/Travas e estados/)).toBeNull()
    expect(within(painel).getByText('«Concluir a assinatura» só habilita com o anexo obrigatório.')).toBeTruthy()
  })

  it('o papel vale para qualquer entrevista: por vídeo, a tela oferece o papel e não manda ao ZapSign', async () => {
    const id = await contratoGerado()
    const banco = ler()
    banco.fichas.find((f) => f.id === 'antonio-exemplo')!.agendamentos.push({ id: 'antonio-entrevista', data: '2026-10-05', hora: '10:30', oQue: 'Entrevista', tipo: 'video' })
    gravar(banco)
    vi.mocked(contrato.kitDeVerdade).mockReturnValue(true)
    vi.mocked(contrato.servicosDoContrato).mockResolvedValue({ zapsign: false, pdf: true })
    vi.mocked(contrato.baixarKit).mockResolvedValue(pdf())
    await abrir(id)
    expect(screen.queryByText(/a assinatura vai pelo ZapSign/)).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'Em papel' })).toBeTruthy()
    expect(screen.getByText(/Imprima o kit, colha a assinatura de Antônio em papel e digitalize o contrato assinado/)).toBeTruthy()
  })

  it('com o ZapSign contratado, a tela é a de antes: celular e papel só na entrevista presencial', async () => {
    vi.mocked(contrato.servicosDoContrato).mockResolvedValue({ zapsign: true, pdf: false })
    await abrir(await contratoGerado())
    expect(screen.getByText('assinar · ZapSign ou papel')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'ZapSign (digital)' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'Em papel na hora' })).toBeTruthy()
    expect(botao('Enviar para assinatura').disabled).toBe(true)
  })
})

describe('GGVP-136 CA5 · imprimir o kit de verdade', () => {
  async function abrirComOKitDoServidor(servicos: { zapsign: boolean; pdf: boolean }) {
    vi.mocked(contrato.kitDeVerdade).mockReturnValue(true)
    vi.mocked(contrato.servicosDoContrato).mockResolvedValue(servicos)
    const id = await contratoGerado()
    await abrir(id)
    return id
  }

  it('com o conversor: o PDF abre na janela de impressão do navegador, e dá para abrir e baixar', async () => {
    vi.mocked(contrato.baixarKit).mockResolvedValue(pdf())
    const id = await abrirComOKitDoServidor({ zapsign: false, pdf: true })
    fireEvent.click(botao('Imprimir o kit'))
    expect(await screen.findByText('Impresso em 05/10/2026 14:32.')).toBeTruthy()
    expect(contrato.baixarKit).toHaveBeenCalledWith(id)
    expect(impressao.imprimirPdf).toHaveBeenCalledWith('blob:kit')
    expect(impressao.baixarArquivo).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Abrir o PDF' }).getAttribute('href')).toBe('blob:kit')
    const baixar = screen.getByRole('link', { name: 'Baixar o PDF' })
    expect([baixar.getAttribute('href'), baixar.getAttribute('download')]).toEqual(['blob:kit', NOME_DO_PDF])
    expect(screen.queryByText(/impressora simulada/)).toBeNull()
    expect((await contrato.obterContrato(id))?.contrato.assinatura?.impressoEm).toEqual(expect.any(String))
  })

  it('sem o conversor: o Word preenchido é baixado para imprimir por ele', async () => {
    vi.mocked(contrato.baixarKit).mockResolvedValue(word())
    await abrirComOKitDoServidor({ zapsign: false, pdf: false })
    fireEvent.click(botao('Imprimir o kit'))
    expect(await screen.findByText('O kit saiu em Word: abra o arquivo e imprima por ele.')).toBeTruthy()
    expect(impressao.baixarArquivo).toHaveBeenCalledWith('blob:kit', NOME_DO_WORD)
    expect(impressao.imprimirPdf).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Baixar o Word' }).getAttribute('download')).toBe(NOME_DO_WORD)
  })

  it('o conversor que não respondeu: o Word sai no lugar, e a tela conta o que aconteceu', async () => {
    vi.mocked(contrato.baixarKit).mockResolvedValue(word())
    await abrirComOKitDoServidor({ zapsign: false, pdf: true })
    fireEvent.click(botao('Imprimir o kit'))
    expect(await screen.findByText('O kit saiu em Word (o conversor de PDF não respondeu): abra o arquivo e imprima por ele.')).toBeTruthy()
    expect(impressao.imprimirPdf).not.toHaveBeenCalled()
  })

  it('"Imprimir de novo" busca o kit outra vez e solta o endereço do anterior', async () => {
    vi.mocked(contrato.baixarKit).mockResolvedValue(pdf())
    await abrirComOKitDoServidor({ zapsign: false, pdf: true })
    fireEvent.click(botao('Imprimir o kit'))
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir de novo' }))
    await vi.waitFor(() => expect(impressao.imprimirPdf).toHaveBeenCalledTimes(2))
    expect(contrato.baixarKit).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:kit')
  })

  it('o kit que o servidor não entrega não vira "impresso": a mensagem aparece e o botão continua', async () => {
    vi.mocked(contrato.baixarKit).mockRejectedValue(new Error('Este contrato ainda não tem o kit gerado.'))
    const id = await abrirComOKitDoServidor({ zapsign: false, pdf: true })
    fireEvent.click(botao('Imprimir o kit'))
    expect(await screen.findByText('Este contrato ainda não tem o kit gerado.')).toBeTruthy()
    expect(botao('Imprimir o kit')).toBeTruthy()
    expect(impressao.imprimirPdf).not.toHaveBeenCalled()
    expect((await contrato.obterContrato(id))?.contrato.assinatura?.impressoEm).toBeUndefined()
  })

  it('no contrato de exemplo a impressora segue simulada, sem baixar nada', async () => {
    vi.mocked(contrato.servicosDoContrato).mockResolvedValue({ zapsign: true, pdf: false })
    await abrir(await contratoGerado())
    fireEvent.click(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'Em papel na hora' }))
    fireEvent.click(botao('Imprimir o kit'))
    expect(await screen.findByText('Impresso em 05/10/2026 14:32 (impressora simulada).')).toBeTruthy()
    expect(contrato.baixarKit).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Imprimir de novo' })).toBeNull()
  })
})
