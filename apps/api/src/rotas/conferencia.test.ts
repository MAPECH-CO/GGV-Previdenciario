import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, decisao, documento, documentoMedico, eventoAuditoria, kitDocumento, parecerMedico, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { travaDoParecer } from '@ggv/contratos'
import { MSG_DISPENSA_JA_PEDIDA, MSG_MESMA_SENIOR, MSG_NAO_ESPERA } from './conferencia.ts'

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

const ver = async (apelido: string) => app.inject({ method: 'GET', url: `/api/casos/${casoId}/conferencia`, cookies: await cookieDe(apelido) })
const decidir = async (apelido: string, corpo: object) =>
  app.inject({ method: 'POST', url: `/api/casos/${casoId}/conferencia`, cookies: await cookieDe(apelido), payload: corpo })
/** Parecer confirmado por pessoa do Jurídico (G17); `confirmado: false` é só a sugestão da IA. */
const parecer = (resultado: 'suficiente' | 'insuficiente', confirmado = true) =>
  banco.insert(parecerMedico).values({
    casoId,
    roteiroVersao: 1,
    resultado,
    itens: [{ item: 'data de início', atendido: resultado === 'suficiente' }],
    ...(confirmado && { confirmadoPor: ids.igor, confirmadoEm: new Date() }),
  })
const G17 = (situacao?: 'insuficiente' | 'pendente') => travaDoParecer('aprovar-inss', 'bpc_loas_deficiente', situacao ? { situacao } : null)
const tarefasAbertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => [t.passo, t.perfilDono])

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['helena', 'senior'], ['otavio', 'senior'], ['ana', 'atendimento'], ['igor', 'juridico_adm'], ['julia', 'financeiro']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'atendimento' }).returning()
  casoId = c.id
  await banco.insert(documento).values({ casoId, tipo: 'rg', chaveArmazenamento: 'x/rg', nomeOriginal: 'RG.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'balcao' })
  await banco.insert(tarefa).values({ casoId, passo: 'D2.01', titulo: 'Conferir antes do INSS', perfilDono: 'senior' })
})
afterEach(() => fechar())

describe('GGVP-23 · abrir a conferência', () => {
  it('CA1 e CA6 · a Sênior vê resumo, benefício, checklist, documentos, ficha e kit; pode decidir', async () => {
    const r = (await ver('helena')).json()
    expect([r.cliente, r.beneficio, r.documentos.length, r.temFicha, r.kitAssinado]).toEqual(['Maria Souza', 'bpc_loas_deficiente', 1, false, false])
    expect(r.checklist).toEqual({ cadastrado: false, completo: true, faltam: [] })
    expect([r.podeDecidir, r.situacao, r.parecer]).toEqual([true, 'aguardando', null])
  })

  it('CA4 · outro perfil vê só para leitura; o Financeiro nem abre', async () => {
    expect((await ver('ana')).json().podeDecidir).toBe(false)
    expect((await ver('julia')).statusCode).toBe(403)
  })

  it('CA5 · mostra o parecer item a item, sem CID nem texto do laudo', async () => {
    await parecer('suficiente')
    const r = (await ver('helena')).json()
    expect(r.parecer).toEqual({ resultado: 'suficiente', itens: [{ item: 'data de início', atendido: true }], justificativaDispensa: null })
  })

  it('GGVP-96 CA12 e CA13 · o parecer só vai ao Jurídico, e cada leitura fica registrada (quem, quando, caso)', async () => {
    await parecer('suficiente')
    const ana = (await ver('ana')).json()
    expect([ana.parecer, ana.parecerRestrito]).toEqual([null, true])
    expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
    const igor = (await ver('igor')).json()
    expect([igor.parecer?.resultado, igor.parecerRestrito]).toEqual(['suficiente', false])
    const acessos = await banco.select().from(acessoDadoSensivel)
    expect(acessos.map((x) => [x.usuarioId, x.perfil, x.casoId, x.recurso.startsWith('parecer:'), x.quando instanceof Date])).toEqual([
      [ids.igor, 'juridico_adm', casoId, true, true],
    ])
  })
})

describe('GGVP-23 · portões ao aprovar (no servidor)', () => {
  it('G1 · com o kit do benefício cadastrado, falta de documento barra e diz qual', async () => {
    await parecer('suficiente')
    // O kit vigente antes de o caso abrir (GGVP-104 CA1: o caso fica com o kit da época).
    const desde = new Date('2026-01-01T00:00:00Z')
    await banco.insert(kitDocumento).values([
      { beneficio: 'bpc_loas_deficiente', tipoDocumento: 'rg', vigenteDesde: desde },
      { beneficio: 'bpc_loas_deficiente', tipoDocumento: 'comprovante_de_residencia', vigenteDesde: desde },
    ])
    const r = await decidir('helena', { decisao: 'aprovar' })
    expect([r.statusCode, r.json().erro]).toEqual([409, 'Checklist incompleto (G1): faltam comprovante_de_residencia.'])
  })

  it('CA5 e G17 · sem parecer, insuficiente, só sugerido pela IA ou com laudo novo esperando: recusa e registra', async () => {
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toBe(G17())
    await parecer('insuficiente')
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toBe(G17('insuficiente'))
    await parecer('suficiente', false)
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toBe(G17('pendente'))
    expect((await ver('helena')).json().travaDoParecer).toBe(G17('pendente'))
    await parecer('suficiente')
    const [d] = await banco
      .insert(documento)
      .values({ casoId, tipo: 'laudo', sensivel: true, chaveArmazenamento: 'x/laudo', nomeOriginal: 'Laudo.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'balcao' })
      .returning()
    await banco.insert(documentoMedico).values({ documentoId: d.id, tipo: 'laudo' })
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toMatch(/laudo novo esperando/)
    const recusas = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'conferencia_recusada')
    expect(recusas.map((e) => (e.detalhe as { portao: string }).portao)).toEqual(['G17', 'G17', 'G17', 'G17'])
  })

  it('G17 · benefício sem laudo (pensão por morte) não pede parecer', async () => {
    await banco.update(caso).set({ beneficio: 'pensao_morte' }).where(eq(caso.id, casoId))
    expect((await ver('helena')).json().travaDoParecer).toBeNull()
    expect((await decidir('helena', { decisao: 'aprovar' })).statusCode).toBe(201)
  })

  it('G17 e Q14 · a dispensa é de duas Sêniores: uma pede com justificativa, outra aprova; a mesma pessoa é recusada', async () => {
    const pedir = async (apelido: string, justificativa: string) =>
      app.inject({ method: 'POST', url: `/api/casos/${casoId}/parecer/dispensa`, cookies: await cookieDe(apelido), payload: { justificativa } })
    const responder = async (apelido: string, aprova: boolean) =>
      app.inject({ method: 'POST', url: `/api/casos/${casoId}/parecer/dispensa/aprovacao`, cookies: await cookieDe(apelido), payload: { aprova } })
    expect((await pedir('helena', 'curta')).statusCode).toBe(400)
    expect((await pedir('helena', 'Laudo do INSS já reconhece a deficiência')).statusCode).toBe(201)
    expect((await pedir('otavio', 'Outro pedido no mesmo caso')).json().erro).toBe(MSG_DISPENSA_JA_PEDIDA)
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toMatch(/espera a aprovação de outra Sênior/)
    const vista = async (apelido: string) => (await ver(apelido)).json().dispensa
    expect(await vista('helena')).toEqual({ pedidaPor: 'helena', justificativa: 'Laudo do INSS já reconhece a deficiência', podeResponder: false })
    expect((await vista('otavio')).podeResponder).toBe(true)
    expect(await vista('ana')).toBeNull()
    // A mesma Sênior não aprova a própria dispensa: recusa e histórico.
    expect((await responder('helena', true)).json().erro).toBe(MSG_MESMA_SENIOR)
    expect((await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'dispensa_parecer_recusada')).toHaveLength(1)
    expect((await responder('otavio', true)).statusCode).toBe(201)
    const [p] = await banco.select().from(parecerMedico)
    expect([p.resultado, p.confirmadoPor, p.justificativaDispensa]).toEqual(['dispensado', ids.otavio, 'Laudo do INSS já reconhece a deficiência'])
    expect((await decidir('helena', { decisao: 'aprovar' })).statusCode).toBe(201)
  })

  it('G17 e Q14 · a segunda Sênior recusa: o portão continua fechado, e um novo pedido pode ser feito', async () => {
    const helena = await cookieDe('helena')
    await app.inject({ method: 'POST', url: `/api/casos/${casoId}/parecer/dispensa`, cookies: helena, payload: { justificativa: 'Benefício por idade, sem laudo' } })
    const r = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/parecer/dispensa/aprovacao`, cookies: await cookieDe('otavio'), payload: { aprova: false } })
    expect(r.statusCode).toBe(201)
    expect(await banco.select().from(parecerMedico)).toEqual([])
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toBe(G17())
    expect((await ver('helena')).json().dispensa).toBeNull()
  })
})

describe('GGVP-23 · decidir', () => {
  it('CA2 e CA7 · aprovar registra quem e quando e abre protocolo e perícia juntos; não aprova duas vezes', async () => {
    await parecer('suficiente')
    expect((await decidir('helena', { decisao: 'aprovar' })).statusCode).toBe(201)
    const [d] = await banco.select().from(decisao)
    expect([d.passo, d.resultado, d.decididoPor, d.perfil]).toEqual(['D2.01', 'aprovado', ids.helena, 'senior'])
    expect(await tarefasAbertas()).toEqual([
      ['D2.02', 'juridico_adm'],
      ['D2.03', 'advogada'],
    ])
    expect((await decidir('helena', { decisao: 'aprovar' })).json().erro).toBe(MSG_NAO_ESPERA)
  })

  it('CA3 e CA8 · reprovar exige motivo; com prazo, a data; volta ao Atendimento com o motivo e sem protocolo', async () => {
    expect((await decidir('helena', { decisao: 'reprovar', motivo: '', temPrazo: false })).statusCode).toBe(400)
    expect((await decidir('helena', { decisao: 'reprovar', motivo: 'Falta a procuração', temPrazo: true })).json().erro).toBe('Informe a data do ajuste (dd/mm/aaaa)')
    expect((await decidir('helena', { decisao: 'reprovar', motivo: 'Falta a procuração', temPrazo: true, prazo: '10/10/2026' })).statusCode).toBe(201)
    const [ajuste] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))
    expect([ajuste.perfilDono, ajuste.titulo, ajuste.prazo]).toEqual(['atendimento', 'Ajustar o caso: Falta a procuração', '2026-10-10'])
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect(c.fase).toBe('atendimento')
  })

  it('CA9 · reprovado e liberado de novo: nova conferência, sem herdar o OK anterior', async () => {
    await parecer('suficiente')
    await decidir('helena', { decisao: 'aprovar' })
    await banco.insert(tarefa).values({ casoId, passo: 'D2.01', titulo: 'Conferir antes do INSS', perfilDono: 'senior' })
    await decidir('helena', { decisao: 'reprovar', motivo: 'Laudo vencido', temPrazo: false })
    const protocolo = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/protocolo`, cookies: await cookieDe('igor') })).json()
    expect(protocolo.okSenior).toBeNull()
    await banco.insert(tarefa).values({ casoId, passo: 'D2.01', titulo: 'Conferir antes do INSS', perfilDono: 'senior' })
    expect((await ver('helena')).json().situacao).toBe('aguardando')
  })

  it('CA10 · quem não é Sênior e chama o servidor direto é recusado e fica no histórico', async () => {
    const r = await decidir('ana', { decisao: 'aprovar' })
    expect([r.statusCode, r.json()]).toEqual([403, { erro: MSG_SEM_PERMISSAO }])
    expect((await banco.select().from(eventoAuditoria)).map((e) => e.acao)).toContain('acesso_negado')
  })

  it('pensão por morte aparece em destaque na fila da Sênior', async () => {
    await banco.update(caso).set({ beneficio: 'pensao_morte' }).where(eq(caso.id, casoId))
    const [linha] = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('helena') })).json()
    expect([linha.titulo, linha.urgente, linha.tela]).toEqual(['Conferir antes do INSS', true, `/casos/${casoId}/conferencia`])
  })
})
