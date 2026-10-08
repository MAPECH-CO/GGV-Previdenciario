import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from '../dados/documentos.ts'
import { lerComprovante, registrarMarcacao } from '../dados/pericia.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAtendimento } from './CentralAtendimento.tsx'
import { CobrarDocumentoPericia } from './CobrarDocumentoPericia.tsx'
import { ReunirDocumentosPericia } from './ReunirDocumentosPericia.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo('documentacao')
})

const arquivo = (nome: string, tipo: string, n: number) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n).padStart(64, '0') })

async function abrir() {
  render(comSessao(<ReunirDocumentosPericia processoId="pedro-exemplo-1" />))
  await screen.findByRole('heading', { level: 1, name: 'Pedro Exemplo · Reunir documentos da perícia' })
}

describe('GGVP-56 · Reunir documentos da perícia (Figma 10:522)', () => {
  it('CA2 · a avaliação social pede CadÚnico, grupo familiar e as declarações, com o prazo de 10 dias antes', async () => {
    await abrir()
    expect(screen.getByText('avaliação social · até 13/10 (10 dias antes da perícia)')).toBeTruthy()
    const itens = within(screen.getByRole('list', { name: 'O que a perícia pede' })).getAllByRole('listitem')
    expect(itens.map((i) => i.querySelector('span')!.textContent)).toEqual([
      '○ CadÚnico atualizado',
      '○ Composição do grupo familiar',
      '○ Declaração de moradia',
      '○ Declaração de união estável ou de separação de fato, quando houver',
    ])
    expect(screen.getByText(/Não oriente o médico sobre o que escrever \(G20\)/, { selector: 'aside p' })).toBeTruthy()
  })

  it('CA4, CA5, CA6 · anexado pela pasta, a falta com justificativa e as conferências; concluído, volta ao Jurídico administrativo', async () => {
    await enviarArquivos('pedro-exemplo', { origem: 'card', arquivos: [arquivo('cadunico.pdf', 'cadunico', 1), arquivo('grupo familiar.pdf', 'grupo-familiar', 2)] })
    await abrir()
    expect(screen.getByText('anexado: cadunico.pdf · 07/10')).toBeTruthy()
    const concluir = screen.getByRole('button', { name: 'Concluir' }) as HTMLButtonElement
    expect(concluir.disabled).toBe(true)
    expect(screen.getByText('Faltam 2 itens: anexe ou registre a falta com justificativa.')).toBeTruthy()

    const moradia = screen.getAllByRole('listitem').find((l) => l.textContent?.includes('Declaração de moradia'))!
    fireEvent.click(within(moradia).getByRole('button', { name: 'Registrar a falta' }))
    fireEvent.change(within(moradia).getByLabelText(/Por que falta/), { target: { value: 'mora em casa própria, com escritura na pasta' } })
    fireEvent.click(within(moradia).getAllByRole('button', { name: 'Registrar a falta' }).at(-1)!)
    expect(await screen.findByText('Falta registrada: Declaração de moradia.')).toBeTruthy()
    const uniao = screen.getAllByRole('listitem').find((l) => l.textContent?.includes('união estável'))!
    fireEvent.click(within(uniao).getByRole('button', { name: 'Registrar a falta' }))
    fireEvent.change(within(uniao).getByLabelText(/Por que falta/), { target: { value: 'não se aplica: viúvo' } })
    fireEvent.click(within(uniao).getAllByRole('button', { name: 'Registrar a falta' }).at(-1)!)
    await screen.findByText(/Falta registrada: Declaração de união estável/)

    expect(screen.getByText('Marque as conferências.')).toBeTruthy()
    for (const c of ['CadÚnico (se BPC/social)', 'Composição do grupo familiar', /Conferi a leitura da IA/]) fireEvent.click(screen.getByLabelText(c))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(await screen.findByRole('heading', { name: '✓ Documentos da perícia reunidos' })).toBeTruthy()
    expect(screen.getByText(/Concluído por Jéssica \(exemplo\) em 07\/10\/2026 10:00\. O fluxo voltou ao Jurídico administrativo: ligar e orientar Pedro \(DP\.06\)\./)).toBeTruthy()
  })

  it('a Central do Atendimento, onde a Documentação trabalha, mostra "Reunir" e "Cobrar" da perícia do Pedro', () => {
    render(comSessao(<CentralAtendimento />))
    expect(screen.getByRole('link', { name: 'Pedro Exemplo · Reunir documentos da perícia' }).getAttribute('href')).toBe('/casos/pedro-exemplo-1/pericia/documentos')
    expect(screen.getByRole('link', { name: 'Pedro Exemplo · Cobrar documento da perícia' }).getAttribute('href')).toBe('/casos/pedro-exemplo-1/pericia/cobranca')
    // As linhas fixas da Maria saíram: a perícia dela ainda não foi marcada.
    expect(screen.queryByRole('link', { name: 'Maria Exemplo · Reunir documentos da perícia' })).toBeNull()
  })
})

describe('GGVP-56 · Cobrar documento da perícia (Figma 10:239)', () => {
  it('CA7 · o pedido ao médico vem das perguntas do roteiro e o G20 barra CID e diagnóstico', async () => {
    const lido = await lerComprovante('maria-exemplo-1', 'c.pdf')
    await registrarMarcacao('maria-exemplo-1', { comprovante: { nome: 'c.pdf' }, lido, pedeDocumentoNovo: true }, 'Igor (exemplo)')
    render(comSessao(<CobrarDocumentoPericia processoId="maria-exemplo-1" />))
    await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Cobrar documento' })
    expect(screen.getByText(/A cobrança tem limite; passou dele, sobe para a advogada responsável, por ser perícia \(G15\)/)).toBeTruthy()
    const abordar = screen.getByLabelText('O que o documento deve abordar') as HTMLTextAreaElement
    expect(abordar.value.startsWith('O relatório médico precisa responder:\n• ')).toBe(true)
    const salvar = screen.getByRole('button', { name: 'Salvar o pedido ao médico' }) as HTMLButtonElement
    fireEvent.change(abordar, { target: { value: 'Escreva que a paciente tem CID M54.5' } })
    expect(salvar.disabled).toBe(true)
    expect(screen.getByText('Tire o código de doença (CID): a orientação não sugere diagnóstico (G20).')).toBeTruthy()
  })

  it('"Enviar cobrança" abre o Chatwoot com a mensagem do que falta, para conferir', async () => {
    render(comSessao(<CobrarDocumentoPericia processoId="pedro-exemplo-1" />))
    await screen.findByRole('heading', { level: 1, name: 'Pedro Exemplo · Cobrar documento' })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cobrança' }))
    const chatwoot = await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Pedro Exemplo' })
    expect(((await within(chatwoot).findByRole('textbox')) as HTMLTextAreaElement).value).toContain('ainda precisamos de: cadúnico atualizado; composição do grupo familiar')
  })
})
