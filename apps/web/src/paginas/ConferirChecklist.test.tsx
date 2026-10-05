import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from '../dados/documentos.ts'
import { arquivarDocumentos, documentosLidos } from '../dados/leitura.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConferirChecklist } from './ConferirChecklist.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(processoId = 'rita-exemplo-1') {
  render(<ConferirChecklist processoId={processoId} />)
  await screen.findByRole('heading', { level: 1, name: /Conferir checklist/ })
}

async function arquivarTudo(fichaId: string) {
  const c = await documentosLidos(fichaId)
  const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
  await arquivarDocumentos(fichaId, { conferi: true, documentos, duplicados: 'manter' })
}

const item = (nome: string) => within(screen.getByRole('list', { name: /Checklist ·/ })).getByText(nome).closest('li')!

describe('Conferir checklist · tela do passo', () => {
  it('CA1 e CA7 · abre com o título do Figma e cada item com ok, falta ou problema; a declaração de moradia diz por que entrou', async () => {
    await arquivarTudo('rita-exemplo')
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rita Exemplo · Conferir checklist')
    expect(screen.getByRole('heading', { name: 'Checklist · LOAS Deficiente' })).toBeTruthy()
    expect(item('Contrato assinado (kit)').textContent).toContain('ok')
    expect(item('Documento pessoal (RG)').textContent).toContain('ok')
    expect(item('Comprovante de renda').textContent).toContain('falta')
    expect(item('Declaração de moradia').textContent).toBe('Declaração de moradiaentra porque o cliente mora em casa de outra pessoafalta')
    expect(item('Laudo médico').textContent).toContain('pedido na entrevista')
  })

  it('CA3 e CA5 · a situação calculada é "incompleto" e a liberação fica bloqueada com a lista do que falta', async () => {
    await abrir()
    expect(screen.getByText(/Situação:/).parentElement?.textContent).toBe('Situação: incompleto')
    expect(screen.getByText(/Liberar ao Jurídico: bloqueado\. O checklist está incompleto\. Falta: Documento pessoal \(RG\)/)).toBeTruthy()
  })

  it('CA5 · o CadÚnico que chegou pelo card e foi arquivado passa a contar como ok', async () => {
    await enviarArquivos('rita-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'cadunico.pdf', formato: 'pdf', tamanho: 1000, tipo: 'cadunico', hash: '5'.padStart(64, '0') }],
    })
    await arquivarTudo('rita-exemplo')
    await abrir()
    expect(item('Cadastro Único (CadÚnico)').textContent).toContain('ok')
  })

  it('CA2 · ficha de grupo familiar sem assinatura: falta, com o motivo do G1', async () => {
    await enviarArquivos('rita-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'grupo familiar sem assinatura.pdf', formato: 'pdf', tamanho: 1000, tipo: 'grupo-familiar', hash: '6'.padStart(64, '0') }],
    })
    await arquivarTudo('rita-exemplo')
    await abrir()
    expect(item('Ficha de grupo familiar').textContent).toBe('Ficha de grupo familiarchegou sem assinatura (G1)falta')
  })

  it('CA6 · benefício sem lista aprovada explica o bloqueio', async () => {
    await abrir('sebastiao-exemplo-1')
    expect(screen.getByText(/Auxílio Acidentário ainda não tem lista de documentos obrigatórios aprovada\. O escritório monta a lista/)).toBeTruthy()
    expect(screen.getByText(/Liberar ao Jurídico: bloqueado\. Auxílio Acidentário ainda não tem lista/)).toBeTruthy()
  })

  it('GGVP-101 CA1 · incompleto, "Gerar cobrança das pendências" registra a conferência e manda a cobrança ao Atendimento', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Gerar cobrança das pendências' }))
    expect(await screen.findByRole('heading', { name: '✓ Conferido às 14:32' })).toBeTruthy()
    expect(screen.getByText(/Checklist incompleto\. Falta: Documento pessoal \(RG\).*A cobrança das pendências foi para o Atendimento \(D1\.23\)\./)).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toContain('Conferiu o checklist do LOAS Deficiente: incompleto')
  })
})
