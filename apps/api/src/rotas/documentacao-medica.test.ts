import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, documentoMedico, fichaRecepcao, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let pessoaId: string
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const pedir = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload && { payload }) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z') })
  for (const [apelido, nome, perfil] of [
    ['gabi', 'Gabi', 'advogada'],
    ['helena', 'Helena', 'senior'],
    ['ana', 'Ana', 'atendimento'],
    ['julia', 'Julia', 'financeiro'],
  ] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Rita Exemplo', situacao: 'cliente', telefone: '11999990000' }).returning()
  pessoaId = p.id
  const [c] = await banco.insert(caso).values({ pessoaId, beneficio: 'bpc_loas_deficiente' }).returning()
  casoId = c.id
  const [d] = await banco
    .insert(documento)
    .values({ casoId, pessoaId, tipo: 'laudo', sensivel: true, chaveArmazenamento: 'x/1', nomeOriginal: 'laudo-medico-rita-exemplo.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'card' })
    .returning()
  await banco.insert(documentoMedico).values({ documentoId: d.id, tipo: 'laudo', dataEmissao: '2026-08-20' })
})
afterEach(() => fechar())

describe('GGVP-132 · a documentação médica do servidor para as Centrais e o portão', () => {
  it('"Dar parecer médico" nasce do caso; o registro troca pela tarefa do complemento e o portão vê o parecer, sem conteúdo clínico', async () => {
    const antes = (await pedir('ana', 'GET', '/api/documentacao-medica')).json()
    expect(antes.tarefas.map((t: { acao: string; href: string }) => [t.acao, t.href])).toEqual([['Dar parecer médico', `/casos/${casoId}/parecer`]])
    expect([antes.portoes[casoId], antes.fichas.map((f: { nome: string }) => f.nome)]).toEqual([{ situacao: 'pendente' }, ['Rita Exemplo']])

    const { analise } = (await pedir('gabi', 'GET', `/api/processos/${casoId}/parecer`)).json().juridico
    const conferidos = Object.fromEntries(analise.itens.map((i: { id: string; situacao: string }) => [i.id, i.situacao]))
    await pedir('gabi', 'POST', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos, decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })

    const depois = (await pedir('ana', 'GET', '/api/documentacao-medica')).json()
    expect(depois.tarefas.map((t: { acao: string }) => t.acao)).toEqual(['Pedir complemento ao médico'])
    expect(depois.portoes[casoId]).toEqual({ situacao: 'insuficiente', quem: 'Gabi', data: '2026-10-08' })
    expect(JSON.stringify(depois)).not.toContain('(exemplo) ')
    expect((await pedir('julia', 'GET', '/api/documentacao-medica')).statusCode).toBe(403)
  })

  it('o que acontece entra no histórico da ficha da Recepção, que a tela mostra: o resultado, nunca o conteúdo', async () => {
    await pedir('helena', 'POST', `/api/processos/${casoId}/parecer/dispensa`, { justificativa: 'Caso urgente, com prazo do INSS.' })
    const ficha = (await pedir('ana', 'GET', `/api/fichas/${pessoaId}`)).json()
    expect(ficha.historico.map((e: { oQue: string; quem: string }) => [e.oQue, e.quem])).toEqual([
      ['Pediu a dispensa do parecer médico (1ª aprovação da sênior, G17). Justificativa: Caso urgente, com prazo do INSS.', 'Helena'],
    ])
  })

  it('a prova do acidente começa da sugestão da segunda ficha da Recepção (GGVP-28)', async () => {
    const [c] = await banco.insert(caso).values({ pessoaId, beneficio: 'auxilio_acidente' }).returning()
    const ficha = (await pedir('ana', 'GET', `/api/fichas/${pessoaId}`)).json()
    const segundaFicha = { data: '2026-10-01', origem: 'papel', emBranco: [], respostas: { deTrabalho: 'sim', vinculo: 'CLT', acidenteEm: '15/03/2024' } }
    const { processos: _, ...documentoDaFicha } = { ...ficha, segundaFicha }
    await banco.insert(fichaRecepcao).values({ pessoaId, documento: documentoDaFicha }).onConflictDoUpdate({ target: fichaRecepcao.pessoaId, set: { documento: documentoDaFicha } })
    const r = (await pedir('gabi', 'GET', `/api/processos/${c.id}/acidente`)).json()
    expect(r).toEqual({ sugestao: { circunstancia: 'trabalho', categoria: 'empregado', acidenteEm: '15/03/2024' } })
  })
})
