import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acervoTrecho, caso, documento, etapa, eventoAuditoria, exigencia, pessoa, resultadoInss, tarefa, usuario, processoAcervo } from '../banco/esquema.ts'
import { SEM_CASO, alimentarAcervo, buscarNoAcervo } from '../ia/acervo.ts'
import { DIMENSOES_DO_VETOR, criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CARTA, MSG_COMUNICACAO, MSG_FORA_DA_VIGILIA } from './vigilia.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}

const PDF = { nome: 'comunicacao.pdf', mime: 'application/pdf', conteudo: '%PDF-1.4 inss' }
function formulario(campos: Record<string, string>, arquivo: typeof PDF | null) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const registrar = async (campos: Record<string, string>, arquivo: typeof PDF | null = PDF, apelido = 'gabi') =>
  app.inject({ method: 'POST', url: `/api/casos/${casoId}/vigilia`, cookies: await cookieDe(apelido), ...formulario(campos, arquivo) })
const ver = async (apelido = 'gabi') => app.inject({ method: 'GET', url: `/api/casos/${casoId}/vigilia`, cookies: await cookieDe(apelido) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => [t.passo, t.titulo]).sort()
/** GGVP-44 CA13 (Mateus, 14/10): de quem é a tarefa aberta com este título. */
const donoDe = async (titulo: string) => (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.titulo, titulo), isNull(tarefa.concluidaEm))))[0]?.perfilDono
const DEFERIDO = { tipo: 'decisao', resultado: 'deferido', texto: 'Benefício concedido.' }
const INDEFERIDO = {
  tipo: 'decisao',
  resultado: 'indeferido',
  texto: 'Benefício negado.',
  motivoInss: 'Renda per capita acima do limite',
  motivoEscrito: 'O INSS somou a renda do filho, que não mora com ela',
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  casoId = c.id
  await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date('2026-10-01T12:00:00Z') })
  await banco.insert(tarefa).values({ casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
})
afterEach(() => fechar())

describe('GGVP-35 · vigiar o Meu INSS', () => {
  it('CA7 · mostra o que o caso espera e desde quando; o Jurídico pode registrar, o Atendimento só vê', async () => {
    const r = (await ver()).json()
    expect([r.cliente, r.esperando, r.desde, r.podeRegistrar, r.registros]).toEqual(['Maria Souza', 'INSS decidir', '2026-10-01T12:00:00.000Z', true, []])
    expect((await ver('ana')).json().podeRegistrar).toBe(false)
    expect((await ver('julia')).statusCode).toBe(403)
  })

  it('CA5 · sem a comunicação anexada não conclui', async () => {
    const r = await registrar(DEFERIDO, null)
    expect([r.statusCode, r.json().erro]).toEqual([400, MSG_COMUNICACAO])
    expect(await abertas()).toEqual([['D2.04', 'Trazer a resposta do INSS']])
  })

  it('CA3 e CA10 · deferido: guarda a comunicação, fecha a vigília, abre "Prestar contas" e registra no histórico', async () => {
    expect((await registrar(DEFERIDO)).statusCode).toBe(201)
    expect(await abertas()).toEqual([['D2.06', 'Prestar contas']])
    expect(await donoDe('Prestar contas')).toBe('senior')
    const [res] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    expect([res.resultado, res.documentoId !== null]).toEqual(['deferido', true])
    const [e] = await banco.select().from(etapa).where(eq(etapa.passo, 'D2.04'))
    expect(e.situacao).toBe('concluida')
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'deferimento_registrado'))).length).toBe(1)
    expect((await ver()).json().registros.map((x: { resumo: string; quem: string }) => [x.resumo, x.quem])).toEqual([['Deferido', 'gabi']])
    // GGVP-158 P7.5: o deferimento entra no acervo na hora, com a data da decisão.
    const acervo = await banco.select().from(processoAcervo)
    expect(acervo.map((a) => [a.casoId, a.desfecho, a.dataDecisao, a.fonte])).toEqual([[casoId, 'deferido', res.dataDecisao, 'portal']])
  })

  it('CA3 · deferido diferente do pedido abre a análise, não a prestação de contas', async () => {
    await registrar({ ...DEFERIDO, diferenteDoPedido: 'true' })
    expect(await abertas()).toEqual([['D2.06', 'Analisar deferimento diferente do pedido']])
    expect(await donoDe('Analisar deferimento diferente do pedido')).toBe('senior')
  })

  it('CA6 e CA8 · exigência: texto e data obrigatórios, prazo a calcular, e o caso continua vigiado', async () => {
    expect((await registrar({ tipo: 'exigencia', texto: 'Trazer CadÚnico' }, null)).json().erro).toBe('Informe a data da exigência (dd/mm/aaaa)')
    expect((await registrar({ tipo: 'exigencia', texto: 'Trazer CadÚnico', data: '03/10/2026' }, null)).statusCode).toBe(201)
    const [x] = await banco.select().from(exigencia).where(eq(exigencia.casoId, casoId))
    expect([x.origem, x.recebidaEm, x.prazo]).toEqual(['inss', '2026-10-03', null])
    expect(await abertas()).toEqual([['D2.04', 'Trazer a resposta do INSS'], ['D2.05', 'Tratar exigência do INSS']])
    expect((await ver()).json().podeRegistrar).toBe(true)
  })

  it('sem vigília aberta, recusa; o Atendimento não registra', async () => {
    expect((await registrar(DEFERIDO, PDF, 'ana')).statusCode).toBe(403)
    await registrar(DEFERIDO)
    const r = await registrar(DEFERIDO)
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_FORA_DA_VIGILIA])
  })
})

describe('GGVP-48 · indeferido segue para a Justiça', () => {
  it('CA2 e GGVP-52 CA1, CA4 · sem a carta, sem o motivo do INSS ou sem o motivo com as palavras de quem viu, não registra', async () => {
    expect((await registrar(INDEFERIDO, null)).json().erro).toBe(MSG_CARTA)
    expect((await registrar({ ...INDEFERIDO, motivoInss: '' })).json().erro).toBe('Informe o motivo que consta no sistema do INSS')
    expect((await registrar({ ...INDEFERIDO, motivoEscrito: ' ' })).json().erro).toBe('Escreva o motivo com as suas palavras')
    expect(await abertas()).toEqual([['D2.04', 'Trazer a resposta do INSS']])
  })

  it('CA1, CA3 e GGVP-52 CA2, CA5 a CA7 (ajuste de 06/10) · vai para a Justiça com o motivo no banco de motivos, e a Sênior recebe "Despachar caso"', async () => {
    expect((await registrar(INDEFERIDO)).json().aberto).toBe('justica')
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect(c.fase).toBe('judicial')
    const [res] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    const [gabi] = await banco.select().from(usuario).where(eq(usuario.email, 'gabi@exemplo.ggv'))
    expect([res.motivoIndeferimento, res.motivoEscrito, res.motivoEscritoPor]).toEqual(['Renda per capita acima do limite', INDEFERIDO.motivoEscrito, gabi.id])
    expect(await abertas()).toEqual([['D3.03', 'Despachar caso']])
    const [t] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.03')))
    expect([t.perfilDono, t.evidenciaDocumentoId]).toEqual(['senior', res.documentoId])
    const etapas = (await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.diagrama, 'D3')))).map((e) => `${e.passo} ${e.situacao}`).sort()
    expect(etapas).toEqual(['D3.01 concluida', 'D3.03 aberta'])
  })

  it('a Sênior pode encerrar sem judicializar, com motivo; ninguém mais pode', async () => {
    const encerrar = async (apelido: string, motivo: string) =>
      app.inject({ method: 'POST', url: `/api/casos/${casoId}/encerrar`, cookies: await cookieDe(apelido), payload: { motivo } })
    expect((await encerrar('helena', 'x')).statusCode).toBe(409)
    await registrar(INDEFERIDO)
    expect((await ver('helena')).json().podeEncerrar).toBe(true)
    expect((await encerrar('gabi', 'x')).statusCode).toBe(403)
    expect((await encerrar('helena', ' ')).json().erro).toBe('Escreva por que o caso é encerrado')
    expect((await encerrar('helena', 'Cliente desistiu')).statusCode).toBe(201)
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect([c.fase, c.desfecho, c.causaDesfecho]).toEqual(['encerrado', 'desistencia', 'Cliente desistiu'])
    expect(await abertas()).toEqual([])
  })

  it('GGVP-158 P5.7 · o caso que a Sênior já despachou não se encerra aqui: segue para a Justiça', async () => {
    await registrar(INDEFERIDO)
    await banco.update(tarefa).set({ situacao: 'concluida', concluidaEm: new Date() }).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.03')))
    expect((await ver('helena')).json().podeEncerrar).toBe(false)
    const r = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/encerrar`, cookies: await cookieDe('helena'), payload: { motivo: 'Cliente desistiu' } })
    expect([r.statusCode, r.json().erro]).toEqual([409, 'Este caso não está esperando o despacho da Sênior.'])
    expect((await banco.select().from(caso).where(eq(caso.id, casoId)))[0].fase).toBe('judicial')
  })
})

describe('GGVP-52 · o motivo do indeferimento no banco de motivos e no acervo', () => {
  const VETOR = Array.from({ length: DIMENSOES_DO_VETOR }, () => 0.01)
  /** A IA de mentira dos vetores do acervo: com `cai`, o serviço responde 503. */
  const iaDoAcervo = (cai = false) =>
    criarIa({
      banco,
      ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' },
      fetch: async () => (cai ? new Response('fora', { status: 503 }) : new Response(JSON.stringify({ data: [{ embedding: VETOR }] }))),
    })
  const doMotivo = async () => (await banco.select().from(acervoTrecho)).filter((t) => t.origem === 'Motivo de indeferimento')

  it('GGVP-52 CA2 · o motivo salvo vai ao banco de motivos e ao acervo: a busca de outro caso o acha, com a referência do caso e sem o nome da cliente', async () => {
    expect((await registrar(INDEFERIDO)).statusCode).toBe(201)
    const [res] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    expect([res.motivoIndeferimento, res.motivoEscrito]).toEqual([INDEFERIDO.motivoInss, INDEFERIDO.motivoEscrito])
    const achados = await buscarNoAcervo(banco, { casoId: SEM_CASO, beneficio: null, consulta: 'renda do filho que não mora com ela', saude: true })
    expect(achados).toContainEqual(expect.objectContaining({ tipo: 'acervo', referencia: `caso:${casoId}`, trecho: expect.stringContaining('somou a renda do filho') }))
    expect(JSON.stringify(achados)).not.toContain('Maria Souza')
    // A rodada grava o trecho no acervo, com o caso.
    await alimentarAcervo(banco, iaDoAcervo())
    expect((await doMotivo()).map((t) => [t.casoId, t.referencia, t.texto])).toEqual([[casoId, `caso:${casoId}`, INDEFERIDO.motivoEscrito]])
  })

  it('GGVP-52 CA5 · a falha em cada gravação fica visível e a nova tentativa grava uma vez só: o registro no banco de motivos e o trecho no acervo', async () => {
    // O banco de motivos: o armazenamento cai na primeira tentativa; nada fica gravado pela metade.
    const local = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-')))
    let cair = true
    const instavel: Armazenamento = {
      salvar: async (chave, conteudo, mime) => {
        if (cair) throw new Error('o disco não respondeu')
        return local.salvar(chave, conteudo, mime)
      },
      ler: local.ler,
    }
    app = criarServidor({ banco, armazenamento: instavel })
    const falhou = await registrar(INDEFERIDO)
    expect(falhou.statusCode).toBeGreaterThanOrEqual(500)
    expect([await banco.select().from(resultadoInss), await banco.select().from(documento)]).toEqual([[], []])
    expect((await banco.select().from(caso).where(eq(caso.id, casoId)))[0].fase).toBe('administrativa')
    cair = false
    expect((await registrar(INDEFERIDO)).statusCode).toBe(201)
    expect((await registrar(INDEFERIDO)).statusCode).toBe(409)
    expect((await banco.select().from(resultadoInss)).map((r) => r.casoId)).toEqual([casoId])

    // O acervo: a IA cai no vetor; o trecho fica sem vetor e a falha aparece nas chamadas da IA do caso.
    expect(await alimentarAcervo(banco, iaDoAcervo(true))).toMatchObject({ vetores: 0 })
    expect((await doMotivo()).map((t) => [t.casoId, t.embedding])).toEqual([[casoId, null]])
    const chamadas = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/ia`, cookies: await cookieDe('gabi') })).json().chamadas
    expect(chamadas.map((c: { finalidade: string; situacao: string }) => [c.finalidade, c.situacao])).toContainEqual(['vetor_acervo', 'falhou'])
    // A rodada seguinte completa o mesmo trecho, sem outro.
    expect(await alimentarAcervo(banco, iaDoAcervo())).toMatchObject({ novos: 0, vetores: 1 })
    expect(await alimentarAcervo(banco, iaDoAcervo())).toEqual({ novos: 0, vetores: 0 })
    expect((await doMotivo()).map((t) => [t.casoId, t.embedding?.length])).toEqual([[casoId, DIMENSOES_DO_VETOR]])
  })
})
