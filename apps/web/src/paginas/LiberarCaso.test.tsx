import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { conferirChecklist } from '../dados/checklist.ts'
import { enviarArquivos } from '../dados/documentos.ts'
import { arquivarDocumentos, documentosLidos } from '../dados/leitura.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { LiberarCaso } from './LiberarCaso.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function arquivarTudo(fichaId: string) {
  const c = await documentosLidos(fichaId)
  const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
  await arquivarDocumentos(fichaId, { conferi: true, documentos, duplicados: 'manter' })
}

async function completarRita() {
  await arquivarTudo('rita-exemplo')
  const faltam = ['cpf', 'comprovante-renda', 'cadunico', 'grupo-familiar', 'declaracao-moradia']
  await enviarArquivos('rita-exemplo', {
    origem: 'card',
    arquivos: faltam.map((tipo, i) => ({ nome: `${tipo}.pdf`, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(40 + i).padStart(64, '0') })),
  })
  await arquivarTudo('rita-exemplo')
  await conferirChecklist('rita-exemplo-1')
}

async function abrir(processoId: string, perfil?: 'atendimento') {
  render(<LiberarCaso processoId={processoId} perfil={perfil ?? 'documentacao'} />)
  await screen.findByRole('heading', { level: 1, name: /Liberar ao Jurídico/ })
}

const liberar = () => screen.getByRole('button', { name: 'Liberar ao Jurídico' }) as HTMLButtonElement

describe('Liberar ao Jurídico · tela do passo', () => {
  it('CA2 e CA7 · o Sebastião do Figma: parecer Suficiente registrado, mas o benefício sem lista trava a liberação', async () => {
    await abrir('sebastiao-exemplo-1')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sebastião Exemplo · Liberar ao Jurídico')
    const parecer = screen.getByRole('checkbox', { name: /Parecer médico Suficiente \(G17\) · confirmado por Dra\. Paula, 15\/07/ }) as HTMLInputElement
    expect(parecer.checked).toBe(true)
    expect(parecer.disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: /Checklist do Auxílio Acidentário/ }) as HTMLInputElement).disabled).toBe(true)
    expect(liberar().disabled).toBe(true)
    expect(screen.getByText(/Auxílio Acidentário ainda não tem lista de documentos obrigatórios aprovada/)).toBeTruthy()
  })

  it('CA1, CA6 e CA7 · completo: só libera com as duas conferências, e o histórico registra quem liberou', async () => {
    await completarRita()
    await abrir('rita-exemplo-1')
    expect(within(screen.getByRole('list', { name: 'Documentos recebidos' })).getAllByRole('listitem')).toHaveLength(9)
    expect(liberar().disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Checklist do LOAS Deficiente: 9 de 9 itens recebidos/ }))
    expect(screen.getByText('Marque o checklist e as assinaturas e datas: os dois são conferência sua.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Assinaturas e datas preenchidas — confira e marque' }))
    fireEvent.click(liberar())
    expect(await screen.findByRole('heading', { name: '✓ Liberado ao Jurídico às 14:32' })).toBeTruthy()
    expect(screen.getByText(/Você \(Documentação · ADM\) liberou em 05\/10\/2026 14:32/)).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toBe('Caso liberado ao Jurídico pela Documentação')
  })

  it('CA4 · outro perfil vê só a situação, sem o OK', async () => {
    await completarRita()
    await abrir('rita-exemplo-1', 'atendimento')
    expect(screen.queryByRole('button', { name: 'Liberar ao Jurídico' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Você está como Atendimento: vê só a situação')
  })

  it('o resumo do que foi coletado: ficha, entrevista, benefício e parecer', async () => {
    await abrir('sebastiao-exemplo-1')
    const resumo = screen.getByRole('heading', { name: 'Resumo do que foi coletado' }).closest('section')!
    expect(resumo.textContent).toContain('Fichapreenchida')
    expect(resumo.textContent).toContain('BenefícioAuxílio Acidentário')
    expect(resumo.textContent).toContain('Parecer médicoSuficiente')
  })
})
