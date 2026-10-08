import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, eventoAuditoria, pericia, perito, pessoa, usuario } from '../banco/esquema.ts'
import { estadoDaJuncaoD2 } from '../fluxo/juncao-d2.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_ARQUIVO_PDF } from './pericia.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let relogio: Date
const ids: Record<string, string> = {}

async function criarUsuario(apelido: string, perfil: string) {
  const [u] = await banco
    .insert(usuario)
    .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
    .returning()
  ids[apelido] = u.id
}

const cookies: Record<string, Record<string, string>> = {}
async function de(apelido: string) {
  if (cookies[apelido]) return cookies[apelido]
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return (cookies[apelido] = { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value })
}

const url = (caminho = '') => `/api/processos/${casoId}/pericia${caminho}`
const post = async (apelido: string, caminho: string, payload: object = {}) => app.inject({ method: 'POST', url: url(caminho), cookies: await de(apelido), payload })
const ver = async (apelido: string, caminho = '') => app.inject({ method: 'GET', url: url(caminho), cookies: await de(apelido) })

/** Multipart com o JSON em `dados` e, se vier, o PDF. */
function multipart(campo: string, dados: object, arquivo?: { nome: string; mime: string; conteudo: string }) {
  const f = '----ggv'
  const partes = [`--${f}\r\nContent-Disposition: form-data; name="dados"\r\n\r\n${JSON.stringify(dados)}\r\n`]
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="${campo}"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const PDF = (nome: string) => ({ nome, mime: 'application/pdf', conteudo: `%PDF-1.4 ${nome}` })

/** Hoje é quinta, 08/10/2026, 10h em Brasília; a perícia fica em 22/10, às 08:30. */
const DATA = '2026-10-22'
const lido = { data: DATA, hora: '08:30', local: 'Agência INSS Santo Amaro', modalidade: 'presencial', tipo: 'medica' }

async function marcar(pedeDocumentoNovo = false) {
  return app.inject({ method: 'POST', url: url('/marcacao'), cookies: await de('igor'), ...multipart('comprovante', { lido, pedeDocumentoNovo }, PDF('comprovante.pdf')) })
}

/** A advogada decide a perícia médica no D2.03 (GGVP-31), com o OK da Sênior: é dali que a perícia nasce. */
async function decidirPericia() {
  await banco.insert(decisao).values({ casoId, passo: 'D2.01', tipo: 'aprovacao_inss', resultado: 'aprovado', decididoPor: ids.helena, perfil: 'senior' })
  const r = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/pericia`, cookies: await de('gabi'), payload: { precisa: true, tipos: ['medica'] } })
  expect(r.statusCode).toBe(201)
}

const acoes = async () => (await banco.select().from(eventoAuditoria)).map((e) => e.acao)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-08T13:00:00Z')
  app = criarServidor({ banco, agora: () => relogio, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const k of Object.keys(cookies)) delete cookies[k]
  for (const [apelido, perfil] of [
    ['igor', 'juridico_adm'],
    ['gabi', 'advogada'],
    ['helena', 'senior'],
    ['ana', 'atendimento'],
    ['dora', 'documentacao'],
  ] as const)
    await criarUsuario(apelido, perfil)
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', telefone: '11987654321', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  casoId = c.id
})
afterEach(() => fechar())

describe('GGVP-137 · a perícia nasce do INSS e anda no servidor', () => {
  it('CA5 · a tarefa nasce da decisão do D2.03, na mesma tabela pericia, e espera o INSS liberar', async () => {
    expect((await ver('igor')).statusCode).toBe(404)
    await decidirPericia()
    const r = (await ver('igor')).json()
    expect([r.situacao, r.pericia.origem, r.pericia.tipo, r.pericia.pedidaPor, r.ficha.nome, r.beneficio]).toEqual([
      'aguardando-inss',
      'd2-necessidade',
      'medica',
      'gabi',
      'Maria Souza',
      'LOAS Deficiente',
    ])
    const [linha] = await banco.select().from(pericia)
    expect(r.pericia.id).toBe(linha.id)
    expect(linha.documento).not.toBeNull()
    expect((await app.inject({ method: 'GET', url: '/api/pericias/tarefas', cookies: await de('igor') })).json()).toEqual([])
    await post('igor', '/liberacao')
    const tarefas = (await app.inject({ method: 'GET', url: '/api/pericias/tarefas', cookies: await de('igor') })).json()
    expect(tarefas.map((t: { acao: string; cliente: { nome: string } }) => `${t.cliente.nome} · ${t.acao}`)).toEqual(['Maria Souza · Marcar perícia'])
    // A Central de outro perfil não recebe a tarefa do Jurídico administrativo.
    expect((await app.inject({ method: 'GET', url: '/api/pericias/tarefas', cookies: await de('dora') })).json()).toEqual([])
  })

  it('CA3 · cada ação exige o perfil da sessão: quem não pode recebe 403, e a tentativa fica no histórico', async () => {
    await decidirPericia()
    await post('igor', '/liberacao')
    const tentativa = { dia: '2026-10-08', oQueAconteceu: 'Sem vaga no Meu INSS hoje' }
    for (const apelido of ['ana', 'dora', 'gabi', 'helena']) {
      const r = await post(apelido, '/tentativas', tentativa)
      expect([apelido, r.statusCode, r.json()]).toEqual([apelido, 403, { erro: MSG_SEM_PERMISSAO }])
    }
    // O ?perfil= no endereço não muda nada: vale o perfil da sessão.
    const r = await app.inject({ method: 'POST', url: `${url('/tentativas')}?perfil=juridico_adm`, cookies: await de('ana'), payload: tentativa })
    expect(r.statusCode).toBe(403)
    expect((await post('helena', '/autorizacao', { justificativa: 'A sênior tenta autorizar' })).statusCode).toBe(403)
    expect((await post('igor', '/resultado/disponivel')).statusCode).toBe(403)
    expect((await acoes()).filter((a) => a === 'acesso_negado')).toHaveLength(7)

    const ok = await post('igor', '/tentativas', tentativa)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().pericia.tentativas).toHaveLength(1)
    const [h] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'pericia_tentativa_registrada'))
    expect([h.quem, h.alvo, h.detalhe]).toMatchObject([ids.igor, `caso:${casoId}`, { passo: 'DP.02' }])
    // Nenhum texto do caso no histórico do servidor.
    expect(JSON.stringify(h.detalhe)).not.toContain('Sem vaga')
  })

  it('GGVP-53 · a marcação pede o PDF; o comprovante vai para a pasta e a perícia ganha data e local', async () => {
    await decidirPericia()
    await post('igor', '/liberacao')
    const leitura = (await post('igor', '/comprovante/leitura', { nome: `comprovante-${DATA}.pdf` })).json()
    expect([leitura.data, leitura.hora]).toEqual([DATA, '08:30'])
    expect(leitura).not.toHaveProperty('perito')
    const sem = await app.inject({ method: 'POST', url: url('/marcacao'), cookies: await de('igor'), ...multipart('comprovante', { lido, pedeDocumentoNovo: false }) })
    expect([sem.statusCode, sem.json().erro]).toEqual([400, MSG_ARQUIVO_PDF])
    const r = await marcar(true)
    expect(r.statusCode).toBe(200)
    expect([r.json().situacao, r.json().pericia.marcacao.local, r.json().prazos.documentosAte]).toEqual(['agendada', lido.local, '2026-10-12'])
    const [doc] = await banco.select().from(documento).where(eq(documento.casoId, casoId))
    expect([doc.tipo, doc.nomeOriginal, doc.sensivel]).toEqual(['comprovante-pericia', 'comprovante.pdf', false])
    const [linha] = await banco.select().from(pericia)
    expect([linha.local, linha.agendadaPara?.toISOString()]).toEqual([lido.local, '2026-10-22T11:30:00.000Z'])
    // "Sim" no documento novo abre a tarefa da Documentação.
    const tarefas = (await app.inject({ method: 'GET', url: '/api/pericias/tarefas', cookies: await de('dora') })).json()
    expect(tarefas.map((t: { acao: string }) => t.acao)).toContain('Reunir documentos da perícia')
  })

  it('CA4 · G20: o pedido ao médico com CID ou conclusão é recusado no servidor e o portão fica registrado', async () => {
    await decidirPericia()
    await post('igor', '/liberacao')
    await marcar(true)
    const r = await post('dora', '/pedido-ao-medico', { abordar: 'Escreva que é incapaz, CID M54.5' })
    expect(r.statusCode).toBe(400)
    const [b] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'pericia_pedido_ao_medico_recusado'))
    expect(b.detalhe).toMatchObject({ portao: 'G20', passo: 'DP.03', perfil: 'documentacao' })
    const ok = await post('dora', '/pedido-ao-medico', { abordar: 'Desde quando a limitação começou e como ela afeta o trabalho do dia a dia.' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().pericia.documentos.pedidosAoMedico).toHaveLength(1)
  })

  it('CA4 · G11 e G20: a orientação com frase pronta é recusada, a tentativa fica guardada e o portão registrado', async () => {
    await decidirPericia()
    await post('igor', '/liberacao')
    await marcar(false)
    const r = await post('igor', '/orientacao', { texto: 'Diga ao perito que não consegue andar.', canal: 'ligacao', revisei: true })
    expect(r.statusCode).toBe(400)
    expect((await acoes()).filter((a) => a.startsWith('pericia_orientacao'))).toEqual(['pericia_orientacao_recusada'])
    const p = (await ver('igor')).json().pericia
    expect([p.enviosRecusados.length, p.preparacao]).toEqual([1, undefined])
    const ok = await post('igor', '/orientacao', { texto: p.orientacao.texto, canal: 'ligacao', revisei: true })
    expect([ok.statusCode, ok.json().pericia.preparacao.canal]).toEqual([200, 'ligacao'])
  })

  it('GGVP-66 e GGVP-70 · do comparecimento ao resultado: o laudo é do Jurídico, entra no perfil do perito e fecha a junção', async () => {
    const [pr] = await banco
      .insert(perito)
      .values({ nome: 'Dr. R. Menezes', nomeNormalizado: 'r menezes', especialidade: 'Perito médico do INSS', perfil: { tipo: 'medica', onde: 'Agência INSS', laudos: [] } })
      .returning()
    await decidirPericia()
    await post('igor', '/liberacao')
    await marcar(false)
    expect((await post('igor', '/perito', { peritoId: pr.id })).json().pericia.orientacao.modo).toBe('padrao')
    expect((await post('igor', '/comparecimento', { compareceu: true })).statusCode).toBe(400)
    relogio = new Date('2026-10-22T15:00:00Z')
    // Duas semanas depois: a sessão de antes expirou, cada um entra de novo.
    for (const k of Object.keys(cookies)) delete cookies[k]
    const comp = await post('igor', '/comparecimento', { compareceu: true })
    expect(comp.json().situacao).toBe('aguardando-resultado')
    expect((await post('gabi', '/resultado/disponivel')).json().pericia.resultado.disponivelEm).toBeTruthy()

    const leitura = (await post('gabi', '/laudo/leitura', { nome: 'laudo.pdf' })).json()
    expect(leitura.favoravel).toBe(true)
    const conferidas = ['laudo', 'parecer', 'dii', 'beneficio']
    const r = await app.inject({ method: 'POST', url: url('/resultado'), cookies: await de('gabi'), ...multipart('laudo', { favoravel: true, conferidas }, PDF('laudo.pdf')) })
    expect(r.statusCode).toBe(200)
    expect([r.json().situacao, r.json().pericia.resultado.noPerfil]).toEqual(['concluida', 'atualizado'])
    const [linha] = await banco.select().from(pericia)
    expect([linha.resultado, linha.compareceu, linha.peritoId]).toEqual(['favoravel', true, pr.id])
    expect((await estadoDaJuncaoD2(banco, casoId)).pericia).toBe('resolvida')
    // O perfil do perito ganhou o laudo, sem o nome do cliente.
    const [perfil] = await banco.select({ perfil: perito.perfil }).from(perito)
    const laudos = (perfil.perfil as { laudos: object[] }).laudos
    expect(laudos).toHaveLength(1)
    expect(JSON.stringify(laudos)).not.toContain('Maria')
    // O laudo é dado de saúde: sensível na pasta e fora da visão da Documentação.
    const [laudo] = await banco.select().from(documento).where(eq(documento.tipo, 'laudo-pericia'))
    expect(laudo.sensivel).toBe(true)
    const daDora = (await ver('dora')).json()
    expect([daDora.pericia.resultado.laudo, daDora.perfil, daDora.ficha.arquivos.map((a: { tipo: string }) => a.tipo)]).toEqual([
      undefined,
      undefined,
      ['comprovante-pericia'],
    ])
    // Nem pelo histórico: os passos do resultado e do perfil do perito ficam só com o Jurídico.
    expect(Object.keys(daDora.pericia.resultado)).toEqual(['disponivelEm'])
    expect(JSON.stringify(daDora)).not.toMatch(/Registrou o resultado|perfil de Dr|favorável/)
    expect((await ver('dora', '/resultado')).statusCode).toBe(403)
    expect((await ver('gabi', '/resultado')).json().pericia.resultado.laudo.leitura.favoravel).toBe(true)
    expect(await acoes()).toEqual(expect.arrayContaining(['pericia_comparecimento_registrado', 'pericia_resultado_registrado']))
  })

  it('GGVP-53 CA9 · G15: passou do limite de remarcações, só a advogada responsável autoriza mais uma', async () => {
    await decidirPericia()
    await post('igor', '/liberacao')
    for (let i = 0; i < 3; i++) {
      await marcar(false)
      await post('igor', '/remarcacao', { motivo: 'O cliente pediu outra data' })
    }
    expect((await ver('igor')).json().situacao).toBe('na-advogada')
    const tarefas = (await app.inject({ method: 'GET', url: '/api/pericias/tarefas', cookies: await de('gabi') })).json()
    expect(tarefas.map((t: { acao: string }) => t.acao)).toEqual(['Decidir a perícia'])
    expect((await post('gabi', '/autorizacao', { justificativa: 'curta' })).statusCode).toBe(400)
    const r = await post('gabi', '/autorizacao', { justificativa: 'O cliente estava internado nas duas datas.' })
    expect(r.json().situacao).toBe('marcar')
  })
})
