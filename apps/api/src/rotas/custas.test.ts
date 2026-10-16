import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MSG_SEM_COMPROVANTE } from '@ggv/contratos'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, custoProcesso, eventoAuditoria, pessoa, prestacaoContas, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CANCELADO, MSG_DATA_FUTURA, MSG_JA_DECIDIDO } from './custas.ts'

const SENHA = 'senha-do-portal-1'
/** Relógio fixo: 09/10/2026 de manhã em Brasília. */
const AGORA = new Date('2026-10-09T13:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

const PERFIS = [
  ['helena', 'senior'],
  ['julia', 'financeiro'],
  ['otavio', 'socio'],
  ['gabi', 'advogada'],
  ['igor', 'juridico_adm'],
  ['ana', 'atendimento'],
  ['lia', 'atendimento_lider'],
  ['dora', 'documentacao'],
] as const
const SEM_CUSTAS = ['gabi', 'igor', 'ana', 'lia', 'dora']

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const FOTO = { nome: 'recibo.jpg', mime: 'image/jpeg', conteudo: 'JPEG-de-teste' }
function formulario(campos: Record<string, string>, arquivo: typeof FOTO | null) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const GASTO = { data: '05/10/2026', descricao: 'Uber para levar o cliente à perícia', valor: '45,90' }
const url = (resto = '') => `/api/casos/${casoId}/custas${resto}`
const ver = async (apelido: string) => app.inject({ method: 'GET', url: url(), cookies: await cookieDe(apelido) })
const lancar = async (apelido: string, campos: Record<string, string> = GASTO, arquivo: typeof FOTO | null = FOTO) =>
  app.inject({ method: 'POST', url: url(), cookies: await cookieDe(apelido), ...formulario(campos, arquivo) })
const acao = async (apelido: string, custo: string, qual: string, payload: object = {}) =>
  app.inject({ method: 'POST', url: url(`/${custo}/${qual}`), cookies: await cookieDe(apelido), payload })
const visao = async (apelido: string, mes = '2026-10') => app.inject({ method: 'GET', url: `/api/custas?mes=${mes}`, cookies: await cookieDe(apelido) })
const historicoDo = (custo: string) => banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.alvo, `custo:${custo}`))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of PERFIS) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Cliente Inventada', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial', advogadaResponsavelId: ids.gabi }).returning()
  casoId = c.id
  // A versão 2 corrige a 1: ganhos são os honorários da mais recente que o Financeiro recebeu; a 3 ainda não foi recebida.
  const versao = (versao: number, honorarios: string, recebidaEm?: Date) =>
    banco.insert(prestacaoContas).values({
      casoId,
      versao,
      valorRecebido: '5000.00',
      honorarios,
      valorCliente: '1.00',
      okAdvogadaPor: ids.gabi,
      okAdvogadaEm: AGORA,
      ...(recebidaEm && { recebidaPor: ids.julia, recebidaEm }),
    })
  await versao(1, '1000.00', new Date('2026-10-02T15:00:00Z'))
  await versao(2, '1500.00', new Date('2026-10-03T15:00:00Z'))
  await versao(3, '9999.00')
})
afterEach(() => fechar())

describe('GGVP-157 · custas do processo', () => {
  it('CA2 · sem comprovante não envia; com ele, o lançamento da Sênior espera o Financeiro e não conta no lucro', async () => {
    const sem = await lancar('helena', GASTO, null)
    expect([sem.statusCode, sem.json().erro]).toEqual([400, MSG_SEM_COMPROVANTE])
    const texto = await lancar('helena', GASTO, { nome: 'a.txt', mime: 'text/plain', conteudo: 'x' })
    expect(texto.statusCode).toBe(400)
    expect(await banco.select().from(custoProcesso)).toHaveLength(0)

    const r = await lancar('helena')
    expect([r.statusCode, r.json().situacao]).toEqual([201, 'esperando'])
    const card = (await ver('helena')).json()
    expect(card.totais).toEqual({ ganhos: '1500.00', custos: '0.00', lucro: '1500.00', esperando: '45.90' })
    expect(card.lancamentos).toEqual([
      { id: r.json().id, data: '2026-10-05', descricao: GASTO.descricao, lancadoPor: 'helena', valor: '45.90', situacao: 'esperando', motivo: null },
    ])
    expect([card.cliente, card.origem, card.podeLancar, card.podeAprovar]).toEqual(['Cliente Inventada', 'justica', true, false])
  })

  it('CA2 · a data do gasto não pode ser depois de hoje, e o valor passa pela regra do campo', async () => {
    expect((await lancar('helena', { ...GASTO, data: '10/10/2026' })).json().erro).toBe(MSG_DATA_FUTURA)
    expect((await lancar('helena', { ...GASTO, valor: '0' })).statusCode).toBe(400)
  })

  it('CA3, CA4 · o Financeiro aprova (passa a contar) ou recusa com motivo (não conta e fica); o que ele lança já entra aprovado', async () => {
    const uber = (await lancar('helena')).json().id
    const comissao = (await lancar('helena', { data: '01/10/2026', descricao: 'Comissão de captação', valor: '300,00' })).json().id
    expect((await acao('julia', uber, 'aprovacao')).json().situacao).toBe('aprovado')
    expect((await acao('julia', uber, 'aprovacao')).json().erro).toBe(MSG_JA_DECIDIDO)
    expect((await acao('julia', comissao, 'recusa', { motivo: '' })).statusCode).toBe(400)
    expect((await acao('julia', comissao, 'recusa', { motivo: 'Comprovante ilegível' })).json().situacao).toBe('recusado')
    const proprio = await lancar('julia', { data: '06/10/2026', descricao: 'Cópias do processo', valor: '10,10' })
    expect(proprio.json().situacao).toBe('aprovado')

    // O Financeiro chega às custas sem abrir o processo (processo.abrir continua só do Jurídico e do Sócio).
    expect((await app.inject({ method: 'GET', url: `/api/casos/${casoId}/processo`, cookies: await cookieDe('julia') })).statusCode).toBe(403)
    const card = (await ver('julia')).json()
    expect(card.totais).toEqual({ ganhos: '1500.00', custos: '56.00', lucro: '1444.00', esperando: '0.00' })
    expect(card.lancamentos.find((l: { id: string }) => l.id === comissao)).toMatchObject({ situacao: 'recusado', motivo: 'Comprovante ilegível' })
    expect([card.podeLancar, card.podeAprovar]).toEqual([true, true])
    const [recusa] = await historicoDo(comissao).then((e) => e.filter((x) => x.acao === 'custo_recusado'))
    expect([recusa.quem, (recusa.detalhe as { motivo: string }).motivo]).toEqual([ids.julia, 'Comprovante ilegível'])
  })

  it('CA8 · corrigir e cancelar guardam o antes e o depois, quem e quando; nada é apagado', async () => {
    const id = (await lancar('julia')).json().id
    const corrigido = await acao('helena', id, 'correcao', { ...GASTO, valor: '50,00' })
    // Corrigido pela Sênior, volta a esperar o Financeiro.
    expect(corrigido.json().situacao).toBe('esperando')
    expect((await acao('helena', id, 'cancelamento')).json().situacao).toBe('cancelado')
    expect((await acao('helena', id, 'cancelamento')).json().erro).toBe(MSG_CANCELADO)
    expect((await acao('julia', id, 'correcao', GASTO)).json().erro).toBe(MSG_CANCELADO)

    const eventos = await historicoDo(id)
    expect(eventos.map((e) => [e.acao, e.quem])).toEqual([
      ['custo_lancado', ids.julia],
      ['custo_corrigido', ids.helena],
      ['custo_cancelado', ids.helena],
    ])
    expect(eventos[1].detalhe).toMatchObject({ antes: { valor: '45.90', situacao: 'aprovado' }, depois: { valor: '50.00', situacao: 'esperando' } })
    expect(eventos[2].detalhe).toMatchObject({ antes: { situacao: 'esperando' }, depois: { situacao: 'cancelado' } })
    expect(eventos.every((e) => e.quando.getTime() === AGORA.getTime())).toBe(true)
    expect(await banco.select().from(custoProcesso)).toHaveLength(1)
    expect((await ver('helena')).json().totais).toEqual({ ganhos: '1500.00', custos: '0.00', lucro: '1500.00', esperando: '0.00' })
  })

  it('CA5 · o custo não entra na prestação de contas do cliente', async () => {
    const antes = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/prestacao`, cookies: await cookieDe('julia') })).json()
    await lancar('julia', { ...GASTO, valor: '700,00' })
    const depois = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/prestacao`, cookies: await cookieDe('julia') })).json()
    expect(depois).toEqual(antes)
  })

  it('CA6 · a visão do mês: o que aprovar e os totais por processo, para o Financeiro e os sócios; a Sênior vê só no processo', async () => {
    const uber = (await lancar('helena')).json().id
    await lancar('julia', { data: '30/09/2026', descricao: 'Cópias', valor: '20,00' })
    for (const apelido of ['julia', 'otavio']) {
      const r = (await visao(apelido)).json()
      expect(r.paraAprovar).toEqual([expect.objectContaining({ id: uber, casoId, cliente: 'Cliente Inventada', lancadoPor: 'helena', valor: '45.90' })])
      expect(r.porProcesso).toEqual([{ casoId, cliente: 'Cliente Inventada', ganhos: '1500.00', custos: '0.00', lucro: '1500.00', esperando: '45.90' }])
      expect(r.totalDoMes).toEqual({ ganhos: '1500.00', custos: '0.00', lucro: '1500.00', esperando: '45.90' })
    }
    expect((await visao('julia', '2026-09')).json().porProcesso).toEqual([expect.objectContaining({ ganhos: '0.00', custos: '20.00', lucro: '-20.00' })])
    expect((await visao('julia', '2026-13')).statusCode).toBe(400)
    expect((await visao('helena')).statusCode).toBe(403)
  })

  it('o comprovante abre pelas mesmas permissões das custas', async () => {
    const id = (await lancar('helena')).json().id
    const r = await app.inject({ method: 'GET', url: url(`/${id}/comprovante`), cookies: await cookieDe('otavio') })
    expect([r.statusCode, r.headers['content-type'], r.body]).toEqual([200, 'image/jpeg', FOTO.conteudo])
    expect((await app.inject({ method: 'GET', url: url(`/${id}/comprovante`), cookies: await cookieDe('gabi') })).statusCode).toBe(403)
  })

  it('CA7 · advogada, Jurídico administrativo, Atendimento, a líder e a Documentação recebem 403 em toda rota de custas, e a linha do processo não mostra custas', async () => {
    const id = (await lancar('helena')).json().id
    for (const apelido of SEM_CUSTAS) {
      const respostas = [
        await ver(apelido),
        await lancar(apelido),
        await acao(apelido, id, 'aprovacao'),
        await acao(apelido, id, 'recusa', { motivo: 'x' }),
        await acao(apelido, id, 'correcao', GASTO),
        await acao(apelido, id, 'cancelamento'),
        await app.inject({ method: 'GET', url: url(`/${id}/comprovante`), cookies: await cookieDe(apelido) }),
        await visao(apelido),
      ]
      expect(
        respostas.map((r) => r.statusCode),
        apelido,
      ).toEqual(Array(8).fill(403))
    }
    // Sênior e sócio não aprovam; o sócio também não lança.
    expect([(await acao('helena', id, 'aprovacao')).statusCode, (await acao('otavio', id, 'recusa', { motivo: 'x' })).statusCode, (await lancar('otavio')).statusCode]).toEqual([403, 403, 403])
    const linha = (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/historico`, cookies: await cookieDe('gabi') })).json()
    expect(linha.eventos.some((e: { descricao: string }) => /custo/i.test(e.descricao))).toBe(false)
  })
})

describe('Novo custo na visão das custas (Pedro, 16/10)', () => {
  const buscar = async (apelido: string, busca: string) => app.inject({ method: 'GET', url: `/api/custas/processos?busca=${encodeURIComponent(busca)}`, cookies: await cookieDe(apelido) })

  it('quem lança acha o processo pelo nome do cliente, sem acento; a resposta não leva CPF nem telefone', async () => {
    await banco.update(pessoa).set({ cpf: '27183946509', telefone: '11988887777' }).where(eq(pessoa.nome, 'Cliente Inventada'))
    for (const apelido of ['julia', 'helena']) {
      const r = await buscar(apelido, 'cliente inven')
      expect(r.json(), apelido).toEqual([{ casoId, cliente: 'Cliente Inventada', beneficio: 'BPC/LOAS Idoso', fase: 'Judicial' }])
    }
    // CPF e telefone só inteiros: pedaço de número não diz quem é cliente.
    expect((await buscar('julia', '271.839.465-09')).json()).toHaveLength(1)
    expect((await buscar('julia', '(11) 98888-7777')).json()).toHaveLength(1)
    for (const pedaco of ['2718394', '27183946508', '98888']) expect((await buscar('julia', pedaco)).json(), pedaco).toEqual([])
    expect((await buscar('julia', 'x')).json()).toEqual([])
    expect((await buscar('julia', 'Ninguém Assim')).json()).toEqual([])
  })

  it('quem não lança custo não busca processo por aqui', async () => {
    for (const apelido of ['otavio', ...SEM_CUSTAS]) expect((await buscar(apelido, 'Cliente')).statusCode, apelido).toBe(403)
  })
})
