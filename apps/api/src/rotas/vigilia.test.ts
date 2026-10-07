import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, etapa, eventoAuditoria, exigencia, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
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
const DEFERIDO = { tipo: 'decisao', resultado: 'deferido', texto: 'Benefício concedido.' }
const INDEFERIDO = { tipo: 'decisao', resultado: 'indeferido', texto: 'Benefício negado.', motivoInss: 'Renda per capita acima do limite' }

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
    const [res] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    expect([res.resultado, res.documentoId !== null]).toEqual(['deferido', true])
    const [e] = await banco.select().from(etapa).where(eq(etapa.passo, 'D2.04'))
    expect(e.situacao).toBe('concluida')
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'deferimento_registrado'))).length).toBe(1)
    expect((await ver()).json().registros.map((x: { resumo: string; quem: string }) => [x.resumo, x.quem])).toEqual([['Deferido', 'gabi']])
  })

  it('CA3 · deferido diferente do pedido abre a análise, não a prestação de contas', async () => {
    await registrar({ ...DEFERIDO, diferenteDoPedido: 'true' })
    expect(await abertas()).toEqual([['D2.06', 'Analisar deferimento diferente do pedido']])
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
  it('CA2 · sem a carta de indeferimento, ou sem o motivo do INSS, não registra', async () => {
    expect((await registrar(INDEFERIDO, null)).json().erro).toBe(MSG_CARTA)
    expect((await registrar({ ...INDEFERIDO, motivoInss: '' })).json().erro).toBe('Informe o motivo que consta no sistema do INSS')
  })

  it('CA1 e CA3 · o caso vai para a Justiça com a tarefa "Registrar indeferimento", a carta e o motivo', async () => {
    expect((await registrar(INDEFERIDO)).json().aberto).toBe('justica')
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect(c.fase).toBe('judicial')
    const [t] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.01')))
    const [res] = await banco.select().from(resultadoInss).where(eq(resultadoInss.casoId, casoId))
    expect([t.titulo, t.perfilDono, t.evidenciaDocumentoId, res.motivoIndeferimento]).toEqual([
      'Registrar indeferimento', 'advogada', res.documentoId, 'Renda per capita acima do limite',
    ])
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
})
