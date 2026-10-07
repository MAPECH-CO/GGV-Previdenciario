import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, etapa, eventoAuditoria, exigencia, exigenciaItem, identificadorCaso, pessoa, protocoloJudicial, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { casarPublicacoes } from '../vigilia/casar.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { MSG_VERSAO_NAO_APROVADA } from './manifestacao.ts'

const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-05T15:00:00Z')
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
const PDF = { nome: 'peca.pdf', mime: 'application/pdf', conteudo: '%PDF-1.4 versão' }
function formulario(campos: Record<string, string>, arquivo: typeof PDF | null = PDF) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const enviar = async (apelido: string, resto: string, campos: Record<string, string> = {}, arquivo: typeof PDF | null = PDF) =>
  app.inject({ method: 'POST', url: `/api/casos/${casoId}${resto}`, cookies: await cookieDe(apelido), ...formulario(campos, arquivo) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const provarTudo = async () => {
  for (const i of await banco.select().from(exigenciaItem)) await enviar(i.perfilResponsavel === 'documentacao' ? 'dora' : 'ana', `/exigencia-juiz/itens/${i.id}/prova`)
}
const anexarEAprovar = async (tipo = 'manifestacao') => {
  const { numero } = (await enviar('gabi', '/manifestacao/versoes', { tipo })).json()
  await chamar('gabi', 'POST', `/manifestacao/versoes/${numero}/aprovacao`, { aprovei: true })
  return numero as number
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['dora', 'documentacao'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Otávio Lima' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
  casoId = c.id
  await banco.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: CNJ_EXEMPLO.exigencia })
  await casarPublicacoes(banco, [{ fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: '2026-10-05', texto: 'Intime-se para juntar laudo e CTPS.', partes: null }], AGORA)
  const [pub] = await banco.select().from(publicacao)
  await app.inject({ method: 'POST', url: `/api/publicacoes/${pub.id}/classificacao`, cookies: await cookieDe('gabi'), payload: { classe: 'exigencia', dias: 15 } })
  await chamar('gabi', 'POST', '/exigencia-juiz', {
    decisao: 'cumprir',
    itens: [
      { setor: 'documentacao', descricao: 'Laudo', prazoInterno: '20/10/2026' },
      { setor: 'atendimento', descricao: 'CTPS', prazoInterno: '20/10/2026' },
    ],
  })
})
afterEach(() => fechar())

describe('GGVP-87 · manifestar', () => {
  it('CA5, CA6 · com setor pendente, mostra quem falta e não protocola; a versão pode ser anexada antes', async () => {
    const r = (await chamar('gabi', 'GET', '/manifestacao')).json()
    expect([r.faltam.sort(), r.podeAnexar, r.podeProtocolar]).toEqual([['Atendimento', 'Documentação'], true, false])
    await anexarEAprovar()
    const p = await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })
    expect([p.statusCode, p.json().erro]).toEqual([409, 'Sem prova em todos os itens, não se manifesta (G21). Falta: Atendimento, Documentação.'])
  })

  it('CA1 · "Manifestar no processo" nasce na distribuição, com o prazo; com tudo provado, a espera do cliente termina e o protocolo libera', async () => {
    expect(await abertas()).toEqual(['advogada · Manifestar no processo', 'atendimento · Cumprir exigência do juiz', 'documentacao · Cumprir exigência do juiz'])
    await provarTudo()
    expect(await abertas()).toEqual(['advogada · Manifestar no processo'])
    const [espera] = await banco.select().from(etapa).where(eq(etapa.passo, 'D3a.E2'))
    expect(espera.concluidaEm).not.toBeNull()
    const [l] = (await chamar('gabi', 'GET', '/../../tarefas')).json()
    expect([l.titulo, l.tela]).toEqual(['Manifestar no processo', `/casos/${casoId}/manifestacao`])
  })

  it('CA3, CA9 · só protocola a versão aprovada: versão nova depois da aprovação bloqueia, e a tentativa fica registrada', async () => {
    await provarTudo()
    await anexarEAprovar()
    await enviar('gabi', '/manifestacao/versoes')
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })).json().erro).toBe(MSG_VERSAO_NAO_APROVADA)
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'protocolo_bloqueado'))).length).toBe(1)
    expect((await chamar('gabi', 'POST', '/manifestacao/versoes/1/aprovacao', { aprovei: true })).json().erro).toBe('Aprove a última versão anexada.')
    expect((await chamar('gabi', 'POST', '/manifestacao/versoes/2/aprovacao', { aprovei: false })).json().erro).toBe('Marque "Aprovei a versão da manifestação (G6)"')
  })

  it('CA2, CA3, CA10 · data e comprovante obrigatórios; protocolado, a exigência se cumpre e o processo volta para a vigília', async () => {
    await provarTudo()
    const n = await anexarEAprovar()
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' }, null)).statusCode).toBe(400)
    expect((await enviar('gabi', '/manifestacao/protocolo', {})).json().erro).toBe('Informe a data do protocolo (dd/mm/aaaa)')
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })).json()).toEqual({ ok: true, tipo: 'manifestacao' })
    const [x] = await banco.select().from(exigencia)
    const [prot] = await banco.select().from(protocoloJudicial)
    expect([x.situacao, prot.tribunal, await abertas()]).toEqual(['cumprida', '4.03', []])
    const r = (await chamar('helena', 'GET', '/manifestacao')).json()
    expect([r.protocolo.versao, r.protocolo.por, r.versoes[0].aprovadaPor]).toEqual([n, 'gabi', 'gabi'])
    const abertasD3a = await banco.select().from(etapa).where(and(eq(etapa.diagrama, 'D3a'), isNull(etapa.concluidaEm)))
    expect(abertasD3a).toEqual([])
  })

  it('CA12 · dilação: só com o OK da Sênior, mesmo com item sem prova', async () => {
    await anexarEAprovar('dilacao')
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })).json().erro).toBe('O pedido de dilação precisa do OK da Sênior.')
    expect((await chamar('gabi', 'POST', '/manifestacao/dilacao', { motivo: 'x' })).statusCode).toBe(403)
    expect((await chamar('helena', 'GET', '/manifestacao')).json().podeAutorizarDilacao).toBe(true)
    expect((await chamar('helena', 'POST', '/manifestacao/dilacao', { motivo: 'Cliente internado, sem como trazer o laudo' })).statusCode).toBe(201)
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })).json()).toEqual({ ok: true, tipo: 'dilacao' })
    const [x] = await banco.select().from(exigencia)
    expect([x.situacao, (await abertas()).length]).toEqual(['dilacao_pedida', 3])
  })

  it('CA13 · tribunal fora do ar: com a prova e a data da volta, o prazo vai para o dia útil seguinte', async () => {
    expect((await enviar('gabi', '/manifestacao/indisponibilidade', { voltouEm: '27/10/2026' }, null)).statusCode).toBe(400)
    expect((await enviar('gabi', '/manifestacao/indisponibilidade', { voltouEm: '27/10/2026' })).json()).toEqual({ ok: true, prazo: '2026-10-28' })
    const r = (await chamar('gabi', 'GET', '/manifestacao')).json()
    expect([r.prazo.fim, r.prazo.regra]).toEqual(['2026-10-28', expect.stringContaining('art. 10')])
  })
})

describe('GGVP-87 CA4 · perto do vencimento, a Sênior', () => {
  const filaDaSenior = async () =>
    (await chamar('helena', 'GET', '/../../tarefas')).json().map((t: { titulo: string; tela: string }) => [t.titulo, t.tela])
  const prazo = (iso: string) => banco.update(exigencia).set({ prazo: iso })

  it('a 2 dias úteis, a exigência do juiz com item sem prova sobe ao topo, com a tela da exigência', async () => {
    await prazo('2026-10-07')
    expect((await filaDaSenior())[0]).toEqual(['Exigência do juiz perto do prazo: 2 dias úteis', `/casos/${casoId}/exigencia-juiz`])
  })

  it('vencida: a Sênior registra a perda (tarefas canceladas) ou pede dilação; outro perfil não', async () => {
    await prazo('2026-10-02')
    expect((await filaDaSenior())[0][0]).toBe('Exigência do juiz vencida: pedir dilação ou registrar a perda')
    expect((await chamar('helena', 'GET', '/exigencia-juiz')).json().podeDecidirVencida).toBe(true)
    expect((await chamar('gabi', 'POST', '/exigencia-juiz/vencida', { decisao: 'perda', motivo: 'x' })).statusCode).toBe(403)
    expect((await chamar('helena', 'POST', '/exigencia-juiz/vencida', { decisao: 'dilacao', novoPrazo: '30/10/2026' })).statusCode).toBe(201)
    await prazo('2026-10-02')
    expect((await chamar('helena', 'POST', '/exigencia-juiz/vencida', { decisao: 'perda', motivo: 'Cliente não trouxe' })).statusCode).toBe(201)
    const [x] = await banco.select().from(exigencia)
    expect([x.situacao, await abertas()]).toEqual(['vencida', []])
  })
})

describe('GGVP-87 · manifestar sem uma prova (ajuste de 06/10)', () => {
  const pendentes = async () => (await chamar('gabi', 'GET', '/manifestacao')).json().pendentes as { alvo: string; id: string; setor: string; descricao: string }[]
  const encerrar = async (corpo: object, apelido = 'gabi') => chamar(apelido, 'POST', '/manifestacao/sem-prova', corpo)

  it('o documento não existe: a advogada encerra o item com o motivo; o setor para de cobrar e o protocolo libera', async () => {
    const [doc] = (await pendentes()).filter((p) => p.setor === 'Documentação')
    for (const i of await banco.select().from(exigenciaItem)) if (i.perfilResponsavel === 'atendimento') await enviar('ana', `/exigencia-juiz/itens/${i.id}/prova`)
    expect((await encerrar({ alvo: 'item', id: doc.id, motivo: '' })).json().erro).toBe('Escreva por que vai manifestar sem essa prova')
    expect((await encerrar({ alvo: 'item', id: doc.id, motivo: 'x' }, 'helena')).statusCode).toBe(403)
    expect((await encerrar({ alvo: 'item', id: doc.id, motivo: 'O laudo não existe: o médico do cliente faleceu' })).statusCode).toBe(201)
    const m = (await chamar('gabi', 'GET', '/manifestacao')).json()
    expect([m.faltam, m.semProva.map((e: { descricao: string; motivo: string; por: string }) => [e.descricao, e.motivo, e.por])]).toEqual([
      [],
      [['Laudo', 'O laudo não existe: o médico do cliente faleceu', 'gabi']],
    ])
    expect(await abertas()).toEqual(['advogada · Manifestar no processo'])
    expect((await enviar('dora', `/exigencia-juiz/itens/${doc.id}/prova`)).json().erro).toBe('Este item foi encerrado pela advogada, sem a prova.')
    await anexarEAprovar()
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })).json()).toEqual({ ok: true, tipo: 'manifestacao' })
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'manifestacao_protocolada'))
    expect((ev.detalhe as { semProva: unknown[] }).semProva).toEqual([{ descricao: 'Laudo', motivo: 'O laudo não existe: o médico do cliente faleceu' }])
  })

  it('com um item ainda pendente, encerrar outro não libera: o portão continua (G21)', async () => {
    const [doc] = (await pendentes()).filter((p) => p.setor === 'Documentação')
    await encerrar({ alvo: 'item', id: doc.id, motivo: 'Documento não existe' })
    await anexarEAprovar()
    expect((await enviar('gabi', '/manifestacao/protocolo', { dataProtocolo: '05/10/2026' })).json().erro).toBe('Sem prova em todos os itens, não se manifesta (G21). Falta: Atendimento.')
  })
})

describe('GGVP-87 · perícia que não tem como ser feita (ajuste de 06/10)', () => {
  beforeEach(async () => {
    // Outro caso: só o documento e uma perícia médica.
    const [p] = await banco.insert(pessoa).values({ nome: 'Marta Sales' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
    casoId = c.id
    const cnj = '00056787520264036301'
    await banco.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: cnj })
    await casarPublicacoes(banco, [{ fonte: 'aasp', numeroCnj: cnj, disponibilizadaEm: '2026-10-05', texto: 'Junte laudo e submeta-se a perícia.', partes: null }], AGORA)
    const [pub] = await banco.select().from(publicacao).where(eq(publicacao.casoId, casoId))
    await app.inject({ method: 'POST', url: `/api/publicacoes/${pub.id}/classificacao`, cookies: await cookieDe('gabi'), payload: { classe: 'exigencia', dias: 15 } })
    await chamar('gabi', 'POST', '/exigencia-juiz', { decisao: 'cumprir', itens: [{ setor: 'documentacao', descricao: 'Laudo', prazoInterno: '20/10/2026' }], tiposPericia: ['medica'] })
  })

  it('com o documento entregue e a perícia pendente, não manifesta; encerrada com o motivo, libera e a tarefa de marcar é cancelada', async () => {
    const antes = (await chamar('gabi', 'GET', '/manifestacao')).json().pendentes as { alvo: string; id: string }[]
    await enviar('dora', `/exigencia-juiz/itens/${antes.find((p) => p.alvo === 'item')!.id}/prova`)
    let m = (await chamar('gabi', 'GET', '/manifestacao')).json()
    expect([m.faltam, m.pendentes.map((p: { alvo: string; setor: string }) => [p.alvo, p.setor]), m.podeEncerrarSemProva]).toEqual([['Perícia'], [['pericia', 'Jurídico administrativo']], true])
    expect((await encerrar({ alvo: 'pericia', id: m.pendentes[0].id, motivo: 'O juiz cancelou a perícia; vamos pedir julgamento com o laudo' })).statusCode).toBe(201)
    m = (await chamar('gabi', 'GET', '/manifestacao')).json()
    expect([m.faltam, m.semProva[0].descricao]).toEqual([[], 'Perícia médica'])
    expect((await chamar('gabi', 'GET', '/exigencia-juiz')).json().pericias).toEqual([{ tipo: 'medica', resultado: 'encerrada sem resultado' }])
    expect(await abertas()).toEqual(['advogada · Manifestar no processo'])
  })

  const encerrar = async (corpo: object) => chamar('gabi', 'POST', '/manifestacao/sem-prova', corpo)
})

