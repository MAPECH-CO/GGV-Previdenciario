import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { atendimento, caso, decisao, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_OUTRA_PESSOA, MSG_SEM_EXPLICACAO, MSG_SEM_RESUMO_ESPERANDO, TITULO_EXPLICAR, TITULO_RESUMO, abrirExplicacaoDoResultado } from './resultado.ts'

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

  it('CA1 · "Explicar resultado" entra na fila de quem fala: do Atendimento no padrão, da advogada quando ela liga', async () => {
    const naFila = async (apelido: string) =>
      ((await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe(apelido) })).json() as { titulo: string }[]).filter((t) => t.titulo === TITULO_EXPLICAR).length
    await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })
    expect([await naFila('ana'), await naFila('gabi')]).toEqual([1, 0])
    const [p] = await banco.insert(pessoa).values({ nome: 'Rosa Exemplo', situacao: 'cliente' }).returning()
    const [outro] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'auxilio_incapacidade_temporaria', fase: 'judicial', desfecho: 'improcedente' }).returning()
    await abrirExplicacaoDoResultado(banco, outro.id)
    const r = await app.inject({ method: 'POST', url: `/api/casos/${outro.id}/resultado/resumo`, cookies: await cookieDe('gabi'), payload: { texto: RESUMO, quemFala: 'advogada' } })
    expect(r.statusCode).toBe(201)
    expect([await naFila('ana'), await naFila('gabi')]).toEqual([1, 1])
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

  it('CA5 · só quem ficou com a explicação registra o contato: com a advogada, o Atendimento recebe 403', async () => {
    await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'advogada' })
    expect((await chamar('ana', 'GET', '/resultado')).json().podeRegistrar).toBe(false)
    const r = await chamar('ana', 'POST', '/resultado/contato', { resultado: 'explicado', canal: 'telefone', explicado: 'Expliquei o resultado ao cliente.' })
    expect([r.statusCode, r.json().erro]).toEqual([403, MSG_OUTRA_PESSOA])
    expect(await abertas()).toEqual([`advogada · ${TITULO_EXPLICAR}`])
    expect((await chamar('gabi', 'GET', '/resultado')).json().podeRegistrar).toBe(true)
    expect((await chamar('gabi', 'POST', '/resultado/contato', { resultado: 'sem_contato', canal: 'telefone' })).statusCode).toBe(201)
  })

  it('CA4 · os contatos mostrados são os desta explicação; outro atendimento do caso depois do resumo não entra', async () => {
    await chamar('gabi', 'POST', '/resultado/resumo', { texto: RESUMO, quemFala: 'atendimento' })
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, casoId))
    await banco
      .insert(atendimento)
      .values({ pessoaId: c.pessoaId, casoId, canal: 'telefone', responsavelId: ids.ana, inicio: new Date(Date.now() + 60_000), resumo: 'O cliente ligou para perguntar do INSS.' })
    await chamar('ana', 'POST', '/resultado/contato', { resultado: 'sem_contato', canal: 'whatsapp' })
    expect((await chamar('ana', 'GET', '/resultado')).json().contatos.map((x: { canal: string }) => x.canal)).toEqual(['whatsapp'])
  })
})
