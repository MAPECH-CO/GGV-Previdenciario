import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, eventoAuditoria, pericia, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_AVISO_NA_CONVERSA, MSG_SEM_AVISO_NA_LIGACAO, MSG_TRANSCRICAO_DESLIGADA } from './conversa.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')
const PERFIS = [
  ['ana', 'atendimento'],
  ['gabi', 'advogada'],
  ['helena', 'senior'],
  ['jessica', 'documentacao'],
  ['marcos', 'financeiro'],
] as const

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()
const eventos = async (acao: string) => (await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, acao))).map((e) => e.detalhe as Record<string, unknown>)

/** O cliente do balcão, com um processo de LOAS. */
async function clienteComProcesso() {
  const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Maria Ribeiro', idade: 66, pretende: 'Quer saber do BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
  const [c] = await banco.insert(caso).values({ pessoaId: fichaId, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  return { fichaId, processoId: c.id }
}

/** A ligação anexada e transcrita: o endereço, o telefone, a perícia, a internação (saúde), o relatório e a senha dita. */
async function ligacaoTranscrita(quem = 'ana') {
  const { fichaId, processoId } = await clienteComProcesso()
  const conversa = await json(quem, 'POST', '/api/conversas', { fichaId, canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
  const id = conversa.conversa.id as string
  await json(quem, 'POST', `/api/conversas/${id}/audio`, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 120_000, avisoNaGravacao: true })
  const transcrita = await json(quem, 'POST', `/api/conversas/${id}/transcricao`, {})
  return { fichaId, processoId, id, transcrita }
}
const idDo = (mudancas: { id: string; campo: string }[], campo: string) => mudancas.find((m) => m.campo === campo)!.id

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of PERFIS)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-138 · a conversa com o cliente no servidor', () => {
  it('por perfil: só o Atendimento e o Jurídico conduzem; o Financeiro não abre a conversa; o servidor confere o pedido', async () => {
    const { fichaId } = await clienteComProcesso()
    const escrita = { fichaId, canal: 'presencial', comQuem: 'cliente', modo: 'escrito', registro: 'Trouxe o comprovante de endereço.' }
    expect((await chamar('jessica', 'POST', '/api/conversas', escrita)).statusCode).toBe(403)
    expect((await chamar('marcos', 'POST', '/api/conversas', escrita)).statusCode).toBe(403)
    expect((await json('ana', 'POST', '/api/conversas', { ...escrita, registro: '' })).erro).toBe('Escreva o resumo da conversa.')

    const r = await json('ana', 'POST', '/api/conversas', escrita)
    expect(r.conversa).toMatchObject({ papel: 'atendimento', quem: 'ana', modo: 'escrito', registro: 'Trouxe o comprovante de endereço.' })
    expect(r.conversa.quemId).toBeUndefined()
    expect(r.gravacao).toMatchObject({ origem: 'registro', transcricao: 'sem-audio', soJuridico: false })
    expect(r.ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Registrou a conversa sem áudio (presencial, com cliente): só registro' })
    expect((await chamar('marcos', 'GET', `/api/conversas/${r.conversa.id}`)).statusCode).toBe(403)
    expect((await json('jessica', 'GET', `/api/conversas/${r.conversa.id}`)).conversa.id).toBe(r.conversa.id)
    expect((await json('gabi', 'POST', '/api/conversas', escrita)).conversa.papel).toBe('juridico')
    expect(await eventos('conversa_aberta')).toHaveLength(2)
  })

  it('G10: sem o aviso não grava; a gravação tem pausa e retomada e, finalizada, o áudio fica no card e vai para a transcrição', async () => {
    const { fichaId } = await clienteComProcesso()
    const { conversa } = await json('ana', 'POST', '/api/conversas', { fichaId, canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
    const url = `/api/conversas/${conversa.id}`
    expect((await json('ana', 'POST', `${url}/gravacao`, {})).erro).toBe(MSG_SEM_AVISO_NA_CONVERSA)
    expect((await json('ana', 'GET', '/api/conversas/tarefas'))[0]).toMatchObject({ acao: 'Registrar conversa', detalhe: 'presencial, com cliente · chegou às 12:00 · gravar depois do aviso (G10)' })

    const gravando = await json('ana', 'POST', `${url}/gravacao`, { avisei: true })
    expect(gravando.gravacao).toMatchObject({ estado: 'gravando', acoes: [{ acao: 'avisou' }, { acao: 'gravou' }] })
    expect(gravando.ficha.historico.at(-1).oQue).toBe('Avisou às 12:00 que a conversa seria gravada (G10) e começou a gravar')
    expect((await json('ana', 'POST', `${url}/gravacao`, { avisei: true })).gravacao.id).toBe(gravando.gravacao.id)
    expect((await json('ana', 'POST', `${url}/acoes`, { acao: 'pausou', aos: 30 })).gravacao.estado).toBe('pausada')
    expect((await json('ana', 'POST', `${url}/acoes`, { acao: 'retomou', aos: 40 })).gravacao.estado).toBe('gravando')
    const fim = await json('ana', 'POST', `${url}/finalizar`, { aos: 120 })
    expect(fim.gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'transcrevendo', duracao: 120, audio: { formato: 'webm' } })
    expect(fim.conversa.finalizadaEm).toBeDefined()
    expect(fim.ficha.transcricoes).toBe(1)
  })

  it('GGVP-133: sem microfone, a conversa gravada agora fica registrada sem áudio, sem áudio nem fala inventados', async () => {
    const { fichaId } = await clienteComProcesso()
    const { conversa } = await json('ana', 'POST', '/api/conversas', { fichaId, canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
    const url = `/api/conversas/${conversa.id}`
    await json('ana', 'POST', `${url}/gravacao`, { avisei: true })
    expect((await json('ana', 'POST', `${url}/acoes`, { acao: 'falhou', aos: 3 })).gravacao.estado).toBe('falhou')
    expect((await json('ana', 'POST', `${url}/sem-audio`, { notas: 'x' })).erro).toBe('Escreva o que foi conversado.')
    const r = await json('ana', 'POST', `${url}/sem-audio`, { notas: 'Contou que mudou de casa; traz o comprovante.' })
    expect(r.gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'sem-audio', registro: 'Contou que mudou de casa; traz o comprovante.', trechos: [] })
    expect(r.gravacao.audio).toBeUndefined()
    expect(r.conversa).toMatchObject({ registro: 'Contou que mudou de casa; traz o comprovante.' })
    expect(r.ficha.historico.at(-1).oQue).toBe('Registrou a conversa sem áudio (presencial, com cliente): o microfone não gravou')
    // Falta só a conferência de quem conversou, como na conversa escrita.
    expect((await json('ana', 'GET', '/api/conversas/tarefas'))[0].detalhe).toMatch(/conferir a conversa \(D5\.04\)$/)
  })

  it('G10 na ligação já feita: só sobe o áudio com o aviso nela, e só arquivo de áudio', async () => {
    const { fichaId } = await clienteComProcesso()
    const { conversa } = await json('ana', 'POST', '/api/conversas', { fichaId, canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
    const url = `/api/conversas/${conversa.id}/audio`
    expect((await json('ana', 'POST', url, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 9000 })).erro).toBe(MSG_SEM_AVISO_NA_LIGACAO)
    expect((await json('ana', 'POST', url, { nome: 'foto.jpg', tipo: 'image/jpeg', tamanho: 9000, avisoNaGravacao: true })).erro).toBe('Esse arquivo não é de áudio.')
    const r = await json('ana', 'POST', url, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 9000, avisoNaGravacao: true })
    expect(r.gravacao).toMatchObject({ origem: 'arquivo', estado: 'encerrada', audio: { nome: 'ligacao.mp3' } })
  })

  it('a transcrição sai sem a senha; quem fez a conversa vê o mesmo que o Jurídico; a leitura do Jurídico fica registrada (LGPD)', async () => {
    const { id, transcrita } = await ligacaoTranscrita()
    expect(transcrita.gravacao.transcricao).toBe('pronta')
    expect(transcrita.conversa.analise.mudancas.map((m: { campo: string }) => m.campo)).toEqual(['endereco', 'telefone', 'pericia', 'fato', 'documento'])
    expect(transcrita.conversa.analise.pendencia).toBe('Documentação: receber e digitalizar o relatório da alta hospitalar.')
    // O que a conversa registrou não é dado de saúde (Pedro, 08/10): a Ana, que conversou, e a advogada recebem o mesmo.
    const juridico = await json('gabi', 'GET', `/api/conversas/${id}`)
    expect(transcrita.conversa).toEqual(juridico.conversa)
    expect(transcrita.gravacao).toEqual(juridico.gravacao)
    expect((await json('jessica', 'GET', `/api/conversas/${id}`)).conversa).toEqual(juridico.conversa)
    const texto = juridico.gravacao.trechos.map((t: { texto: string }) => t.texto).join(' ')
    expect(texto).toContain('senha do gov.br')
    expect(texto).not.toContain('Exemplo@2026')
    expect(await banco.select().from(acessoDadoSensivel).where(eq(acessoDadoSensivel.recurso, `conversa:${id}`))).toHaveLength(1)
    // O histórico guarda o que aconteceu, sem o conteúdo.
    expect(await eventos('conversa_transcrita')).toEqual([expect.objectContaining({ conversa: id, mudancas: 5, saude: true, senhaDita: true })])
  })

  it('com a simulação desligada, a transcrição falha com o motivo e a tela segue manual', async () => {
    await app.close()
    vi.stubEnv('RELACIONAMENTO_SIMULADO', 'nao')
    app = criarServidor({ banco, agora: () => relogio })
    vi.unstubAllEnvs()
    const { transcrita } = await ligacaoTranscrita()
    expect(transcrita.gravacao).toMatchObject({ transcricao: 'falhou', motivoDaFalha: MSG_TRANSCRICAO_DESLIGADA })
    expect(transcrita.conversa.analise).toBeUndefined()
  })

  it('conferir: só quem conversou; nada sem a pendência respondida; telefone só com o cliente verificado; o fato novo, só o Jurídico confirma', async () => {
    const { fichaId, id, transcrita } = await ligacaoTranscrita()
    const m = transcrita.conversa.analise.mudancas
    const url = `/api/conversas/${id}/conferencia`
    const confirmar = (...campos: string[]) => campos.map((c) => ({ id: idDo(m, c), decisao: 'confirmada' }))
    const decisoes = [...confirmar('endereco', 'telefone', 'pericia', 'documento')]
    const pendencia = { surgiu: true, texto: transcrita.conversa.analise.pendencia, responsavel: 'jessica', prazo: '10/10/2026' }

    expect((await chamar('gabi', 'POST', url, { decisoes, pendencia })).statusCode).toBe(403)
    expect((await json('ana', 'POST', url, { decisoes })).erro).toBe('Responda "Surgiu pendência?".')
    expect((await json('ana', 'POST', url, { decisoes: [...decisoes, ...confirmar('fato')], pendencia })).erro).toBe('A mudança de fato novo é de a advogada responsável ou a Sênior.')
    expect((await json('ana', 'POST', url, { decisoes, pendencia: { ...pendencia, responsavel: 'ninguém' } })).erro).toBe('Escolha quem fica com a tarefa.')
    // A ligação não é o cliente no escritório: o telefone só muda com a verificação e o contrato novo (GGVP-111).
    expect((await json('ana', 'POST', url, { decisoes, pendencia })).erro).toMatch(/^Telefone, e-mail e dados bancários só mudam/)
    expect(await eventos('portao_bloqueado')).toEqual([expect.objectContaining({ portao: 'verificacao', passo: 'D5.04', perfil: 'atendimento' })])

    const r = await json('ana', 'POST', url, { decisoes, pendencia, verificacao: { como: 'video', contratoNovo: true } })
    expect(r.conversa).toMatchObject({ conferidaEm: relogio.toISOString(), pendencia: { responsavel: 'jessica', setor: 'Documentação · ADM', prazo: '2026-10-10' } })
    expect(r.conversa.pendencia.responsavelId).toBeUndefined()
    // A ficha do cliente no servidor mudou: o documento da Recepção e a pessoa que o resto do portal lê.
    const ficha = await json('jessica', 'GET', `/api/fichas/${fichaId}`)
    expect(ficha).toMatchObject({ telefone: '11900000044', endereco: 'Rua Exemplo das Acácias, 45' })
    const [p] = await banco.select().from(pessoa).where(eq(pessoa.id, fichaId))
    expect(p).toMatchObject({ telefone: '11900000044', logradouro: 'Rua Exemplo das Acácias, 45' })
    expect(ficha.historico.map((e: { oQue: string }) => e.oQue)).toEqual(
      expect.arrayContaining([
        'Mudança de telefone de contato com o cliente verificado (chamada de vídeo com o cliente; em contrato novo)',
        'Atualizou na ficha, pela conversa, o telefone de contato: «(11) 98765-4321» → «(11) 90000-0044»',
        'Atualizou no processo, pela conversa, o data da perícia do INSS: «—» → «16/10/2026»',
      ]),
    )
    expect(r.gravacao.marcas).toContain('ficha atualizada')
    // A pendência vira tarefa na Central da Jéssica; a conversa sai da Central da Ana.
    expect(await json('jessica', 'GET', '/api/conversas/tarefas')).toEqual([expect.objectContaining({ acao: 'Cumprir pendência', prazo: 'vence 10/10', href: `/conversas/${id}/conferir` })])
    expect(await json('ana', 'GET', '/api/conversas/tarefas')).toEqual([])

    // Depois, o Jurídico confere só o que é dele.
    expect((await json('ana', 'POST', url, { decisoes: confirmar('fato') })).erro).toBe('A mudança de fato novo é de a advogada responsável ou a Sênior.')
    const doJuridico = await json('gabi', 'POST', url, { decisoes: confirmar('fato') })
    expect(doJuridico.conversa.decisoes).toHaveLength(5)
    expect(await eventos('conversa_conferida')).toEqual([
      expect.objectContaining({ confirmadas: 4, campos: ['endereco', 'telefone', 'pericia', 'documento'], pendencia: true }),
      expect.objectContaining({ confirmadas: 1, campos: ['fato'], pendencia: false }),
    ])
    // As versões são as mesmas para quem vê o caso.
    expect(await json('ana', 'GET', `/api/fichas/${fichaId}/versoes`)).toEqual(await json('gabi', 'GET', `/api/fichas/${fichaId}/versoes`))
  })

  it('a perícia já marcada não muda pela conversa: muda pela remarcação', async () => {
    const { id, processoId, transcrita } = await ligacaoTranscrita()
    await banco.insert(pericia).values({ casoId: processoId, tipo: 'medica', agendadaPara: new Date('2026-10-02T11:00:00Z') })
    const m = transcrita.conversa.analise.mudancas
    const r = await json('ana', 'POST', `/api/conversas/${id}/conferencia`, {
      decisoes: ['endereco', 'telefone', 'pericia', 'documento'].map((c) => ({ id: idDo(m, c), decisao: c === 'telefone' ? 'desfeita' : 'confirmada' })),
      pendencia: { surgiu: false },
    })
    expect(r.erro).toBe('A data da perícia já marcada muda pela remarcação, na tela da perícia: desfaça este item aqui e remarque lá.')
  })

  it('versões: só a Sênior volta, a volta vira versão nova e muda a ficha; a pendência, só o responsável ou a Sênior', async () => {
    const { fichaId, id, transcrita } = await ligacaoTranscrita()
    const m = transcrita.conversa.analise.mudancas
    await json('ana', 'POST', `/api/conversas/${id}/conferencia`, {
      decisoes: [{ id: idDo(m, 'telefone'), decisao: 'corrigida', valor: '(11) 90000-0055' }, ...['endereco', 'pericia', 'documento'].map((c) => ({ id: idDo(m, c), decisao: 'desfeita' }))],
      pendencia: { surgiu: true, texto: 'Ligar de volta para confirmar o número.', responsavel: 'ana', prazo: '09/10/2026' },
      verificacao: { como: 'presencial', contratoNovo: true },
    })
    const telefone = (await json('ana', 'GET', `/api/fichas/${fichaId}/versoes`)).filter((v: { campo: string }) => v.campo === 'telefone')
    expect(telefone.map((v: { valor: string; origem: string }) => [v.valor, v.origem])).toEqual([
      ['11987654321', 'antes'],
      ['11900000055', 'conversa'],
    ])
    const volta = `/api/fichas/${fichaId}/versoes/telefone/volta`
    expect((await chamar('ana', 'POST', volta, { onde: 'ficha', versao: 0 })).statusCode).toBe(403)
    expect((await json('helena', 'POST', volta, { onde: 'ficha', versao: 1 })).erro).toBe('Essa já é a versão em vigor.')
    expect((await json('helena', 'POST', `/api/fichas/${fichaId}/versoes/fato/volta`, { onde: 'processo', versao: 0 })).erro).toMatch(/^Fato novo e documento citado somam ao caso/)
    const depois = await json('helena', 'POST', volta, { onde: 'ficha', versao: 0 })
    expect(depois.at(-1)).toMatchObject({ valor: '11987654321', origem: 'volta', quem: 'helena' })
    expect((await json('ana', 'GET', `/api/fichas/${fichaId}`)).telefone).toBe('11987654321')
    expect(await eventos('versao_voltada')).toEqual([expect.objectContaining({ campo: 'telefone', onde: 'ficha' })])

    // A pendência é da Ana: a advogada não dá por cumprida; o prazo novo é só da Sênior.
    expect((await chamar('gabi', 'POST', `/api/conversas/${id}/pendencia/cumprida`)).statusCode).toBe(403)
    expect((await chamar('ana', 'POST', `/api/conversas/${id}/pendencia/prazo`, { prazo: '20/10/2026' })).statusCode).toBe(403)
    expect((await json('helena', 'POST', `/api/conversas/${id}/pendencia/prazo`, { prazo: '01/10/2026' })).erro).toBe('Prazo de hoje em diante (dd/mm/aaaa).')
    expect((await json('helena', 'POST', `/api/conversas/${id}/pendencia/prazo`, { prazo: '20/10/2026' })).conversa.pendencia.prazo).toBe('2026-10-20')
    const cumprida = await json('ana', 'POST', `/api/conversas/${id}/pendencia/cumprida`)
    expect(cumprida.conversa.pendencia).toMatchObject({ cumpridaPor: 'ana' })
    expect(await json('ana', 'GET', '/api/conversas/tarefas')).toEqual([])
    expect((await chamar('ana', 'POST', `/api/conversas/${id}/pendencia/cumprida`)).statusCode).toBe(404)
  })

  it('as pessoas que podem ficar com a pendência vêm do login, com o setor', async () => {
    expect(await json('ana', 'GET', '/api/conversas/responsaveis')).toEqual([
      { nome: 'ana', setor: 'Atendimento' },
      { nome: 'gabi', setor: 'Jurídico' },
      { nome: 'helena', setor: 'Jurídico' },
      { nome: 'jessica', setor: 'Documentação · ADM' },
      { nome: 'marcos', setor: 'Financeiro' },
    ])
  })
})
