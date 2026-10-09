import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { cobrancaDocumento, contratoRecepcao, documentacaoMedica, documento, kitDocumento, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_G1 } from './conferencia.ts'
import { nomeTipo } from '../../../web/src/dados/catalogos.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

/** O cliente com o caso aberto ("fechou"), como na Recepção. */
async function casoDe(beneficio: string) {
  const ficha = await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer o BPC.', telefone: '11987654321', cpf: '52998224725', beneficioInteresse: beneficio, outraPessoa: false })
  const { processo } = await json('ana', 'POST', `/api/fichas/${ficha.id}/processos`, { beneficio })
  return { fichaId: ficha.id as string, processoId: processo.id as string }
}
const doc = (nome: string, tipo: string, hash = 'a'.repeat(64)) => ({ nome, formato: 'pdf', tamanho: 1000, tipo, hash })
/** O contrato assinado e os documentos do kit do LOAS (os cinco, se nada for dito), lidos e arquivados. */
async function completarOKit(fichaId: string, processoId: string, tipos = ['rg', 'cpf', 'comprovante-residencia', 'cadunico', 'grupo-familiar']) {
  const [linha] = await banco.select().from(contratoRecepcao).where(eq(contratoRecepcao.casoId, processoId))
  const dados = linha.dados as { contrato: object }
  await banco.update(contratoRecepcao).set({ dados: { ...dados, contrato: { ...dados.contrato, etapa: 'leitura' } } }).where(eq(contratoRecepcao.casoId, processoId))
  await json('ana', 'POST', `/api/fichas/${fichaId}/arquivos`, { origem: 'card', arquivos: tipos.map((t, i) => doc(`${t}.pdf`, t, String(i).repeat(64))) })
  const documentos = tipos.map((t) => ({ id: `${fichaId}/${t}.pdf`, tipo: t, data: '2026-10-08' }))
  expect(await json('dora', 'POST', `/api/fichas/${fichaId}/documentos-lidos/arquivar`, { conferi: true, documentos })).toMatchObject({ arquivados: tipos.length })
}
const situacoes = (c: { checklist: { itens: { tipo: string; situacao: string }[] } }) => Object.fromEntries(c.checklist.itens.map((i) => [i.tipo, i.situacao]))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['dora', 'documentacao'], ['julia', 'financeiro'], ['sara', 'senior']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  // O kit do LOAS como a semente do servidor o publica: com os nomes do banco.
  const kit = [
    ...['documento_de_identidade', 'cpf', 'comprovante_de_residencia', 'cadunico', 'ficha_de_grupo_familiar'].map((tipoDocumento) => ({ tipoDocumento, obrigatorio: true })),
    ...['declaracao_de_moradia', 'declaracao_de_uniao_estavel', 'declaracao_de_separacao_de_fato'].map((tipoDocumento) => ({ tipoDocumento, obrigatorio: false })),
  ]
  await banco.insert(kitDocumento).values(kit.map((k) => ({ ...k, beneficio: 'bpc_loas_idoso', vigenteDesde: new Date('2000-01-01T12:00:00Z') })))
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 5c: o checklist do caso no servidor', () => {
  it('o kit do escritório nos nomes das telas: o RG do card, lido e arquivado, conta como o documento de identidade', async () => {
    const { fichaId, processoId } = await casoDe('loas-idoso')
    const url = `/api/processos/${processoId}/checklist`
    expect((await chamar('julia', 'GET', url)).statusCode).toBe(403)
    expect(await json('dora', 'GET', '/api/processos/00000000-0000-4000-8000-000000000000/checklist')).toEqual({ erro: 'Caso não encontrado.' })

    const antes = await json('dora', 'GET', url)
    expect(antes).toMatchObject({ beneficio: 'LOAS Idoso', ficha: { id: fichaId }, processo: { id: processoId }, checklist: { temLista: true, completo: false } })
    expect(situacoes(antes)).toEqual({ contrato: 'pendente', rg: 'pendente', cpf: 'pendente', 'comprovante-residencia': 'pendente', cadunico: 'pendente', 'grupo-familiar': 'pendente' })

    // Chegou pelo card, mas ainda não foi lido e arquivado: não conta.
    await json('ana', 'POST', `/api/fichas/${fichaId}/arquivos`, { origem: 'card', arquivos: [doc('RG.pdf', 'rg')] })
    expect(situacoes(await json('dora', 'GET', url)).rg).toBe('pendente')
    await json('dora', 'POST', `/api/fichas/${fichaId}/documentos-lidos/arquivar`, { conferi: true, documentos: [{ id: `${fichaId}/RG.pdf`, tipo: 'rg', data: '2026-10-08' }] })
    expect(situacoes(await json('dora', 'GET', url)).rg).toBe('recebido')
  })

  it('a conferência grava a situação calculada; a incompleta abre uma cobrança só; o checklist vai na cópia das telas', async () => {
    const { processoId } = await casoDe('loas-idoso')
    const url = `/api/processos/${processoId}/checklist/conferencia`
    expect((await chamar('julia', 'POST', url)).statusCode).toBe(403)

    const r = await json('dora', 'POST', url)
    expect(r.conferencia).toMatchObject({ processoId, completo: false })
    expect(r.conferencia.faltam).toHaveLength(6)
    expect(r.ficha.historico.slice(-2).map((e: { oQue: string }) => e.oQue)).toEqual([
      `Conferiu o checklist do LOAS Idoso: incompleto; falta: ${r.conferencia.faltam.slice(0, -1).join(', ')} e ${r.conferencia.faltam.at(-1)}`,
      `Abriu a cobrança das pendências do checklist para o Atendimento: ${r.conferencia.faltam.slice(0, -1).join(', ')} e ${r.conferencia.faltam.at(-1)}`,
    ])
    expect(r.cobrancas).toMatchObject([{ processoId, abertaEm: '2026-10-08', tentativas: [], decisoes: [] }])
    expect(r.checklists).toMatchObject([{ processoId, conferencia: r.conferencia }])

    // Conferir de novo não abre a segunda cobrança.
    expect((await json('ana', 'POST', url)).cobrancas).toHaveLength(1)
    const { checklists } = await json('ana', 'GET', '/api/recepcao')
    expect(checklists).toMatchObject([{ processoId, beneficio: 'LOAS Idoso', checklist: { temLista: true, completo: false }, conferencia: { completo: false } }])
  })

  it('o acidente e a criança vêm do banco: sem a circunstância, o checklist do Auxílio-Acidente espera por ela', async () => {
    const { processoId } = await casoDe('auxilio-acidente')
    const url = `/api/processos/${processoId}/checklist`
    expect((await json('dora', 'GET', url)).checklist).toMatchObject({ temLista: false, bloqueio: 'Marque a circunstância do acidente: o que é obrigatório depende dela.' })
    await banco.insert(documentacaoMedica).values({
      casoId: processoId,
      parte: 'acidente',
      documento: { circunstancia: 'transito', categoria: 'empregado', acidenteEm: '2026-01-10', auxilioAnterior: false, recusados: [] },
    })
    const c = (await json('dora', 'GET', url)).checklist
    expect(c.bloqueio).toBeUndefined()
    expect(c.itens.map((i: { tipo: string }) => i.tipo)).toEqual(['contrato', 'boletim-ocorrencia', 'fotos-acidente', 'ficha-pronto-socorro', 'prontuario', 'exame-imagem-epoca', 'exame-pos-alta'])
  })

  it('a liberação do caso da Recepção confere esse checklist: o que falta com os nomes das telas, e a conferência completa', async () => {
    const { fichaId, processoId } = await casoDe('loas-idoso')
    const liberar = () => json('dora', 'POST', `/api/casos/${processoId}/liberacao`, { conferiChecklist: true, conferiAssinaturas: true })
    const recusa = await liberar()
    expect(recusa.erro).toContain(`${MSG_G1} Contrato assinado (kit), `)
    expect(recusa.erro).toContain(nomeTipo('rg'))

    await completarOKit(fichaId, processoId)

    expect((await liberar()).erro).toBe(`${MSG_G1} a conferência do checklist completo (D1.21).`)
    expect((await json('dora', 'POST', `/api/processos/${processoId}/checklist/conferencia`)).conferencia).toMatchObject({ completo: true, faltam: [] })
    expect(await liberar()).toEqual({ ok: true })
  })

  it('boas-vindas: só depois do checklist conferido; a Atendimento marca "Já enviei" uma vez; vai na cópia das telas', async () => {
    const { fichaId, processoId } = await casoDe('loas-idoso')
    const url = `/api/processos/${processoId}/boas-vindas`
    expect(await json('ana', 'GET', url)).toMatchObject({ situacao: 'aguardando-checklist', copias: [] })
    expect(await json('ana', 'POST', url)).toEqual({ erro: 'Confira o checklist antes das boas-vindas.' })

    await json('dora', 'POST', `/api/processos/${processoId}/checklist/conferencia`)
    const aEnviar = await json('ana', 'GET', url)
    expect(aEnviar.situacao).toBe('a-enviar')
    expect(aEnviar.mensagem).toMatch(/^Olá, Joana! Boas-vindas ao escritório GGV\. Seu caso de LOAS Idoso está aberto/)
    // Quem marca é quem manda mensagem: a Documentação não.
    expect((await chamar('dora', 'POST', url)).statusCode).toBe(403)

    const r = await json('ana', 'POST', url)
    expect(r.boasVindas).toMatchObject({ situacao: 'enviada', registro: { fichaId, processoId, situacao: 'enviada', mensagem: aEnviar.mensagem } })
    expect(r.ficha.historico.at(-1).oQue).toBe('Mandou as boas-vindas por fora do portal (o portal ainda não envia), com as cópias do kit e 6 pendências do checklist')
    expect(r.ficha.contatos.at(-1)).toMatchObject({ canal: 'Chatwoot', data: '2026-10-08' })
    expect(await json('ana', 'POST', url)).toEqual({ erro: 'As boas-vindas já foram enviadas.' })
    expect((await json('ana', 'GET', '/api/recepcao')).boasVindas).toMatchObject([{ fichaId, processoId, situacao: 'enviada' }])

    // O processo novo de quem já é cliente não recebe (CA3).
    const { processo: outro } = await json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-deficiente' })
    expect((await json('ana', 'GET', `/api/processos/${outro.id}/boas-vindas`)).situacao).toBe('ja-era-cliente')
  })
})

describe('GGVP-125 · bloco 5c: a cobrança dos documentos no servidor', () => {
  type Tentativa = { dia: string; canal: 'chatwoot' | 'ligacao'; resultado: 'sem-resposta' | 'respondeu'; quem: string }
  /** A cobrança que a conferência incompleta abriu, com as tentativas que o teste pedir. */
  async function cobrancaAberta(tentativas: Tentativa[] = []) {
    const caso = await casoDe('loas-idoso')
    await json('dora', 'POST', `/api/processos/${caso.processoId}/checklist/conferencia`)
    if (tentativas.length) {
      const [linha] = await banco.select().from(cobrancaDocumento).where(eq(cobrancaDocumento.casoId, caso.processoId))
      await banco.update(cobrancaDocumento).set({ dados: { ...(linha.dados as object), tentativas } }).where(eq(cobrancaDocumento.id, linha.id))
    }
    return { ...caso, url: `/api/processos/${caso.processoId}/cobranca` }
  }

  it('a tentativa com data, canal e resultado, os três dias até a próxima e o adiamento, que não zera a contagem', async () => {
    const { url, processoId } = await cobrancaAberta()
    expect((await chamar('julia', 'GET', url)).statusCode).toBe(403)
    const aberta = await json('ana', 'GET', url)
    expect(aberta).toMatchObject({ situacao: 'aberta', tentativa: 1, motivoParado: null, processo: { id: processoId } })
    expect(aberta.faltam).toHaveLength(6)
    expect(aberta.mensagem).toContain('Joana')
    expect(await json('ana', 'POST', `${url}/tentativas`, { canal: 'email', resultado: 'sem-resposta' })).toEqual({ erro: 'Canal ou resultado inválido.' })

    const r = await json('ana', 'POST', `${url}/tentativas`, { canal: 'ligacao', resultado: 'sem-resposta' })
    expect(r).toMatchObject({ situacao: 'aberta', tentativa: 2, cobranca: { tentativas: [{ dia: '2026-10-08', canal: 'ligacao', resultado: 'sem-resposta', quem: 'ana' }] } })
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Cobrança: 1ª tentativa por Ligação \(sem resposta\); falta: /)
    expect(r.cobrancas).toHaveLength(1)
    expect((await json('ana', 'POST', `${url}/tentativas`, { canal: 'ligacao', resultado: 'sem-resposta' })).erro).toMatch(/^A próxima tentativa é em /)

    expect(await json('ana', 'POST', `${url}/adiamento`, { para: null })).toEqual({ erro: 'Informe a nova data (dd/mm/aaaa).' })
    expect(await json('ana', 'POST', `${url}/adiamento`, { para: '2026-10-08' })).toEqual({ erro: 'A nova data tem de ser depois de hoje.' })
    const adiada = await json('ana', 'POST', `${url}/adiamento`, { para: '2026-10-14' })
    expect(adiada.cobranca).toMatchObject({ adiadaPara: '2026-10-14', tentativas: [{ canal: 'ligacao' }] })
    expect(adiada.ficha.historico.at(-1).oQue).toMatch(/^Adiou a cobrança para .+; a contagem continua em 1 tentativa$/)
    expect((await json('ana', 'GET', '/api/recepcao')).cobrancas).toMatchObject([{ processoId, adiadaPara: '2026-10-14' }])
  })

  it('no limite, só a Sênior decide, com justificativa, e a decisão volta ao Atendimento', async () => {
    const { url } = await cobrancaAberta([
      { dia: '2026-10-02', canal: 'chatwoot', resultado: 'sem-resposta', quem: 'ana' },
      { dia: '2026-10-05', canal: 'ligacao', resultado: 'sem-resposta', quem: 'ana' },
    ])
    expect((await json('ana', 'GET', url)).situacao).toBe('na-senior')
    expect(await json('ana', 'POST', `${url}/tentativas`, { canal: 'ligacao', resultado: 'sem-resposta' })).toEqual({ erro: 'Passou do limite de 2 tentativas: a sênior decide (G15).' })
    expect(await json('ana', 'POST', `${url}/adiamento`, { para: '2026-10-14' })).toEqual({ erro: 'Passou do limite: a sênior decide.' })

    const decisao = { opcao: 'nova-tentativa', justificativa: 'A cliente está viajando e volta no dia 20', prazo: '2026-10-20' }
    expect((await chamar('ana', 'POST', `${url}/decisao`, decisao)).statusCode).toBe(403)
    expect(await json('sara', 'POST', `${url}/decisao`, { ...decisao, justificativa: '  ' })).toEqual({ erro: 'A justificativa é obrigatória.' })
    const r = await json('sara', 'POST', `${url}/decisao`, decisao)
    expect(r).toMatchObject({ situacao: 'aberta', cobranca: { adiadaPara: '2026-10-20', decisoes: [{ opcao: 'nova-tentativa', justificativa: decisao.justificativa, prazo: '2026-10-20', quem: 'sara' }] } })
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Decidiu a cobrança: nova tentativa com prazo até .+\. Justificativa: A cliente está viajando e volta no dia 20\. A decisão voltou para o Atendimento$/)
    expect(await json('sara', 'POST', `${url}/decisao`, decisao)).toEqual({ erro: 'A cobrança ainda não chegou ao limite.' })
  })

  it('chegou tudo: a cobrança fecha sozinha na sincronização, uma vez só', async () => {
    const { fichaId, processoId, url } = await cobrancaAberta()
    await completarOKit(fichaId, processoId)
    const chegouTudo = (fichas: { id: string; historico: { oQue: string }[] }[]) =>
      fichas.find((f) => f.id === fichaId)!.historico.filter((e) => e.oQue.startsWith('Chegou tudo o que faltava')).length
    const r = await json('ana', 'GET', '/api/recepcao')
    expect(r.cobrancas).toMatchObject([{ processoId, encerrada: { porque: 'recebeu-tudo' } }])
    expect(chegouTudo(r.fichas)).toBe(1)
    expect(chegouTudo((await json('dora', 'GET', '/api/recepcao')).fichas)).toBe(1)
    expect((await json('ana', 'GET', url)).situacao).toBe('encerrada')
    expect(await json('ana', 'POST', `${url}/tentativas`, { canal: 'ligacao', resultado: 'sem-resposta' })).toEqual({ erro: 'A cobrança está fechada.' })
  })
})

describe('GGVP-125 · bloco 5d: o documento de qualquer canal confere as pendências', () => {
  it('o comprovante que chega pelo lote do scanner, lido e arquivado, fecha a cobrança aberta; o registro aponta para o Drive', async () => {
    const { fichaId, processoId } = await casoDe('loas-idoso')
    await completarOKit(fichaId, processoId, ['rg', 'cpf', 'cadunico', 'grupo-familiar'])
    const { conferencia } = await json('dora', 'POST', `/api/processos/${processoId}/checklist/conferencia`)
    expect(conferencia.faltam).toEqual([nomeTipo('comprovante-residencia')])
    const aberta = async () => ((await banco.select().from(cobrancaDocumento).where(eq(cobrancaDocumento.casoId, processoId)))[0].dados as { encerrada?: object }).encerrada

    expect(await aberta()).toBeUndefined()
    const { tarefa: recebimento } = await json('ana', 'POST', `/api/fichas/${fichaId}/encaminhamentos`, { motivo: 'documento', setor: 'Documentação · ADM' })
    await json('dora', 'POST', `/api/tarefas/${recebimento.id}/lote`)
    const { documentos } = await json('dora', 'GET', `/api/fichas/${fichaId}/documentos-lidos`)
    const lidos = documentos.filter((d: { situacao: string }) => d.situacao === 'a-conferir')
    expect(lidos.map((d: { tipo: string }) => d.tipo)).toEqual(['comprovante-residencia', 'cnis'])
    const arquivar = { conferi: true, documentos: lidos.map((d: { id: string; tipo: string }) => ({ id: d.id, tipo: d.tipo, data: '2026-10-08' })) }
    expect(await json('dora', 'POST', `/api/fichas/${fichaId}/documentos-lidos/arquivar`, arquivar)).toMatchObject({ arquivados: 2 })

    // A cobrança fecha sozinha quando nada mais falta (a leitura do servidor confere).
    await json('ana', 'GET', `/api/processos/${processoId}/cobranca`)
    expect(await aberta()).toBeTruthy()
    // O papel está no Drive (simulado): o registro aponta para lá, conferido, e não vai ao Drive de novo.
    const doScanner = (await banco.select().from(documento).where(eq(documento.pessoaId, fichaId))).filter((d) => d.origem === 'scanner')
    expect(doScanner.map((d) => [d.tipo, d.situacao, d.drivePendente, d.sensivel, d.chaveArmazenamento.startsWith('drive:'), d.casoId])).toEqual([
      ['comprovante-residencia', 'conferido', false, false, true, processoId],
      ['cnis', 'conferido', false, false, true, processoId],
    ])
  })

  it('o checklist conferido completo abre "Liberar ao Jurídico" para a Documentação, uma só; a liberação fecha', async () => {
    const { fichaId, processoId } = await casoDe('loas-idoso')
    const liberar = () => banco.select().from(tarefa).where(and(eq(tarefa.casoId, processoId), eq(tarefa.passo, 'D1.24')))
    await json('dora', 'POST', `/api/processos/${processoId}/checklist/conferencia`)
    expect(await liberar()).toEqual([])

    await completarOKit(fichaId, processoId)
    await json('dora', 'POST', `/api/processos/${processoId}/checklist/conferencia`)
    await json('dora', 'POST', `/api/processos/${processoId}/checklist/conferencia`)
    expect((await liberar()).map((t) => [t.titulo, t.perfilDono, t.concluidaEm])).toEqual([['Liberar ao Jurídico', 'documentacao', null]])

    expect(await json('dora', 'POST', `/api/casos/${processoId}/liberacao`, { conferiChecklist: true, conferiAssinaturas: true })).toEqual({ ok: true })
    expect((await liberar())[0].concluidaEm).not.toBeNull()
  })
})

