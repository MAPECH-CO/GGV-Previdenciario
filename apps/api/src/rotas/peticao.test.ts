import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, eventoAuditoria, exigenciaItem, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CITADO_DE_OUTRO_CASO, MSG_NADA_A_PEDIR } from './peticao.ts'

// A petição inicial (GGVP-63, 67, 71), do pedido ao protocolo, pelas rotas de verdade desde o registro do indeferido.
const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-07T13:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', resto: string, payload?: object) =>
  app.inject({ method: metodo, url: `/api/casos/${casoId}${resto}`, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
type Arquivo = { nome: string; mime: string; conteudo: string }
const PDF = (nome: string): Arquivo => ({ nome, mime: 'application/pdf', conteudo: `%PDF-1.4 ${nome}` })
async function enviar(apelido: string, resto: string, campos: Record<string, string>, arquivo: Arquivo | null) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return app.inject({
    method: 'POST',
    url: `/api/casos/${casoId}${resto}`,
    cookies: await cookieDe(apelido),
    payload: partes.join('') + `--${f}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${f}` },
  })
}
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const ler = async (apelido = 'gabi') => (await chamar(apelido, 'GET', '/peticao')).json()

/** O indeferido com a carta e o motivo (GGVP-48, GGVP-52) e o despacho da Sênior à Documentação (GGVP-54). */
async function despachadoADocumentacao() {
  const [p] = await banco.insert(pessoa).values({ nome: 'Vicente Prado' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
  await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: AGORA })
  await banco.insert(tarefa).values({ casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  const indeferido = { tipo: 'decisao', resultado: 'indeferido', texto: 'Negado.', motivoInss: 'Renda acima do limite', motivoEscrito: 'O INSS somou a renda do filho' }
  expect((await enviar('gabi', '/vigilia', indeferido, PDF('carta.pdf'))).statusCode).toBe(201)
  const despacho = { decisao: 'acionar', itens: [{ setor: 'documentacao', descricao: 'Laudo atualizado', temPrazo: false }] }
  expect((await chamar('helena', 'POST', '/despacho', despacho)).statusCode).toBe(201)
}
const laudoDaDocumentacao = async () => {
  const [item] = await banco.select().from(exigenciaItem).where(eq(exigenciaItem.perfilResponsavel, 'documentacao'))
  expect((await enviar('dora', `/pendencias/itens/${item.id}/prova`, {}, PDF('laudo.pdf'))).statusCode).toBe(201)
  return (await banco.select().from(documento).where(eq(documento.nomeOriginal, 'laudo.pdf')))[0]
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['dora', 'documentacao'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await despachadoADocumentacao()
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-63 · pedir a petição', () => {
  const PEDIDO = { instrucoes: 'Pedir a concessão desde a DER', opcoes: { tutelaUrgencia: true }, texto: 'Excelentíssimo Senhor Juiz Federal...' }

  it('CA1 · com setor pendente, o pedido fica bloqueado e diz quem falta', async () => {
    const x = await ler()
    expect([x.faltam, x.podePedir, x.carta.nome, x.pedido, x.versoes]).toEqual([['Documentação'], true, 'carta.pdf', null, []])
    expect((await chamar('gabi', 'POST', '/peticao/pedido', PEDIDO)).json().erro).toBe(
      'Pedir a petição fica bloqueado até todos os setores subirem o card. Falta: Documentação.',
    )
    expect(await abertas()).toEqual(['advogada · Pedir a petição', 'documentacao · Cumprir pendência'])
  })

  it('CA2, CA6, CA9, CA10 · com tudo fechado, grava as instruções, as opções e os citados na ordem; a versão 1 vai para a conferência', async () => {
    const laudo = await laudoDaDocumentacao()
    let x = await ler()
    expect([x.faltam, x.documentos.map((d: { nome: string }) => d.nome)]).toEqual([[], ['laudo.pdf']])
    const r = await chamar('gabi', 'POST', '/peticao/pedido', { ...PEDIDO, citados: [{ documentoId: laudo.id }, { nome: 'CNIS atualizado' }] })
    expect(r.statusCode).toBe(201)
    x = await ler()
    expect(x.pedido).toEqual({
      por: 'gabi',
      em: AGORA.toISOString(),
      instrucoes: 'Pedir a concessão desde a DER',
      opcoes: { tutelaUrgencia: true, precedentes: false, anexarCitados: true },
      citados: [
        { documentoId: laudo.id, nome: 'laudo.pdf' },
        { documentoId: null, nome: 'CNIS atualizado' },
      ],
    })
    expect([x.versoes.map((v: { numero: number; por: string }) => [v.numero, v.por]), x.atual, x.podePedir]).toEqual([
      [[1, 'gabi']],
      { numero: 1, texto: 'Excelentíssimo Senhor Juiz Federal...' },
      false,
    ])
    expect(await abertas()).toEqual(['advogada · Conferir petição'])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'peticao_pedida'))
    expect((ev.detalhe as { versao: number }).versao).toBe(1)
    expect((await chamar('gabi', 'POST', '/peticao/pedido', PEDIDO)).json().erro).toBe(MSG_NADA_A_PEDIR)
  })

  it('CA9 · o texto é obrigatório; só a advogada pede; documento de outro caso não entra', async () => {
    await laudoDaDocumentacao()
    expect((await chamar('gabi', 'POST', '/peticao/pedido', { texto: ' ' })).json().erro).toBe('Escreva ou cole o texto da petição (versão 1)')
    expect((await chamar('helena', 'POST', '/peticao/pedido', PEDIDO)).statusCode).toBe(403)
    const [outro] = await banco.insert(pessoa).values({ nome: 'Outra' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: outro.id }).returning()
    const [doc] = await banco
      .insert(documento)
      .values({ casoId: c.id, tipo: 'x', chaveArmazenamento: 'outro/doc', nomeOriginal: 'doc.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'x', origem: 'portal' })
      .returning()
    expect((await chamar('gabi', 'POST', '/peticao/pedido', { ...PEDIDO, citados: [{ documentoId: doc.id }] })).json().erro).toBe(MSG_CITADO_DE_OUTRO_CASO)
    expect(await abertas()).toEqual(['advogada · Pedir a petição'])
  })
})
