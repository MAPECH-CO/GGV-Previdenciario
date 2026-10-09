import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  concluirAssinaturaEmPapel,
  digitalizarContratoAssinado,
  fecharContrato,
  gerarContrato,
  imprimirKit,
  obterContrato,
  simularLeituraDoContrato,
} from '../dados/contrato.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConferirContrato } from './ConferirContrato.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

/** O Antônio assina em papel e a IA aponta a página da assinatura cortada: o Atendimento confere. */
async function paraConferir() {
  const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
  const todas = { campos: true, datas: true, fichaLoas: true, codigoPenal: true }
  await gerarContrato(processo.id, { aprovados: false, oQueCorrigir: 'faltavam o RG e o endereço', conferencias: todas, correcoes: { rg: '12.345.678-X', endereco: 'Rua Exemplo, 1' } })
  await imprimirKit(processo.id)
  await digitalizarContratoAssinado(processo.id)
  await concluirAssinaturaEmPapel(processo.id)
  await simularLeituraDoContrato(processo.id)
  render(<ConferirContrato processoId={processo.id} />)
  await screen.findByRole('heading', { level: 1, name: /Conferir contrato/ })
  return processo.id
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

describe('Conferir contrato (GGVP-85)', () => {
  it('CA2 e CA4 · a tarefa mostra o que a IA apontou: a assinatura reconhecida e a página que falta', async () => {
    await paraConferir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Antônio Exemplo · Conferir contrato')
    expect(screen.getByText('contrato recebido')).toBeTruthy()
    const ia = screen.getByRole('region', { name: 'A IA sugere · você confere' })
    expect(within(ia).getByText('A IA apontou 1 pendência: a página da assinatura veio cortada. Confira e peça a página inteira antes de seguir.')).toBeTruthy()
    expect(within(ia).getByText('reconhecida (nome e CPF conferem)')).toBeTruthy()
    expect(within(ia).getByText('falta pág. 4 (rubrica)').getAttribute('data-problema')).toBe('true')
    expect(screen.getByText('A IA sugere; a pessoa confirma.')).toBeTruthy()
  })

  it('CA5 · "Está certo — seguir" só com a decisão; "Não, corrigir e reenviar" exige o que corrigir', async () => {
    await paraConferir()
    expect(botao('Está certo — seguir').disabled).toBe(true)
    expect(screen.getByText('Responda se está tudo certo.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir e reenviar' }))
    expect(screen.getByText('Escreva o que corrigir.')).toBeTruthy()
    expect(botao('Corrigir').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'pedir a pág. 4 rubricada' } })
    expect(botao('Corrigir').disabled).toBe(false)
    expect(botao('Está certo — seguir').disabled).toBe(true)
  })

  it('CA3, CA5 e CA6 · corrigir com a página anexa: a versão assinada fica no histórico e volta a preparar', async () => {
    const id = await paraConferir()
    const caixa = screen.getByLabelText(/Anexar a página da assinatura para conferência/)
    fireEvent.change(caixa, { target: { files: [new File(['x'], 'planilha.xlsx')] } })
    expect(screen.getByText('Só PDF, JPG ou PNG.')).toBeTruthy()
    fireEvent.change(caixa, { target: { files: [new File(['x'], 'pagina-4.jpg', { type: 'image/jpeg' })] } })
    expect(screen.getByText('✓ pagina-4.jpg')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir e reenviar' }))
    fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'pedir a pág. 4 rubricada' } })
    fireEvent.click(botao('Corrigir'))
    expect(await screen.findByRole('heading', { name: '✓ Volta para corrigir e reenviar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Preparar contrato' }).getAttribute('href')).toBe(`/contrato/${id}/preparar`)
    const caso = await obterContrato(id)
    expect(caso?.contrato.anteriores?.[0]).toMatchObject({ versao: 1, motivo: 'pedir a pág. 4 rubricada' })
    expect(caso?.ficha.arquivos.at(-1)?.nome).toBe('pagina-4.jpg')
  })

  it('CA7 · "Está certo — seguir": vai para a cópia do contrato', async () => {
    const id = await paraConferir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    fireEvent.click(botao('Está certo — seguir'))
    expect(await screen.findByRole('heading', { name: '✓ Contrato conferido: segue para a cópia' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entregar cópia do contrato' }).getAttribute('href')).toBe(`/contrato/${id}/copia`)
    expect((await obterContrato(id))?.contrato.etapa).toBe('copia')
  })

  it('o contato do cliente: ligar mostra o número e o WhatsApp fica em "Últimos contatos"', async () => {
    await paraConferir()
    fireEvent.click(botao('Ligar'))
    expect(screen.getByText('Ligue para (11) 90000-0001 (ligação simulada).')).toBeTruthy()
    fireEvent.click(botao('WhatsApp'))
    const janela = await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Antônio Exemplo' })
    expect((within(janela).getByLabelText('Aviso da pendência no contrato (confira antes de enviar)') as HTMLTextAreaElement).value).toContain(
      'Recebemos o contrato assinado, mas a página da assinatura veio cortada.',
    )
    fireEvent.click(within(janela).getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('Aviso enviado pelo WhatsApp: ficou em "Últimos contatos".')).toBeTruthy()
    expect((await obterFicha('antonio-exemplo'))?.contatos.at(-1)?.texto).toBe('Avisado da pendência no contrato assinado.')
  })
})
