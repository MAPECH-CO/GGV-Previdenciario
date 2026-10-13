import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { chamadaIa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import type { Arquivo, Ficha } from '../../../web/src/dados/tipos.ts'
import { criarLeitor } from './leitura.ts'

// GGVP-158 P4.1: a leitura do documento do balcão vem do conteúdo, pela IA; o código confere antes de guardar.

let banco: Banco
let fechar: () => Promise<void>
let quem: string
const CHAVES = { OPENAI_API_KEY: 'chave-de-teste-openai' }
const AGORA = new Date('2026-10-13T15:00:00Z')
const PDF = { bytes: new TextEncoder().encode('%PDF-1.4 o CNIS digitalizado'), mime: 'application/pdf' }
/** Outro arquivo: o mesmo arquivo lido de novo devolve a leitura guardada (a sugestão pronta), sem chamar a IA. */
const OUTRO_PDF = { bytes: new TextEncoder().encode('%PDF-1.4 outra digitalização'), mime: 'application/pdf' }
const ficha = { id: 'f1', nome: 'Maria Exemplo', cpf: '52998224725', arquivos: [] } as unknown as Ficha
const arquivo = (nome: string, tipo = 'cnis'): Arquivo => ({ nome, tipo, local: 'pessoais', data: '2026-10-13', origem: 'card', repetido: false, aguardaLeitura: true })

/** A IA de mentira devolve esta leitura; o que ela recebeu fica no `fetch`. */
const servico = (lido: object) =>
  vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(lido) } }] })))
const LIDO = { tipo: 'cnis', data: '2026-09-30', nome: 'Maria Exemplo', cpf: '529.982.247-25', rg: '', endereco: '', assinado: null, dataEmBranco: false, legivel: true, confianca: 92, emitente: '', registro: '' }

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const [u] = await banco.insert(usuario).values({ email: 'ana@exemplo.ggv', nome: 'ana', senhaHash: 'x', perfis: ['atendimento'] }).returning()
  quem = u.id
})
afterEach(() => fechar())

describe('GGVP-158 P4.1 · a IA lê o conteúdo do documento do balcão', () => {
  it('o CNIS lido pelo conteúdo: tipo, data, nome e CPF da IA, a conferir; o arquivo foi junto ao modelo', async () => {
    const fetch = servico(LIDO)
    const leitor = criarLeitor({ ia: criarIa({ banco, ambiente: CHAVES, fetch }), agora: () => AGORA })
    const l = await leitor.documento({ ficha, arquivo: arquivo('Documento - 2026-10-13.pdf', 'outro'), leituras: [], conteudo: PDF, quem })
    expect(l).toMatchObject({ tipo: 'cnis', data: '2026-09-30', confianca: 92, lidos: { nome: 'Maria Exemplo', cpf: '52998224725' }, situacao: 'a-conferir', lidoEm: AGORA.toISOString() })
    expect(String(fetch.mock.calls[0][1]?.body)).toContain(Buffer.from(PDF.bytes).toString('base64'))
    expect((await banco.select().from(chamadaIa))[0]).toMatchObject({ finalidade: 'ler_documento_balcao', situacao: 'ok', pedidaPor: quem })
  })

  it('o nome do arquivo não conta: "sem assinatura" e "ilegível" no nome não mudam a leitura; a IA é que aponta', async () => {
    const ia = criarIa({ banco, ambiente: CHAVES, fetch: servico({ ...LIDO, tipo: 'procuracao', assinado: true }) })
    const l = await criarLeitor({ ia }).documento({ ficha, arquivo: arquivo('Procuracao sem assinatura ilegivel.pdf', 'procuracao'), leituras: [], conteudo: PDF, quem })
    expect([l?.semAssinatura, l?.situacao, l?.confianca]).toEqual([undefined, 'a-conferir', 92])
    const falta = criarIa({ banco, ambiente: CHAVES, fetch: servico({ ...LIDO, tipo: 'procuracao', assinado: false, dataEmBranco: true }) })
    const sem = await criarLeitor({ ia: falta }).documento({ ficha, arquivo: arquivo('Procuracao.pdf', 'procuracao'), leituras: [], conteudo: OUTRO_PDF, quem })
    expect([sem?.semAssinatura, sem?.dataEmBranco]).toEqual([true, true])
  })

  it('o que não confere fica de fora: CPF inválido, data impossível e tipo fora do catálogo (vale o anunciado)', async () => {
    const ia = criarIa({ banco, ambiente: CHAVES, fetch: servico({ ...LIDO, tipo: 'certidao-de-marte', cpf: '111.111.111-11', data: '2026-02-30' }) })
    const l = await criarLeitor({ ia }).documento({ ficha, arquivo: arquivo('CNIS.pdf'), leituras: [], conteudo: PDF, quem })
    expect([l?.tipo, l?.data, l?.lidos.cpf, l?.quarentena]).toEqual(['cnis', '2026-10-13', undefined, undefined])
  })

  it('o CPF de outra pessoa põe em quarentena; o ilegível vai como ilegível, com confiança zero', async () => {
    const outro = criarIa({ banco, ambiente: CHAVES, fetch: servico({ ...LIDO, cpf: '111.444.777-35' }) })
    expect((await criarLeitor({ ia: outro }).documento({ ficha, arquivo: arquivo('CNIS.pdf'), leituras: [], conteudo: PDF, quem }))?.situacao).toBe('quarentena')
    const borrado = criarIa({ banco, ambiente: CHAVES, fetch: servico({ ...LIDO, legivel: false }) })
    const l = await criarLeitor({ ia: borrado }).documento({ ficha, arquivo: arquivo('CNIS.pdf'), leituras: [], conteudo: OUTRO_PDF, quem })
    expect([l?.situacao, l?.confianca]).toEqual(['ilegivel', 0])
  })

  it('sem IA (sem chave, ou documento médico sem a autorização): a conferir, com confiança zero e o tipo anunciado', async () => {
    const fetch = servico(LIDO)
    const semChave = await criarLeitor({ ia: criarIa({ banco, ambiente: {}, fetch }) }).documento({ ficha, arquivo: arquivo('CNIS.pdf'), leituras: [], conteudo: PDF, quem })
    expect([semChave?.tipo, semChave?.confianca, semChave?.situacao, semChave?.lidos]).toEqual(['cnis', 0, 'a-conferir', {}])
    const laudo = await criarLeitor({ ia: criarIa({ banco, ambiente: CHAVES, fetch }) }).documento({ ficha, arquivo: arquivo('Laudo.pdf', 'laudo'), leituras: [], conteudo: PDF, quem })
    expect([laudo?.confianca, fetch.mock.calls.length]).toEqual([0, 0])
    expect((await banco.select().from(chamadaIa)).map((c) => c.situacao)).toEqual(['desligada', 'recusada'])
  })

  it('sem o conteúdo, a leitura de verdade espera (nulo); a de exemplo, só nos testes de tela, lê pelo nome', async () => {
    const fetch = servico(LIDO)
    expect(await criarLeitor({ ia: criarIa({ banco, ambiente: CHAVES, fetch }) }).documento({ ficha, arquivo: arquivo('CNIS.pdf'), leituras: [], quem })).toBeNull()
    const exemplo = await criarLeitor({ ia: criarIa({ banco, ambiente: CHAVES, fetch }), simulada: true }).documento({ ficha, arquivo: arquivo('CNIS ilegivel.pdf'), leituras: [], quem })
    expect([exemplo?.situacao, fetch.mock.calls.length]).toEqual(['ilegivel', 0])
  })
})
