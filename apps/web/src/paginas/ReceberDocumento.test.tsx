import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, encaminhar, obterFicha, tarefasDoSetor, zerarExemplo } from '../dados/servidor.ts'
import { ReceberDocumento } from './ReceberDocumento.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(fichaId: string) {
  const { tarefa } = await encaminhar({ fichaId, motivo: 'documento', setor: 'Documentação · ADM' })
  render(<ReceberDocumento tarefaId={tarefa.id} />)
  await screen.findByRole('heading', { level: 1 })
  return tarefa
}

const registrar = () => screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement
const marcar = (rotulo: string | RegExp) => fireEvent.click(screen.getByRole('checkbox', { name: rotulo }))

describe('Receber documento · tela do passo', () => {
  it('abre com o título do Figma, o caso e o "Registrar" parado até escolher papel ou digital', async () => {
    await abrir('antonio-exemplo')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Antônio Exemplo · Receber documento')
    expect(screen.getByText(/Cliente entregou documentos · Aposentadoria por incapacidade permanente · Judicial · exigência/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antes de concluir' })).toBeTruthy()
    expect(registrar().disabled).toBe(true)
    expect(screen.getByText('Escolha se chegou em papel ou digital.')).toBeTruthy()
  })

  it('CA2, CA5 e CA10 · papel no scanner: arquiva, avisa "CONFERIR O PAPEL" e só registra com as duas conferências', async () => {
    await abrir('antonio-exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Papel — vai ao scanner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Digitalizar (scanner simulado)' }))
    const lote = within(await screen.findByRole('list', { name: 'Documentos do lote' }))
    expect(lote.getByText('CNIS - Antônio Exemplo - 2026-10-05.pdf')).toBeTruthy()
    expect(screen.getByText(/✓ Arquivado na pasta do cliente/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('CONFERIR O PAPEL')
    expect(screen.getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe('/clientes/antonio-exemplo')

    marcar('Conferi o tipo de cada documento')
    expect(registrar().disabled).toBe(true)
    expect(screen.getByText('Confira o papel antes de devolver o original.')).toBeTruthy()
    marcar(/Conferi o papel/)
    fireEvent.click(registrar())
    expect(await screen.findByRole('heading', { name: '✓ Registrado às 14:32' })).toBeTruthy()
    expect(tarefasDoSetor('Documentação · ADM')).toEqual([])
    expect((await obterFicha('antonio-exemplo'))?.historico.at(-1)?.oQue).toContain('Registrou o recebimento de 2 documentos em papel')
  })

  it('CA4 · sem dono certo, o lote vai para "A REVISAR" com o motivo da planilha', async () => {
    await abrir('natalia-exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Papel — vai ao scanner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Digitalizar (scanner simulado)' }))
    expect(await screen.findByText(/Foi para A REVISAR/)).toBeTruthy()
    expect(screen.getByText(/não existe pasta parecida, mas o CPF dessa pessoa não está escrito no papel/)).toBeTruthy()
    expect(screen.getByText(/Documento nunca vai para a pasta de outro cliente/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Abrir' })).toBeNull()
  })

  it('CA10 · digital: anexa ao card pela janela e registra depois de conferir o tipo', async () => {
    await abrir('rita-exemplo')
    fireEvent.click(screen.getByRole('radio', { name: 'Digital — anexar ao card' }))
    expect(screen.getByText('Anexe os arquivos ao card.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Anexar ao card' }))
    const janela = within(screen.getByRole('dialog', { name: 'Conferir e enviar' }))
    fireEvent.change(janela.getByLabelText(/Solte mais arquivos aqui/), { target: { files: [new File(['rg'], 'rg.pdf')] } })
    const enviar = janela.getByRole('button', { name: 'Enviar para a pasta do cliente' }) as HTMLButtonElement
    await waitFor(() => expect(enviar.disabled).toBe(false))
    fireEvent.click(enviar)
    expect(await screen.findByText('1 arquivo anexado ao card.')).toBeTruthy()
    marcar('Conferi o tipo de cada documento')
    fireEvent.click(registrar())
    expect(await screen.findByRole('heading', { name: '✓ Registrado às 14:32' })).toBeTruthy()
  })

  it('tarefa que não existe avisa', async () => {
    render(<ReceberDocumento tarefaId="nenhuma" />)
    expect(await screen.findByRole('heading', { name: 'Tarefa não encontrada' })).toBeTruthy()
  })
})
