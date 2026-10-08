import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, gravacaoRecepcao, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { SENHA_RETIRADA } from '../../../web/src/regras/entrevista.ts'
import { MSG_SEM_AVISO_NA_LIGACAO } from './conversa.ts'

// GGVP-133, parte 3: a transcrição de verdade na conversa do Relacionamento, sempre com serviço falso.
const SENHA = 'senha-do-portal-1'
const CHAVES = { OPENAI_API_KEY: 'chave-de-teste-openai', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const relogio = new Date('2026-10-08T15:00:00Z')

const DIARIZADO = {
  usage: { type: 'duration', seconds: 60 },
  segments: [
    { speaker: 'A', start: 0.5, end: 3, text: 'Bom dia, dona Maria. A ligação está sendo gravada.' },
    { speaker: 'B', start: 3.2, end: 8, text: 'Bom dia. Mudei de endereço, agora moro na Rua das Flores, 10.' },
    { speaker: 'B', start: 8.5, end: 12, text: 'A senha do gov.br é Girassol2024 se precisar.' },
  ],
}

/** O serviço falso: transcreve, arruma (devolve as falas como vieram) e entrega a chave temporária. */
function montar() {
  const pedidos: string[] = []
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    pedidos.push(u)
    const resposta = (corpo: object) => new Response(JSON.stringify(corpo), { status: 200 })
    if (u.endsWith('/audio/transcriptions')) return resposta(DIARIZADO)
    if (u.endsWith('/realtime/client_secrets')) return resposta({ value: 'ek_temporaria', expires_at: 1791500000 })
    const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
    const falas = JSON.parse(corpo.messages[1].content.split('Falas:\n')[1].replace('\n</conteudo>', '')) as { i: number; falante: string; texto: string }[]
    const papel = (f: string) => (f.endsWith('A') ? 'escritorio' : 'cliente')
    const arrumada = { falantes: Object.fromEntries(falas.map((f) => [f.falante, papel(f.falante)])), falas: falas.map((f) => ({ i: f.i, texto: f.texto })) }
    return resposta({ choices: [{ message: { content: JSON.stringify(arrumada) } }] })
  })
  const ia = criarIa({ banco, ambiente: CHAVES, fetch: fetch as unknown as typeof globalThis.fetch, agora: () => relogio })
  app = criarServidor({ banco, agora: () => relogio, ia, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'conversa-'))) })
  return pedidos
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const json = async (apelido: string, url: string, payload?: object) => (await app.inject({ method: 'POST', url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })).json()
function comArquivo(nome: string, mime: string, conteudo: string, campos: Record<string, string> = {}) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: ${mime}\r\n\r\n${conteudo}\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const subir = async (url: string, arquivo: ReturnType<typeof comArquivo>, apelido = 'ana') => app.inject({ method: 'POST', url, cookies: await cookieDe(apelido), ...arquivo })

/** O cliente do balcão, com um processo de LOAS, e a conversa aberta. */
async function conversaAberta(apelido: string, canal: 'ligacao' | 'presencial', modo: 'arquivo' | 'tempo-real') {
  const fichaId = (await json('ana', '/api/fichas', { nome: 'Maria Ribeiro', idade: 66, pretende: 'Quer saber do BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
  await banco.insert(caso).values({ pessoaId: fichaId, beneficio: 'bpc_loas_idoso', fase: 'administrativa' })
  const r = await json(apelido, '/api/conversas', { fichaId, canal, comQuem: 'cliente', modo })
  return { fichaId, id: r.conversa.id as string }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['marcos', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-133 · transcrição de verdade na conversa do Relacionamento', () => {
  it('CA2, CA3, CA6 · a ligação baixada do Chatwoot sobe na conversa, com o aviso (G10), e a OpenAI transcreve; quem fala é a Atendimento e o cliente; nada muda na ficha sozinho (G14)', async () => {
    montar()
    const { fichaId, id } = await conversaAberta('ana', 'ligacao', 'arquivo')
    const ligacao = (campos: Record<string, string>) => comArquivo('ligacao-chatwoot.mp3', 'audio/mpeg', 'ID3 ligação', campos)
    expect((await subir(`/api/conversas/${id}/audio`, ligacao({}))).json().erro).toBe(MSG_SEM_AVISO_NA_LIGACAO)
    expect((await subir(`/api/conversas/${id}/audio`, ligacao({ avisoNaGravacao: 'sim' }), 'marcos')).statusCode).toBe(403)
    const g = (await subir(`/api/conversas/${id}/audio`, ligacao({ avisoNaGravacao: 'sim' }))).json().gravacao
    expect(g).toMatchObject({ origem: 'arquivo', estado: 'encerrada', transcricao: 'transcrevendo', audio: { nome: 'ligacao-chatwoot.mp3', partes: 1 } })

    const r = await json('ana', `/api/conversas/${id}/transcricao`, {})
    expect(r.gravacao.transcricao).toBe('pronta')
    expect(r.gravacao.trechos.map((t: { quem: string; papel: string }) => [t.quem, t.papel])).toEqual([
      ['ana', 'atendimento'],
      ['Maria Ribeiro', 'cliente'],
      ['Maria Ribeiro', 'cliente'],
    ])
    expect(r.gravacao.trechos[2].texto).toContain(SENHA_RETIRADA)
    expect(JSON.stringify(r)).not.toContain('Girassol2024')
    expect(r.gravacao.extraidas).toEqual([{ id: 'senha', rotulo: 'Senha do gov.br', valor: 'dita na conversa: não consta na transcrição (G9)', destino: 'cofre' }])
    expect(r.conversa.analise.mudancas).toEqual([])
    expect(r.conversa.analise.observacao).toContain('a IA ainda não aponta as mudanças')
    expect(r.ficha.historico.map((h: { oQue: string }) => h.oQue)).toContain('A transcrição da conversa ficou pronta: está nas Transcrições do card')
    expect(r.ficha.telefone).toBe('11987654321')
    const docs = await banco.select().from(documento).where(eq(documento.pessoaId, fichaId))
    expect(docs.map((d) => d.tipo).sort()).toEqual(['audio_gravacao', 'transcricao'])
  })

  it('CA1, CA4, CA10 · a conversa no escritório: a chave do texto ao vivo, as partes do microfone pela rota da conversa e o preparo em segundo plano', async () => {
    const pedidos = montar()
    const { id } = await conversaAberta('gabi', 'presencial', 'tempo-real')
    await json('gabi', `/api/conversas/${id}/gravacao`, { avisei: true })
    expect((await json('gabi', `/api/conversas/${id}/chave-ao-vivo`)).chave).toBe('ek_temporaria')
    const parte = (inicio: string) => comArquivo(`parte-${inicio}.webm`, 'audio/webm', `parte ${inicio}`, { inicio })
    await subir(`/api/conversas/${id}/audio`, parte('0'), 'gabi')
    expect((await subir(`/api/conversas/${id}/audio`, parte('600'), 'gabi')).json().gravacao.audio.partes).toBe(2)
    const fim = await json('gabi', `/api/conversas/${id}/finalizar`, { aos: 700 })
    expect(fim.gravacao.audio.documentos.map((d: { inicio: number }) => d.inicio)).toEqual([0, 600])
    expect((await subir(`/api/conversas/${id}/audio`, parte('700'), 'gabi')).json().erro).toBe('Esta conversa não recebe mais áudio.')

    await app.prepararSugestoes()
    const [linha] = await banco.select().from(gravacaoRecepcao).where(eq(gravacaoRecepcao.id, fim.gravacao.id))
    const g = linha.dados as { transcricao: string; trechos: { aos: number; quem: string; papel: string }[] }
    expect(g.transcricao).toBe('pronta')
    expect(g.trechos.map((t) => t.aos)).toEqual([1, 3, 9, 601, 603, 609])
    expect(g.trechos[0]).toMatchObject({ quem: 'gabi', papel: 'advogada' })
    expect(pedidos.filter((u) => u.endsWith('/audio/transcriptions'))).toHaveLength(2)
  })

  it('CA4 · na ligação não há texto ao vivo', async () => {
    montar()
    const { id } = await conversaAberta('ana', 'ligacao', 'tempo-real')
    await json('ana', `/api/conversas/${id}/gravacao`, { avisei: true })
    expect((await json('ana', `/api/conversas/${id}/chave-ao-vivo`)).erro).toBe('O texto ao vivo é só da conversa no escritório, gravada agora.')
  })
})
