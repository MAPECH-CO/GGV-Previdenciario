import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarZapSign, fecharContrato, gerarContrato, obterContrato } from '../dados/contrato.ts'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ColherAssinatura } from './ColherAssinatura.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  configurarZapSign({ falhar: false })
  zerarExemplo()
})

async function abrir(processoId: string) {
  render(<ColherAssinatura processoId={processoId} />)
  await screen.findByRole('heading', { level: 1, name: /Colher assinatura/ })
}

/** O Antônio fecha a Aposentadoria por Idade e o contrato é gerado: fica para colher a assinatura. */
async function contratoGerado() {
  const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
  const todas = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
  await gerarContrato(processo.id, { aprovados: false, oQueCorrigir: 'faltavam o RG e o endereço', conferencias: todas, correcoes: { rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' } })
  return processo.id
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

describe('Colher assinatura · ZapSign (GGVP-72)', () => {
  it('CA1 e CA12 · "ZapSign (digital)" e "Enviar para assinatura": o documento nasce no ZapSign e a mensagem com o link abre para conferir', async () => {
    const id = await contratoGerado()
    await abrir(id)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Antônio Exemplo · Colher assinatura')
    expect(screen.getByText('assinar · ZapSign ou papel')).toBeTruthy()
    expect(botao('Enviar para assinatura').disabled).toBe(true)
    fireEvent.click(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'ZapSign (digital)' }))
    fireEvent.click(botao('Enviar para assinatura'))
    const janela = await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Antônio Exemplo' })
    const mensagem = within(janela).getByLabelText('Mensagem com o link do ZapSign (confira antes de enviar)') as HTMLTextAreaElement
    expect(mensagem.value).toContain(`https://zapsign.exemplo/assinar/zapsign-exemplo-${id}`)
    fireEvent.click(within(janela).getByRole('button', { name: 'Enviar' }))
    const tentativas = await screen.findByRole('list', { name: 'Tentativas de contato' })
    expect(within(tentativas).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['05/10 · WhatsApp · link enviado · Você (Atendimento)'])
    expect(screen.getByText('enviado ao cliente; aguardando a assinatura')).toBeTruthy()
    expect(screen.getByText('Próxima tentativa em 08/10, se o cliente não assinar antes.')).toBeTruthy()
    expect((await obterFicha('antonio-exemplo'))?.contatos.at(-1)?.texto).toBe('Link do ZapSign enviado para assinar o contrato.')
  })

  it('CA2, CA4, CA5 e CA11 · a Nair: o status, o lembrete de hoje e a segunda tentativa, que sobe para a sênior', async () => {
    await abrir('nair-exemplo-1')
    expect(screen.getByText('zapsign-exemplo-nair-exemplo-1')).toBeTruthy()
    expect(screen.getByText(/Hoje: tente contato de novo \(tentativa 2 de 2\)/)).toBeTruthy()
    expect(screen.getByText('Tentativa 1 de 2 · limite (G15)')).toBeTruthy()
    fireEvent.click(botao('Ligar'))
    expect(screen.getByText('Ligue para (11) 90000-0003 (ligação simulada).')).toBeTruthy()
    fireEvent.click(botao('Registrar a ligação'))
    expect(await screen.findByText(/Limite de 2 tentativas atingido \(G15\): o caso subiu para a advogada sênior/)).toBeTruthy()
    expect((await obterContrato('nair-exemplo-1'))?.contrato.assinatura?.zapsign?.documentoId).toBe('zapsign-exemplo-nair-exemplo-1')
  })

  it('CA3, CA6 e CA10 · o retorno do ZapSign anexa o arquivo final no card e a tarefa se encerra', async () => {
    await abrir('nair-exemplo-1')
    fireEvent.click(botao('Simular o retorno do ZapSign (assinado)'))
    expect(await screen.findByRole('heading', { name: '✓ Contrato assinado pelo ZapSign' })).toBeTruthy()
    expect(screen.getByText(/Contrato assinado - Nair Exemplo - 2026-10-05 \(ZapSign, com evidências\)\.pdf/)).toBeTruthy()
    expect(screen.queryByText(/Pendente: documento assinado/)).toBeNull()
  })

  it('CA9 · erro ao gerar no ZapSign: a mensagem e "Tentar de novo"', async () => {
    const id = await contratoGerado()
    configurarZapSign({ falhar: true })
    await abrir(id)
    fireEvent.click(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'ZapSign (digital)' }))
    fireEvent.click(botao('Enviar para assinatura'))
    expect(await screen.findByText('O ZapSign não respondeu ao gerar o documento. Nada foi enviado ao cliente.')).toBeTruthy()
    configurarZapSign({ falhar: false })
    fireEvent.click(botao('Tentar de novo'))
    expect(await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Antônio Exemplo' })).toBeTruthy()
  })

  it('GGVP-77 CA1, CA2 e CA3 · papel na hora: imprimir com as datas em branco, digitalizar e só então concluir', async () => {
    const id = await contratoGerado()
    await abrir(id)
    fireEvent.click(within(screen.getByRole('region', { name: 'Como o cliente vai assinar?' })).getByRole('radio', { name: 'Em papel na hora' }))
    expect(botao('Concluir a assinatura').disabled).toBe(true)
    fireEvent.click(botao('Imprimir o kit'))
    const datas = await screen.findByRole('list', { name: 'Datas do kit impresso' })
    expect(within(datas).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Contrato de honorários · 05/10/2026',
      'Procuração · em branco, à mão na assinatura',
      'Declaração de hipossuficiência · em branco, à mão na assinatura',
      'Declaração de residência · em branco, à mão na assinatura',
      'Termo INSS · em branco, à mão na assinatura',
      'Código Penal · em branco, à mão na assinatura',
    ])
    expect(screen.getByText('Anexe a digitalização do contrato assinado.')).toBeTruthy()
    expect(botao('Concluir a assinatura').disabled).toBe(true)
    fireEvent.click(botao('Digitalizar o contrato assinado (scanner simulado)'))
    expect(await screen.findByText(/✓ Contrato assinado - Antônio Exemplo - 2026-10-05 \(papel, PDF pesquisável\)\.pdf, PDF pesquisável na pasta do cliente/)).toBeTruthy()
    fireEvent.click(botao('Concluir a assinatura'))
    expect(await screen.findByRole('heading', { name: '✓ Contrato assinado em papel' })).toBeTruthy()
    expect((await obterContrato(id))?.contrato.etapa).toBe('leitura')
  })

  it('GGVP-77 CA4 · entrevista por vídeo: a opção de papel não aparece e a assinatura vai pelo ZapSign', async () => {
    const id = await contratoGerado()
    const banco = ler()
    banco.fichas.find((f) => f.id === 'antonio-exemplo')!.agendamentos.push({ id: 'antonio-entrevista', data: '2026-10-05', hora: '10:30', oQue: 'Entrevista', tipo: 'video' })
    gravar(banco)
    await abrir(id)
    expect(screen.queryByRole('radio', { name: 'Em papel na hora' })).toBeNull()
    expect(screen.queryByRole('radio', { name: 'Papel, na hora' })).toBeNull()
    expect(screen.getByText(/A entrevista de Antônio foi por vídeo \(meet\): a assinatura vai pelo ZapSign/)).toBeTruthy()
  })

  it('contrato ainda não gerado leva a preparar', async () => {
    await abrir('cleide-exemplo-1')
    expect(screen.getByRole('link', { name: 'Preparar o contrato' }).getAttribute('href')).toBe('/contrato/cleide-exemplo-1/preparar')
  })
})
