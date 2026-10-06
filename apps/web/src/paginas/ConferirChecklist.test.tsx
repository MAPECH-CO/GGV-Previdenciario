import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { enviarArquivos } from '../dados/documentos.ts'
import { salvarCrianca } from '../dados/infantil.ts'
import { arquivarDocumentos, documentosLidos } from '../dados/leitura.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
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

  // Desde a GGVP-47 o Auxílio-Acidente tem lista: o exemplo sem lista é a aposentadoria do Antônio.
  it('CA6 · benefício sem lista aprovada explica o bloqueio', async () => {
    await abrir('antonio-exemplo-1')
    expect(screen.getByText(/Aposentadoria por Incapacidade Permanente ainda não tem lista de documentos obrigatórios aprovada\. O escritório monta a lista/)).toBeTruthy()
    expect(screen.getByText(/Liberar ao Jurídico: bloqueado\. Aposentadoria por Incapacidade Permanente ainda não tem lista/)).toBeTruthy()
  })

  it('GGVP-101 CA1 · incompleto, "Gerar cobrança das pendências" registra a conferência e manda a cobrança ao Atendimento', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Gerar cobrança das pendências' }))
    expect(await screen.findByRole('heading', { name: '✓ Conferido às 14:32' })).toBeTruthy()
    expect(screen.getByText(/Checklist incompleto\. Falta: Documento pessoal \(RG\).*A cobrança das pendências foi para o Atendimento \(D1\.23\)\./)).toBeTruthy()
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toContain('Conferiu o checklist do LOAS Deficiente: incompleto')
  })
})

describe('Checklist do Auxílio-Acidente · tela do passo (GGVP-47)', () => {
  beforeEach(() => iniciarPerfil(''))

  async function abrirSebastiao() {
    await abrir('sebastiao-exemplo-1')
    await screen.findByRole('heading', { name: 'Circunstância do acidente' })
  }

  const escolher = (rotulo: string, valor: string) => fireEvent.change(screen.getByRole('combobox', { name: rotulo }), { target: { value: valor } })
  const nomes = () => within(screen.getByRole('list', { name: /Checklist ·/ })).getAllByRole('listitem').map((li) => li.textContent)

  it('CA2 · antes de marcar, o kit aparece e trava; o trânsito tira a CAT e o trabalho põe, com a espécie', async () => {
    await abrirSebastiao()
    expect(screen.getByText('Marque a circunstância do acidente: o que é obrigatório depende dela.')).toBeTruthy()
    expect(screen.getByText(/Liberar ao Jurídico: bloqueado\. Marque a circunstância do acidente/)).toBeTruthy()
    expect(screen.getByText('A circunstância define a espécie e o que é obrigatório no checklist. Ainda não foi marcada.')).toBeTruthy()
    const salvar = screen.getByRole('button', { name: 'Salvar a circunstância' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)

    escolher('Circunstância', 'transito')
    escolher('Categoria do segurado', 'empregado')
    fireEvent.change(screen.getByRole('textbox', { name: 'Data do acidente' }), { target: { value: '15/03/2024' } })
    expect(screen.getByText('B36 · auxílio-acidente previdenciário')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /O empregador recusou a CAT/ })).toBeNull()
    fireEvent.click(salvar)
    expect(await screen.findByText('Circunstância salva: o checklist foi refeito.')).toBeTruthy()
    await screen.findByText('Ficha do pronto-socorro')
    expect(nomes().join('|')).not.toContain('CAT')

    escolher('Circunstância', 'trabalho')
    expect(screen.getByText('B94 · auxílio-acidente acidentário')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /O empregador recusou a CAT/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Houve internação ou cirurgia/ }))
    fireEvent.click(salvar)
    await screen.findByText('CAT (Comunicação de Acidente de Trabalho)')
    expect((await obterFicha('sebastiao-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Marcou a circunstância do acidente: Acidente de trabalho · Empregado · B94 · auxílio-acidente acidentário',
    )
  })

  it('CA1 e CA3 · cada complementar com a exigência e o status: o desejável "não conta", o que falta, e o motivo para não liberar', async () => {
    await abrirSebastiao()
    escolher('Circunstância', 'trabalho')
    escolher('Categoria do segurado', 'empregado')
    fireEvent.change(screen.getByRole('textbox', { name: 'Data do acidente' }), { target: { value: '15/03/2024' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Houve internação ou cirurgia/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar a circunstância' }))
    await screen.findByText('CAT (Comunicação de Acidente de Trabalho)')
    expect(item('CAT (Comunicação de Acidente de Trabalho)').textContent).toBe('CAT (Comunicação de Acidente de Trabalho)obrigatóriook')
    expect(item('Boletim de ocorrência').textContent).toBe('Boletim de ocorrênciadesejável: não conta para o completonão conta')
    expect(item('Prontuário').textContent).toBe('Prontuáriocondicionalfalta')
    expect(item('Exame posterior à alta').textContent).toBe('Exame posterior à altaobrigatóriook')
    expect(screen.getByText(/Liberar ao Jurídico: bloqueado\. O checklist está incompleto\. Falta: Ficha do pronto-socorro, Prontuário e Exame de imagem da época do acidente\./)).toBeTruthy()
  })

  it('CA2 · a categoria facultativo trava na hora, antes de salvar', async () => {
    await abrirSebastiao()
    escolher('Circunstância', 'trabalho')
    escolher('Categoria do segurado', 'facultativo')
    fireEvent.change(screen.getByRole('textbox', { name: 'Data do acidente' }), { target: { value: '15/03/2024' } })
    expect(screen.getByText('Facultativo não tem direito ao auxílio-acidente: o caso trava na categoria.')).toBeTruthy()
  })

  it('quem não é da Documentação nem do Jurídico vê a circunstância, mas não marca', async () => {
    iniciarPerfil('?perfil=atendimento')
    await abrirSebastiao()
    expect(screen.getByText('Só a Documentação ou o Jurídico marcam a circunstância do acidente.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Salvar a circunstância' })).toBeNull()
    expect((screen.getByRole('combobox', { name: 'Circunstância' }) as HTMLSelectElement).disabled).toBe(true)
  })
})

describe('Checklist do LOAS da criança · tela do passo (GGVP-50)', () => {
  it('CA2 · os relatórios por condição entram como obrigatórios; sem a condição, o checklist espera a advogada', async () => {
    await abrir('davi-exemplo-1')
    expect(item('Relatório escolar').textContent).toBe('Relatório escolarobrigatóriofalta')
    expect(screen.getByText('A advogada marca a condição da criança no parecer: os relatórios que o caso pede dependem dela.')).toBeTruthy()
    await salvarCrianca('davi-exemplo-1', { condicoes: ['saude-mental'], terapias: ['psicologia'] }, { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' })
    cleanup()
    await abrir('davi-exemplo-1')
    expect(item('Relatório do CAPS').textContent).toBe('Relatório do CAPSobrigatóriofalta')
    expect(item('Relatório de psicologia').textContent).toBe('Relatório de psicologiaobrigatóriofalta')
    expect(screen.queryByText(/A advogada marca a condição da criança/)).toBeNull()
  })
})

