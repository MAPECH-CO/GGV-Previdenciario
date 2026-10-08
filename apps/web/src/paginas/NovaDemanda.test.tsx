import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { marcarEntrevista, registrarResultado } from '../dados/agenda.ts'
import { abrirDemanda } from '../dados/novaDemanda.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { NovaDemanda } from './NovaDemanda.tsx'
import { RegistrarFechamento } from './RegistrarFechamento.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(fichaId = 'antonio-exemplo') {
  render(<NovaDemanda fichaId={fichaId} />)
  await screen.findByRole('heading', { level: 1, name: /Nova demanda/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const escolher = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
const demanda = { pretende: 'auxílio-acidente pelo braço', beneficio: 'auxilio-acidente', tipo: 'outro-pedido' as const, abertaPor: 'atendimento' as const }
const marcacao = {
  tipo: 'presencial' as const,
  data: '2026-10-06',
  hora: '10:30',
  duracao: 45,
  com: 'paula',
  gravar: true,
  levar: true,
  pedirFicha: false,
  confirmarHorarioOcupado: true,
}

describe('Nova demanda de quem já é cliente (GGVP-124)', () => {
  it('CA1 · registra o que a pessoa quer e o benefício na mesma ficha, sem cadastro novo', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Antônio Exemplo · Nova demanda')
    expect(screen.getByText('cliente desde 03/2023 · 1 processo na ficha · caso novo, sem cadastro novo')).toBeTruthy()
    expect(botao('Abrir a nova demanda').disabled).toBe(true)
    expect(screen.getByText('Responda o que a pessoa veio fazer.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Outro pedido' }))
    fireEvent.change(screen.getByLabelText('O que a pessoa quer *'), { target: { value: 'auxílio-acidente pelo braço' } })
    escolher('Benefício de interesse *', 'auxilio-acidente')
    fireEvent.click(botao('Abrir a nova demanda'))
    expect(await screen.findByRole('heading', { name: '✓ Nova demanda aberta na mesma ficha' })).toBeTruthy()
    expect(screen.getByText('Marque a entrevista: segue o mesmo caminho de marcar e entrevistar.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Marcar a entrevista' }).getAttribute('href')).toBe('/agenda/marcar/antonio-exemplo')
    const ficha = await obterFicha('antonio-exemplo')
    expect(ficha?.demandas).toHaveLength(1)
  })

  it('CA5 e CA7 · mostra os documentos pessoais que não se pedem de novo e a subpasta do processo novo', async () => {
    await abrir()
    const naFicha = screen.getByRole('region', { name: 'O que já está na ficha' })
    expect(naFicha.textContent).toContain(
      'Documento pessoal (RG), Documento pessoal (CPF), Comprovante de residência, CNIS, CTPS: já estão na pasta, não se pedem de novo.',
    )
    expect(naFicha.textContent).toContain('Aposentadoria por Incapacidade Permanente · Judicial · exigência')
    expect(naFicha.textContent).toContain('com o benefício e o ano, quando a advogada definir o benefício')
    escolher('Benefício de interesse *', 'auxilio-acidente')
    expect(naFicha.textContent).toContain('Número novo, kit novo (contrato e procuração) e a subpasta «AUXÍLIO ACIDENTÁRIO 2026» na pasta do cliente.')
  })

  it('CA8 · recurso e defesa seguem no mesmo processo: não abre demanda', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Recurso ou defesa' }))
    expect(screen.getByText(/Recurso e defesa seguem no mesmo processo: não abre processo novo. Encaminhe ao Jurídico/)).toBeTruthy()
    expect(screen.getByText('Recurso e defesa seguem no mesmo processo: não abre processo novo.')).toBeTruthy()
    expect(botao('Abrir a nova demanda').disabled).toBe(true)
  })

  it('CA9 · aberta pela advogada, a tela avisa que o Atendimento liga para o cliente', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Tentar de novo depois de perder' }))
    fireEvent.change(screen.getByLabelText('O que a pessoa quer *'), { target: { value: 'tentar de novo o auxílio' } })
    escolher('Benefício de interesse *', 'incapacidade-temporaria')
    escolher('Quem abre a demanda *', 'advogada')
    fireEvent.click(botao('Abrir a nova demanda'))
    expect(await screen.findByText('O Atendimento recebeu a tarefa "Ligar para o cliente" para marcar a entrevista.')).toBeTruthy()
    expect(screen.getByText('Você (Advogada) · 05/10')).toBeTruthy()
  })

  it('CA2 · com a entrevista feita, leva ao "Fechou com o escritório?"', async () => {
    await abrirDemanda('antonio-exemplo', demanda)
    const r = await marcarEntrevista('antonio-exemplo', marcacao)
    if (r.resultado !== 'marcado') throw new Error(r.resultado)
    await registrarResultado(r.agendamento.id, 'realizado')
    await abrir()
    expect(screen.getByText('Entrevista feita em 06/10: registre se fechou com o escritório.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Registrar fechamento' }).getAttribute('href')).toBe('/clientes/antonio-exemplo/fechamento')
  })

  it('lead não abre nova demanda', async () => {
    await abrir('josefa-exemplo')
    expect(screen.getByText(/Nova demanda é para quem já é cliente: Josefa ainda é lead./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir a nova demanda' })).toBeNull()
  })
})

describe('Registrar fechamento da nova demanda (GGVP-124)', () => {
  beforeEach(async () => {
    await abrirDemanda('antonio-exemplo', demanda)
    const r = await marcarEntrevista('antonio-exemplo', marcacao)
    if (r.resultado !== 'marcado') throw new Error(r.resultado)
    await registrarResultado(r.agendamento.id, 'realizado')
    render(<RegistrarFechamento fichaId="antonio-exemplo" />)
    await screen.findByRole('heading', { level: 1, name: /Registrar fechamento/ })
  })

  it('CA3 e CA7 · "Sim, fechou": processo novo na mesma ficha, com a subpasta do benefício e do ano', async () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, fechou' }))
    expect(screen.getByText(/Processo novo de Auxílio Acidentário, o benefício que a advogada definiu, na mesma ficha/)).toBeTruthy()
    fireEvent.click(botao('Registrar fechamento'))
    expect(await screen.findByRole('heading', { name: '✓ Fechou: Auxílio Acidentário é processo novo na mesma ficha' })).toBeTruthy()
    expect(screen.getByText('Segue para o kit do benefício (D1.15), com a subpasta «AUXÍLIO ACIDENTÁRIO 2026» na pasta do cliente.')).toBeTruthy()
  })

  it('"Não fechou": sem recontato, a demanda se encerra com o motivo (G16)', async () => {
    expect(screen.queryByRole('radio', { name: 'Sim, agendar recontato' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Não fechou' }))
    expect(screen.queryByLabelText('Recontatar em *')).toBeNull()
    escolher('Motivo *', 'preco')
    fireEvent.click(botao('Registrar e encerrar a demanda'))
    expect(await screen.findByRole('heading', { name: '✓ Nova demanda encerrada com o motivo' })).toBeTruthy()
    expect(screen.getByText('Preço. Antônio segue cliente nos outros processos.')).toBeTruthy()
  })
})
