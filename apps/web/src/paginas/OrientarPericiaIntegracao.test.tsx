import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as dados from '../dados/pericia.ts'
import { configurarExemplo } from '../dados/servidor.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { OrientarPericia } from './OrientarPericia.tsx'
const CASO = '11111111-1111-4111-8111-111111111111'
const FICHA = '22222222-2222-4222-8222-222222222222'
const TEXTO = 'Orientação inventada para o teste: chegue trinta minutos antes.'
function estado(registrada = false): dados.PericiaNaTela {
  const processo = { id: CASO, beneficio: 'beneficio-ficticio', etapa: 'Em perícia' }
  const quando = '2026-10-09T12:00:00Z'
  return {
    ficha: { id: FICHA, nome: 'Pessoa Inventada Teste', telefone: '11900000000', processos: [processo],
      situacao: 'cliente', desde: '10/2026', senhaGov: { situacao: 'sem-senha' }, fichaAtendimentoPreenchida: false,
      agendamentos: [], contatos: [], documentos: [], transcricoes: 0, historico: [], arquivos: [],
    },
    processo, beneficio: 'Benefício fictício', situacao: 'agendada', etapa: 'Em perícia', lembreteHoje: false, jaPassou: false, anteriores: [],
    pericia: {
      id: '33333333-3333-4333-8333-333333333333', processoId: CASO, fichaId: FICHA, tipo: 'medica', instancia: 'juizo',
      origem: 'd3a-juiz', pedidaPor: 'Pessoa Inventada', pedidaEm: quando, abertaEm: quando, tentativas: [], remarcacoes: 0, historico: [],
      marcacao: { data: '2030-10-20', hora: '10:30', local: 'Local fictício', modalidade: 'Presencial', tipo: 'medica', origem: 'juizo', registradaEm: quando, registradaPor: 'Sistema' },
      orientacao: { texto: TEXTO, modo: 'padrao', motivo: 'perfil ainda indisponível', geradaEm: quando },
      ...(registrada && { preparacao: { texto: TEXTO, canal: 'chatwoot', quem: 'Pessoa Inventada', quando } }),
    },
  }
}
beforeEach(() => {
  configurarExemplo({ servidor: true, latencia: 0 })
  entrarComo('juridico-adm')
  vi.spyOn(dados, 'sugerirOrientacao').mockResolvedValue({ texto: null, sugestao: null, motivo: null })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); configurarExemplo({ servidor: false }) })
function servir(status: string) {
  const ordem: string[] = []
  vi.spyOn(dados, 'obterPericia').mockResolvedValue(estado())
  vi.spyOn(dados, 'enviarOrientacao').mockImplementation(async () => { ordem.push('registrar'); return estado(true) })
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { ordem.push('enviar'); return new Response(JSON.stringify({ status, erro: 'Falha inventada', texto: TEXTO })) }
    return new Response(JSON.stringify({ modelo: 'pericia-orientacao', texto: 'Modelo inventado', editavel: true, trava: null, contato: null, conversas: [], simulado: false }))
  }))
  return ordem
}
async function abrirEnvio() {
  render(comSessao(<OrientarPericia processoId={CASO} />))
  await screen.findByRole('heading', { name: 'Pessoa Inventada Teste · Orientar para a perícia' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Revisei a orientação' }))
  fireEvent.click(screen.getByRole('button', { name: 'Enviar orientação' }))
  const botao = await screen.findByRole('button', { name: 'Enviar pelo Chatwoot' })
  await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(botao)
}
describe('Tela real da orientação', () => {
  it('envia pela API antes de registrar a orientação no caso', async () => {
    const ordem = servir('enviada')
    await abrirEnvio()
    await screen.findByText(/Conclusão registrada no caso/)
    expect(ordem).toEqual(['enviar', 'registrar'])
  })
  it('não registra a orientação se a mensagem não saiu', async () => {
    const ordem = servir('falhou')
    await abrirEnvio()
    await screen.findByText(/A orientação não saiu pelo Chatwoot/)
    expect(ordem).toEqual(['enviar'])
  })
  it('permite revisar e enviar o registro antigo sem afirmar que ele já foi enviado', async () => {
    servir('enviada')
    vi.mocked(dados.obterPericia).mockResolvedValue(estado(true))
    render(comSessao(<OrientarPericia processoId={CASO} />))
    const botao = await screen.findByRole('button', { name: 'Enviar orientação registrada' })
    expect((botao as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisei a orientação registrada' }))
    expect((botao as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText(/este registro sozinho não comprova envio/)).toBeTruthy()
  })
})
