import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, documentacaoMedica, documento, documentoMedico, eventoAuditoria, parecerMedico, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_DISPENSA_ESPERANDO } from './parecer.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let agora: Date
let pessoaId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const ver = async (apelido: string, casoId: string) => app.inject({ method: 'GET', url: `/api/processos/${casoId}/parecer`, cookies: await cookieDe(apelido) })
const postar = async (apelido: string, url: string, corpo: object) => app.inject({ method: 'POST', url, cookies: await cookieDe(apelido), payload: corpo })

async function novoCaso(beneficio: 'bpc_loas_deficiente' | 'aposentadoria_pcd' | 'aposentadoria_idade') {
  const [c] = await banco.insert(caso).values({ pessoaId, beneficio, fase: 'atendimento' }).returning()
  return c.id
}
let n = 0
/** Um documento médico lido pelo portal: a IA simulada lê pelo nome do arquivo. */
async function laudo(casoId: string, arquivo: string, dataEmissao = '2026-09-01') {
  const [d] = await banco
    .insert(documento)
    .values({ casoId, pessoaId, tipo: 'laudo', sensivel: true, chaveArmazenamento: `x/${++n}`, nomeOriginal: arquivo, mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'card', criadoEm: agora })
    .returning()
  await banco.insert(documentoMedico).values({ documentoId: d.id, tipo: 'laudo', dataEmissao, profissional: 'Dra. Exemplo' })
  return d.id
}
/** Confere cada item como a IA sugeriu. */
const conforme = (analise: { quando: string; itens: { id: string; situacao: string }[] }) => Object.fromEntries(analise.itens.map((i) => [i.id, i.situacao]))
const eventos = async (acao: string) => (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === acao)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  agora = new Date('2026-10-08T15:00:00Z')
  app = criarServidor({ banco, agora: () => agora })
  for (const [apelido, nome, perfil] of [
    ['gabi', 'Gabi', 'advogada'],
    ['helena', 'Helena', 'senior'],
    ['otavio', 'Otávio', 'senior'],
    ['ana', 'Ana', 'atendimento'],
    ['igor', 'Igor', 'juridico_adm'],
    ['julia', 'Julia', 'financeiro'],
  ] as const) {
    const [u] = await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false }).returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Rita Exemplo', situacao: 'cliente', telefone: '11999990000' }).returning()
  pessoaId = p.id
})
afterEach(() => fechar())

describe('GGVP-132 · o parecer no servidor (GGVP-20)', () => {
  it('CA1 · a análise lê os documentos médicos do caso com o roteiro em vigor; só o Jurídico recebe o conteúdo, e a leitura fica registrada', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    await laudo(casoId, 'laudo-medico-rita-exemplo.pdf')
    const gabi = (await ver('gabi', casoId)).json()
    expect([gabi.situacao, gabi.roteiro, gabi.juridico.analise.sugestao, gabi.juridico.pendente]).toEqual([
      'pendente',
      { id: 'loas-deficiente', nome: 'BPC/LOAS Deficiente', versao: 1 },
      'insuficiente',
      true,
    ])
    expect(gabi.juridico.analise.itens.filter((i: { situacao: string }) => i.situacao === 'presente').map((i: { id: string }) => i.id)).toEqual(['natureza', 'inicio', 'limitacoes'])
    // O Atendimento vê que o documento existe (tipo, data, emitente) e o resultado; nunca o conteúdo.
    const ana = (await ver('ana', casoId)).json()
    expect([ana.situacao, ana.juridico, ana.documentos]).toEqual(['pendente', undefined, [{ id: expect.any(String), tipo: 'laudo', data: '2026-09-01', emitente: 'Dra. Exemplo' }]])
    expect((await banco.select().from(acessoDadoSensivel)).map((a) => [a.usuarioId, a.recurso])).toEqual([[ids.gabi, `parecer:${casoId}`]])
    expect((await ver('julia', casoId)).statusCode).toBe(403)
    expect((await ver('gabi', '00000000-0000-0000-0000-000000000000')).statusCode).toBe(404)
  })

  it('CA3 · só o Jurídico registra: o Atendimento e o Jurídico administrativo recebem 403', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    await laudo(casoId, 'laudo-medico-rita-exemplo.pdf')
    const { analise } = (await ver('gabi', casoId)).json().juridico
    for (const quem of ['ana', 'igor']) {
      const r = await postar(quem, `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'insuficiente', abordar: 'Quais são as barreiras do dia a dia?' })
      expect([r.statusCode, r.json().erro]).toEqual([403, MSG_SEM_PERMISSAO])
    }
    expect(await banco.select().from(parecerMedico)).toEqual([])
  })

  it('CA3, CA5 · a advogada registra Insuficiente: vai para parecer_medico confirmado, abre o complemento e o histórico não leva conteúdo', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    await laudo(casoId, 'laudo-medico-rita-exemplo.pdf')
    const { analise } = (await ver('gabi', casoId)).json().juridico
    const r = await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })
    expect(r.statusCode).toBe(201)
    expect([r.json().situacao, r.json().confirmado.quem, r.json().juridico.pendente]).toEqual(['insuficiente', 'Gabi', false])
    const [linha] = await banco.select().from(parecerMedico)
    expect([linha.resultado, linha.confirmadoPor, linha.roteiroVersao]).toEqual(['insuficiente', ids.gabi, 1])
    const [complemento] = await banco.select().from(documentacaoMedica).where(eq(documentacaoMedica.parte, 'complemento'))
    expect((complemento.documento as { parecer: string; perguntas: string[] }[])[0]).toMatchObject({ parecer: 'insuficiente', perguntas: ['Qual a previsão de duração do quadro?', expect.any(String)] })
    const [evento] = await eventos('parecer_registrado')
    expect([evento.alvo, evento.detalhe]).toEqual([`caso:${casoId}`, expect.objectContaining({ situacao: 'insuficiente', corrigidos: 0 })])
    expect(JSON.stringify(evento.detalhe)).not.toContain('previsão')
  })

  it('G18 e G20 no servidor: contradição conferida não vira Suficiente; o pedido ao médico não leva CID; análise velha volta 409', async () => {
    const casoId = await novoCaso('aposentadoria_pcd')
    await laudo(casoId, 'laudo incapacidade total.pdf')
    const { analise } = (await ver('gabi', casoId)).json().juridico
    expect(analise.sugestao).toBe('contraditorio')
    const g18 = await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'suficiente' })
    expect([g18.statusCode, g18.json().erro]).toEqual([400, 'Há contradição conferida: o parecer fica Contraditório e o caso não avança (G18).'])
    const g20 = await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'insuficiente', abordar: 'Peça ao médico o CID F32.1 no laudo.' })
    expect(g20.statusCode).toBe(400)
    const velha = await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: '2026-01-01T00:00:00.000Z', conferidos: conforme(analise), decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })
    expect(velha.statusCode).toBe(409)
    const ok = await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })
    expect(ok.json().situacao).toBe('contraditorio')
  })

  it('CA4, CA6 · o laudo novo depois do parecer espera o Jurídico, com a comparação; o registro novo tira a espera aqui e na conferência', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    await laudo(casoId, 'laudo-medico-rita-exemplo.pdf', '2026-08-20')
    let { analise } = (await ver('gabi', casoId)).json().juridico
    await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'insuficiente', abordar: 'Qual a previsão de duração do quadro?' })
    agora = new Date('2026-10-09T13:00:00Z')
    const novo = await laudo(casoId, 'laudo-novo.pdf', '2026-10-01')
    const depois = (await ver('gabi', casoId)).json()
    expect([depois.laudoNovoEm, depois.juridico.pendente, depois.juridico.analise.sugestao]).toEqual(['2026-10-09', true, 'suficiente'])
    expect(depois.juridico.analise.mudou[0]).toBe('Documento novo: Laudo médico · 01/10/2026')
    expect(depois.juridico.comparacao.novo.id).toBe(novo)
    ;({ analise } = depois.juridico)
    const r = await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'suficiente' })
    expect([r.json().situacao, r.json().laudoNovoEm, r.json().juridico.registro.laudoNovo]).toEqual(['suficiente', undefined, '2026-10-09'])
    expect((await banco.select().from(documentoMedico)).every((d) => d.confirmadoPor === ids.gabi)).toBe(true)
    // O Suficiente encerra o complemento que estava aberto.
    const [complemento] = await banco.select().from(documentacaoMedica).where(eq(documentacaoMedica.parte, 'complemento'))
    expect((complemento.documento as { encerrado?: { porque: string } }[])[0].encerrado?.porque).toBe('parecer-suficiente')
  })

  it('régua documental (sem laudo) não entra no parecer médico', async () => {
    const casoId = await novoCaso('aposentadoria_idade')
    await laudo(casoId, 'laudo.pdf')
    const r = (await ver('gabi', casoId)).json()
    expect([r.situacao, r.precisaParecer, r.juridico.analise]).toEqual(['sem-documentos', false, undefined])
  })
})

describe('GGVP-132 · a dispensa do parecer por duas Sêniores no servidor (GGVP-33, G17)', () => {
  const dispensa = (casoId: string) => `/api/processos/${casoId}/parecer/dispensa`
  const JUSTIFICATIVA = 'Caso urgente: o laudo do SUS demora e há prazo do INSS.'

  it('CA2 · a primeira pede, outra Sênior aprova: o parecer fica dispensado aqui e em parecer_medico', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    const pedida = await postar('helena', dispensa(casoId), { justificativa: JUSTIFICATIVA })
    expect([pedida.statusCode, pedida.json().dispensa.pedidaPor, pedida.json().situacao]).toEqual([201, 'Helena', 'sem-documentos'])
    expect((await postar('otavio', dispensa(casoId), { justificativa: JUSTIFICATIVA })).json().erro).toBe(MSG_DISPENSA_ESPERANDO)
    const aprovada = await postar('otavio', `${dispensa(casoId)}/aprovacao`, { aprova: true })
    expect([aprovada.json().situacao, aprovada.json().dispensa.aprovadaPor]).toEqual(['dispensado', 'Otávio'])
    const [linha] = await banco.select().from(parecerMedico)
    expect([linha.resultado, linha.justificativaDispensa, linha.confirmadoPor]).toEqual(['dispensado', JUSTIFICATIVA, ids.otavio])
    expect((await eventos('parecer_dispensado')).length).toBe(1)
  })

  it('CA2 · a mesma Sênior não aprova o próprio pedido: 409, e a tentativa vai ao histórico como portão G17', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    await postar('helena', dispensa(casoId), { justificativa: JUSTIFICATIVA })
    const r = await postar('helena', `${dispensa(casoId)}/aprovacao`, { aprova: true })
    expect([r.statusCode, r.json().erro]).toEqual([409, 'Uma pessoa sozinha não dispensa o parecer: a segunda aprovação é de outra sênior (G17).'])
    const [evento] = await eventos('dispensa_parecer_recusada')
    expect(evento.detalhe).toEqual(expect.objectContaining({ portao: 'G17', passo: 'D1.24', motivo: 'mesma_senior' }))
    expect(await banco.select().from(parecerMedico)).toEqual([])
  })

  it('só a Sênior pede ou aprova; sem justificativa não pede; com parecer Suficiente não há o que dispensar', async () => {
    const casoId = await novoCaso('bpc_loas_deficiente')
    expect((await postar('gabi', dispensa(casoId), { justificativa: JUSTIFICATIVA })).statusCode).toBe(403)
    expect((await postar('helena', dispensa(casoId), { justificativa: 'curta' })).statusCode).toBe(400)
    await laudo(casoId, 'laudo.pdf')
    const { analise } = (await ver('gabi', casoId)).json().juridico
    await postar('gabi', `/api/processos/${casoId}/parecer`, { analise: analise.quando, conferidos: conforme(analise), decisao: 'suficiente' })
    expect((await postar('helena', dispensa(casoId), { justificativa: JUSTIFICATIVA })).statusCode).toBe(409)
  })
})
