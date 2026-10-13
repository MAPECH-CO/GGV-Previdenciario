import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { agendamento, caso, contrato, contratoRecepcao, documento, eventoAuditoria, mensagem, modelo, pessoa, prestacaoContas, processoAcervo, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import {
  MSG_ACOMPANHANTE,
  MSG_ANTES_DA_PRESTACAO,
  MSG_ANTES_DO_AVISO,
  MSG_ANTES_DO_RECEBIMENTO,
  MSG_DATA_PASSADA,
  MSG_ENCERRADO,
  MSG_G8,
  MSG_LIGACAO_ANTES,
  MSG_MESMA_PESSOA,
  MSG_OUTRA_ADVOGADA,
  MSG_SEM_DEFERIDO,
  MSG_SEM_DESFECHO,
  MSG_SEM_IDA,
  MODELO_IDA_AO_BANCO,
  O_QUE_LEVAR,
  TEXTO_PADRAO_IDA_AO_BANCO,
  TITULO_AVISO,
  TITULO_CONFIRMAR,
  TITULO_REMARCAR,
  garantirModeloDaIdaAoBanco,
  recebimentosConfirmados,
} from './prestacao.ts'
import { NUNCA_PEDIMOS_A_SENHA } from '../../../web/src/regras/mensagens.ts'

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
const PRESTACAO = { valorRecebido: '12.345,67', percentual: '30', formaPagamento: 'pix', prazoPagamento: '30/10/2026', conferiCarta: true }
const AGENDA = () => ({ data: '15/10/2026', hora: '10:00', local: 'Caixa, agência Centro', acompanhanteId: ids.ana })
const RECEBIDO = { resultado: 'recebido', valoresConferem: true }
const receber = () => chamar('julia', 'POST', '/prestacao/recebimento', RECEBIDO)
/** O caminho até a tarefa do aviso: OK da advogada e recebimento do Financeiro (GGVP-98 CA4). */
async function ateOAviso() {
  await deferir()
  await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
  await receber()
}

/** Relógio fixo: as datas da ida ao banco (15/10 e 20/10) seguem no futuro, mesmo depois que o dia passar. */
const AGORA = new Date('2026-10-08T15:00:00Z')

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA })
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
  await banco.insert(modelo).values({ tipo: 'mensagem', nome: MODELO_IDA_AO_BANCO, conteudo: 'Olá, {cliente}! Ida ao banco em {data} às {hora}, {local}.{acompanhamento}' })
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
  it('CA13 · com advogada responsável, só ela vê e conclui; outra advogada é recusada e fica no histórico; o Financeiro segue vendo', async () => {
    const [outra] = await banco
      .insert(usuario)
      .values({ email: 'paula@exemplo.ggv', nome: 'paula', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['advogada'], trocarSenha: false })
      .returning()
    await banco.update(caso).set({ advogadaResponsavelId: ids.gabi }).where(eq(caso.id, casoId))
    await deferir()
    for (const [metodo, payload] of [['GET', undefined], ['POST', PRESTACAO]] as const) {
      const r = await chamar('paula', metodo, '/prestacao', payload)
      expect([r.statusCode, r.json().erro]).toEqual([403, MSG_OUTRA_ADVOGADA])
    }
    const negados = await banco.select().from(eventoAuditoria).where(and(eq(eventoAuditoria.quem, outra.id), eq(eventoAuditoria.acao, 'acesso_negado')))
    expect(negados).toHaveLength(2)
    expect((await chamar('julia', 'GET', '/prestacao')).statusCode).toBe(200)
    expect((await chamar('gabi', 'POST', '/prestacao', PRESTACAO)).statusCode).toBe(201)
  })

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

  it('CA7 e GGVP-98 CA1, CA4 · antes de concluir, nada para o Financeiro; ao concluir, só o recebimento; recebido, nasce o aviso', async () => {
    await deferir()
    expect(await abertas()).toEqual(['advogada · Prestar contas'])
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect(await abertas()).toEqual(['financeiro · Receber a prestação de contas'])
    await receber()
    expect(await abertas()).toEqual([`financeiro · ${TITULO_AVISO}`])
  })

  it('CA2 · os valores só para o Financeiro e a advogada da prestação; o Atendimento recebe 403; a Sênior lê, sem dar o OK (Pedro, 09/10)', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('ana', 'GET', '/prestacao')).statusCode).toBe(403)
    await banco.insert(usuario).values({ email: 'helena@exemplo.ggv', nome: 'helena', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['senior'], trocarSenha: false })
    const daSenior = await chamar('helena', 'GET', '/prestacao')
    expect(daSenior.statusCode).toBe(200)
    expect(daSenior.json().podeEditar).toBe(false)
    expect((await chamar('helena', 'POST', '/prestacao', PRESTACAO)).statusCode).toBe(403)
    expect((await chamar('julia', 'GET', '/prestacao')).json().versoes[0].honorarios).toBe('3703.70')
    // GGVP-98: a ida ao banco passou ao Financeiro; o Atendimento não abre a tela nem vê valores.
    expect((await chamar('ana', 'GET', '/banco')).statusCode).toBe(403)
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
    expect([v.versoes[0].formaPagamento, v.versoes[0].prazoPagamento, v.podeReceber]).toEqual(['pix', '2026-10-30', true])
    expect((await chamar('julia', 'POST', '/prestacao/recebimento', { resultado: 'divergencia', motivo: 'Honorários acima do contrato' })).statusCode).toBe(201)
    expect(await abertas()).toEqual(['advogada · Corrigir a prestação: Honorários acima do contrato'])
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('julia', 'POST', '/prestacao/recebimento', { resultado: 'recebido' })).json().erro).toBe('Marque "Valores conferem com o comprovante"')
    expect((await receber()).statusCode).toBe(201)
    const [ultima] = await banco.select().from(prestacaoContas).where(eq(prestacaoContas.versao, 2))
    expect([ultima.recebidaPor, ultima.recebidaEm !== null]).toEqual([ids.julia, true])
    expect((await receber()).statusCode).toBe(409)
  })

  it('GGVP-98 CA8 · quem deu o OK e tenta registrar o recebimento é recusado, e a tentativa fica registrada', async () => {
    await banco.update(usuario).set({ perfis: ['advogada', 'financeiro'] }).where(eq(usuario.id, ids.gabi))
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    const cookies = await cookieDe('gabi')
    await app.inject({ method: 'POST', url: '/api/sessao/perfil', cookies, payload: { perfil: 'financeiro' } })
    const r = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/prestacao/recebimento`, cookies, payload: RECEBIDO })
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_MESMA_PESSOA])
    const [b] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))
    // Separação de funções, e não o G8 (que é "o aviso só sai depois do OK"): código neutro, sem número (Q21, 08/10).
    expect(b.detalhe).toMatchObject({ portao: 'funcoes', passo: 'D2.06r', perfil: 'financeiro', motivo: 'ok_e_recebimento' })
  })
})

describe('GGVP-158 P3.3 · o percentual vem do contrato e não muda na prestação (GGVP-92 CA8)', () => {
  it('o caso que veio da Recepção lê o percentual guardado no contrato dela', async () => {
    await banco.delete(contrato)
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, casoId))
    await banco.insert(contratoRecepcao).values({ casoId, pessoaId: c.pessoaId, dados: { contrato: { processoId: casoId, etapa: 'copia', percentualHonorarios: 25.5 }, processo: { id: casoId } } })
    await deferir()
    expect((await chamar('gabi', 'GET', '/prestacao')).json().percentualContrato).toBe('25.50')
    expect((await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, percentual: '25,5' })).json()).toMatchObject({ ok: true, versao: 1 })
  })

  it('o percentual digitado diferente do contrato é recusado, e a mensagem diz qual vale', async () => {
    await deferir()
    const r = await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, percentual: '25' })
    expect([r.statusCode, r.json().erro]).toEqual([400, 'O percentual de honorários é o do contrato: 30%.'])
    expect(await banco.select().from(prestacaoContas)).toEqual([])
  })

  it('sem percentual no contrato, segue como antes: vale o digitado', async () => {
    await banco.update(contrato).set({ percentualHonorarios: null })
    await deferir()
    expect((await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, percentual: '25' })).json()).toMatchObject({ ok: true, versao: 1 })
  })
})

describe('GGVP-158 P6.3 · a prestação segue o combinado do contrato, editável antes do OK, com a fonte de cada valor', () => {
  const ACORDO = { entrada: 500, parcelas: { quantidade: 4, valor: 300 } }
  async function comAcordo() {
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, casoId))
    await banco.insert(contratoRecepcao).values({ casoId, pessoaId: c.pessoaId, dados: { contrato: { processoId: casoId, etapa: 'copia', acordo: ACORDO }, processo: { id: casoId } } })
    await deferir()
  }

  it('abre com a entrada e as parcelas do contrato; sem o combinado, nulo, sem zero inventado', async () => {
    await deferir()
    expect((await chamar('gabi', 'GET', '/prestacao')).json().acordo).toBeNull()
    await banco.delete(prestacaoContas)
    await banco.delete(tarefa)
    await banco.delete(resultadoInss)
    await banco.delete(documento)
    await comAcordo()
    expect((await chamar('gabi', 'GET', '/prestacao')).json().acordo).toEqual({ entrada: '500.00', parcelas: { quantidade: 4, valor: '300.00' } })
  })

  it('o OK com o combinado do contrato: as fontes são o contrato, a carta e o sistema; o repasse fecha em centavos', async () => {
    await comAcordo()
    const r = await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, formaPagamento: 'boleto', entrada: '500,00', parcelas: { quantidade: '4', valor: '300,00' }, parteNaCaixa: '1.000,00' })
    expect(r.json()).toMatchObject({ ok: true, versao: 1, honorarios: '3703.70', repasse: '8641.97' })
    const [v] = (await chamar('julia', 'GET', '/prestacao')).json().versoes
    expect([v.entrada, v.parcelas, v.parteNaCaixa, v.formaPagamento]).toEqual(['500.00', { quantidade: 4, valor: '300.00' }, '1000.00', 'boleto'])
    expect(v.fontes).toEqual({ valorRecebido: 'carta', percentual: 'contrato', honorarios: 'sistema', repasse: 'sistema', entrada: 'contrato', parcelas: 'contrato', parteNaCaixa: 'conferencia' })
  })

  it('o ajuste antes do OK fica com a fonte de quem conferiu, e o histórico guarda o calculado e o que valeu', async () => {
    await comAcordo()
    const r = await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, honorarios: '3.000,00', entrada: '500,00', parcelas: { quantidade: '3', valor: '300,00' } })
    expect(r.json()).toMatchObject({ ok: true, honorarios: '3000.00', repasse: '9345.67' })
    const [v] = (await chamar('gabi', 'GET', '/prestacao')).json().versoes
    expect([v.honorarios, v.repasse, v.fontes.honorarios, v.fontes.entrada, v.fontes.parcelas, v.fontes.parteNaCaixa]).toEqual(['3000.00', '9345.67', 'conferencia', 'contrato', 'conferencia', null])
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'prestacao_concluida'))
    expect(ev.detalhe).toMatchObject({ versao: 1, honorariosCalculados: '3703.70', honorarios: '3000.00' })
  })

  it('a forma antiga e a Caixa acima dos honorários são recusadas, e nada é gravado', async () => {
    await comAcordo()
    for (const [corpo, erro] of [
      [{ ...PRESTACAO, formaPagamento: 'dinheiro' }, 'Escolha a forma de pagamento da lista'],
      [{ ...PRESTACAO, parteNaCaixa: '5.000,00' }, 'A parte paga na Caixa vai até o valor dos honorários.'],
    ] as const) {
      const r = await chamar('gabi', 'POST', '/prestacao', corpo)
      expect([r.statusCode, r.json().erro]).toEqual([400, erro])
    }
    expect(await banco.select().from(prestacaoContas)).toEqual([])
  })
})

describe('GGVP-44 · ida ao banco', () => {
  it('CA10 e GGVP-98 CA6 · só depois do recebimento; os quatro campos obrigatórios; quem acompanha é do Atendimento e recebe "Levar ao banco"', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('julia', 'POST', '/banco', AGENDA())).json().erro).toBe(MSG_ANTES_DA_PRESTACAO)
    await receber()
    expect((await chamar('ana', 'POST', '/banco', AGENDA())).statusCode).toBe(403)
    expect((await chamar('julia', 'POST', '/banco', { ...AGENDA(), local: '' })).json().erro).toBe('Informe a agência ou o local')
    expect((await chamar('julia', 'POST', '/banco', { ...AGENDA(), acompanhanteId: '' })).json().erro).toBe(MSG_ACOMPANHANTE)
    expect((await chamar('julia', 'POST', '/banco', { ...AGENDA(), acompanhanteId: ids.igor })).json().erro).toBe(MSG_ACOMPANHANTE)
    expect((await chamar('julia', 'GET', '/banco')).json().equipe.map((u: { nome: string }) => u.nome)).toEqual(['ana'])
    expect((await chamar('julia', 'POST', '/banco', AGENDA())).statusCode).toBe(201)
    const r = (await chamar('julia', 'GET', '/prestacao')).json()
    expect([r.agendamento.quando, r.agendamento.local, r.agendamento.acompanhante]).toEqual(['2026-10-15T13:00:00.000Z', 'Caixa, agência Centro', 'ana'])
    const [levar] = await banco.select().from(tarefa).where(eq(tarefa.passo, 'D2.06l'))
    expect([levar.titulo, levar.perfilDono, levar.responsavelId, levar.prazo]).toEqual(['Levar ao banco', 'atendimento', ids.ana, '2026-10-15'])
  })

  it('CA3, CA11 e GGVP-98 CA2, CA5 · a mensagem sai do modelo; o envio registra data, canal e texto, fecha a tarefa e grava o acervo', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    const r = (await chamar('julia', 'GET', '/banco')).json()
    expect(r.mensagem).toBe('Olá, Vera Lúcia! Ida ao banco em 15/10/2026 às 10:00, Caixa, agência Centro. ana, do escritório, vai com você.')
    expect((await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })).statusCode).toBe(201)
    const [m] = await banco.select().from(mensagem)
    expect([m.canal, m.conteudo, m.enviadaPor, m.enviadaEm !== null]).toEqual(['telefone', r.mensagem, ids.julia, true])
    expect(await abertas()).toEqual(['atendimento · Levar ao banco'])
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    const acervo = await banco.select().from(processoAcervo)
    expect(acervo.map((a) => [a.casoId, a.desfecho, a.fonte, a.desfechoConferidoPor])).toEqual([[casoId, 'deferido', 'portal', null]])
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'baixa_registrada'))).length).toBe(2)
  })

  it('G8 · sem o OK da advogada, o aviso não sai', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await banco.update(prestacaoContas).set({ okAdvogadaEm: null, okAdvogadaPor: null })
    expect((await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })).json().erro).toBe(MSG_G8)
    const [b] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))
    expect(b.detalhe).toMatchObject({ portao: 'G8', passo: 'D3b.03', perfil: 'financeiro' })
  })

  it('CA12 e GGVP-98 CA7 · remarcar cancela o anterior, o Financeiro vê o novo, o convite sai de novo e "Levar ao banco" muda junto', async () => {
    await banco.insert(usuario).values({ email: 'raí@exemplo.ggv', nome: 'raí', senhaHash: 'x', perfis: ['atendimento'], trocarSenha: false })
    const [rai] = await banco.select().from(usuario).where(eq(usuario.nome, 'raí'))
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    await chamar('julia', 'POST', '/banco', { ...AGENDA(), data: '20/10/2026', hora: '14:30', acompanhanteId: rai.id })
    const ags = await banco.select().from(agendamento)
    expect(ags.map((a) => a.situacao).sort()).toEqual(['cancelado', 'marcado'])
    expect((await chamar('julia', 'GET', '/prestacao')).json().agendamento.quando).toBe('2026-10-20T17:30:00.000Z')
    expect(await abertas()).toEqual(['atendimento · Levar ao banco', `financeiro · ${TITULO_AVISO}`])
    const levar = await banco.select().from(tarefa).where(eq(tarefa.passo, 'D2.06l'))
    expect(levar.map((t) => [t.responsavelId, t.prazo])).toEqual([[rai.id, '2026-10-20']])
    expect((await chamar('julia', 'GET', '/banco')).json().mensagem).toContain('20/10/2026 às 14:30')
  })

  it('GGVP-98 CA9 · depois do aviso, o Financeiro confirma o recebimento: a ida ao banco fica feita e o caso fecha', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    expect((await chamar('julia', 'POST', '/banco/confirmacao')).json().erro).toBe(MSG_ANTES_DO_AVISO)
    expect((await chamar('julia', 'GET', '/banco')).json().podeConfirmar).toBe(false)
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    expect((await chamar('julia', 'GET', '/banco')).json().podeConfirmar).toBe(true)
    // GGVP-78: o "Receber e lançar" não é dinheiro na mão; o painel Financeiro e os Resultados contam a confirmação.
    expect((await recebimentosConfirmados(banco)).size).toBe(0)
    expect((await chamar('julia', 'POST', '/banco/confirmacao')).statusCode).toBe(201)
    expect([...(await recebimentosConfirmados(banco))]).toEqual([[casoId, AGORA]])
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    const [ag] = await banco.select().from(agendamento)
    expect([c.fase, c.encerradoEm !== null, ag.situacao]).toEqual(['encerrado', true, 'realizado'])
    expect(await abertas()).toEqual([])
    const v = (await chamar('julia', 'GET', '/banco')).json()
    expect([v.encerrado, v.podeConfirmar, v.podeAgendar]).toEqual([true, false, false])
    expect((await chamar('julia', 'POST', '/banco/confirmacao')).statusCode).toBe(409)
  })

  it('GGVP-98 CA9 · caso encerrado não reabre: agendar e avisar de novo devolvem 409, e nenhuma tarefa nasce', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    await chamar('julia', 'POST', '/banco/confirmacao')
    for (const [resto, corpo] of [['/banco', AGENDA()], ['/banco/envio', { canal: 'telefone' }]] as const) {
      const r = await chamar('julia', 'POST', resto, corpo)
      expect([r.statusCode, r.json().erro]).toEqual([409, MSG_ENCERRADO])
    }
    expect(await abertas()).toEqual([])
    expect((await banco.select().from(agendamento)).map((a) => a.situacao)).toEqual(['realizado'])
    expect(await banco.select().from(mensagem)).toHaveLength(1)
  })

  it('GGVP-98 CA2 · sem desfecho registrado, o aviso não sai e o caso não entra no acervo como processo bom', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await banco.update(resultadoInss).set({ resultado: 'indeferido' })
    const r = await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_SEM_DESFECHO])
    expect([await banco.select().from(processoAcervo), await banco.select().from(mensagem)]).toEqual([[], []])
  })
})

describe('GGVP-98 · nona revisão de 08/10', () => {
  it('CA6 · a ida ao banco não é marcada no passado (ontem, ou hoje numa hora que já passou): 400, e nada é agendado', async () => {
    await ateOAviso()
    // Relógio fixo: agora são 12:00 de 08/10 em Brasília.
    for (const passado of [{ data: '07/10/2026' }, { data: '08/10/2026', hora: '10:00' }]) {
      const r = await chamar('julia', 'POST', '/banco', { ...AGENDA(), ...passado })
      expect([r.statusCode, r.json().erro], JSON.stringify(passado)).toEqual([400, MSG_DATA_PASSADA])
    }
    expect(await banco.select().from(agendamento)).toEqual([])
    expect((await chamar('julia', 'POST', '/banco', { ...AGENDA(), data: '08/10/2026', hora: '14:00' })).statusCode).toBe(201)
  })
})

describe('GGVP-98 · quarta revisão de 08/10', () => {
  it('CA3 · na rota, lançar sem conferir os valores é recusado (400), e nada é recebido', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect((await chamar('julia', 'POST', '/prestacao/recebimento', { resultado: 'recebido', valoresConferem: false })).statusCode).toBe(400)
    const [p] = await banco.select().from(prestacaoContas)
    expect([p.recebidaEm, p.recebidaPor]).toEqual([null, null])
  })

  it('CA4 · versão nova depois do recebimento: o aviso espera o novo recebimento do Financeiro', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    expect((await chamar('gabi', 'POST', '/prestacao', { ...PRESTACAO, valorRecebido: '12.000,00' })).statusCode).toBe(201)
    const r = await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_ANTES_DO_RECEBIMENTO])
    await receber()
    expect((await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })).statusCode).toBe(201)
  })

  it('CA9 · caso encerrado não aceita versão nova da prestação, e nenhuma tarefa nasce', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    await chamar('julia', 'POST', '/banco/confirmacao')
    const r = await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_ENCERRADO])
    expect(await abertas()).toEqual([])
  })

  // O banco embutido atende uma consulta de cada vez, então aqui a disputa não acontece de verdade: o teste confere o
  // resultado com dois pedidos juntos. No PostgreSQL, quem barra é a condição no próprio update do recebimento.
  it('CA4 · dois recebimentos ao mesmo tempo: um passa, o outro recebe 409, e o recebimento conta uma vez', async () => {
    await deferir()
    await chamar('gabi', 'POST', '/prestacao', PRESTACAO)
    const rs = await Promise.all([receber(), receber()])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([201, 409])
    expect(await banco.select().from(tarefa).where(eq(tarefa.passo, 'D2.06b'))).toHaveLength(1)
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'prestacao_recebida'))).toHaveLength(1)
  })
})

describe('GGVP-98 · o Atendimento leva o cliente ao banco (P3 do roteiro de 09/10)', () => {
  /** O Financeiro recebeu, marcou a ida com a Ana e avisou o cliente. */
  async function ateLevar() {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
  }

  it('quem leva vê cliente, data, hora, local e o que levar, sem nenhum valor; a tarefa abre a tela do passo', async () => {
    await ateOAviso()
    expect((await chamar('ana', 'GET', '/banco/levar')).json().erro).toBe(MSG_SEM_IDA)
    await chamar('julia', 'POST', '/banco', AGENDA())
    const r = await chamar('ana', 'GET', '/banco/levar')
    expect(r.json()).toEqual({ casoId, cliente: 'Vera Lúcia', data: '15/10/2026', hora: '10:00', local: 'Caixa, agência Centro', acompanhante: 'ana', oQueLevar: O_QUE_LEVAR })
    expect(r.body).not.toMatch(/12345|8641|3703|R\$|valor|honor|repasse|percentual/i)
    // O Financeiro marca, não leva; o Jurídico administrativo também não.
    expect((await chamar('julia', 'GET', '/banco/levar')).statusCode).toBe(403)
    expect((await chamar('igor', 'POST', '/banco/levar', { resultado: 'levado' })).statusCode).toBe(403)
    const central = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('ana') })).json()
    expect(central.map((t: { titulo: string; tela: string }) => [t.titulo, t.tela])).toEqual([['Levar ao banco', `/casos/${casoId}/banco/levar`]])
  })

  it('"Levei o cliente ao banco" conclui a tarefa com quem e quando; o Financeiro recebe na Central a tarefa de confirmar, e ela fecha na confirmação', async () => {
    await ateLevar()
    expect((await chamar('ana', 'POST', '/banco/levar', { resultado: 'levado' })).statusCode).toBe(201)
    const [t] = await banco.select().from(tarefa).where(eq(tarefa.passo, 'D2.06l'))
    expect([t.situacao, t.concluidaPor, t.concluidaEm !== null]).toEqual(['concluida', ids.ana, true])
    const [h] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'cliente_levado_ao_banco'))
    expect([h.quem, h.alvo]).toEqual([ids.ana, `caso:${casoId}`])
    expect(await abertas()).toEqual([`financeiro · ${TITULO_CONFIRMAR}`])
    const central = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('julia') })).json()
    expect(central.map((t: { titulo: string; tela: string }) => [t.titulo, t.tela])).toEqual([[TITULO_CONFIRMAR, `/casos/${casoId}/banco`]])
    const outra = await chamar('ana', 'POST', '/banco/levar', { resultado: 'levado' })
    expect([outra.statusCode, outra.json().erro]).toEqual([409, MSG_SEM_IDA])
    expect((await chamar('julia', 'POST', '/banco/confirmacao')).statusCode).toBe(201)
    expect(await abertas()).toEqual([])
  })

  it('"Não deu" pede o motivo, cancela a ida e volta ao Financeiro remarcar; remarcada, "Levar ao banco" nasce de novo', async () => {
    await ateLevar()
    expect((await chamar('ana', 'POST', '/banco/levar', { resultado: 'nao_deu', motivo: ' ' })).json().erro).toBe('Escreva por que não deu')
    expect((await chamar('ana', 'POST', '/banco/levar', { resultado: 'nao_deu', motivo: 'Agência fechada' })).statusCode).toBe(201)
    expect(await abertas()).toEqual([`financeiro · ${TITULO_REMARCAR}: Agência fechada`])
    expect((await banco.select().from(agendamento)).map((a) => a.situacao)).toEqual(['cancelado'])
    const [h] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'ida_ao_banco_nao_feita'))
    expect([h.quem, h.detalhe]).toMatchObject([ids.ana, { motivo: 'Agência fechada' }])
    // Sem ida marcada, não há recebimento a confirmar; o Financeiro marca de novo e quem leva recebe a tarefa.
    expect((await chamar('julia', 'POST', '/banco/confirmacao')).statusCode).toBe(409)
    expect((await chamar('julia', 'POST', '/banco', { ...AGENDA(), data: '20/10/2026' })).statusCode).toBe(201)
    expect(await abertas()).toEqual(['atendimento · Levar ao banco', `financeiro · ${TITULO_REMARCAR}: Agência fechada`])
    expect((await chamar('ana', 'GET', '/banco/levar')).json().data).toBe('20/10/2026')
    // Remarcada, a confirmação espera o aviso da nova data: o aviso da ida que não deu não vale (CA9).
    const cedo = await chamar('julia', 'POST', '/banco/confirmacao')
    expect([cedo.statusCode, cedo.json().erro]).toEqual([409, MSG_ANTES_DO_AVISO])
    expect((await chamar('julia', 'GET', '/banco')).json().podeConfirmar).toBe(false)
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    expect(await abertas()).toEqual(['atendimento · Levar ao banco'])
    expect((await chamar('julia', 'GET', '/banco')).json().podeConfirmar).toBe(true)
    // Remarcar de novo devolve o título do aviso: o motivo antigo já foi atendido.
    await chamar('julia', 'POST', '/banco', { ...AGENDA(), data: '22/10/2026' })
    expect(await abertas()).toEqual(['atendimento · Levar ao banco', `financeiro · ${TITULO_AVISO}`])
  })
})

describe('GGVP-158 P6.4 · a ligação avisa; o WhatsApp é só o complemento, e sai de verdade', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('o WhatsApp antes da ligação recusa; sem o Chatwoot, não sai: 409 com o motivo, a tentativa fica no histórico e fora dos avisos', async () => {
    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    const antes = await chamar('julia', 'POST', '/banco/envio', { canal: 'whatsapp' })
    expect([antes.statusCode, antes.json().erro]).toEqual([409, MSG_LIGACAO_ANTES])
    expect((await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })).statusCode).toBe(201)
    const naoSaiu = await chamar('julia', 'POST', '/banco/envio', { canal: 'whatsapp' })
    expect(naoSaiu.statusCode).toBe(409)
    expect(naoSaiu.json().erro).toMatch(/^A confirmação não saiu pelo Chatwoot: .+ A ligação já avisou o cliente\.$/)
    const linhas = await banco.select().from(mensagem)
    expect(linhas.map((m) => [m.canal, m.status]).sort()).toEqual([['telefone', null], ['whatsapp', 'falhou']])
    expect((await chamar('julia', 'GET', '/banco')).json().avisos.map((a: { canal: string }) => a.canal)).toEqual(['telefone'])
    const [tentativa] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'mensagem_enviada'))
    expect(tentativa.detalhe).toMatchObject({ modelo: MODELO_IDA_AO_BANCO, status: 'falhou' })
  })

  it('com o Chatwoot, sai pela conversa aberta do cliente, com o texto aprovado e o aviso da senha; o id fica guardado', async () => {
    const API = 'https://chatwoot.teste/api/v1/accounts/7'
    const posts: { caminho: string; corpo: unknown }[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const caminho = url.replace(API, '')
      if (init.method === 'POST') posts.push({ caminho, corpo: JSON.parse(String(init.body)) })
      const rotas: Record<string, unknown> = {
        'GET /contacts/search?q=87654321': { payload: [{ id: 31, name: 'Vera Lúcia', phone_number: '+5511987654321', contact_inboxes: [{ source_id: 'f', inbox: { id: 9, name: 'GGV PREV' } }] }] },
        'GET /contacts/31/conversations': { payload: [{ id: 502, inbox_id: 9, status: 'open', last_activity_at: 1759910000 }] },
        'GET /conversations/502/messages': { payload: [] },
        'POST /conversations/502/messages': { id: 77, status: 'sent' },
      }
      const r = rotas[`${init.method ?? 'GET'} ${caminho}`]
      return r === undefined ? new Response(null, { status: 404 }) : Response.json(r)
    })
    await banco.update(pessoa).set({ telefone: '11987654321' })
    await app.close()
    const ambiente = { CHATWOOT_URL: 'https://chatwoot.teste', CHATWOOT_CONTA: '7', CHATWOOT_CAIXA: '9', CHATWOOT_TOKEN: 'token-de-teste', AMBIENTE: 'homologacao', CHATWOOT_PERMITIDOS: '(11) 98765-4321' }
    for (const [nome, valor] of Object.entries(ambiente)) vi.stubEnv(nome, valor)
    app = criarServidor({ banco, agora: () => AGORA })
    vi.unstubAllEnvs()

    await ateOAviso()
    await chamar('julia', 'POST', '/banco', AGENDA())
    await chamar('julia', 'POST', '/banco/envio', { canal: 'telefone' })
    const texto = (await chamar('julia', 'GET', '/banco')).json().mensagem
    const r = await chamar('julia', 'POST', '/banco/envio', { canal: 'whatsapp' })
    expect([r.statusCode, r.json()]).toEqual([201, { ok: true, status: 'enviada' }])
    expect(posts).toEqual([{ caminho: '/conversations/502/messages', corpo: { content: `${texto} ${NUNCA_PEDIMOS_A_SENHA}`, message_type: 'outgoing', private: false } }])
    const [m] = await banco.select().from(mensagem).where(eq(mensagem.canal, 'whatsapp'))
    const [modeloDoBanco] = await banco.select().from(modelo)
    expect([m.status, m.chatwootMensagemId, m.conversaChatwoot, m.modelo, m.modeloId, m.enviadaPor]).toEqual(['enviada', 77, 502, null, modeloDoBanco.id, ids.julia])
    expect((await chamar('julia', 'GET', '/banco')).json().avisos.map((a: { canal: string }) => a.canal).sort()).toEqual(['telefone', 'whatsapp'])
  })

  it('o modelo ao subir: o banco sem ele ganha o padrão; o que a Sênior mudou fica', async () => {
    await banco.delete(modelo)
    expect(await garantirModeloDaIdaAoBanco(banco, AGORA)).toBe(true)
    const [m] = await banco.select().from(modelo)
    expect([m.tipo, m.nome, m.conteudo, m.versao]).toEqual(['mensagem', MODELO_IDA_AO_BANCO, TEXTO_PADRAO_IDA_AO_BANCO, 1])
    await banco.update(modelo).set({ ativo: false })
    expect(await garantirModeloDaIdaAoBanco(banco, AGORA)).toBe(false)
    expect((await banco.select().from(modelo)).length).toBe(1)
  })
})
