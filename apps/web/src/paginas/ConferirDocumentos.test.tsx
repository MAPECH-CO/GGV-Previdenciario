import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from '../dados/documentos.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConferirDocumentos } from './ConferirDocumentos.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(fichaId = 'rita-exemplo') {
  render(<ConferirDocumentos fichaId={fichaId} />)
  await screen.findByRole('heading', { level: 1, name: /Conferir documento/ })
}

const arquivar = () => screen.getByRole('button', { name: 'Arquivar' }) as HTMLButtonElement
const lidos = () => within(screen.getByRole('list', { name: 'Documentos lidos pela IA' }))

describe('Conferir documento · tela do passo', () => {
  it('CA7 · abre com o título do Figma, o que a IA sugeriu, a confiança e a baixa confiança marcada', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rita Exemplo · Conferir documento')
    expect(screen.getByText('digitalizados · ler e arquivar')).toBeTruthy()
    expect(screen.getByText('O scanner digitalizou e a IA leu e classificou. Confira e arquive.')).toBeTruthy()
    expect(screen.getByText('Documento pessoal (RG), Comprovante de residência, Laudo médico')).toBeTruthy()
    expect(lidos().getAllByRole('listitem')).toHaveLength(4)
    expect(lidos().getByText('digitalizado · 10/03/2015 · confiança 96%')).toBeTruthy()
    // O laudo (62%) e a cópia do comprovante (74%) ficam abaixo de 80%.
    expect(lidos().getAllByText('baixa confiança: confira com atenção').map((s) => s.closest('li')?.querySelector('span span')?.textContent)).toEqual([
      'Comprovante de residência',
      'Laudo médico',
    ])
    expect(screen.getByText('2 para conferir com atenção')).toBeTruthy()
    // Documento médico: a Documentação confirma, sem abrir o conteúdo (CA16).
    expect(lidos().getByText('o conteúdo fica com o Jurídico, que recebe a análise da IA')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antes de concluir' })).toBeTruthy()
  })

  it('CA7 e CA9 · "Arquivar" só habilita com o duplicado decidido e a conferência marcada', async () => {
    await abrir()
    expect(arquivar().disabled).toBe(true)
    expect(screen.getByText('Decida o que fazer com o documento duplicado.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Descartar a cópia menos legível' }))
    expect(screen.getByText('Marque "Conferi os documentos lidos pela IA".')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }))
    expect(arquivar().disabled).toBe(false)
    fireEvent.click(arquivar())
    expect(await screen.findByRole('heading', { name: '✓ Arquivado às 14:32' })).toBeTruthy()
    expect(screen.getByText(/3 documentos arquivados na pasta de Rita Exemplo no Drive; 1 cópia descartada, com o original guardado/)).toBeTruthy()
    // CA14: o checklist foi recalculado; a quarentena continua à vista.
    expect(
      await screen.findByText(
        'O checklist do LOAS Deficiente foi recalculado com o que entrou. Ainda falta: Documento pessoal (CPF), Comprovante de renda, Cadastro Único (CadÚnico), Ficha de grupo familiar e Declaração de moradia.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir o checklist' }).getAttribute('href')).toBe('/casos/rita-exemplo-1/checklist')
    expect(screen.getByRole('heading', { name: /Em quarentena/ })).toBeTruthy()
  })

  it('CA7 · "Reclassificar" troca o tipo e a data, e data errada trava o "Arquivar"', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Reclassificar' }))
    const tipo = screen.getByRole('combobox', { name: /Tipo de RG - Rita Exemplo/ })
    fireEvent.change(tipo, { target: { value: 'certidao' } })
    expect(screen.getByText('Certidão, Comprovante de residência, Laudo médico')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /Data de RG - Rita Exemplo/ }), { target: { value: '31/02/2015' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Manter os dois' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }))
    expect(arquivar().disabled).toBe(true)
    expect(screen.getByText('Corrija a data do documento (dd/mm/aaaa).')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: /Data de RG - Rita Exemplo/ }), { target: { value: '10032015' } })
    fireEvent.blur(screen.getByRole('textbox', { name: /Data de RG - Rita Exemplo/ }))
    fireEvent.click(arquivar())
    await screen.findByRole('heading', { name: /✓ Arquivado/ })
    expect((await obterFicha('rita-exemplo'))?.arquivos[0]).toMatchObject({ tipo: 'certidao', aguardaLeitura: false })
  })

  it('CA3 e CA8 · o nome lido diferente fica destacado e o cadastro só muda com "Usar no cadastro"', async () => {
    await abrir()
    const tabela = within(screen.getByRole('table'))
    const nome = tabela.getByText('Rita de Cássia Exemplo').closest('tr')!
    expect(nome.getAttribute('data-situacao')).toBe('diverge')
    expect(within(nome).getByText(/diferente do cadastro/)).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.nome).toBe('Rita Exemplo')
    fireEvent.click(within(nome).getByRole('button', { name: 'Usar no cadastro: Nome lido de Documento pessoal (RG)' }))
    expect(await screen.findByText('Nome atualizado no cadastro com o que a IA leu.')).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.nome).toBe('Rita de Cássia Exemplo')
    expect(tabela.getAllByText('✓ igual').length).toBeGreaterThan(0)
  })

  it('CA10 e CA11 · a quarentena mostra o motivo; mover sem motivo é recusado, com motivo vai para o Antônio', async () => {
    await abrir()
    const quarentena = within(screen.getByRole('heading', { name: /Em quarentena/ }).closest('section')!)
    expect(quarentena.getByText('A IA desconfia do dono: o nome lido é Antônio Exemplo, não Rita Exemplo.')).toBeTruthy()
    fireEvent.click(quarentena.getByRole('button', { name: 'Mover para outro caso' }))
    expect((quarentena.getByRole('combobox', { name: 'Para qual caso' }) as HTMLSelectElement).value).toBe('antonio-exemplo-1')
    fireEvent.click(quarentena.getByRole('button', { name: 'Mover' }))
    expect((await quarentena.findByRole('alert')).textContent).toBe('Informe o motivo para mover o documento')
    fireEvent.change(quarentena.getByRole('textbox', { name: 'Motivo (obrigatório)' }), { target: { value: 'veio na pilha da Rita' } })
    fireEvent.click(quarentena.getByRole('button', { name: 'Mover' }))
    expect(await screen.findByText(/Moveu CNIS para o caso Aposentadoria por Incapacidade Permanente de Antônio Exemplo/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Em quarentena/ })).toBeNull()
  })

  it('CA10 · "É deste cliente: liberar" devolve o documento à conferência', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'É deste cliente: liberar' }))
    expect(await screen.findByText('O documento é deste cliente: voltou para a conferência.')).toBeTruthy()
    expect(lidos().getAllByRole('listitem')).toHaveLength(5)
  })

  it('ficha sem nada para conferir não mostra o "Arquivar"', async () => {
    await abrir('josefa-exemplo')
    expect(screen.getByRole('heading', { name: 'Nada para conferir' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull()
  })

  it('GGVP-95 CA1 · o documento médico mostra o tipo, a data de emissão, o médico e o registro, sem o conteúdo', async () => {
    await abrir()
    const laudo = lidos().getByText('Laudo médico').closest('li')!
    expect(laudo.textContent).toContain('digitalizado · emitido em 20/08/2026 · Dra. Exemplo Neurologista · CRM-SP 000000 · confiança 62%')
    expect(laudo.textContent).toContain('documento médico')
    expect(within(laudo as HTMLElement).queryByRole('link', { name: /Abrir/ })).toBeNull()
  })

  it('GGVP-95 CA2 · reclassificar o laudo mostra o que a IA sugeriu, e a correção vai para o histórico', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Reclassificar' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Tipo de Laudo medico/ }), { target: { value: 'relatorio-medico' } })
    expect(lidos().getByText('corrigido: a IA sugeriu Laudo médico')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Manter os dois' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi os documentos lidos pela IA' }))
    fireEvent.click(arquivar())
    await screen.findByRole('heading', { name: '✓ Arquivado às 14:32' })
    expect((await obterFicha('rita-exemplo'))?.historico.at(-2)?.oQue).toMatch(/^Corrigiu a classificação de Laudo medico .*: a IA sugeriu Laudo médico; ficou Relatório médico$/)
  })

  it('GGVP-95 CA3 · o ilegível aparece à parte, com o original guardado e a pendência do Atendimento', async () => {
    await enviarArquivos('maria-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'laudo ilegivel.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '9'.padStart(64, '0') }],
    })
    await abrir('maria-exemplo')
    const ilegiveis = screen.getByRole('list', { name: 'Documentos ilegíveis' })
    expect(ilegiveis.textContent).toContain('Laudo médico · laudo ilegivel.pdf')
    expect(ilegiveis.textContent).toContain('O original fica guardado na pasta; o Atendimento recebeu «Pedir documento legível»')
    expect(screen.queryByRole('button', { name: 'Arquivar' })).toBeNull()
  })
})

