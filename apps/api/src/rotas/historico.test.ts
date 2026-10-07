import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, decisao, eventoAuditoria, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_EXPORTACAO_EM_CURSO, MSG_HISTORICO_IMUTAVEL, TITULO_AUTORIZAR } from './historico.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method: metodo, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const acoes = async () => (await banco.select().from(eventoAuditoria)).map((e) => e.acao)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-07T15:00:00Z') })
  for (const [apelido, perfil] of [['helena', 'senior'], ['gabi', 'advogada'], ['lauro', 'socio'], ['julia', 'financeiro']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-99 · histórico de quem fez o quê', () => {
  it('CA3, CA7, CA11 · a linha do processo junta eventos e decisões, em ordem, com quem, o passo e a descrição', async () => {
    await banco.insert(eventoAuditoria).values([
      { quem: ids.gabi, acao: 'protocolo_registrado', alvo: `caso:${casoId}`, quando: new Date('2026-10-05T12:00:00Z'), detalhe: { numero: '1' } },
      { quem: 'sistema', acao: 'vigilia_rodou', alvo: `caso:${casoId}`, quando: new Date('2026-10-06T12:00:00Z'), detalhe: {} },
      { quem: ids.gabi, acao: 'protocolo_registrado', alvo: 'caso:outro', quando: new Date('2026-10-05T13:00:00Z'), detalhe: {} },
    ])
    await banco
      .insert(decisao)
      .values({ casoId, passo: 'D2.01', tipo: 'aprovacao_inss', resultado: 'aprovado', decididoPor: ids.helena, perfil: 'senior', decididoEm: new Date('2026-10-04T12:00:00Z') })
    const r = (await chamar('gabi', 'GET', `/api/casos/${casoId}/historico`)).json()
    expect(r.eventos).toEqual([
      { quando: '2026-10-04T12:00:00.000Z', quem: 'helena', origem: 'pessoa', passo: 'D2.01', descricao: 'OK da Sênior para o INSS: aprovado' },
      { quando: '2026-10-05T12:00:00.000Z', quem: 'gabi', origem: 'pessoa', passo: null, descricao: 'Protocolo no Meu INSS registrado' },
      { quando: '2026-10-06T12:00:00.000Z', quem: 'Sistema', origem: 'sistema', passo: null, descricao: 'Vigilia rodou' },
    ])
    expect([r.podePedirExportacao, r.exportacao]).toEqual([false, null])
  })

  it('CA9 · editar ou apagar o histórico pela API é recusado e registrado', async () => {
    for (const metodo of ['PUT', 'DELETE'] as const) {
      const r = await chamar('helena', metodo, `/api/casos/${casoId}/historico/qualquer`, {})
      expect([r.statusCode, r.json().erro]).toEqual([403, MSG_HISTORICO_IMUTAVEL])
    }
    expect((await chamar('lauro', 'DELETE', `/api/casos/${casoId}/historico`)).statusCode).toBe(403)
    expect((await acoes()).filter((a) => a === 'historico_alteracao_recusada')).toHaveLength(3)
  })

  it('CA12 · a gestão pede com o motivo, só o Sócio autoriza, e só quem pediu exporta, uma vez; tudo fica no histórico', async () => {
    const url = `/api/casos/${casoId}/historico/exportacao`
    expect((await chamar('gabi', 'POST', url, { motivo: 'Pedido do titular' })).statusCode).toBe(403)
    expect((await chamar('helena', 'POST', url, { motivo: ' ' })).json().erro).toBe('Escreva o motivo do pedido')
    expect((await chamar('helena', 'POST', url, { motivo: 'Pedido do titular dos dados (LGPD)' })).statusCode).toBe(201)
    expect((await chamar('julia', 'POST', url, { motivo: 'Outro' })).json().erro).toBe(MSG_EXPORTACAO_EM_CURSO)
    const [doSocio] = await banco.select().from(tarefa).where(and(eq(tarefa.titulo, TITULO_AUTORIZAR), isNull(tarefa.concluidaEm)))
    expect([doSocio.perfilDono, doSocio.passo]).toEqual(['socio', 'historico'])
    expect((await chamar('helena', 'GET', url)).statusCode).toBe(403)
    const visto = (await chamar('lauro', 'GET', `/api/casos/${casoId}/historico`)).json()
    expect([visto.exportacao.situacao, visto.exportacao.pedidaPor, visto.exportacao.motivo, visto.podeAutorizarExportacao]).toEqual([
      'pedida',
      'helena',
      'Pedido do titular dos dados (LGPD)',
      true,
    ])
    expect((await chamar('helena', 'POST', `${url}/autorizacao`)).statusCode).toBe(403)
    expect((await chamar('lauro', 'POST', `${url}/autorizacao`)).statusCode).toBe(201)
    expect((await banco.select().from(tarefa).where(and(eq(tarefa.titulo, TITULO_AUTORIZAR), isNull(tarefa.concluidaEm))))).toEqual([])
    expect((await chamar('julia', 'GET', url)).statusCode).toBe(403)
    const exportado = await chamar('helena', 'GET', url)
    expect([exportado.statusCode, exportado.headers['content-disposition']]).toEqual([200, `attachment; filename="historico-${casoId}.json"`])
    // A trilha sai completa: o pedido, a autorização e as tentativas negadas no caso (a da advogada e a da Sênior).
    expect(exportado.json().eventos.map((e: { acao: string }) => e.acao).sort()).toEqual(['acesso_negado', 'acesso_negado', 'exportacao_autorizada', 'exportacao_pedida'])
    expect((await chamar('helena', 'GET', url)).statusCode).toBe(403)
    expect((await acoes()).filter((a) => ['exportacao_pedida', 'exportacao_autorizada', 'historico_exportado'].includes(a))).toEqual([
      'exportacao_pedida',
      'exportacao_autorizada',
      'historico_exportado',
    ])
  })

  it('CA14 · o relatório de prazos cumpridos e perdidos vem do histórico, para a gestão', async () => {
    await banco.insert(eventoAuditoria).values([
      { quem: ids.gabi, acao: 'exigencia_inss_respondida', alvo: `caso:${casoId}`, quando: new Date('2026-10-01T12:00:00Z'), detalhe: {} },
      { quem: 'sistema', acao: 'exigencia_juiz_perdida', alvo: `caso:${casoId}`, quando: new Date('2026-10-02T12:00:00Z'), detalhe: {} },
    ])
    const r = (await chamar('julia', 'GET', '/api/gestao/prazos')).json()
    expect([r.cumpridos, r.perdidos, r.itens.map((i: { cliente: string; situacao: string; descricao: string }) => [i.cliente, i.situacao, i.descricao])]).toEqual([
      1,
      1,
      [
        ['Vera Lúcia', 'perdido', 'Exigência do juiz perdida'],
        ['Vera Lúcia', 'cumprido', 'Exigência do INSS respondida'],
      ],
    ])
    expect((await chamar('gabi', 'GET', '/api/gestao/prazos')).statusCode).toBe(403)
  })
})
