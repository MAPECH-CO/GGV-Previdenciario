import { describe, expect, it } from 'vitest'
import { fonteAasp, URL_AASP } from './aasp.ts'

// Respostas gravadas no formato da AASP (sonda de 07/10), com texto e processos inventados: nada de dado real.
const CHAVE = 'chave-de-teste-0123456789abcdef'
const intimacao = (processo: string, texto: string, dia = '2026-10-06') => ({
  jornal: { nomeJornal: 'DJENTRF3', dataDisponibilizacao_Publicacao: `${dia}T00:00:00`, termoReferenciaData: 'Disponibilização' },
  textoPublicacao: texto,
  titulo: '1ª Turma (exemplo)',
  cabecalho: 'Cabeçalho do diário (exemplo)',
  rodape: '',
  numeroPublicacao: 1,
  numeroArquivo: 1,
  codigoRelacionamento: 1,
  numeroUnicoProcesso: processo,
})
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

function redeGravada(respostas: Response[]) {
  const pedidos: URL[] = []
  const esperas: number[] = []
  const buscar = (async (entrada: string | URL | Request) => {
    pedidos.push(new URL(String(entrada)))
    return respostas.shift() ?? json({ intimacoes: [], erro: false, status: 'Sucesso' })
  }) as typeof fetch
  return { pedidos, esperas, rede: { buscar, esperar: async (ms: number) => void esperas.push(ms) } }
}

// Rodada das 08:00 de 07/10, em Brasília: a janela cobre 06/10 e 07/10.
const DE = new Date('2026-10-06T11:00:00Z')
const ATE = new Date('2026-10-07T11:00:00Z')

describe('fonte AASP (grupo 4, decisões 45 e 47)', () => {
  it('pede um dia por vez, para cada chave, e mapeia processo, data e texto', async () => {
    const { pedidos, esperas, rede } = redeGravada([
      json({ intimacoes: [intimacao('0001234-96.2026.4.03.6301', 'Intime-se a parte autora (exemplo).')], erro: false, status: 'Sucesso' }),
    ])
    const lista = await fonteAasp([CHAVE], ['TRF3', 'TJSP'], rede).buscar(DE, ATE)
    expect(pedidos.map((u) => `${u.origin}${u.pathname}`)).toEqual([URL_AASP, URL_AASP])
    expect(pedidos.map((u) => u.searchParams.get('data'))).toEqual(['2026-10-06', '2026-10-07'])
    expect(pedidos.every((u) => u.searchParams.get('chave') === CHAVE)).toBe(true)
    expect(esperas).toEqual([500])
    expect(lista).toEqual([
      { fonte: 'aasp', numeroCnj: '00012349620264036301', disponibilizadaEm: '2026-10-06', texto: 'Intime-se a parte autora (exemplo).', partes: null },
    ])
  })

  it('só ficam os tribunais da vigília; sem número de processo, segue para a fila de revisão', async () => {
    const { rede } = redeGravada([
      json({
        intimacoes: [
          intimacao('0001234-96.2026.4.03.6301', 'Do TRF3 (exemplo).'),
          intimacao('1000123-45.2026.8.26.0100', 'Do TJSP (exemplo).'),
          intimacao('1000999-11.2026.5.02.0001', 'Da Justiça do Trabalho (exemplo).'),
          intimacao('', 'Sem número do processo (exemplo).'),
        ],
        erro: false,
        status: 'Sucesso',
      }),
    ])
    const lista = await fonteAasp([CHAVE], ['TRF3', 'TJSP'], rede).buscar(DE, new Date('2026-10-06T20:00:00Z'))
    expect(lista.map((p) => [p.numeroCnj, p.texto])).toEqual([
      ['00012349620264036301', 'Do TRF3 (exemplo).'],
      ['10001234520268260100', 'Do TJSP (exemplo).'],
      [null, 'Sem número do processo (exemplo).'],
    ])
  })

  it('chave recusada vira falha de credencial, que avisa o suporte, sem a chave nem a URL na mensagem (GGVP-30 CA8)', async () => {
    const { rede } = redeGravada([json({}, 401)])
    const erro = await fonteAasp(['outra', CHAVE], ['TRF3'], rede)
      .buscar(DE, DE)
      .then(
        () => null,
        (e: Error) => e.message,
      )
    expect(erro).toBe('credencial: a AASP recusou a chave 1 de 2 (HTTP 401)')
  })

  it('erro da AASP vira falha da API, sem a chave, mesmo que a resposta a repita', async () => {
    const http = redeGravada([json({}, 500)])
    await expect(fonteAasp([CHAVE], ['TRF3'], http.rede).buscar(DE, DE)).rejects.toThrow('api: a AASP respondeu 500')
    const comErro = redeGravada([json({ intimacoes: null, erro: true, status: `Chave ${CHAVE} inválida` })])
    const mensagem = await fonteAasp([CHAVE], ['TRF3'], comErro.rede)
      .buscar(DE, DE)
      .then(
        () => '',
        (e: Error) => e.message,
      )
    expect(mensagem).toBe('api: a AASP respondeu com erro (Chave *** inválida)')
    expect(mensagem).not.toContain(CHAVE)
    const semRede = {
      buscar: (async () => {
        throw new TypeError(`fetch failed ${URL_AASP}?chave=${CHAVE}`)
      }) as typeof fetch,
      esperar: async () => {},
    }
    const caiu = await fonteAasp([CHAVE], ['TRF3'], semRede)
      .buscar(DE, DE)
      .then(
        () => '',
        (e: Error) => `${e.message} ${String(e.cause ?? '')}`,
      )
    expect(caiu.trim()).toBe('api: a AASP não respondeu')
  })
})
