import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, chamadaIa, contrato, decisao, documento, documentoMedico, eventoAuditoria, kitDocumento, parecerMedico, pessoa, processoAcervo, tarefa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
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
  // G1 em ordem (CA11, CA12): o kit vigente antes de o caso abrir pede só o RG, que o caso tem, e o contrato está assinado.
  await banco.insert(kitDocumento).values({ beneficio: 'bpc_loas_deficiente', tipoDocumento: 'rg', vigenteDesde: new Date('2026-01-01T00:00:00Z') })
  await banco.insert(contrato).values({ casoId, situacao: 'assinado' })
})
afterEach(() => fechar())

describe('GGVP-23 · abrir a conferência', () => {
  it('CA1 e CA6 · a Sênior vê resumo, benefício, checklist, documentos, ficha e kit; pode decidir', async () => {
    const r = (await ver('helena')).json()
    expect([r.cliente, r.beneficio, r.documentos.length, r.temFicha, r.kitAssinado]).toEqual(['Maria Souza', 'bpc_loas_deficiente', 1, false, true])
    expect(r.checklist).toEqual({ cadastrado: true, completo: true, faltam: [] })
    expect([r.podeDecidir, r.situacao, r.parecer]).toEqual([true, 'aguardando', null])
  })

  it('CA4 · outro perfil vê só para leitura; o Financeiro nem abre', async () => {
    expect((await ver('ana')).json().podeDecidir).toBe(false)
    expect((await ver('julia')).statusCode).toBe(403)
  })

  it('GGVP-96 · a peça jurídica (pacote da petição, versões da manifestação) só vai a quem vê a petição', async () => {
    const peca = { mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'portal' }
    await banco.insert(documento).values([
      { casoId, tipo: 'pacote_peticao', chaveArmazenamento: 'x/pacote', nomeOriginal: 'peticao-inicial-v1.pdf', ...peca },
      { casoId, tipo: 'manifestacao_versao', chaveArmazenamento: 'x/manifestacao', nomeOriginal: 'manifestacao.pdf', ...peca },
    ])
    const nomes = async (apelido: string) => (await ver(apelido)).json().documentos.map((d: { nome: string }) => d.nome)
    expect(await nomes('ana')).toEqual(['RG.pdf'])
    expect(await nomes('helena')).toEqual(['RG.pdf', 'peticao-inicial-v1.pdf', 'manifestacao.pdf'])
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
    // O kit vigente antes de o caso abrir (GGVP-104 CA1: o caso fica com o kit da época); o RG vem do caso-base.
    await banco.insert(kitDocumento).values({ beneficio: 'bpc_loas_deficiente', tipoDocumento: 'comprovante_de_residencia', vigenteDesde: new Date('2026-01-01T00:00:00Z') })
    const r = await decidir('helena', { decisao: 'aprovar' })
    expect([r.statusCode, r.json().erro]).toEqual([409, 'Checklist incompleto (G1): faltam comprovante_de_residencia.'])
  })

  const recusasDoG1 = async () =>
    (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'conferencia_recusada').map((e) => (e.detalhe as { portao: string }).portao)

  it('CA11 · benefício sem kit cadastrado: recusa, diz o G1 e registra (sem kit não é checklist completo)', async () => {
    await parecer('suficiente')
    await banco.delete(kitDocumento)
    const r = await decidir('helena', { decisao: 'aprovar' })
    expect([r.statusCode, r.json().erro]).toEqual([409, 'Kit do benefício não cadastrado: cadastre na Configuração antes de aprovar (G1).'])
    expect(await recusasDoG1()).toEqual(['G1'])
    expect(await tarefasAbertas()).toEqual([['D2.01', 'senior']])
  })

  it('CA12 · contrato não assinado: recusa, diz o G1 e registra', async () => {
    await parecer('suficiente')
    await banco.update(contrato).set({ situacao: 'enviado' })
    const r = await decidir('helena', { decisao: 'aprovar' })
    expect([r.statusCode, r.json().erro]).toEqual([409, 'Contrato não assinado (G1): o caso não tem o contrato assinado.'])
    expect(await recusasDoG1()).toEqual(['G1'])
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
    // O G1 vale para todo benefício (CA11): a pensão também precisa do kit cadastrado.
    await banco.insert(kitDocumento).values({ beneficio: 'pensao_morte', tipoDocumento: 'rg', vigenteDesde: new Date('2026-01-01T00:00:00Z') })
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
    // GGVP-120 CA11: pelo nome do catálogo, não pelo código.
    expect(linha.detalhe).toBe('Pensão por Morte')
  })
})

describe('GGVP-131 · chance de êxito na conferência (recorte de 07/10)', () => {
  const FATORES = 'Puxa para cima: parecer suficiente. Puxa para baixo: nenhum. Para subir: manter o laudo atualizado.'
  let enviado = ''
  beforeEach(() => {
    const fetch = async (_url: unknown, init?: RequestInit) => {
      enviado = JSON.parse(String(init?.body)).messages[1].content
      return new Response(JSON.stringify({ choices: [{ message: { content: FATORES } }] }))
    }
    app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }) })
  })
  const chance = async (apelido: string) => app.inject({ method: 'POST', url: `/api/casos/${casoId}/chance`, cookies: await cookieDe(apelido) })

  it('CA2, CA4, CA10 · o número vem do acervo conferido do mesmo benefício, com os casos e a base; a IA explica; fica no histórico', async () => {
    const conferido = { beneficio: 'bpc_loas_deficiente', fonte: 'portal', desfechoConferidoPor: ids.helena }
    await banco.insert(processoAcervo).values([
      { ...conferido, desfecho: 'deferido' },
      { ...conferido, desfecho: 'procedente_total' },
      { ...conferido, desfecho: 'procedente_parcial' },
      { ...conferido, desfecho: 'improcedente' },
      { ...conferido, desfecho: 'desistencia' },
      { beneficio: 'bpc_loas_deficiente', fonte: 'portal', desfecho: 'improcedente' },
      { ...conferido, beneficio: 'pensao_morte', desfecho: 'improcedente' },
    ])
    await parecer('suficiente')
    const r = (await chance('helena')).json()
    expect([r.casos, r.favoraveis, r.porcentagem, typeof r.baseEm, r.fatores.texto, r.fatores.sugestao]).toEqual([4, 3, 75, 'string', FATORES, true])
    expect(enviado).toContain('Chance calculada pelo sistema: 75% em 4 casos parecidos')
    expect(enviado).toContain('Parecer médico: suficiente')
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'chance_mostrada'))
    expect(ev.detalhe).toMatchObject({ casos: 4, porcentagem: 75, chamada: r.fatores.chamadaId })
  })

  it('Sugestão pronta (07/10) · a rodada prepara os fatores sem registrar "mostrada"; ao abrir, mostra e registra, sem nova chamada', async () => {
    await app.prepararSugestoes()
    expect(enviado).toContain('Chance calculada pelo sistema')
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'chance_mostrada'))).toEqual([])
    const [chamada] = await banco.select().from(chamadaIa)
    enviado = ''
    const r = (await chance('helena')).json()
    expect([r.fatores.chamadaId, enviado]).toEqual([chamada.id, ''])
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'chance_mostrada'))).toHaveLength(1)
  })

  it('CA2 · sem casos parecidos, sem número; CA9 · o Atendimento não vê', async () => {
    const r = (await chance('helena')).json()
    expect([r.casos, r.porcentagem, r.baseEm]).toEqual([0, null, null])
    expect(enviado).toContain('sem casos parecidos na casa ainda')
    expect(enviado).toContain('Nenhum laudo médico novo esperando conferência')
    expect((await chance('ana')).statusCode).toBe(403)
  })
})

describe('GGVP-127 · o caso devolvido pela Sênior: ajustar e liberar de novo', () => {
  beforeEach(async () => {
    const [u] = await banco
      .insert(usuario)
      .values({ email: 'fabio@exemplo.ggv', nome: 'fabio', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['documentacao'], trocarSenha: false })
      .returning()
    ids.fabio = u.id
  })
  const liberacao = async (apelido: string) => app.inject({ method: 'GET', url: `/api/casos/${casoId}/liberacao`, cookies: await cookieDe(apelido) })
  const liberar = async (apelido: string, corpo: object = { conferiChecklist: true, conferiAssinaturas: true }) =>
    app.inject({ method: 'POST', url: `/api/casos/${casoId}/liberacao`, cookies: await cookieDe(apelido), payload: corpo })
  const diaDaqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
  const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

  it('CA1 · o Atendimento abre a tarefa de ajuste na Central e vê o motivo, o prazo e quem reprovou', async () => {
    const prazo = diaDaqui(10)
    await decidir('helena', { decisao: 'reprovar', motivo: 'Falta a procuração assinada', temPrazo: true, prazo: dataBr(prazo) })
    const [linha] = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('ana') })).json()
    expect([linha.titulo, linha.tela, linha.urgente]).toEqual(['Ajustar o caso: Falta a procuração assinada', `/casos/${casoId}/ajuste`, false])
    const r = (await liberacao('ana')).json()
    expect(r.ajuste).toMatchObject({ motivo: 'Falta a procuração assinada', prazo, reprovadoPor: 'helena' })
    expect([r.podeLiberar, r.esperandoConferencia]).toEqual([true, false])
  })

  it('CA2 e CA4 · liberado de novo: nova conferência da Sênior, sem o OK anterior; o ajuste sai da fila', async () => {
    await parecer('suficiente')
    await decidir('helena', { decisao: 'aprovar' })
    await banco.insert(tarefa).values({ casoId, passo: 'D2.01', titulo: 'Conferir antes do INSS', perfilDono: 'senior' })
    await decidir('helena', { decisao: 'reprovar', motivo: 'Laudo vencido', temPrazo: false })
    // A Documentação libera a primeira vez; o caso devolvido é do Atendimento (Pedro, 08/10).
    expect([(await liberar('fabio')).statusCode, (await liberacao('fabio')).json().podeLiberar]).toEqual([403, false])
    expect((await liberar('ana', { conferiChecklist: true })).statusCode).toBe(400)
    expect((await liberar('ana')).statusCode).toBe(201)
    const abertas = await tarefasAbertas()
    expect(abertas).toContainEqual(['D2.01', 'senior'])
    expect(abertas).not.toContainEqual(['D1.ajuste', 'atendimento'])
    expect((await ver('helena')).json().situacao).toBe('aguardando')
    const protocolo = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/protocolo`, cookies: await cookieDe('igor') })).json()
    expect(protocolo.okSenior).toBeNull()
    // Já na fila: ninguém libera duas vezes; sem ajuste aberto, o Atendimento nem libera.
    expect([(await liberar('fabio')).statusCode, (await liberar('ana')).statusCode, (await liberacao('ana')).json().ajuste]).toEqual([409, 403, null])
    expect((await banco.select().from(eventoAuditoria)).map((e) => e.acao)).toContain('caso_liberado_ao_juridico')
  })

  it('CA4 · na liberação nova, o servidor confere de novo o checklist (G1) e o parecer (G17)', async () => {
    await decidir('helena', { decisao: 'reprovar', motivo: 'Falta o CNIS', temPrazo: false })
    const r = await liberar('ana')
    expect([r.statusCode, r.json().erro]).toEqual([409, travaDoParecer('liberar', 'bpc_loas_deficiente', null)])
    await parecer('suficiente')
    await banco.insert(kitDocumento).values({ beneficio: 'bpc_loas_deficiente', tipoDocumento: 'cnis', obrigatorio: true, vigenteDesde: new Date('2000-01-01') })
    const g1 = await liberar('ana')
    expect([g1.statusCode, g1.json().erro]).toEqual([409, 'Checklist incompleto (G1): faltam cnis.'])
    const bloqueios = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'liberacao_recusada').map((e) => (e.detalhe as { portao: string }).portao)
    expect(bloqueios).toEqual(['G17', 'G1'])
    expect(await tarefasAbertas()).toEqual([['D1.ajuste', 'atendimento']])
  })

  it('CA3 · com o prazo perto de vencer, a tarefa de ajuste fica com a cor de ação', async () => {
    await decidir('helena', { decisao: 'reprovar', motivo: 'Falta a procuração', temPrazo: true, prazo: dataBr(diaDaqui(1)) })
    const [linha] = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('ana') })).json()
    expect(linha.urgente).toBe(true)
  })
})
