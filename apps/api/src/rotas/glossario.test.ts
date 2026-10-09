import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'
import { ROTULO_BENEFICIO } from '@ggv/contratos'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import * as esquema from '../banco/esquema.ts'
import { eventoAuditoria, glossarioTermo, juizo, perito, usuario } from '../banco/esquema.ts'
import { pastaMigracoes } from '../banco/migrar.ts'
import { termosDoGlossario } from '../fluxo/glossario.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_TERMO_REPETIDO } from './glossario.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let relogio = new Date('2026-10-08T15:00:00Z')
const passarUmMinuto = () => (relogio = new Date(relogio.getTime() + 60_000))

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const glossario = async (apelido = 'helena') => (await chamar(apelido, 'GET', '/api/configuracao/glossario')).json()
const acrescentar = (payload: object, apelido = 'helena') => chamar(apelido, 'POST', '/api/configuracao/glossario', payload)
const termo = async (nome: string) => (await glossario()).termos.find((t: { termo: string }) => t.termo === nome)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-08T15:00:00Z')
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['helena', 'senior'], ['lauro', 'socio'], ['julia', 'financeiro'], ['gabi', 'advogada']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-143 · glossário do escritório', () => {
  it('CA1 · a gestão vê o glossário; só a Sênior muda; fora da gestão, nada', async () => {
    expect([(await glossario()).podeEditar, (await glossario('lauro')).podeEditar]).toEqual([true, false])
    expect((await chamar('gabi', 'GET', '/api/configuracao/glossario')).statusCode).toBe(403)
    // GGVP-96: o Financeiro vê só os Resultados da Gestão; a configuração e o glossário, não.
    expect((await chamar('julia', 'GET', '/api/configuracao/glossario')).statusCode).toBe(403)
    expect((await acrescentar({ termo: 'DCB', tipo: 'sigla' }, 'lauro')).statusCode).toBe(403)
    const { id } = await termo('LOAS')
    expect((await chamar('julia', 'PUT', `/api/configuracao/glossario/${id}`, { termo: 'Loas', tipo: 'sigla' })).statusCode).toBe(403)
    expect((await chamar('lauro', 'DELETE', `/api/configuracao/glossario/${id}`)).statusCode).toBe(403)
    expect((await termo('LOAS')).termo).toBe('LOAS')
    const negados = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))
    expect(negados.map((e) => (e.detalhe as { acao: string }).acao).sort()).toEqual(['gestao.ver', 'gestao.ver', 'glossario.editar', 'glossario.editar', 'glossario.editar'])
  })

  it('CA1 · a Sênior acrescenta, corrige e tira; cada mudança fica no histórico da configuração, com o antes e o depois', async () => {
    const r = await acrescentar({ termo: ' 2ª Vara  Federal de Santo Amaro ', tipo: 'juizo' })
    expect(r.statusCode).toBe(201)
    const { id } = r.json()
    expect(await termo('2ª Vara Federal de Santo Amaro')).toEqual({ id, termo: '2ª Vara Federal de Santo Amaro', tipo: 'juizo', significado: null })

    expect((await acrescentar({ termo: '2ª vara federal de santo amaro', tipo: 'juizo' })).json()).toEqual({ erro: MSG_TERMO_REPETIDO })
    expect((await acrescentar({ termo: '', tipo: 'juizo' })).json()).toEqual({ erro: 'Escreva o termo' })

    passarUmMinuto()
    const corrigir = await chamar('helena', 'PUT', `/api/configuracao/glossario/${id}`, { termo: '2ª Vara Gabinete JEF de Santo Amaro', tipo: 'juizo', significado: 'Juizado' })
    expect(corrigir.statusCode).toBe(201)
    expect(await termo('2ª Vara Gabinete JEF de Santo Amaro')).toMatchObject({ id, significado: 'Juizado' })
    const { id: loas } = await termo('LOAS')
    expect((await chamar('helena', 'PUT', `/api/configuracao/glossario/${id}`, { termo: 'loas', tipo: 'sigla' })).statusCode).toBe(409)
    expect((await chamar('helena', 'PUT', '/api/configuracao/glossario/nao-existe', { termo: 'X1', tipo: 'outro' })).statusCode).toBe(404)

    passarUmMinuto()
    expect((await chamar('helena', 'DELETE', `/api/configuracao/glossario/${id}`)).json()).toEqual({ ok: true })
    expect(await termo('2ª Vara Gabinete JEF de Santo Amaro')).toBeUndefined()
    expect((await chamar('helena', 'DELETE', `/api/configuracao/glossario/${id}`)).statusCode).toBe(404)
    expect(await termo('LOAS')).toMatchObject({ id: loas })

    const historico = (await chamar('helena', 'GET', '/api/configuracao')).json().historico
    expect(historico.map((h: { quem: string; descricao: string }) => `${h.quem} · ${h.descricao}`)).toEqual([
      'helena · Glossário: "2ª Vara Gabinete JEF de Santo Amaro" tirado',
      'helena · Glossário: "2ª Vara Federal de Santo Amaro" corrigido para "2ª Vara Gabinete JEF de Santo Amaro"',
      'helena · Glossário: "2ª Vara Federal de Santo Amaro" acrescentado',
    ])
    const [corrigido] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'glossario_termo_corrigido'))
    expect(corrigido.detalhe).toMatchObject({
      antes: { termo: '2ª Vara Federal de Santo Amaro', tipo: 'juizo', significado: null },
      depois: { termo: '2ª Vara Gabinete JEF de Santo Amaro', tipo: 'juizo', significado: 'Juizado' },
    })
    expect(corrigido.alvo).toBe('configuracao')
  })

  it('CA2 · a transcrição e a IA leem do mesmo lugar: o que a Sênior acrescenta já vem na leitura do banco', async () => {
    await acrescentar({ termo: 'DCB', tipo: 'sigla', significado: 'Data de Cessação do Benefício' })
    const termos = await termosDoGlossario(banco)
    expect(termos.find((t) => t.termo === 'DCB')).toMatchObject({ tipo: 'sigla', significado: 'Data de Cessação do Benefício' })
    expect(termos).toEqual((await glossario()).termos)
  })

  it('CA3 · o glossário nasce com os benefícios do catálogo e as siglas mais usadas, com o significado', async () => {
    const termos = await termosDoGlossario(banco)
    const doTipo = (tipo: string) => termos.filter((t) => t.tipo === tipo)
    expect(doTipo('beneficio').map((t) => t.termo).sort()).toEqual(Object.values(ROTULO_BENEFICIO).filter((r) => r !== 'Outro').sort())
    expect(Object.fromEntries(doTipo('sigla').map((t) => [t.termo, t.significado]))).toEqual({
      LOAS: 'Lei Orgânica da Assistência Social',
      BPC: 'Benefício de Prestação Continuada',
      CNIS: 'Cadastro Nacional de Informações Sociais',
      NB: 'Número do Benefício',
      DER: 'Data de Entrada do Requerimento',
      DIB: 'Data de Início do Benefício',
      RPV: 'Requisição de Pequeno Valor',
      CTC: 'Certidão de Tempo de Contribuição',
    })
  })
})

describe('GGVP-143 CA3 · o glossário nasce com os peritos e juízos que o portal já conhece', () => {
  it('a migração do glossário copia os nomes de perito e de juízo que já estavam no banco, sem repetir', async () => {
    // Um banco migrado até antes do glossário, com peritos e juízos; depois, a migração do glossário.
    const pasta = await mkdtemp(join(tmpdir(), 'ggv-migracoes-'))
    await cp(pastaMigracoes, pasta, { recursive: true })
    const diario = JSON.parse(await readFile(join(pasta, 'meta/_journal.json'), 'utf8')) as { entries: { tag: string }[] }
    diario.entries = diario.entries.slice(0, diario.entries.findIndex((e) => e.tag.includes('glossario')))
    await writeFile(join(pasta, 'meta/_journal.json'), JSON.stringify(diario))
    const db = drizzle(new PGlite(), { schema: esquema })
    try {
      await migrate(db, { migrationsFolder: pasta })
      await db.insert(perito).values({ nome: 'Dra. Ana Prado (exemplo)', nomeNormalizado: 'ana prado' })
      await db.insert(juizo).values([
        { tribunal: 'TRF3', nome: '2ª Vara Federal de Santo Amaro (exemplo)' },
        { tribunal: 'TJSP', nome: '2ª Vara Federal de Santo Amaro (exemplo)' },
      ])
      await migrate(db, { migrationsFolder: pastaMigracoes })
      const linhas = await db.select({ termo: glossarioTermo.termo, tipo: glossarioTermo.tipo }).from(glossarioTermo)
      expect(linhas.filter((l) => l.tipo === 'perito' || l.tipo === 'juizo')).toEqual([
        { termo: 'Dra. Ana Prado (exemplo)', tipo: 'perito' },
        { termo: '2ª Vara Federal de Santo Amaro (exemplo)', tipo: 'juizo' },
      ])
    } finally {
      await db.$client.close()
      await rm(pasta, { recursive: true, force: true })
    }
  })
})
