import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { conferirChecklist } from '../dados/checklist.ts'
import { enviarArquivos } from '../dados/documentos.ts'
import { arquivarDocumentos, documentosLidos } from '../dados/leitura.ts'
import { obterParecer, pedirDispensa, registrarParecer, responderDispensa } from '../dados/parecer.ts'
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
  // O relatório médico completa o laudo, e a advogada registra o parecer Suficiente (GGVP-20).
  const faltam = ['cpf', 'comprovante-renda', 'cadunico', 'grupo-familiar', 'declaracao-moradia', 'laudo']
  await enviarArquivos('rita-exemplo', {
    origem: 'card',
    arquivos: faltam.map((tipo, i) => ({ nome: `${tipo}.pdf`, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(40 + i).padStart(64, '0') })),
  })
  await arquivarTudo('rita-exemplo')
  await conferirChecklist('rita-exemplo-1')
  const analise = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!.analise!
  const conferidos = Object.fromEntries(analise.itens.map((i) => [i.id, i.situacao]))
  await registrarParecer('rita-exemplo-1', { analise: analise.quando, conferidos, decisao: 'suficiente' }, { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' })
}

async function abrir(processoId: string, perfil?: 'atendimento') {
  render(<LiberarCaso processoId={processoId} perfil={perfil} />)
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

  it('GGVP-20 · "Abrir ›" do parecer e "Parecer médico" abrem a janela do parecer, na visão da Documentação', async () => {
    await abrir('sebastiao-exemplo-1')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o parecer médico' }))
    const janela = await screen.findByRole('dialog', { name: 'Parecer médico de suficiência' })
    expect((await within(janela).findByRole('status')).textContent).toContain('SUFICIENTE')
    expect(within(janela).queryByRole('list', { name: 'Roteiro aplicado' })).toBeNull()
    expect(within(janela).getByText('Nada: a documentação cobre o que o benefício exige.')).toBeTruthy()
  })

  it('o resumo do que foi coletado: ficha, entrevista, benefício e parecer', async () => {
    await abrir('sebastiao-exemplo-1')
    const resumo = screen.getByRole('heading', { name: 'Resumo do que foi coletado' }).closest('section')!
    expect(resumo.textContent).toContain('Fichapreenchida')
    expect(resumo.textContent).toContain('BenefícioAuxílio Acidentário')
    expect(resumo.textContent).toContain('Parecer médicoSuficiente')
  })

  it('GGVP-33 CA1 e CA4 · com o parecer Insuficiente, o item diz o que falta e "Liberar" não habilita', async () => {
    await completarRita()
    const analise = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!.analise!
    const conferidos = Object.fromEntries(analise.itens.map((i) => [i.id, i.id === 'prognostico' ? 'ausente' : i.situacao]))
    await registrarParecer(
      'rita-exemplo-1',
      { analise: analise.quando, conferidos, decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' },
      { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' },
    )
    await abrir('rita-exemplo-1')
    expect(screen.getByText(/Parecer médico Insuficiente \(G17\) · confirmado por Dra\. Paula \(exemplo\), 05\/10: falta o complemento do médico/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Checklist do LOAS Deficiente/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Assinaturas e datas preenchidas — confira e marque' }))
    expect(liberar().disabled).toBe(true)
    expect(screen.getByText('Não dá para liberar ao Jurídico: o parecer médico está Insuficiente. Falta o complemento do médico e o parecer refeito (G17).')).toBeTruthy()
  })

  it('GGVP-33 CA2 · a dispensa de duas sêniores aparece no item do parecer e libera', async () => {
    await completarRita()
    const analise = (await obterParecer('rita-exemplo-1', 'juridico'))!.juridico!.analise!
    const conferidos = Object.fromEntries(analise.itens.map((i) => [i.id, i.id === 'prognostico' ? 'ausente' : i.situacao]))
    await registrarParecer(
      'rita-exemplo-1',
      { analise: analise.quando, conferidos, decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' },
      { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' },
    )
    configurarExemplo({ agora: () => new Date(2026, 9, 5, 16, 0) })
    await pedirDispensa('rita-exemplo-1', 'Prazo do juiz vence e o médico só atende em novembro.', { perfil: 'senior', nome: 'Dra. Renata (exemplo)' })
    await responderDispensa('rita-exemplo-1', true, { perfil: 'senior-2', nome: 'Dr. Otávio (exemplo)' })
    await abrir('rita-exemplo-1')
    const parecer = screen.getByRole('checkbox', { name: /Parecer médico dispensado por duas sêniores \(G17\) · Dra\. Renata \(exemplo\) e Dr\. Otávio \(exemplo\), 05\/10/ }) as HTMLInputElement
    expect(parecer.checked).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /Checklist do LOAS Deficiente/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Assinaturas e datas preenchidas — confira e marque' }))
    expect(liberar().disabled).toBe(false)
  })
})
