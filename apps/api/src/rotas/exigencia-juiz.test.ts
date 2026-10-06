import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, configuracao, decisao, etapa, exigencia, exigenciaItem, identificadorCaso, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { casarPublicacoes } from '../vigilia/casar.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { MSG_NADA_A_ANALISAR } from './exigencia-juiz.ts'

const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-05T15:00:00Z') // segunda-feira
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
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo} · ${t.prazo}`).sort()
const ITEM = { setor: 'documentacao', descricao: 'Trazer laudo médico atualizado', provaEsperada: 'Laudo com CID e data', prazoInterno: '20/10/2026' }

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['dora', 'documentacao'], ['ana', 'atendimento'], ['igor', 'juridico_adm']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await banco.insert(configuracao).values([
    { chave: 'cobranca.limite', valor: 2 },
    { chave: 'cobranca.intervalo_dias', valor: 2 },
  ])
  const [p] = await banco.insert(pessoa).values({ nome: 'Otávio Lima' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
  casoId = c.id
  await banco.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: CNJ_EXEMPLO.exigencia })
  await casarPublicacoes(banco, [{ fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: '2026-10-05', texto: 'Intime-se a parte autora para juntar laudo.', partes: null }], AGORA)
  const [pub] = await banco.select().from(publicacao)
  // Disponibilizada na segunda 05/10, 15 dias úteis: prazo até 27/10.
  await app.inject({ method: 'POST', url: `/api/publicacoes/${pub.id}/classificacao`, cookies: await cookieDe('gabi'), payload: { classe: 'exigencia', dias: 15 } })
})
afterEach(() => fechar())

describe('GGVP-79 · analisar a exigência do juiz', () => {
  it('CA5, CA12 · a análise mostra o texto e o prazo com a regra; a tarefa da advogada leva para ela', async () => {
    const r = (await chamar('gabi', 'GET', '/exigencia-juiz')).json()
    expect([r.situacao, r.texto, r.prazo.fim, r.podeDistribuir, r.itens]).toEqual(['a_analisar', 'Intime-se a parte autora para juntar laudo.', '2026-10-27', true, []])
    expect(r.prazo.regra).toContain('Lei 11.419')
    const [l] = (await chamar('gabi', 'GET', '/../../tarefas')).json()
    expect([l.titulo, l.tela]).toEqual(['Analisar exigência do juiz', `/casos/${casoId}/exigencia-juiz`])
  })

  it('CA2, CA6 · só ciência: registrada com quem e quando, sem tarefa, e a análise sai da fila', async () => {
    expect((await chamar('gabi', 'POST', '/exigencia-juiz', { decisao: 'ciencia' })).statusCode).toBe(201)
    expect(await abertas()).toEqual([])
    const [d] = await banco.select().from(decisao).where(eq(decisao.passo, 'D3a.02'))
    expect([d.resultado, d.decididoPor !== null]).toEqual(['ciencia', true])
    expect((await chamar('gabi', 'GET', '/exigencia-juiz')).statusCode).toBe(404)
  })

  it('CA1, CA7, CA10, CA13 · precisa cumprir: cada item vira tarefa do setor, com o prazo interno, o lembrete e o processual ao lado', async () => {
    expect((await chamar('gabi', 'POST', '/exigencia-juiz', { decisao: 'cumprir', itens: [{ ...ITEM, prazoInterno: '28/10/2026' }] })).json().erro).toBe(
      'O prazo interno não pode passar do prazo do processo (27/10/2026).',
    )
    await chamar('gabi', 'POST', '/exigencia-juiz', {
      decisao: 'cumprir',
      itens: [ITEM, { setor: 'atendimento', descricao: 'Pedir ao cliente a carteira de trabalho', prazoInterno: '06/10/2026' }, { setor: 'juridico_adm', descricao: 'Juntar o CNIS', prazoInterno: '15/10/2026' }],
    })
    // Lembrete a 2 dias (07/10), sem passar do prazo interno.
    expect(await abertas()).toEqual([
      'atendimento · Cumprir exigência do juiz · 2026-10-06',
      'documentacao · Cumprir exigência do juiz · 2026-10-07',
      'juridico_adm · Cumprir exigência do juiz · 2026-10-07',
    ])
    const [linha] = (await chamar('dora', 'GET', '/../../tarefas')).json()
    expect([linha.tela, linha.titulo]).toEqual([`/casos/${casoId}/exigencia-juiz/setor`, 'Cumprir exigência do juiz'])
    const r = (await chamar('helena', 'GET', '/exigencia-juiz')).json()
    expect([r.situacao, r.faltam.sort(), r.itens.length, r.itens.find((i: { setor: string }) => i.setor === 'documentacao').provaEsperada]).toEqual([
      'em_cumprimento', ['Atendimento', 'Documentação', 'Jurídico'], 3, 'Laudo com CID e data',
    ])
    const [x] = await banco.select().from(exigencia)
    expect([x.origem, x.prazo, x.publicacaoId !== null]).toEqual(['juizo', '2026-10-27', true])
    const [espera] = await banco.select().from(etapa).where(eq(etapa.passo, 'D3a.E2'))
    expect(espera.aguardando).toBe('cliente responder ou entregar')
  })

  it('CA8 · perícia abre sozinha a tarefa do Jurídico administrativo, com a origem do juiz', async () => {
    await chamar('gabi', 'POST', '/exigencia-juiz', { decisao: 'cumprir', tiposPericia: ['medica'] })
    expect(await abertas()).toEqual(['juridico_adm · Marcar perícia médica (exigência do juiz) · null'])
    expect((await chamar('gabi', 'GET', '/exigencia-juiz')).json().faltam).toEqual(['Perícia'])
  })

  it('CA9 · só a advogada distribui; a Sênior vê e tem a ação recusada e registrada', async () => {
    expect((await chamar('helena', 'POST', '/exigencia-juiz', { decisao: 'ciencia' })).statusCode).toBe(403)
    expect((await chamar('helena', 'GET', '/exigencia-juiz')).json().podeDistribuir).toBe(false)
    await chamar('gabi', 'POST', '/exigencia-juiz', { decisao: 'ciencia' })
    expect((await chamar('gabi', 'POST', '/exigencia-juiz', { decisao: 'ciencia' })).json().erro).toBe(MSG_NADA_A_ANALISAR)
    expect(await banco.select().from(exigenciaItem)).toEqual([])
  })
})
