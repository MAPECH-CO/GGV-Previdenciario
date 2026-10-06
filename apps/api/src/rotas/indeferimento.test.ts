import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, eventoAuditoria, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_MOTIVO_JA_REGISTRADO } from './indeferimento.ts'
import { MSG_CARTA } from './vigilia.ts'

const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-07T13:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const ler = async (apelido = 'gabi') => app.inject({ method: 'GET', url: `/api/casos/${casoId}/indeferimento`, cookies: await cookieDe(apelido) })
const PDF = { nome: 'carta.pdf', mime: 'application/pdf', conteudo: '%PDF-1.4 carta' }
async function registrar(apelido: string, motivo: string, arquivo: typeof PDF | null = null) {
  const f = '----ggv'
  const partes = [`--${f}\r\nContent-Disposition: form-data; name="motivo"\r\n\r\n${motivo}\r\n`]
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return app.inject({
    method: 'POST',
    url: `/api/casos/${casoId}/indeferimento/motivo`,
    cookies: await cookieDe(apelido),
    payload: partes.join('') + `--${f}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${f}` },
  })
}
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()

/** O que o registro do indeferido (GGVP-48) deixa: o caso na Justiça, a carta, o motivo do INSS e a tarefa D3.01. */
async function indeferido(comCarta = true) {
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
  casoId = c.id
  const [carta] = comCarta
    ? await banco
        .insert(documento)
        .values({ casoId, tipo: 'carta_indeferimento', chaveArmazenamento: `casos/${casoId}/carta`, nomeOriginal: 'carta-inss.pdf', mime: 'application/pdf', tamanho: 9, hashSha256: 'x', origem: 'portal' })
        .returning()
    : []
  await banco.insert(resultadoInss).values({ casoId, resultado: 'indeferido', dataDecisao: '2026-10-06', motivoIndeferimento: 'Renda per capita acima de 1/4 do salário mínimo', documentoId: carta?.id ?? null })
  await banco.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.01', situacao: 'aberta', iniciadaEm: AGORA })
  await banco.insert(tarefa).values({ casoId, passo: 'D3.01', titulo: 'Registrar indeferimento', perfilDono: 'advogada', evidenciaDocumentoId: carta?.id ?? null })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-52 · registrar o motivo do indeferimento', () => {
  it('CA3 · mostra a carta e o motivo do INSS ao lado do campo; só o Jurídico registra', async () => {
    await indeferido()
    const x = (await ler()).json()
    expect([x.cliente, x.motivoInss, x.carta.nome, x.motivoEscrito, x.podeRegistrar]).toEqual([
      'Sebastião Cruz',
      'Renda per capita acima de 1/4 do salário mínimo',
      'carta-inss.pdf',
      null,
      true,
    ])
    expect((await ler('ana')).json().podeRegistrar).toBe(false)
  })

  it('CA1 · o motivo com as suas palavras é obrigatório; sem o perfil, a ação é recusada', async () => {
    await indeferido()
    expect((await registrar('gabi', '   ')).json().erro).toBe('Escreva o motivo com as suas palavras')
    expect((await registrar('ana', 'Faltou o laudo')).statusCode).toBe(403)
    expect(await abertas()).toEqual(['advogada · Registrar indeferimento'])
  })

  it('CA2, CA5 a CA7 · grava no banco de motivos com o caso, conclui a tarefa, o despacho da Sênior nasce e fica na linha do processo', async () => {
    await indeferido()
    expect((await registrar('gabi', ' O INSS somou a renda do filho que não mora com ela ')).statusCode).toBe(201)
    const [r] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    expect([r.motivoEscrito, r.motivoEscritoEm?.toISOString()]).toEqual(['O INSS somou a renda do filho que não mora com ela', AGORA.toISOString()])
    expect(await abertas()).toEqual(['senior · Despachar caso'])
    const etapas = await banco.select().from(etapa).where(eq(etapa.casoId, casoId))
    expect(etapas.map((e) => [e.passo, e.situacao]).sort()).toEqual([['D3.01', 'concluida'], ['D3.03', 'aberta']])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'indeferimento_motivo_registrado'))
    expect([ev.alvo, ev.quando.toISOString()]).toEqual([`caso:${casoId}`, AGORA.toISOString()])
    const x = (await ler()).json()
    expect([x.motivoEscrito, x.podeRegistrar]).toEqual([{ texto: 'O INSS somou a renda do filho que não mora com ela', por: 'gabi', em: AGORA.toISOString() }, false])
    // CA5: confirmar de novo não duplica nada.
    expect((await registrar('gabi', 'Outro texto')).json().erro).toBe(MSG_MOTIVO_JA_REGISTRADO)
    expect(await abertas()).toEqual(['senior · Despachar caso'])
  })

  it('CA4 · sem a carta no registro do indeferido, a carta é obrigatória e fica no caso', async () => {
    await indeferido(false)
    expect((await registrar('gabi', 'Faltou o laudo')).json().erro).toBe(MSG_CARTA)
    expect((await registrar('gabi', 'Faltou o laudo', PDF)).statusCode).toBe(201)
    const [r] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    const [d] = await banco.select().from(documento).where(eq(documento.id, r.documentoId!))
    expect([d.tipo, d.nomeOriginal, d.casoId]).toEqual(['carta_indeferimento', 'carta.pdf', casoId])
  })
})
