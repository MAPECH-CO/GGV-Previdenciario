import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { agendamento, caso, contrato, documento, mensagem, modelo, pessoa, prestacaoContas, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_ANTES_DA_PRESTACAO, MSG_G8, MSG_SEM_DEFERIDO, MODELO_IDA_AO_BANCO } from './prestacao.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', resto: string, payload?: object) =>
  app.inject({ method: metodo, url: `/api/casos/${casoId}${resto}`, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const PRESTACAO = { valorRecebido: '12.345,67', percentual: '30', formaPagamento: 'Pix', prazoPagamento: '30/10/2026', conferiCarta: true }
const AGENDA = { data: '15/10/2026', hora: '10:00', local: 'Caixa, agência Centro', acompanhante: 'Ana' }

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['julia', 'financeiro'], ['ana', 'atendimento'], ['igor', 'juridico_adm']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
  await banco.insert(contrato).values({ casoId, situacao: 'assinado', percentualHonorarios: '30.00' })
  await banco.insert(modelo).values({ tipo: 'mensagem', nome: MODELO_IDA_AO_BANCO, conteudo: 'Olá, {cliente}! Ida ao banco em {data} às {hora}, {local}, com {acompanhante}.' })
})
afterEach(() => fechar())

async function deferir() {
  const [d] = await banco
    .insert(documento)
    .values({ casoId, tipo: 'comunicacao_inss', chaveArmazenamento: 'x/carta', nomeOriginal: 'carta-de-concessao.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'portal' })
    .returning()
  await banco.insert(resultadoInss).values({ casoId, resultado: 'deferido', dataDecisao: '2026-10-05', documentoId: d.id, registradoPor: ids.gabi })
  await banco.insert(tarefa).values({ casoId, passo: 'D2.06', titulo: 'Prestar contas', perfilDono: 'advogada', evidenciaDocumentoId: d.id })
}

describe('GGVP-44 · prestação de contas', () => {
  it('sem deferimento, não há prestação', async () => {
    expect((await chamar('gabi', 'POST', '/prestacao', PRESTACAO)).json().erro).toBe(MSG_SEM_DEFERIDO)
  })

  it('CA4, CA5 · nasce com a carta e o percentual do contrato; os valores vêm do servidor', async () => {
    await deferir()
    const r = (await chamar('gabi', 'GET', '/prestacao')).json()
    expect([r.carta.nome, r.percentualContrato, r.versoes, r.podeEditar]).toEqual(['carta-de-concessao.pdf', '30.00', [], true])
    expect((await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, conferiCarta: false })).json().erro).toBe('Marque "Conferi os valores com a carta de concessão"')
    expect((await chamar('gabi', 'POST', '/prestacao', PRESTACAO)).json()).toEqual({ ok: true, versao: 1, valorRecebido: '12345.67', honorarios: '3703.70', repasse: '8641.97' })
  })

  it('CA7, CA1, CA2 · antes de concluir, nada para o Financeiro; ao concluir, Financeiro e Atendimento juntos', async () => {
    await deferir()
    expect(await abertas()).toEqual(['advogada · Prestar contas'])
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect(await abertas()).toEqual(['atendimento · Agendar ida ao banco', 'financeiro · Receber a prestação de contas'])
  })

  it('CA2 · os valores só para o Financeiro e o Jurídico; o Atendimento recebe 403 e agenda sem ver valor', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('ana', 'GET', '/prestacao')).statusCode).toBe(403)
    expect((await chamar('julia', 'GET', '/prestacao')).json().versoes[0].honorarios).toBe('3703.70')
    expect(JSON.stringify((await chamar('ana', 'GET', '/banco')).json())).not.toMatch(/3703|12345|honorario/)
  })

  it('CA6 · alterar depois de concluída grava a versão seguinte, com quem e quando, e guarda a anterior', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, valorRecebido: '10.000,00' })).json().versao).toBe(2)
    const r = (await chamar('julia', 'GET', '/prestacao')).json()
    expect(r.versoes.map((v: { versao: number; valorRecebido: string; por: string }) => [v.versao, v.valorRecebido, v.por])).toEqual([
      [2, '10000.00', 'gabi'],
      [1, '12345.67', 'gabi'],
    ])
    expect((await abertas()).filter((t) => t.startsWith('financeiro'))).toEqual(['financeiro · Receber a prestação de contas'])
  })

  it('CA8, CA9 · o Financeiro vê forma e prazo, registra o recebimento; divergência volta para a advogada com o motivo', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    const v = (await chamar('julia', 'GET', '/prestacao')).json()
    expect([v.versoes[0].formaPagamento, v.versoes[0].prazoPagamento, v.podeReceber]).toEqual(['Pix', '2026-10-30', true])
    expect((await chamar('julia', 'POST', '/prestacao/recebimento', { resultado: 'divergencia', motivo: 'Honorários acima do contrato' })).statusCode).toBe(201)
    expect(await abertas()).toEqual(['advogada · Corrigir a prestação: Honorários acima do contrato', 'atendimento · Agendar ida ao banco'])
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('julia', 'POST', '/prestacao/recebimento', { resultado: 'recebido' })).statusCode).toBe(201)
    const [ultima] = await banco.select().from(prestacaoContas).where(eq(prestacaoContas.versao, 2))
    expect([ultima.recebidaPor, ultima.recebidaEm !== null]).toEqual([ids.julia, true])
    expect((await chamar('julia', 'POST', '/prestacao/recebimento', { resultado: 'recebido' })).statusCode).toBe(409)
  })
})

describe('GGVP-44 · ida ao banco', () => {
  it('CA10 · só depois da prestação concluída; os quatro campos são obrigatórios; o Financeiro vê o agendamento', async () => {
    await deferir()
    expect((await chamar('ana', 'POST', '/banco', AGENDA)).json().erro).toBe(MSG_ANTES_DA_PRESTACAO)
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('ana', 'POST', '/banco', { ...AGENDA, local: '' })).json().erro).toBe('Informe a agência ou o local')
    expect((await chamar('ana', 'POST', '/banco', AGENDA)).statusCode).toBe(201)
    const r = (await chamar('julia', 'GET', '/prestacao')).json()
    expect([r.agendamento.quando, r.agendamento.local, r.agendamento.acompanhante]).toEqual(['2026-10-15T13:00:00.000Z', 'Caixa, agência Centro', 'Ana'])
  })

  it('CA3, CA11 · a mensagem sai do modelo; o envio registra data, canal e texto e fecha a tarefa', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    await chamar('ana', 'POST', '/banco', AGENDA)
    const r = (await chamar('ana', 'GET', '/banco')).json()
    expect(r.mensagem).toBe('Olá, Vera Lúcia! Ida ao banco em 15/10/2026 às 10:00, Caixa, agência Centro, com Ana.')
    expect((await chamar('ana', 'POST', '/banco/envio', { canal: 'whatsapp' })).statusCode).toBe(201)
    const [m] = await banco.select().from(mensagem)
    expect([m.canal, m.conteudo, m.enviadaPor, m.enviadaEm !== null]).toEqual(['whatsapp', r.mensagem, ids.ana, true])
    expect(await abertas()).toEqual(['financeiro · Receber a prestação de contas'])
  })

  it('G8 · sem o OK da advogada, o aviso não sai', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    await chamar('ana', 'POST', '/banco', AGENDA)
    await banco.update(prestacaoContas).set({ okAdvogadaEm: null, okAdvogadaPor: null })
    expect((await chamar('ana', 'POST', '/banco/envio', { canal: 'whatsapp' })).json().erro).toBe(MSG_G8)
  })

  it('CA12 · remarcar cancela o anterior, o Financeiro vê o novo e o convite precisa sair de novo', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    await chamar('ana', 'POST', '/banco', AGENDA)
    await chamar('ana', 'POST', '/banco/envio', { canal: 'whatsapp' })
    await chamar('ana', 'POST', '/banco', { ...AGENDA, data: '20/10/2026', hora: '14:30' })
    const ags = await banco.select().from(agendamento)
    expect(ags.map((a) => a.situacao).sort()).toEqual(['cancelado', 'marcado'])
    expect((await chamar('julia', 'GET', '/prestacao')).json().agendamento.quando).toBe('2026-10-20T17:30:00.000Z')
    expect(await abertas()).toContain('atendimento · Agendar ida ao banco')
    expect((await chamar('ana', 'GET', '/banco')).json().mensagem).toContain('20/10/2026 às 14:30')
  })
})
