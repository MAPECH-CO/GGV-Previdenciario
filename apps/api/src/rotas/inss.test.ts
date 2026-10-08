import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import {
  caso,
  credencialGovbr,
  decisao,
  documento,
  etapa,
  eventoAuditoria,
  pericia,
  pessoa,
  requerimentoInss,
  tarefa,
  usuario,
} from '../banco/esquema.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_COMPROVANTE, MSG_SEM_OK_SENIOR } from './inss.ts'

const SENHA = 'senha-do-portal-1'
const cofre = criarCofre(chaveDoCofre({}))
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

async function criarUsuario(apelido: string, perfil: string) {
  const [u] = await banco
    .insert(usuario)
    .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
    .returning()
  ids[apelido] = u.id
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}

/** Corpo multipart para o protocolo: campos e, se vier, o comprovante. */
function formulario(campos: Record<string, string>, arquivo?: { nome: string; mime: string; conteudo: string }) {
  const fronteira = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${fronteira}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo)
    partes.push(`--${fronteira}\r\nContent-Disposition: form-data; name="comprovante"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return { payload: partes.join('') + `--${fronteira}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${fronteira}` } }
}

const CAMPOS_OK = { numero: '1234.567-8', der: '05/10/2026', revisado: 'true' }
const COMPROVANTE = { nome: 'comprovante.pdf', mime: 'application/pdf', conteudo: '%PDF-1.4 comprovante' }

/** `arquivo: null` = sem comprovante. */
async function protocolar(cookies: Record<string, string>, campos: Record<string, string> = CAMPOS_OK, arquivo: typeof COMPROVANTE | null = COMPROVANTE) {
  return app.inject({ method: 'POST', url: `/api/casos/${casoId}/protocolo`, cookies, ...formulario(campos, arquivo ?? undefined) })
}

async function okDaSenior() {
  await banco.insert(decisao).values({ casoId, passo: 'D2.01', tipo: 'aprovacao_inss', resultado: 'aprovado', decididoPor: ids.helena, perfil: 'senior' })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, cofre, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['igor', 'juridico_adm'], ['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento']] as const)
    await criarUsuario(apelido, perfil)
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  casoId = c.id
  for (const [i, tipo] of ['rg', 'laudo', 'procuracao'].entries())
    await banco.insert(documento).values({
      casoId, tipo, chaveArmazenamento: `x/${i}`, nomeOriginal: `${tipo}.pdf`, mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'balcao', criadoEm: new Date(Date.UTC(2026, 9, 1, i)),
    })
  await banco.insert(credencialGovbr).values({ pessoaId: p.id, ...cofre.cifrar('senha-gov-da-maria') })
  await banco.insert(tarefa).values([
    { casoId, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm' },
    { casoId, passo: 'D2.03', titulo: 'Decidir perícia', perfilDono: 'advogada' },
  ])
})
afterEach(() => fechar())

describe('Central do perfil', () => {
  it('GGVP-27 CA1 e CA5 · o protocolo só aparece na fila do Jurídico administrativo depois do OK da Sênior', async () => {
    const igor = await cookieDe('igor')
    expect((await app.inject({ method: 'GET', url: '/api/tarefas', cookies: igor })).json()).toEqual([])
    await okDaSenior()
    const [linha] = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: igor })).json()
    expect([linha.titulo, linha.cliente.nome, linha.tela]).toEqual(['Protocolar no Meu INSS', 'Maria Souza', `/casos/${casoId}/protocolo`])
  })

  it('cada perfil vê só as tarefas da sua raia', async () => {
    const tarefasDa = async (apelido: string) =>
      (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe(apelido) })).json().map((t: { titulo: string }) => t.titulo)
    expect(await tarefasDa('gabi')).toEqual(['Decidir perícia'])
    expect(await tarefasDa('ana')).toEqual([])
  })
})

describe('GGVP-27 · Protocolar no Meu INSS', () => {
  it('CA1 · abre o caso com os documentos na ordem e o aviso do cofre; outro perfil não abre', async () => {
    await okDaSenior()
    const r = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/protocolo`, cookies: await cookieDe('igor') })).json()
    expect(r.documentos.map((d: { tipo: string }) => d.tipo)).toEqual(['rg', 'laudo', 'procuracao'])
    expect([r.cliente, r.temSenhaNoCofre, r.okSenior.por, r.jaProtocolado]).toEqual(['Maria Souza', true, 'helena', false])
    const ana = await app.inject({ method: 'GET', url: `/api/casos/${casoId}/protocolo`, cookies: await cookieDe('ana') })
    expect([ana.statusCode, ana.json()]).toEqual([403, { erro: MSG_SEM_PERMISSAO }])
  })

  it('CA3 · sem o OK da Sênior, o servidor recusa e registra', async () => {
    const r = await protocolar(await cookieDe('igor'))
    expect([r.statusCode, r.json()]).toEqual([409, { erro: MSG_SEM_OK_SENIOR }])
    expect(await banco.select().from(requerimentoInss)).toEqual([])
    expect((await banco.select().from(eventoAuditoria)).map((e) => e.acao)).toContain('protocolo_recusado_sem_ok')
    const [b] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'protocolo_recusado_sem_ok'))
    expect(b.detalhe).toMatchObject({ portao: 'G2', passo: 'D2.02' })
  })

  it('CA4 · número, DER, conferência e comprovante são obrigatórios, com mensagem clara', async () => {
    await okDaSenior()
    const igor = await cookieDe('igor')
    const erro = async (campos: Record<string, string>, arquivo: typeof COMPROVANTE | null = null) => (await protocolar(igor, campos, arquivo)).json().erro
    expect(await erro({ ...CAMPOS_OK, numero: '' }, COMPROVANTE)).toBe('Informe o número do requerimento')
    expect(await erro({ ...CAMPOS_OK, der: '31/02/2026' }, COMPROVANTE)).toBe('Informe a data de entrada do requerimento (dd/mm/aaaa)')
    expect(await erro({ ...CAMPOS_OK, revisado: 'false' }, COMPROVANTE)).toBe('Marque "Revisei o requerimento antes de enviar"')
    expect(await erro(CAMPOS_OK)).toBe(MSG_COMPROVANTE)
    expect(await erro(CAMPOS_OK, { ...COMPROVANTE, mime: 'text/html' })).toBe(MSG_COMPROVANTE)
  })

  it('CA2 e CA7 · registra o protocolo, guarda o comprovante, conclui a tarefa e o caso passa a esperar o INSS', async () => {
    await okDaSenior()
    const igor = await cookieDe('igor')
    const r = await protocolar(igor)
    expect(r.statusCode).toBe(201)
    const [req] = await banco.select().from(requerimentoInss)
    expect([req.numero, req.der, req.registradoPor]).toEqual(['12345678', '2026-10-05', ids.igor])
    const [comprovante] = await banco.select().from(documento).where(eq(documento.id, req.comprovanteDocumentoId))
    expect([comprovante.tipo, comprovante.hashSha256]).toEqual(['comprovante_protocolo_inss', expect.stringMatching(/^[0-9a-f]{64}$/)])
    const [espera] = await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.E1')))
    expect(espera.situacao).toBe('aguardando_externo')
    expect((await app.inject({ method: 'GET', url: '/api/tarefas', cookies: igor })).json()).toEqual([])
    expect((await protocolar(igor)).statusCode).toBe(409)
  })

  it('CA6 · a senha do gov.br só com a senha do portal, por tempo limitado, e o uso vai para o histórico', async () => {
    await okDaSenior()
    const igor = await cookieDe('igor')
    const errada = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/cofre`, cookies: igor, payload: { senhaDoPortal: 'errada' } })
    expect(errada.statusCode).toBe(403)
    const certa = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/cofre`, cookies: igor, payload: { senhaDoPortal: SENHA } })
    expect(certa.json()).toEqual({ senha: 'senha-gov-da-maria', segundos: 60 })
    expect(certa.headers['cache-control']).toBe('no-store')
    const eventos = await banco.select().from(eventoAuditoria)
    expect(eventos.map((e) => e.acao)).toEqual(expect.arrayContaining(['cofre_negado', 'cofre_senha_lida']))
    expect(JSON.stringify(eventos)).not.toContain('senha-gov-da-maria')
  })
})

describe('GGVP-31 · Mandar para perícia', () => {
  const decidir = async (apelido: string, corpo: unknown) =>
    app.inject({ method: 'POST', url: `/api/casos/${casoId}/pericia`, cookies: await cookieDe(apelido), payload: corpo as object })

  it('CA5 · sem resposta, ou "sim" sem tipo, o servidor recusa; só a advogada decide', async () => {
    await okDaSenior()
    expect((await decidir('gabi', {})).statusCode).toBe(400)
    expect((await decidir('gabi', { precisa: true, tipos: [] })).json().erro).toBe('Escolha a perícia médica, a avaliação social ou as duas')
    expect((await decidir('igor', { precisa: false })).statusCode).toBe(403)
  })

  it('CA1 e CA6 · com perícia: decisão com autora e horário, uma perícia por tipo e a tarefa aberta pelo sistema para o Jurídico administrativo', async () => {
    await okDaSenior()
    expect((await decidir('gabi', { precisa: true, tipos: ['medica', 'social'] })).statusCode).toBe(201)
    const [d] = await banco.select().from(decisao).where(eq(decisao.passo, 'D2.03'))
    expect([d.resultado, d.decididoPor, d.perfil]).toEqual(['com_pericia', ids.gabi, 'advogada'])
    expect((await banco.select().from(pericia)).map((p) => p.tipo).sort()).toEqual(['medica', 'social'])
    const titulos = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('igor') })).json().map((t: { titulo: string }) => t.titulo)
    expect(titulos).toContain('Marcar perícia médica e avaliação social')
    expect((await decidir('gabi', { precisa: false })).statusCode).toBe(409)
  })

  it('CA2 e CA3 · sem perícia e com o protocolo feito, o caso entra na vigília', async () => {
    await okDaSenior()
    await protocolar(await cookieDe('igor'))
    const r = await decidir('gabi', { precisa: false })
    expect(r.json().juncao).toEqual({ protocolo: true, pericia: 'sem_pericia', fechou: true })
    expect(await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.04')))).toHaveLength(1)
  })
})
