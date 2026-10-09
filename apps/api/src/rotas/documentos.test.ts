import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, documento, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_DOCUMENTO_DE_PECA, MSG_DOCUMENTO_SENSIVEL, ehPeca } from './documentos.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let arquivos: Armazenamento
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const baixar = async (apelido: string, doc: string, caso = casoId) => app.inject({ method: 'GET', url: `/api/casos/${caso}/documentos/${doc}`, cookies: await cookieDe(apelido) })

async function guardar(nome: string, conteudo: string, sensivel = false, gravarArquivo = true, mime = 'application/pdf', tipo = 'carta_inss') {
  const chave = `casos/${casoId}/${nome}`
  if (gravarArquivo) await arquivos.salvar(chave, Buffer.from(conteudo), mime)
  const [d] = await banco
    .insert(documento)
    .values({ casoId, tipo, sensivel, chaveArmazenamento: chave, nomeOriginal: nome, mime, tamanho: conteudo.length, hashSha256: 'x', origem: 'portal' })
    .returning()
  return d.id
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  arquivos = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-')))
  app = criarServidor({ banco, armazenamento: arquivos })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
  casoId = c.id
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('baixar documento do caso (GGVP-52 CA3, GGVP-71 CA11)', () => {
  it('devolve o arquivo com o tipo e o nome original, para abrir no navegador', async () => {
    const doc = await guardar('carta de indeferimento.pdf', '%PDF-1.4 carta')
    const r = await baixar('ana', doc)
    expect([r.statusCode, r.headers['content-type'], r.body]).toEqual([200, 'application/pdf', '%PDF-1.4 carta'])
    expect(r.headers['content-disposition']).toBe("inline; filename*=UTF-8''carta%20de%20indeferimento.pdf")
    expect([r.headers['x-content-type-options'], r.headers['content-security-policy']]).toEqual(['nosniff', "sandbox; default-src 'none'"])
  })

  it('arquivo que não é PDF nem imagem não abre no navegador: baixa como arquivo', async () => {
    const doc = await guardar('pagina.html', '<script>alert(1)</script>', false, true, 'text/html')
    const r = await baixar('gabi', doc)
    expect([r.headers['content-type'], r.headers['content-disposition']]).toEqual(['application/octet-stream', "attachment; filename*=UTF-8''pagina.html"])
  })

  it('dado de saúde: só o Jurídico abre, e cada leitura fica registrada (LGPD)', async () => {
    const doc = await guardar('laudo.pdf', '%PDF-1.4 laudo', true)
    expect((await baixar('ana', doc)).json().erro).toBe(MSG_DOCUMENTO_SENSIVEL)
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))).length).toBe(1)
    expect((await baixar('gabi', doc)).statusCode).toBe(200)
    const acessos = await banco.select().from(acessoDadoSensivel)
    expect(acessos.map((a) => [a.perfil, a.casoId, a.recurso])).toEqual([['advogada', casoId, `documento:${doc}`]])
  })

  it('GGVP-96 · peça jurídica (o pacote da petição, as versões da manifestação): só quem vê a petição abre', async () => {
    expect(['pacote_peticao', 'manifestacao_versao', 'dilacao_versao', 'carta_inss', 'citado_peticao', 'comprovante_protocolo_judicial'].filter(ehPeca)).toEqual([
      'pacote_peticao',
      'manifestacao_versao',
      'dilacao_versao',
    ])
    const pacote = await guardar('peticao-inicial-v1.pdf', '%PDF-1.4 peça', false, true, 'application/pdf', 'pacote_peticao')
    const versao = await guardar('manifestacao.pdf', '%PDF-1.4 manifestação', false, true, 'application/pdf', 'manifestacao_versao')
    for (const doc of [pacote, versao]) {
      expect((await baixar('ana', doc)).json().erro).toBe(MSG_DOCUMENTO_DE_PECA)
      expect((await baixar('gabi', doc)).statusCode).toBe(200)
    }
    const negados = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))
    expect(negados.map((e) => (e.detalhe as { acao: string }).acao)).toEqual(['peticao.ver', 'peticao.ver'])
  })

  it('documento de outro caso, identificador inválido ou arquivo fora do armazenamento: não encontrado', async () => {
    const doc = await guardar('carta.pdf', '%PDF-1.4 carta')
    const [p] = await banco.insert(pessoa).values({ nome: 'Outra' }).returning()
    const [outro] = await banco.insert(caso).values({ pessoaId: p.id }).returning()
    expect((await baixar('gabi', doc, outro.id)).statusCode).toBe(404)
    expect((await baixar('gabi', 'nao-e-uuid')).statusCode).toBe(404)
    const semArquivo = await guardar('sumiu.pdf', '%PDF', false, false)
    expect((await baixar('gabi', semArquivo)).json().erro).toBe('O arquivo deste documento não está no armazenamento.')
  })
})
