import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, configuracao, decisao, documento, etapa, eventoAuditoria, exigenciaItem, identificadorCaso, pessoa, peticao, peticaoVersao, tarefa, usuario } from '../banco/esquema.ts'
import { MSG_SEM_REFERENCIA } from '../ia/acervo.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_COMPROVANTE } from './manifestacao.ts'
import { MSG_CITADO_DE_OUTRO_CASO, MSG_CITADO_NAO_FALTA, MSG_CNJ_DE_OUTRO_CASO, MSG_DOCUMENTO_QUE_FALTA, MSG_NADA_A_CONFERIR, MSG_NADA_A_PEDIR, MSG_PROTOCOLADA, MSG_SO_A_ULTIMA } from './peticao.ts'

// A petição inicial (GGVP-63, 67, 71), do pedido ao protocolo, pelas rotas de verdade desde o registro do indeferido.
const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-07T13:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let arquivos: Armazenamento
let pastaArquivos: string
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
  pastaArquivos = mkdtempSync(join(tmpdir(), 'arq-'))
  arquivos = armazenamentoLocal(pastaArquivos)
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: arquivos })
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
    const [b] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))
    expect(b.detalhe).toMatchObject({ portao: 'setores', passo: 'D3.05', faltam: 1 })
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
        { documentoId: laudo.id, nome: 'laudo.pdf', pedidoADocumentacao: false },
        { documentoId: null, nome: 'CNIS atualizado', pedidoADocumentacao: false },
      ],
    })
    expect([x.versoes.map((v: { numero: number; por: string }) => [v.numero, v.por]), x.atual, x.podePedir]).toEqual([
      [[1, 'gabi']],
      { numero: 1, texto: 'Excelentíssimo Senhor Juiz Federal...', diferenca: null },
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

describe('Épico IA · a minuta da petição inicial', () => {
  const MINUTA = 'EXCELENTÍSSIMO SENHOR JUIZ FEDERAL DO JUIZADO ESPECIAL FEDERAL... (laudo.pdf) ... [completar: valor da causa]'
  let pedidos: string[] = []
  beforeEach(() => {
    pedidos = []
    const fetch = async (_url: unknown, init?: RequestInit) => {
      pedidos.push(String(init?.body))
      return new Response(JSON.stringify({ choices: [{ message: { content: MINUTA } }] }))
    }
    app = criarServidor({ banco, agora: () => AGORA, armazenamento: arquivos, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }) })
  })

  it('com setor pendente, a minuta espera; com tudo fechado, a IA escreve com o caso e as fontes, e nada é gravado', async () => {
    expect((await chamar('gabi', 'POST', '/peticao/minuta', { instrucoes: '' })).json().erro).toBe('A minuta espera todos os setores subirem o card. Falta: Documentação.')
    const laudo = await laudoDaDocumentacao()
    const corpo = { instrucoes: 'Pedir desde a DER', opcoes: { tutelaUrgencia: true }, citados: [{ documentoId: laudo.id }, { nome: 'CNIS atualizado' }] }
    const r = (await chamar('gabi', 'POST', '/peticao/minuta', corpo)).json()
    expect([r.sugestao.texto, r.sugestao.sugestao, r.motivo, r.aviso]).toEqual([MINUTA, true, null, null])
    expect(r.sugestao.fontes.map((f: { tipo: string; trecho?: string }) => [f.tipo, f.trecho])).toEqual([
      ['documento', 'laudo.pdf'],
      ['caso', 'O INSS somou a renda do filho'],
    ])
    const enviado = JSON.parse(pedidos[0]).messages[1].content as string
    for (const trecho of ['Vicente Prado', 'BPC/LOAS Idoso', 'O INSS somou a renda do filho', 'Laudo atualizado', 'laudo.pdf; CNIS atualizado (ainda falta)', 'Tutela de urgência: pedir', 'Pedir desde a DER'])
      expect(enviado).toContain(trecho)
    expect((await ler()).pedido).toBeNull()
    expect(await abertas()).toEqual(['advogada · Pedir a petição'])
  })

  it('"usar precedentes" com o acervo vazio avisa "sem referência na casa"; a versão 1 pedida da minuta fica marcada', async () => {
    await laudoDaDocumentacao()
    const r = (await chamar('gabi', 'POST', '/peticao/minuta', { opcoes: { precedentes: true } })).json()
    expect(r.aviso).toBe(MSG_SEM_REFERENCIA)
    expect((await chamar('gabi', 'POST', '/peticao/pedido', { texto: MINUTA, chamadaIaId: r.sugestao.chamadaId })).statusCode).toBe(201)
    const [v] = await banco.select().from(peticaoVersao)
    expect([v.numero, v.geradaPor, v.conteudo]).toEqual([1, 'gabi · minuta da IA', MINUTA])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'peticao_pedida'))
    expect((ev.detalhe as { chamadaIa: string }).chamadaIa).toBe(r.sugestao.chamadaId)
  })

  it('GGVP-45 CA1, CA4, CA6 · "usar precedentes" leva à IA a petição aprovada de outro caso parecido, sem os dados do outro cliente', async () => {
    await laudoDaDocumentacao()
    const [p] = await banco.insert(pessoa).values({ nome: 'Rosa Antunes' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
    const [pet] = await banco.insert(peticao).values({ casoId: c.id, tipo: 'inicial' }).returning()
    const tese = 'Rosa Antunes, CPF 111.222.333-44: a renda do filho maior que mora à parte não entra no cálculo da renda per capita do grupo familiar.'
    await banco.insert(peticaoVersao).values({ peticaoId: pet.id, numero: 1, conteudo: tese, hash: 'h', geradaPor: 'gabi', aprovadaEm: AGORA })
    const r = (await chamar('gabi', 'POST', '/peticao/minuta', { opcoes: { precedentes: true } })).json()
    const doAcervo = r.sugestao.fontes.filter((f: { tipo: string }) => f.tipo === 'acervo')
    expect([r.aviso, doAcervo.length, doAcervo[0].referencia]).toEqual([null, 1, `caso:${c.id}`])
    const enviado = JSON.parse(pedidos[0]).messages[1].content as string
    expect(enviado).toContain('Trechos do acervo da casa')
    expect(enviado).toContain('a renda do filho maior que mora à parte')
    for (const dado of ['Rosa', 'Antunes', '111.222.333-44']) expect(enviado).not.toContain(dado)
  })

  it('sem a IA, a tela recebe o motivo e a advogada escreve como antes', async () => {
    app = criarServidor({ banco, agora: () => AGORA, armazenamento: arquivos, ia: criarIa({ banco, ambiente: {} }) })
    await laudoDaDocumentacao()
    expect((await chamar('gabi', 'POST', '/peticao/minuta', {})).json()).toEqual({ sugestao: null, motivo: 'A IA não escreveu agora: escreva ou cole a versão 1.', aviso: null })
  })
})

describe('GGVP-67 · conferir a petição', () => {
  const V1 = 'Dos fatos\nDo direito\nDo pedido'
  const MARCACOES = { liNaIntegra: true, conferem: true, nadaContradiz: true }
  const editar = (texto: string, oQueMudou = 'Ajustei') => chamar('gabi', 'POST', '/peticao/versoes', { texto, oQueMudou })
  const aprovar = (n: number, corpo: object = MARCACOES, apelido = 'gabi') => chamar(apelido, 'POST', `/peticao/versoes/${n}/aprovacao`, corpo)

  beforeEach(async () => {
    const laudo = await laudoDaDocumentacao()
    expect((await chamar('gabi', 'POST', '/peticao/pedido', { texto: V1, citados: [{ documentoId: laudo.id }] })).statusCode).toBe(201)
  })

  it('CA4, CA11 · "Conferir petição" mostra a versão inteira; na versão 1 não há o que comparar', async () => {
    expect(await abertas()).toEqual(['advogada · Conferir petição'])
    const x = await ler()
    expect([x.atual, x.podeEditar, x.podeAprovar]).toEqual([{ numero: 1, texto: V1, diferenca: null }, true, true])
    expect([(await ler('helena')).podeEditar, (await ler('helena')).podeAprovar]).toEqual([false, false])
  })

  it('CA1, CA3, CA5, CA10 · "Editar eu mesma" grava a versão seguinte com o que mudou; a anterior fica, e a diferença aparece', async () => {
    expect((await editar('x', ' ')).json().erro).toBe('Escreva o que mudou nesta versão')
    expect((await editar('Dos fatos\nDa tutela de urgência\nDo direito\nDo pedido', 'Incluí a tutela')).json()).toEqual({ ok: true, numero: 2 })
    const x = await ler()
    expect(x.versoes.map((v: { numero: number; oQueMudou: string | null }) => [v.numero, v.oQueMudou])).toEqual([
      [1, null],
      [2, 'Incluí a tutela'],
    ])
    expect(x.atual.diferenca).toEqual([
      { tipo: 'igual', texto: 'Dos fatos' },
      { tipo: 'incluido', texto: 'Da tutela de urgência' },
      { tipo: 'igual', texto: 'Do direito' },
      { tipo: 'igual', texto: 'Do pedido' },
    ])
    const [v1] = await banco.select().from(peticaoVersao).where(eq(peticaoVersao.numero, 1))
    expect(v1.conteudo).toBe(V1)
  })

  it('CA2, CA5, CA6, CA9 (G6, G18) · só a última, com as três marcações; fica quem aprovou e o identificador, e o protocolo abre', async () => {
    await editar(V1 + '\nDo valor da causa')
    expect((await aprovar(1)).json().erro).toBe(MSG_SO_A_ULTIMA)
    expect((await aprovar(2, { liNaIntegra: true, conferem: true })).json().erro).toBe('Marque "Nada contradiz o requisito do benefício (G18)"')
    expect((await aprovar(2)).statusCode).toBe(201)
    const x = await ler()
    expect([x.versoes[1].aprovadaPor, x.versoes[1].aprovadaEm, x.podeAprovar]).toEqual(['gabi', AGORA.toISOString(), false])
    expect(await abertas()).toEqual(['advogada · Protocolar na Justiça'])
    const [d] = await banco.select().from(decisao).where(eq(decisao.tipo, 'aprovacao_peticao'))
    expect([d.passo, d.resultado, d.justificativa]).toEqual(['D3.06', 'versao 2', expect.stringContaining('(G18)')])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'peticao_aprovada'))
    expect((ev.detalhe as { hash: string }).hash).toBe(x.versoes[1].hash)
    expect((await aprovar(2)).json().erro).toBe(MSG_NADA_A_CONFERIR)
  })

  it('CA6 · aprovada, o pacote sai na ordem: a petição em PDF com o identificador da versão, a carta e os citados', async () => {
    await aprovar(1)
    const [v] = await banco.select().from(peticaoVersao).where(eq(peticaoVersao.numero, 1))
    const pacote = v.pacote as { documentoId: string; nome: string; hash: string; papel: string }[]
    expect(pacote.map((a) => [a.papel, a.nome])).toEqual([
      ['peticao', 'peticao-inicial-v1.pdf'],
      ['carta', 'carta.pdf'],
      ['citado', 'laudo.pdf'],
    ])
    const [peca] = await banco.select().from(documento).where(eq(documento.id, pacote[0].documentoId))
    expect([peca.tipo, pacote[0].hash]).toEqual(['pacote_peticao', peca.hashSha256])
    expect((await PDFDocument.load(await arquivos.ler(peca.chaveArmazenamento))).getSubject()).toBe(v.hash)
  })

  it('CA7 · mexer na aprovada não a altera: cria a versão seguinte, volta para a conferência e fica no histórico', async () => {
    await aprovar(1)
    expect((await editar(V1 + '\nDo valor da causa', 'Faltou o valor da causa')).json()).toEqual({ ok: true, numero: 2 })
    const [v1] = await banco.select().from(peticaoVersao).where(eq(peticaoVersao.numero, 1))
    expect([v1.conteudo, Boolean(v1.aprovadaPor)]).toEqual([V1, true])
    expect(await abertas()).toEqual(['advogada · Conferir petição'])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'peticao_versao_apos_aprovacao'))
    expect(ev.detalhe).toMatchObject({ numero: 2, aprovada: 1 })
    expect((await ler()).podeAprovar).toBe(true)
  })

  it('CA8 · quem não pode aprovar é recusado no servidor, e a recusa fica registrada', async () => {
    expect((await aprovar(1, MARCACOES, 'helena')).statusCode).toBe(403)
    const negados = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))
    expect(negados.map((e) => (e.detalhe as { acao: string }).acao)).toContain('peticao.aprovar')
  })
})

describe('GGVP-71 · pacote e travas', () => {
  const TEXTO = 'Vicente Prado, CPF 613.748.259-64, vem requerer o benefício.'
  const MARCACOES = { liNaIntegra: true, conferem: true, nadaContradiz: true }
  type Trava = { chave: string; ok: boolean; evidencia: string }
  const travas = async () => Object.fromEntries(((await ler()).travas as Trava[]).map((t) => [t.chave, [t.ok, t.evidencia]]))

  beforeEach(async () => {
    await banco.update(pessoa).set({ cpf: '61374825964' }).where(eq(pessoa.nome, 'Vicente Prado'))
    await banco.insert(configuracao).values({ chave: 'tribunais', valor: [{ nome: 'Justiça Federal', site: 'https://exemplo.jus.br', tamanhoMaximoMb: 10 }] })
    const laudo = await laudoDaDocumentacao()
    await chamar('gabi', 'POST', '/peticao/pedido', { texto: TEXTO, citados: [{ documentoId: laudo.id }, { nome: 'CNIS atualizado' }] })
    expect((await chamar('gabi', 'POST', '/peticao/versoes/1/aprovacao', MARCACOES)).statusCode).toBe(201)
  })

  it('CA1, CA2, CA6, CA7, CA11 · o pacote para baixar e as três travas, cada uma com a evidência; o que falta trava', async () => {
    const x = await ler()
    expect(x.pacote.map((a: { papel: string; nome: string }) => [a.papel, a.nome])).toEqual([
      ['peticao', 'peticao-inicial-v1.pdf'],
      ['carta', 'carta.pdf'],
      ['citado', 'laudo.pdf'],
    ])
    expect([x.tribunais, x.podeProtocolar]).toEqual([[{ nome: 'Justiça Federal', site: 'https://exemplo.jus.br', tamanhoMaximoMb: 10 }], true])
    expect(await travas()).toEqual({
      tema350: [true, 'No pacote: carta.pdf'],
      cpf: [true, 'Na petição: 613.748.259-64 · no cadastro: 613.748.259-64'],
      pacote: [false, 'Falta: CNIS atualizado'],
    })
    expect((await ler('helena')).podeProtocolar).toBe(false)
  })

  it('CA13 · a advogada sobe o documento que falta, e o pacote é gerado de novo com ele', async () => {
    expect((await enviar('gabi', '/peticao/citados/0/documento', {}, PDF('outro.pdf'))).json().erro).toBe(MSG_CITADO_NAO_FALTA)
    expect((await enviar('gabi', '/peticao/citados/1/documento', {}, null)).json().erro).toBe(MSG_DOCUMENTO_QUE_FALTA)
    expect((await enviar('gabi', '/peticao/citados/1/documento', {}, PDF('cnis.pdf'))).statusCode).toBe(201)
    const x = await ler()
    expect(x.pedido.citados[1]).toMatchObject({ nome: 'cnis.pdf', pedidoADocumentacao: false })
    expect(x.pacote.map((a: { nome: string }) => a.nome)).toEqual(['peticao-inicial-v1.pdf', 'carta.pdf', 'laudo.pdf', 'cnis.pdf'])
    expect((await travas()).pacote).toEqual([true, '4 arquivos em PDF: peticao-inicial-v1.pdf, carta.pdf, laudo.pdf, cnis.pdf'])
  })

  it('CA13 · ou pede à Documentação: nasce "Cumprir pendência"; entregue, a advogada escolhe o documento e o pacote fica completo', async () => {
    expect((await chamar('gabi', 'POST', '/peticao/citados/1/pedido')).statusCode).toBe(201)
    expect((await chamar('gabi', 'POST', '/peticao/citados/1/pedido')).json().erro).toBe('Este documento já foi pedido à Documentação.')
    expect(await abertas()).toEqual(['advogada · Protocolar na Justiça', 'documentacao · Cumprir pendência'])
    expect((await ler()).pedido.citados[1].pedidoADocumentacao).toBe(true)
    const [item] = await banco.select().from(exigenciaItem).where(eq(exigenciaItem.descricao, 'Documento para a petição: CNIS atualizado'))
    expect((await enviar('dora', `/pendencias/itens/${item.id}/prova`, {}, PDF('cnis-entregue.pdf'))).statusCode).toBe(201)
    const [entregue] = await banco.select().from(documento).where(eq(documento.nomeOriginal, 'cnis-entregue.pdf'))
    expect((await enviar('gabi', '/peticao/citados/1/documento', { documentoId: entregue.id }, null)).statusCode).toBe(201)
    expect((await travas()).pacote[0]).toBe(true)
  })
})

describe('GGVP-71 · protocolar no tribunal', () => {
  const CNJ = '0001234-96.2026.4.03.6301'
  const CAMPOS = { tribunal: 'Justiça Federal', numeroCnj: CNJ, dataProtocolo: '06/10/2026', conferiTema350: 'true', conferiCpf: 'true', conferiPacote: 'true' }
  const protocolar = (campos: Record<string, string> = CAMPOS, arquivo: Arquivo | null = PDF('comprovante.pdf'), apelido = 'gabi') =>
    enviar(apelido, '/peticao/protocolo', campos, arquivo)

  beforeEach(async () => {
    await banco.update(pessoa).set({ cpf: '61374825964' }).where(eq(pessoa.nome, 'Vicente Prado'))
    await banco.insert(configuracao).values({ chave: 'tribunais', valor: [{ nome: 'Justiça Federal', site: 'https://exemplo.jus.br', tamanhoMaximoMb: 10 }] })
    const laudo = await laudoDaDocumentacao()
    await chamar('gabi', 'POST', '/peticao/pedido', { texto: 'Vicente Prado, CPF 613.748.259-64, vem requerer.', citados: [{ documentoId: laudo.id }] })
    await chamar('gabi', 'POST', '/peticao/versoes/1/aprovacao', { liNaIntegra: true, conferem: true, nadaContradiz: true })
  })

  it('CA5, CA6 · comprovante, número do processo válido, data e a confirmação de cada trava são obrigatórios; só a advogada protocola', async () => {
    expect((await protocolar(CAMPOS, null)).json().erro).toBe(MSG_COMPROVANTE)
    expect((await protocolar({ ...CAMPOS, numeroCnj: '123' })).json().erro).toBe('Número do processo inválido. Confira os 20 dígitos do CNJ.')
    expect((await protocolar({ ...CAMPOS, conferiCpf: 'false' })).json().erro).toBe('Confirme a trava do CPF pela evidência')
    expect((await protocolar({ ...CAMPOS, tribunal: 'Outro' })).json().erro).toBe('Escolha um tribunal da configuração do escritório.')
    expect((await protocolar(CAMPOS, PDF('comprovante.pdf'), 'helena')).statusCode).toBe(403)
    expect(await abertas()).toEqual(['advogada · Protocolar na Justiça'])
  })

  it('CA3 · com uma trava falhando, o protocolo fica bloqueado e diz qual', async () => {
    await banco.update(pessoa).set({ cpf: '52916384782' }).where(eq(pessoa.nome, 'Vicente Prado'))
    expect((await protocolar()).json().erro).toBe('Trava falhando: CPF conferido (Na petição: 613.748.259-64 · no cadastro: 529.163.847-82).')
    const [b] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))
    expect(b.detalhe).toMatchObject({ portao: 'G7', passo: 'D3.07', travas: ['CPF conferido'] })
  })

  it('CA4, CA8, CA10 · registra o protocolo da versão aprovada; o CNJ entra no caso para a vigília, as travas e quem protocolou ficam', async () => {
    expect((await protocolar()).statusCode).toBe(201)
    const x = await ler()
    expect([x.protocolo, x.podeProtocolar]).toEqual([
      { em: '2026-10-06T15:00:00.000Z', numero: '00012349620264036301', tribunal: 'Justiça Federal', por: 'gabi', versao: 1 },
      false,
    ])
    const [cnj] = await banco.select().from(identificadorCaso).where(and(eq(identificadorCaso.casoId, casoId), eq(identificadorCaso.tipo, 'cnj')))
    expect(cnj.valor).toBe('00012349620264036301')
    const travas = await banco.select().from(decisao).where(eq(decisao.tipo, 'trava_g7'))
    expect(travas.map((t) => t.resultado).sort()).toEqual(['cpf', 'pacote', 'tema350'])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'peticao_protocolada'))
    expect(ev.detalhe).toMatchObject({ versao: 1, hash: x.versoes[0].hash, numero: '00012349620264036301' })
    expect(await abertas()).toEqual([])
    expect((await protocolar()).json().erro).toBe(MSG_PROTOCOLADA)
    expect((await chamar('gabi', 'POST', '/peticao/versoes', { texto: 'x', oQueMudou: 'y' })).json().erro).toBe(MSG_PROTOCOLADA)
  })

  it('CA9 · um arquivo do pacote trocado depois da aprovação bloqueia o protocolo e a divergência fica registrada', async () => {
    const [carta] = await banco.select().from(documento).where(eq(documento.nomeOriginal, 'carta.pdf'))
    writeFileSync(join(pastaArquivos, carta.chaveArmazenamento), '%PDF-1.4 outra carta')
    expect((await protocolar()).json().erro).toBe('O pacote mudou depois da aprovação: carta.pdf. O protocolo fica bloqueado; gere o pacote de novo e confira.')
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'pacote_divergente'))
    expect(ev.detalhe).toMatchObject({ arquivos: ['carta.pdf'], versao: 1 })
    expect(await abertas()).toEqual(['advogada · Protocolar na Justiça'])
  })

  it('o mesmo número de processo não vai para dois casos', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Outra' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id }).returning()
    await banco.insert(identificadorCaso).values({ casoId: c.id, tipo: 'cnj', valor: '00012349620264036301' })
    expect((await protocolar()).json().erro).toBe(MSG_CNJ_DE_OUTRO_CASO)
  })
})

