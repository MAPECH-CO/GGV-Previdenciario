import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, asc, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { eventoAuditoria, modelo, usuario } from '../banco/esquema.ts'
import { MSG_CPF_ESCRITO, MSG_NAO_E_DOCX, MSG_SEM_VARIAVEL } from '../kit/docx.ts'
import { docxDeTeste, formularioDoArquivo } from '../kit/docx-de-teste.ts'
import type { ArquivoDoModelo } from '../kit/modelos.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_ENVIE_O_MODELO } from './modelos.ts'

const SENHA = 'senha-do-portal-1'
const APOSENTADORIAS = 'contrato-completo-aposentadorias'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let arquivos: Armazenamento
let relogio = new Date('2026-10-09T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}

const subir = async (apelido: string, id: string, arquivo: Buffer | null, nome?: string) =>
  app.inject({ method: 'PUT', url: `/api/configuracao/modelos/${id}`, cookies: await cookieDe(apelido), ...formularioDoArquivo(arquivo, nome) })
const lista = async (apelido = 'helena') => app.inject({ method: 'GET', url: '/api/configuracao/modelos', cookies: await cookieDe(apelido) })
const MODELO_VALIDO = () => docxDeTeste(['Contrato de {{NOME COMPLETO}}, CPF {{NÚMERO DO CPF}}', 'São Paulo, {{DATA DE HOJE}}.'])
const linhas = () => banco.select().from(modelo).where(and(eq(modelo.tipo, 'contrato'), eq(modelo.nome, APOSENTADORIAS))).orderBy(asc(modelo.versao))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-09T15:00:00Z')
  arquivos = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'modelos-')))
  app = criarServidor({ banco, agora: () => relogio, armazenamento: arquivos })
  for (const [apelido, perfil] of [['helena', 'senior'], ['lauro', 'socio'], ['ana', 'atendimento'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-136 CA1 · modelo com versão, subido pela Configuração', () => {
  it('a Sênior sobe o modelo: o arquivo fica no armazenamento privado, com a versão 1, e a lista mostra a versão em vigor', async () => {
    const antes = (await lista()).json()
    expect(antes.podeSubir).toBe(true)
    expect(antes.modelos).toHaveLength(9)
    expect(antes.modelos.find((m: { id: string }) => m.id === APOSENTADORIAS)).toEqual({ id: APOSENTADORIAS, nome: 'Contrato Completo de aposentadorias', versao: null, vigenteDesde: null })

    const docx = MODELO_VALIDO()
    const r = await subir('helena', APOSENTADORIAS, docx)
    expect([r.statusCode, r.json()]).toEqual([201, { ok: true, versao: 1 }])

    const [linha] = await linhas()
    expect([linha.versao, linha.ativo]).toEqual([1, true])
    const arquivo = JSON.parse(linha.conteudo) as ArquivoDoModelo
    expect(await arquivos.ler(arquivo.chave)).toEqual(docx)
    expect([arquivo.tamanho, arquivo.chave.startsWith(`modelos/${APOSENTADORIAS}/`)]).toEqual([docx.length, true])
    expect((await lista()).json().modelos.find((m: { id: string }) => m.id === APOSENTADORIAS)).toMatchObject({ versao: 1, vigenteDesde: '2026-10-09T15:00:00.000Z' })
  })

  it('trocar o modelo cria a versão seguinte: a nova é a única em vigor e a anterior fica guardada', async () => {
    const primeiro = MODELO_VALIDO()
    const segundo = docxDeTeste(['Contrato novo de {{NOME COMPLETO}}'])
    await subir('helena', APOSENTADORIAS, primeiro)
    relogio = new Date('2026-10-10T12:00:00Z')
    expect((await subir('helena', APOSENTADORIAS, segundo)).json()).toEqual({ ok: true, versao: 2 })

    const [v1, v2] = await linhas()
    expect([v1.versao, v1.ativo, v2.versao, v2.ativo]).toEqual([1, false, 2, true])
    // A versão 1 continua no armazenamento: o kit já gerado com ela não perde o modelo da época.
    expect(await arquivos.ler((JSON.parse(v1.conteudo) as ArquivoDoModelo).chave)).toEqual(primeiro)
    expect(await arquivos.ler((JSON.parse(v2.conteudo) as ArquivoDoModelo).chave)).toEqual(segundo)
    expect((await lista()).json().modelos.find((m: { id: string }) => m.id === APOSENTADORIAS)).toMatchObject({ versao: 2, vigenteDesde: '2026-10-10T12:00:00.000Z' })
  })

  it('só a Sênior sobe o modelo; a gestão vê a lista, mas não sobe; fora da gestão, nem vê', async () => {
    for (const apelido of ['lauro', 'ana', 'julia']) expect((await subir(apelido, APOSENTADORIAS, MODELO_VALIDO())).statusCode, apelido).toBe(403)
    expect(await linhas()).toEqual([])
    expect((await lista('lauro')).json().podeSubir).toBe(false)
    expect([(await lista('ana')).statusCode, (await lista('julia')).statusCode]).toEqual([403, 403])
  })

  it('a publicação vai para o histórico da configuração, com quem subiu, sem o nome do arquivo enviado', async () => {
    await subir('helena', APOSENTADORIAS, MODELO_VALIDO(), 'Contrato de Fulana Exemplo.docx')
    const config = (await app.inject({ method: 'GET', url: '/api/configuracao', cookies: await cookieDe('helena') })).json()
    expect(config.historico.map((h: { quem: string; descricao: string }) => [h.quem, h.descricao])).toContainEqual(['helena', 'Modelo "Contrato Completo de aposentadorias": versão 1 publicada'])
    const guardado = JSON.stringify([await linhas(), await banco.select().from(eventoAuditoria)])
    expect(guardado).not.toContain('Fulana Exemplo')
  })

  it('recusa o que não é modelo e não grava nada: sem arquivo, não é do Word, sem variável, variável desconhecida, CPF escrito, chave mal fechada', async () => {
    const recusas: [string, Buffer | null, string][] = [
      ['sem arquivo', null, MSG_ENVIE_O_MODELO],
      ['texto solto', Buffer.from('isto não é um zip'), MSG_NAO_E_DOCX],
      ['sem variável', docxDeTeste(['Contrato já preenchido de Fulano']), MSG_SEM_VARIAVEL],
      ['variável desconhecida', docxDeTeste(['{{NOME COMPLETO}} e {{CPF DO CLIENTE}}']), 'O modelo tem variáveis que o portal não sabe preencher: {{CPF DO CLIENTE}}. Confira a escrita no Word.'],
      ['CPF escrito', docxDeTeste(['{{NOME COMPLETO}}, CPF 123.456.789-09']), MSG_CPF_ESCRITO],
      ['chave mal fechada', docxDeTeste(['{{NOME COMPLETO}} {{NÚMERO DO CPF']), 'O modelo tem uma {{VARIÁVEL}} mal escrita (perto de "{NÚMERO"): confira as chaves {{ }} no Word.'],
    ]
    for (const [nome, arquivo, mensagem] of recusas) {
      const r = await subir('helena', APOSENTADORIAS, arquivo)
      expect([nome, r.statusCode, r.json().erro]).toEqual([nome, 400, mensagem])
    }
    expect(await linhas()).toEqual([])
  })

  it('a variável que o Word parte em vários pedaços é reconhecida; o nome com acento solto também', async () => {
    const quebrado = docxDeTeste(['Olá {{NOME |COMPLETO}} e {{NÚMERO DO C|PF}}', `{{NÚMERO DO RG}}`])
    expect((await subir('helena', APOSENTADORIAS, quebrado)).statusCode).toBe(201)
  })

  it('modelo fora da lista do kit é recusado', async () => {
    expect((await subir('helena', 'modelo-99', MODELO_VALIDO())).statusCode).toBe(404)
  })
})
