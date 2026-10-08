import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { atendimento, caso, decisao, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_EXPLICACAO, MSG_SEM_RESUMO_ESPERANDO, TITULO_EXPLICAR, TITULO_RESUMO, abrirExplicacaoDoResultado } from './resultado.ts'

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
const chamar = async (apelido: string, metodo: 'GET' | 'POST', resto: string, payload?: object) =>
  app.inject({ method: metodo, url: `/api/casos/${casoId}${resto}`, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const RESUMO = 'O juiz entendeu que a incapacidade não ficou provada no período pedido. Explicar com calma e sem prometer nada.'

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['ana', 'atendimento'], ['julia', 'financeiro'], ['fabio', 'documentacao']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Paulo Mendes', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'auxilio_incapacidade_temporaria', fase: 'judicial', desfecho: 'improcedente' }).returning()
  casoId = c.id
  await abrirExplicacaoDoResultado(banco, casoId)
})
afterEach(() => fechar())

describe('GGVP-22 · o Jurídico aprova o resumo', () => {
  it('CA3, CA5 · a advogada escreve, aprova e passa ao Atendimento; o resumo sai com o nome de quem aprovou', async () => {
    expect(await abertas()).toEqual([`advogada · ${TITULO_RESUMO}`])
    await abrirExplicacaoDoResultado(banco, casoId)
    expect(await abertas()).toHaveLength(1)
    expect((await chamar('ana', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })).statusCode).toBe(403)
    expect((await chamar('gabi', 'GET', '/resultado')).json().podeAprovar).toBe(true)
    expect((await chamar('gabi', 'POST', '/resultado/resumo', { texto: 'curto', quemFala: 'atendimento' })).statusCode).toBe(400)
    expect((await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })).statusCode).toBe(201)
    expect(await abertas()).toEqual([`atendimento · ${TITULO_EXPLICAR}`])
    const r = (await chamar('ana', 'GET', '/resultado')).json()
    expect([r.resumo.texto, r.resumo.aprovadoPor, r.resumo.quemFala, r.podeRegistrar, r.podeAprovar]).toEqual([RESUMO, 'gabi', 'atendimento', true, false])
    const [d] = await banco.select().from(decisao)
    expect([d.tipo, d.decididoPor, d.perfil]).toEqual(['resumo_cliente', ids.gabi, 'advogada'])
    expect((await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })).json().erro).toBe(MSG_SEM_RESUMO_ESPERANDO)
  })

  it('CA5 · caso complexo: a advogada escolhe "eu ligo", e a tarefa fica com ela', async () => {
    await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'advogada' })
    const [t] = await banco.select().from(tarefa).where(and(eq(tarefa.passo, 'D3b.06'), isNull(tarefa.concluidaEm)))
    expect([t.perfilDono, t.responsavelId, t.titulo]).toEqual(['advogada', ids.gabi, TITULO_EXPLICAR])
    expect((await chamar('ana', 'GET', '/resultado')).json().resumo.quemFala).toBe('advogada')
  })

  it('CA3 · sem resumo aprovado, não há o que explicar; o Financeiro nem abre', async () => {
    expect((await chamar('ana', 'GET', '/resultado')).json().resumo).toBeNull()
    expect((await chamar('ana', 'POST', '/resultado/contato', { resultado: 'sem_contato', canal: 'telefone' })).json().erro).toBe(MSG_SEM_EXPLICACAO)
    expect((await chamar('julia', 'GET', '/resultado')).statusCode).toBe(403)
  })
})

describe('GGVP-22 · explicar ao cliente', () => {
  it('CA4, CA2 · sem contato mantém a tarefa; explicado conclui, registra data, canal e o que foi dito, e fecha o caso', async () => {
    await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })
    expect((await chamar('fabio', 'POST', '/resultado/contato', { resultado: 'sem_contato', canal: 'telefone' })).statusCode).toBe(403)
    expect((await chamar('ana', 'POST', '/resultado/contato', { resultado: 'sem_contato', canal: 'telefone' })).statusCode).toBe(201)
    expect(await abertas()).toEqual([`atendimento · ${TITULO_EXPLICAR}`])
    expect((await chamar('ana', 'POST', '/resultado/contato', { resultado: 'explicado', canal: 'whatsapp', explicado: '' })).statusCode).toBe(400)
    const explicado = 'Expliquei que o juiz não viu prova da incapacidade e que o escritório não vai recorrer.'
    expect((await chamar('ana', 'POST', '/resultado/contato', { resultado: 'explicado', canal: 'whatsapp', explicado })).statusCode).toBe(201)
    expect(await abertas()).toEqual([])
    const r = (await chamar('ana', 'GET', '/resultado')).json()
    expect(r.contatos.map((x: { canal: string; explicado: string | null; quem: string }) => [x.canal, x.explicado, x.quem])).toEqual([
      ['telefone', null, 'ana'],
      ['whatsapp', explicado, 'ana'],
    ])
    expect([r.encerrado, r.podeRegistrar]).toEqual([true, false])
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect([c.fase, c.encerradoEm !== null]).toEqual(['encerrado', true])
    expect(await banco.select().from(atendimento)).toHaveLength(2)
  })
})

describe('Épico IA · a IA sugere o resumo do resultado', () => {
  const RASCUNHO = 'O juiz entendeu que não ficou provada a incapacidade no período pedido, e por isso o pedido foi negado.'
  let enviado = ''
  const comIa = (texto: string) => {
    const fetch = async (_url: unknown, init?: RequestInit) => {
      enviado = JSON.parse(String(init?.body)).messages[1].content
      return new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }))
    }
    app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste' }, fetch }) })
  }

  it('a IA escreve com a decisão de mérito; nada é gravado; o resumo aprovado é o do Jurídico, com a chamada à parte', async () => {
    await banco.insert(publicacao).values({ fonte: 'aasp', casoId, disponibilizadaEm: '2026-10-01', texto: 'Sentença: julgo improcedente o pedido.', hash: 'h-merito', classe: 'merito' })
    comIa(RASCUNHO)
    expect((await chamar('ana', 'POST', '/resultado/sugestao')).statusCode).toBe(403)
    const r = (await chamar('gabi', 'POST', '/resultado/sugestao')).json()
    expect([r.sugestao.texto, r.sugestao.sugestao, r.sugestao.fontes[0].tipo, r.motivo]).toEqual([RASCUNHO, true, 'publicacao', null])
    expect(enviado).toContain('Sentença: julgo improcedente o pedido.')
    expect(enviado).toContain('Auxílio por Incapacidade Temporária')
    expect(await banco.select().from(decisao)).toEqual([])
    const aprovado = `${RASCUNHO} O escritório não vai recorrer.`
    expect((await chamar('gabi', 'POST', '/resultado/resumo', { texto: aprovado, quemFala: 'atendimento', chamadaIaId: r.sugestao.chamadaId })).statusCode).toBe(201)
    const [d] = await banco.select().from(decisao)
    expect([d.justificativa, d.sugestaoIa, d.decididoPor]).toEqual([aprovado, { chamadaId: r.sugestao.chamadaId }, ids.gabi])
  })

  it('sem o texto da decisão, a IA é avisada de que o motivo fica para a advogada', async () => {
    comIa(RASCUNHO)
    const r = (await chamar('gabi', 'POST', '/resultado/sugestao')).json()
    expect([r.sugestao.fontes[0].tipo, r.motivo]).toEqual(['caso', null])
    expect(enviado).toContain('Texto da decisão: não está no sistema; o motivo fica para a advogada completar')
  })

  it('Sugestão pronta (07/10) · a rodada deixa o rascunho pronto; ao abrir, aparece sem nova chamada', async () => {
    let chamadas = 0
    const fetch = async () => {
      chamadas++
      return new Response(JSON.stringify({ choices: [{ message: { content: RASCUNHO } }] }))
    }
    app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste' }, fetch }) })
    await app.prepararSugestoes()
    const r = (await chamar('gabi', 'POST', '/resultado/sugestao')).json()
    expect([r.sugestao.texto, chamadas]).toEqual([RASCUNHO, 1])
  })

  it('saída com código de doença é barrada (G20), e o Jurídico escreve; depois do resumo aprovado, não há o que sugerir', async () => {
    comIa('O laudo mostrou F32.1 e por isso perdemos.')
    expect((await chamar('gabi', 'POST', '/resultado/sugestao')).json()).toEqual({ sugestao: null, motivo: 'A IA não escreveu agora: escreva o resumo.' })
    await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })
    expect((await chamar('gabi', 'POST', '/resultado/sugestao')).json().erro).toBe(MSG_SEM_RESUMO_ESPERANDO)
  })
})
