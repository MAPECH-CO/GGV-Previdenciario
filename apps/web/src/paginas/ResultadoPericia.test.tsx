import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { lerComprovante, obterPericia, registrarComparecimento, registrarMarcacao, tarefasDoJuridicoAdm } from '../dados/pericia.ts'
import { iniciarPerfil } from '../dados/perfis.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAdvogada } from './CentralAdvogada.tsx'
import { ProcessoPericia } from './ProcessoPericia.tsx'
import { ResultadoPericia } from './ResultadoPericia.tsx'

let agora = new Date(2026, 9, 7, 10, 0)

beforeEach(async () => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  iniciarPerfil('?perfil=advogada')
  // A semente nasce em 07/10; o Antônio vai à perícia do juízo em 16/10, 10:30, e o caso passa a esperar o resultado.
  await obterPericia('antonio-exemplo-1')
  agora = new Date(2026, 9, 16, 14, 0)
  await registrarComparecimento('antonio-exemplo-1', { compareceu: true }, 'Igor (exemplo)')
  agora = new Date(2026, 9, 20, 9, 0)
})

const pdf = (nome: string) => new File([`conteúdo de ${nome}`], nome, { type: 'application/pdf' })

async function abrirEAnexar(nome: string) {
  render(<ResultadoPericia processoId="antonio-exemplo-1" />)
  await screen.findByRole('heading', { name: 'Antônio Exemplo · Conferir resultado da perícia' })
  fireEvent.change(screen.getByLabelText(/Laudo ou registro do GERID/), { target: { files: [pdf(nome)] } })
  return within(await screen.findByRole('region', { name: 'Resumo do laudo pela IA' }))
}

const conferirTudo = () => {
  for (const c of screen.getByRole('region', { name: 'Conferência (você decide; a IA só resume)' }).querySelectorAll('input')) fireEvent.click(c)
}

describe('GGVP-70 · conferir o resultado (Figma 14:556 e 1579:431)', () => {
  it('CA5, CA8 · o resumo do laudo pela IA, com a jurimetria do perito do sistema (G22); registrar só com tudo respondido', async () => {
    const resumo = await abrirEAnexar('laudo_pericia_antonio.pdf')
    expect(resumo.getByText('Favorável · incapacidade para o trabalho habitual')).toBeTruthy()
    expect(resumo.getByText('71% favorável em 34 laudos · amostra suficiente (G22)')).toBeTruthy()
    const registrar = screen.getByRole('button', { name: 'Registrar resultado' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Informe se o resultado foi favorável ou desfavorável.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Favorável — seguir' }))
    expect(screen.getByText('Marque as conferências antes de registrar.')).toBeTruthy()
    conferirTudo()
    expect(registrar.disabled).toBe(false)
    expect(screen.getByText('Jurimetria com amostra baixa aparece como insuficiente e não chega ao cliente (G22).')).toBeTruthy()
  })

  it('CA2, CA6 · favorável no judicial: o feito diz como volta ao juízo, com o prazo de 15 dias (G12)', async () => {
    await abrirEAnexar('laudo_pericia_antonio.pdf')
    fireEvent.click(screen.getByRole('radio', { name: 'Favorável — seguir' }))
    conferirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    const feito = within(await screen.findByRole('region', { name: '✓ Resultado registrado: favorável' }))
    expect(
      feito.getByText(/O resultado subiu no card e voltou para quem pediu \(D3a · pedido do juiz\): volta ao judicial \(D3a\): manifestar sobre o laudo, até 04\/11 \(15 dias, G12\)/),
    ).toBeTruthy()
  })

  it('CA3 · desfavorável: a IA diz por que e indica; a advogada pede nova perícia e o Jurídico administrativo marca de novo', async () => {
    const resumo = await abrirEAnexar('laudo_desfavoravel_antonio.pdf')
    expect(resumo.getByText('O perito não comentou os laudos e os exames do escritório, que mostram a limitação há mais de um ano.')).toBeTruthy()
    expect(resumo.getByText('Indicação da IA: sim. Fica no histórico; quem decide é você.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Desfavorável — avaliar nova perícia' }))
    conferirTudo()
    expect(screen.getByText('Desfavorável: decida se vale pedir nova perícia.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, pedir nova perícia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    expect(await screen.findByRole('heading', { name: '✓ Resultado registrado: desfavorável' })).toBeTruthy()
    expect(screen.getByText(/Nova perícia pedida: o Jurídico administrativo marca de novo, sem contar como remarcação/)).toBeTruthy()
    expect(tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'antonio-exemplo')?.acao).toBe('Marcar perícia')
  })

  it('CA4 · desfavorável e não vale: volta à origem marcado como desfavorável', async () => {
    await abrirEAnexar('laudo_desfavoravel_antonio.pdf')
    fireEvent.click(screen.getByRole('radio', { name: 'Desfavorável — avaliar nova perícia' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Não, devolver com resultado desfavorável' }))
    conferirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    expect(await screen.findByRole('heading', { name: '✓ Resultado registrado: desfavorável' })).toBeTruthy()
    expect(screen.getByText(/voltou para quem pediu \(D3a · pedido do juiz\)/)).toBeTruthy()
  })

  it('a página do processo: o resultado no card e o prazo para manifestar (Figma 1579:117)', async () => {
    await abrirEAnexar('laudo_pericia_antonio.pdf')
    fireEvent.click(screen.getByRole('radio', { name: 'Favorável — seguir' }))
    conferirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    await screen.findByRole('heading', { name: '✓ Resultado registrado: favorável' })
    render(<ProcessoPericia processoId="antonio-exemplo-1" />)
    const pericias = within(await screen.findByRole('region', { name: 'Perícias' }))
    expect(pericias.getByText('Favorável')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Prazos' })).getByText('Manifestação sobre o laudo (15 dias, G12)')).toBeTruthy()
  })
})

describe('GGVP-70 · o chat da advogada (Figma 2107:667 e 2186:2)', () => {
  it('CA9 · "perícias da semana": cada item abre a página do processo, não a Agenda', async () => {
    render(<CentralAdvogada />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Quais perícias temos esta semana?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText(/^Uma perícia até 26\/10\. Cada uma abre o processo do cliente, com a perícia em destaque\./)).toBeTruthy()
    const item = within(screen.getByRole('list', { name: 'Tarefas sugeridas' })).getByRole('link')
    expect(item.getAttribute('href')).toBe('/casos/pedro-exemplo-1/pericia')
    expect(item.textContent).toContain('Pedro Exemplo · Avaliação social')
    expect(item.textContent).toContain('INSS · 23/10, 09:00')
  })

  it('"como o perito avalia": os números do sistema, a amostra pequena sem porcentagem (G22) e a conferência do resultado', async () => {
    render(<CentralAdvogada />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Como o Dr. A. Prado costuma avaliar problemas de coluna?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText(/Em coluna ainda são poucos laudos \(8\), então a porcentagem não aparece \(G22\)/)).toBeTruthy()
    const itens = within(screen.getByRole('list', { name: 'Tarefas sugeridas' })).getAllByRole('link')
    expect(itens.map((i) => i.getAttribute('href'))).toEqual(['/casos/antonio-exemplo-1/pericia?perito=1', '/casos/antonio-exemplo-1/pericia/resultado'])
    expect(itens[1].textContent).toContain('Antônio Exemplo · Conferir resultado da perícia')
  })
})

describe('GGVP-73 · o laudo atualiza o perfil do perito', () => {
  it('CA1, CA3 · registrado o laudo, o perfil ganha um registro: a versão e o histórico na janela do perito', async () => {
    await abrirEAnexar('laudo_pericia_antonio.pdf')
    fireEvent.click(screen.getByRole('radio', { name: 'Favorável — seguir' }))
    conferirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    const perfil = within(await screen.findByRole('region', { name: 'Perfil do perito' }))
    expect(perfil.getByText(/A IA atualizou o perfil de Dr\. A\. Prado \(exemplo\): versão 35, formada por 35 laudos/)).toBeTruthy()
    fireEvent.click(perfil.getByRole('button', { name: 'Ver o perfil do perito' }))
    const janela = within(screen.getByRole('dialog', { name: 'Dr. A. Prado (exemplo)' }))
    expect(janela.getByText('Histórico do perfil · 35 laudos')).toBeTruthy()
    const ultimos = within(janela.getByRole('list', { name: 'Últimos laudos do perfil' })).getAllByRole('listitem')
    expect(ultimos[0].textContent).toBe('• 20/10 · 0000001-00.2025.4.03.0000 · coluna · favorável')
  })

  it('CA6 · perito não reconhecido: a pergunta de um clique liga o laudo e o perfil é atualizado', async () => {
    const lido = await lerComprovante('maria-exemplo-1', 'comprovante_maria.pdf')
    await registrarMarcacao('maria-exemplo-1', { comprovante: { nome: 'comprovante_maria.pdf' }, lido, pedeDocumentoNovo: false }, 'Igor (exemplo)')
    agora = new Date(2026, 10, 3, 11, 0)
    await registrarComparecimento('maria-exemplo-1', { compareceu: true }, 'Igor (exemplo)')
    render(<ResultadoPericia processoId="maria-exemplo-1" />)
    await screen.findByRole('heading', { name: 'Maria Exemplo · Conferir resultado da perícia' })
    fireEvent.change(screen.getByLabelText(/Laudo ou registro do GERID/), { target: { files: [pdf('laudo_maria.pdf')] } })
    expect(await screen.findByText('perito não identificado: sem jurimetria')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Favorável — seguir' }))
    conferirTudo()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }))
    const pergunta = within(await screen.findByRole('region', { name: 'Quem foi o perito deste laudo?' }))
    expect(pergunta.getByText(/até lá, o laudo fica fora das contas/)).toBeTruthy()
    fireEvent.click(pergunta.getByRole('button', { name: 'Dr. R. Menezes (exemplo) · Perito médico do INSS' }))
    expect(await screen.findByText('Laudo ligado a Dr. R. Menezes (exemplo): o perfil foi atualizado.')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Perfil do perito' })).getByText(/versão 7, formada por 7 laudos/)).toBeTruthy()
  })
})
