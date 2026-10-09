import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, configuracao, credencialGovbr, eventoAuditoria, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { apagarSenhasVencidas } from '../fluxo/cofre.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_TRAVADO } from '../sessao/rotas.ts'
import { MSG_COFRE_SEM_TAREFA } from './inss.ts'

const SENHA = 'senha-do-portal-1'
/** Senha de teste do gov.br: a varredura procura por ela no histórico e na exportação (CA9). */
const SENHA_GOV = 'gov-teste-cofre-9f3k'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let relogio = new Date('2026-10-07T15:00:00Z') // 12h em Brasília
let pessoaId: string
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method: metodo, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const cadastrar = (apelido: string, senha = SENHA_GOV) => chamar(apelido, 'POST', `/api/pessoas/${pessoaId}/cofre`, { senha })
const revelar = () => chamar('igor', 'POST', `/api/casos/${casoId}/cofre`, { senhaDoPortal: SENHA })
const eventos = () => banco.select().from(eventoAuditoria)
const tarefaDoProtocolo = () => banco.insert(tarefa).values({ casoId, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm' })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-07T15:00:00Z')
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['dora', 'documentacao'], ['igor', 'juridico_adm'], ['helena', 'senior'], ['julia', 'financeiro'], ['lauro', 'socio'], ['gabi', 'advogada']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await banco.insert(configuracao).values([
    { chave: 'cofre.alerta.leituras_por_dia', valor: 2 },
    { chave: 'cofre.alerta.hora_inicio', valor: 7 },
    { chave: 'cofre.alerta.hora_fim', valor: 20 },
  ])
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', situacao: 'cliente' }).returning()
  pessoaId = p.id
  const [c] = await banco.insert(caso).values({ pessoaId, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-103 · cofre de senhas do gov.br', () => {
  it('CA4, CA8, CA11 · o Atendimento cadastra e troca só pelo cofre, cifrado; o registro tem quem fez, nunca o valor', async () => {
    expect((await cadastrar('ana')).json()).toEqual({ ok: true, trocada: false })
    expect((await cadastrar('igor', 'outra-senha-gov')).json()).toEqual({ ok: true, trocada: true })
    expect((await cadastrar('dora')).statusCode).toBe(403)
    expect((await chamar('ana', 'POST', `/api/pessoas/${pessoaId}/cofre`, { senha: '' })).json().erro).toBe('Digite a senha do gov.br')
    const [c] = await banco.select().from(credencialGovbr).where(eq(credencialGovbr.pessoaId, pessoaId))
    expect(c.senhaCifrada.toString('utf8')).not.toContain('outra-senha-gov')
    const registros = (await eventos()).filter((e) => e.acao.startsWith('cofre_senha_'))
    expect(registros.map((e) => [e.acao, e.alvo])).toEqual([
      ['cofre_senha_cadastrada', `pessoa:${pessoaId}`],
      ['cofre_senha_trocada', `pessoa:${pessoaId}`],
    ])
  })

  it('CA2, CA5, CA6 · revelar só com tarefa aberta de gov.br; a tarefa vai como motivo; sem ela, recusa e registra', async () => {
    await cadastrar('ana')
    const sem = await revelar()
    expect([sem.statusCode, sem.json().erro]).toEqual([403, MSG_COFRE_SEM_TAREFA])
    await tarefaDoProtocolo()
    const r = await revelar()
    expect([r.statusCode, r.json(), r.headers['cache-control']]).toEqual([200, { senha: SENHA_GOV, segundos: 60 }, 'no-store'])
    const lida = (await eventos()).find((e) => e.acao === 'cofre_senha_lida')!
    expect(lida.detalhe).toMatchObject({ motivo: 'Protocolar no Meu INSS', passo: 'D2.02' })
    expect((await eventos()).map((e) => e.acao)).toContain('cofre_uso_recusado')
  })

  it('CA7 · mais leituras no dia que o limite, ou fora do horário, avisa a Sênior uma vez por dia', async () => {
    await cadastrar('ana')
    await tarefaDoProtocolo()
    for (let n = 0; n < 4; n++) await revelar()
    const alertas = async () => (await banco.select().from(tarefa).where(eq(tarefa.perfilDono, 'senior'))).map((t) => t.titulo)
    expect(await alertas()).toEqual(['Uso do cofre fora do padrão: igor, 3 leituras hoje (limite 2)'])
    relogio = new Date('2026-10-09T05:00:00Z') // 2h em Brasília, outro dia
    await revelar()
    expect(await alertas()).toContain('Uso do cofre fora do padrão: igor, leitura às 02h, fora do horário (7h às 20h)')
  })

  it('CA6 · a gestão vê os usos por pessoa, sem o valor', async () => {
    await cadastrar('ana')
    await tarefaDoProtocolo()
    await revelar()
    await chamar('igor', 'POST', `/api/casos/${casoId}/cofre`, { senhaDoPortal: 'errada' })
    const r = await chamar('julia', 'GET', '/api/gestao/cofre')
    expect(r.json().pessoas.map((p: { quem: string; leituras: number; cadastros: number; recusas: number }) => [p.quem, p.leituras, p.cadastros, p.recusas]).sort()).toEqual([
      ['ana', 0, 1, 0],
      ['igor', 1, 0, 1],
    ])
    expect(r.body).not.toContain(SENHA_GOV)
    expect((await chamar('gabi', 'GET', '/api/gestao/cofre')).statusCode).toBe(403)
  })

  it('CA9 · a senha de teste não aparece no histórico nem na exportação do histórico', async () => {
    await cadastrar('ana')
    await tarefaDoProtocolo()
    await revelar()
    const url = `/api/casos/${casoId}/historico/exportacao`
    await chamar('helena', 'POST', url, { motivo: 'Auditoria' })
    await chamar('lauro', 'POST', `${url}/autorizacao`)
    const exportado = await chamar('helena', 'GET', url)
    expect(exportado.statusCode).toBe(200)
    expect(exportado.body).not.toContain(SENHA_GOV)
    expect(JSON.stringify(await eventos())).not.toContain(SENHA_GOV)
  })

  it('CA10 · a senha sai do cofre 1 ano depois do último encerramento; com caso aberto ou encerrado há menos, fica', async () => {
    const pessoaCom = async (nome: string, casos: { fase: 'encerrado' | 'judicial'; encerradoEm?: Date }[]) => {
      const [p] = await banco.insert(pessoa).values({ nome, situacao: 'cliente' }).returning()
      for (const c of casos) await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: c.fase, encerradoEm: c.encerradoEm ?? null })
      await banco.insert(credencialGovbr).values({ pessoaId: p.id, senhaCifrada: Buffer.from('x'), iv: Buffer.from('y') })
      return p.id
    }
    const agora = new Date('2026-10-07T12:00:00Z')
    const vencida = await pessoaCom('Encerrado há 13 meses', [{ fase: 'encerrado', encerradoEm: new Date('2025-09-01T12:00:00Z') }])
    const recente = await pessoaCom('Encerrado há 6 meses', [{ fase: 'encerrado', encerradoEm: new Date('2026-04-01T12:00:00Z') }])
    const aberta = await pessoaCom('Com caso aberto', [{ fase: 'encerrado', encerradoEm: new Date('2024-01-01T12:00:00Z') }, { fase: 'judicial' }])
    expect(await apagarSenhasVencidas(banco, agora)).toBe(1)
    const restantes = (await banco.select({ pessoaId: credencialGovbr.pessoaId }).from(credencialGovbr)).map((c) => c.pessoaId)
    expect([restantes.includes(vencida), restantes.includes(recente), restantes.includes(aberta)]).toEqual([false, true, true])
    const [apagada] = (await eventos()).filter((e) => e.acao === 'cofre_senha_apagada')
    expect([apagada.quem, apagada.alvo]).toEqual(['sistema', `pessoa:${vencida}`])
  })
})

describe('GGVP-103 · revelar para responder a exigência e a trava (orquestrador, 09/10)', () => {
  const tarefaDaResposta = () => banco.insert(tarefa).values({ casoId, passo: 'D2.05r', titulo: 'Responder exigência no portal do INSS', perfilDono: 'advogada' })
  const revelarComo = (apelido: string, senhaDoPortal = SENHA) => chamar(apelido, 'POST', `/api/casos/${casoId}/cofre`, { senhaDoPortal })
  /** Uma sessão só: entrar de novo com a senha certa zera a contagem, como no login. */
  const naMesmaSessao = async (apelido: string) => {
    const cookies = await cookieDe(apelido)
    return (senhaDoPortal = SENHA) => app.inject({ method: 'POST', url: `/api/casos/${casoId}/cofre`, cookies, payload: { senhaDoPortal } })
  }

  it('CA12 · a advogada revela para responder a exigência no portal; o motivo fica no histórico; sem a tarefa, não', async () => {
    await cadastrar('ana')
    expect((await revelarComo('gabi')).json().erro).toBe(MSG_COFRE_SEM_TAREFA)
    await tarefaDaResposta()
    const r = await revelarComo('gabi')
    expect([r.statusCode, r.json().senha]).toEqual([200, SENHA_GOV])
    const lida = (await eventos()).find((e) => e.acao === 'cofre_senha_lida')!
    expect(lida.detalhe).toMatchObject({ passo: 'D2.05r', motivo: 'Responder exigência no portal do INSS' })
    // Quem não trata a exigência nem protocola segue sem revelar.
    expect((await revelarComo('ana')).statusCode).toBe(403)
  })

  it('CA13 · na 5ª senha do portal errada, trava por 15 minutos, mesmo com a certa; depois, volta', async () => {
    await cadastrar('ana')
    await tarefaDoProtocolo()
    const igor = await naMesmaSessao('igor')
    for (let i = 1; i <= 4; i++) expect((await igor('errada')).statusCode).toBe(403)
    const quinta = await igor('errada')
    expect([quinta.statusCode, quinta.json().erro]).toEqual([423, MSG_TRAVADO])
    expect((await igor()).statusCode).toBe(423)
    expect((await eventos()).some((e) => e.acao === 'cofre_travado')).toBe(true)
    relogio = new Date(relogio.getTime() + 16 * 60_000)
    expect((await igor()).statusCode).toBe(200)
  })

  it('CA13 · acertar zera a contagem: erros de antes não somam com os de depois', async () => {
    await cadastrar('ana')
    await tarefaDoProtocolo()
    const igor = await naMesmaSessao('igor')
    for (let i = 1; i <= 4; i++) await igor('errada')
    expect((await igor()).statusCode).toBe(200)
    const [u] = await banco.select({ tentativas: usuario.tentativasErradas }).from(usuario).where(eq(usuario.email, 'igor@exemplo.ggv'))
    expect(u.tentativas).toBe(0)
  })
})
