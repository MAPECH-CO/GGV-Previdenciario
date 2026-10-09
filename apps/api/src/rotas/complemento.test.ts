import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, documentoMedico, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_AINDA_NO_LIMITE, MSG_SEM_COMPLEMENTO } from './complemento.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let agora: Date
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const ver = async (apelido: string, id = casoId) => app.inject({ method: 'GET', url: `/api/processos/${id}/complemento`, cookies: await cookieDe(apelido) })
const postar = async (apelido: string, caminho: string, corpo: object) =>
  app.inject({ method: 'POST', url: `/api/processos/${casoId}${caminho}`, cookies: await cookieDe(apelido), payload: corpo })
const tentar = (apelido: string, resultado = 'sem-resposta') => postar(apelido, '/complemento/tentativas', { canal: 'ligacao', resultado })
const dia = (d: string) => (agora = new Date(`${d}T15:00:00Z`))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  dia('2026-10-08')
  app = criarServidor({ banco, agora: () => agora })
  for (const [apelido, nome, perfil] of [
    ['gabi', 'Gabi', 'advogada'],
    ['helena', 'Helena', 'senior'],
    ['ana', 'Ana', 'atendimento'],
    ['julia', 'Julia', 'financeiro'],
  ] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Rita Exemplo', situacao: 'cliente', telefone: '11999990000' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'atendimento' }).returning()
  casoId = c.id
  const [d] = await banco
    .insert(documento)
    .values({ casoId, pessoaId: p.id, tipo: 'laudo', sensivel: true, chaveArmazenamento: 'x/1', nomeOriginal: 'laudo-medico-rita-exemplo.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'card' })
    .returning()
  await banco.insert(documentoMedico).values({ documentoId: d.id, tipo: 'laudo', dataEmissao: '2026-08-20' })
  // O parecer Insuficiente da advogada abre o complemento (GGVP-20 CA5).
  const parecer = await app.inject({ method: 'GET', url: `/api/processos/${casoId}/parecer`, cookies: await cookieDe('gabi') })
  const { analise } = parecer.json().juridico
  const conferidos = Object.fromEntries(analise.itens.map((i: { id: string; situacao: string }) => [i.id, i.situacao]))
  await postar('gabi', '/parecer', { analise: analise.quando, conferidos, decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })
})
afterEach(() => fechar())

describe('GGVP-132 · o complemento ao médico no servidor (GGVP-29)', () => {
  it('CA1, CA6 · o Atendimento vê o resultado, as perguntas e a orientação, sem conteúdo clínico; o Financeiro nem abre', async () => {
    const r = (await ver('ana')).json()
    expect([r.situacao, r.tentativa, r.complemento.parecer, r.ficha]).toEqual(['aberto', 1, 'insuficiente', { id: expect.any(String), nome: 'Rita Exemplo', telefone: '11999990000' }])
    // Sem chave, a IA fica desligada e a análise segue manual: todo item obrigatório falta.
    expect(r.complemento.perguntas[0]).toBe('Qual é a natureza do impedimento do paciente?')
    expect(r.orientacao).toContain('Qual a previsão de duração do quadro?')
    expect(JSON.stringify(r)).not.toMatch(/trecho|evidencia/)
    expect((await ver('julia')).statusCode).toBe(403)
  })

  it('caso sem complemento: 404', async () => {
    const [outro] = await banco.insert(caso).values({ pessoaId: (await banco.select().from(pessoa))[0].id, beneficio: 'bpc_loas_deficiente' }).returning()
    const r = await ver('ana', outro.id)
    expect([r.statusCode, r.json().erro]).toEqual([404, MSG_SEM_COMPLEMENTO])
  })

  it('CA3 (G15) · duas tentativas sem resposta sobem para a Sênior, que decide nova tentativa com prazo; o histórico registra', async () => {
    expect((await tentar('gabi')).statusCode).toBe(403)
    const primeira = await tentar('ana')
    expect([primeira.statusCode, primeira.json().tentativa, primeira.json().motivoParado]).toEqual([201, 2, 'A próxima tentativa é em 11/10, 3 dias depois da última.'])
    expect((await tentar('ana')).statusCode).toBe(409)
    expect((await postar('helena', '/complemento/decisoes', { justificativa: 'Mais uma chance', prazo: '2026-10-20' })).json().erro).toBe(MSG_AINDA_NO_LIMITE)
    dia('2026-10-11')
    const segunda = await tentar('ana')
    expect(segunda.json().situacao).toBe('na-senior')
    expect((await tentar('ana')).statusCode).toBe(409)
    expect((await postar('ana', '/complemento/decisoes', { justificativa: 'Mais uma chance', prazo: '2026-10-20' })).json().erro).toBe(MSG_SEM_PERMISSAO)
    expect((await postar('helena', '/complemento/decisoes', { justificativa: 'Mais uma chance', prazo: '2026-10-10' })).statusCode).toBe(400)
    const decidida = await postar('helena', '/complemento/decisoes', { justificativa: 'Mais uma chance', prazo: '2026-10-20' })
    expect([decidida.statusCode, decidida.json().situacao, decidida.json().proxima, decidida.json().complemento.decisoes[0].quem]).toEqual([201, 'aberto', '2026-10-20', 'Helena'])
    const acoes = (await banco.select().from(eventoAuditoria)).map((e) => e.acao)
    expect(acoes.filter((a) => a.startsWith('complemento_'))).toEqual(['complemento_tentativa_registrada', 'complemento_tentativa_registrada', 'complemento_decidido'])
  })
})
