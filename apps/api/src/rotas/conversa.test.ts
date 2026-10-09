import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, eventoAuditoria, gravacaoRecepcao, pericia, pessoa, usuario } from '../banco/esquema.ts'
import { MSG_SEM_AUDIO, MSG_TRANSCRICAO_DESLIGADA } from '../fluxo/transcricao.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_AVISO_NA_CONVERSA, MSG_SEM_AVISO_NA_LIGACAO } from './conversa.ts'
import { MSG_MANDE_O_ARQUIVO } from './recepcao-entrevista.ts'

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

// GGVP-133: o servidor não transcreve conversa de exemplo. A ligação sobe de verdade e a OpenAI é um serviço falso (nenhuma
// chamada de verdade), que diz o endereço e o telefone novos, a perícia remarcada, a internação (saúde), o relatório, a
// senha dita em voz alta (G9) e o combinado.
const CHAVES = { OPENAI_API_KEY: 'chave-de-teste-openai', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
const FALAS = [
  { speaker: 'A', start: 0, end: 5, text: 'Maria, esta ligação está sendo gravada e transcrita para atualizar a sua ficha. Tudo bem?' },
  { speaker: 'B', start: 20, end: 25, text: 'Mudei de casa. Agora moro na Rua Exemplo das Acácias, 45.' },
  { speaker: 'B', start: 38, end: 43, text: 'Troquei de número: agora é (11) 90000-0044.' },
  { speaker: 'B', start: 56, end: 60, text: 'Remarcaram a perícia para 16/10.' },
  { speaker: 'B', start: 66, end: 72, text: 'Fiquei três dias no hospital no fim de setembro. Trouxe o relatório da alta.' },
  { speaker: 'B', start: 86, end: 90, text: 'A minha senha do gov.br é Exemplo@2026, pode anotar.' },
  { speaker: 'A', start: 96, end: 102, text: 'Não precisa: a senha vai para o cofre. A Documentação vai receber o relatório da alta.' },
]
const LEITURA = {
  resumo: 'A cliente mudou de endereço e de telefone, teve a perícia remarcada e ficou três dias no hospital.',
  ditos: [
    { campo: 'endereco', valor: 'Rua Exemplo das Acácias, 45', i: 1 },
    { campo: 'telefone', valor: '(11) 90000-0044', i: 2 },
    { campo: 'pericia', valor: '16/10/2026', i: 3 },
    { campo: 'fato', valor: 'Três dias no hospital no fim de setembro', i: 4, saude: true },
    { campo: 'documento', valor: 'Relatório da alta hospitalar', i: 4 },
  ],
  combinado: 'Documentação: receber e digitalizar o relatório da alta hospitalar.',
}

/** O serviço falso que responde como a OpenAI: transcreve, arruma (devolve as falas como vieram) e lê a conversa. */
const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const resposta = (corpo: object) => new Response(JSON.stringify(corpo), { status: 200 })
  if (String(url).endsWith('/audio/transcriptions')) return resposta({ usage: { type: 'duration', seconds: 110 }, segments: FALAS })
  const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
  if (corpo.messages[0].content.includes('registrar uma conversa')) return resposta({ choices: [{ message: { content: JSON.stringify(LEITURA) } }] })
  const falas = JSON.parse(corpo.messages[1].content.split('Falas:\n')[1].replace('\n</conteudo>', '')) as { i: number; falante: string; texto: string }[]
  const papel = (f: string) => (f.endsWith('A') ? 'escritorio' : 'cliente')
  const arrumada = { falantes: Object.fromEntries(falas.map((f) => [f.falante, papel(f.falante)])), falas: falas.map((f) => ({ i: f.i, texto: f.texto })) }
  return resposta({ choices: [{ message: { content: JSON.stringify(arrumada) } }] })
}) as unknown as typeof globalThis.fetch

function montar(ambiente: Record<string, string> = CHAVES) {
  const ia = criarIa({ banco, ambiente, fetch: fetchFalso, agora: () => relogio })
  app = criarServidor({ banco, agora: () => relogio, ia, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'conversa-'))) })
}

/** Corpo multipart com o arquivo e, se vierem, campos. */
function comArquivo(nome: string, mime: string, campos: Record<string, string> = {}) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: ${mime}\r\n\r\náudio\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const subir = async (apelido: string, url: string, arquivo: ReturnType<typeof comArquivo>) => app.inject({ method: 'POST', url, cookies: await cookieDe(apelido), ...arquivo })
const LIGACAO = () => comArquivo('ligacao.mp3', 'audio/mpeg', { avisoNaGravacao: 'sim' })

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
  await subir(quem, `/api/conversas/${id}/audio`, LIGACAO())
  const transcrita = await json(quem, 'POST', `/api/conversas/${id}/transcricao`, {})
  return { fichaId, processoId, id, transcrita }
}
const idDo = (mudancas: { id: string; campo: string }[], campo: string) => mudancas.find((m) => m.campo === campo)!.id

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  montar()
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

  it('G10: sem o aviso não grava; a gravação tem pausa e retomada; sem áudio guardado, finalizar não inventa áudio; com ele, o áudio fica no card e vai para a transcrição', async () => {
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
    // GGVP-133: a página recarregou antes da primeira parte do microfone: nenhum áudio chegou. A gravação falha, sem áudio
    // de mentira, e as saídas são subir o áudio gravado fora ou registrar sem áudio.
    const semAudio = await json('ana', 'POST', `${url}/finalizar`, { aos: 120 })
    expect(semAudio.gravacao).toMatchObject({ estado: 'falhou', duracao: 120 })
    expect([semAudio.gravacao.audio, semAudio.conversa.finalizadaEm, semAudio.ficha.transcricoes]).toEqual([undefined, undefined, 0])
    expect((await json('ana', 'POST', `${url}/transcricao`, {})).gravacao.trechos).toEqual([])
    await subir('ana', `${url}/audio`, comArquivo('gravador.ogg', 'audio/ogg', { inicio: '0' }))
    const fim = await json('ana', 'POST', `${url}/finalizar`, { aos: 120 })
    expect(fim.gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'transcrevendo', duracao: 120, audio: { nome: 'gravador.ogg', partes: 1 } })
    expect(fim.conversa.finalizadaEm).toBeDefined()
    expect(fim.ficha.transcricoes).toBe(1)
    expect(fim.ficha.historico.at(-1).oQue).toBe('Finalizou a conversa gravada (2 min); o áudio ficou no card e foi para a transcrição')
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

  it('G10 na ligação já feita: só sobe o áudio com o aviso nela, só arquivo de áudio, e só com o arquivo (o nome sozinho não é áudio)', async () => {
    const { fichaId } = await clienteComProcesso()
    const { conversa } = await json('ana', 'POST', '/api/conversas', { fichaId, canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
    const url = `/api/conversas/${conversa.id}/audio`
    expect((await subir('ana', url, comArquivo('ligacao.mp3', 'audio/mpeg'))).json().erro).toBe(MSG_SEM_AVISO_NA_LIGACAO)
    expect((await subir('ana', url, comArquivo('foto.jpg', 'image/jpeg', { avisoNaGravacao: 'sim' }))).json().erro).toBe('Esse arquivo não é de áudio.')
    // GGVP-133: só o nome não fica guardado no card, como na entrevista: nada de gravação sem áudio.
    const soONome = await chamar('ana', 'POST', url, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 9000, avisoNaGravacao: true })
    expect([soONome.statusCode, soONome.json().erro]).toEqual([400, MSG_MANDE_O_ARQUIVO])
    expect((await json('ana', 'GET', `/api/conversas/${conversa.id}`)).gravacao).toBeUndefined()
    const r = (await subir('ana', url, LIGACAO())).json()
    expect(r.gravacao).toMatchObject({ origem: 'arquivo', estado: 'encerrada', audio: { nome: 'ligacao.mp3', partes: 1 } })
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

  it('GGVP-133: sem a chave do serviço, a ligação de verdade não vira conversa de exemplo: a transcrição falha com o motivo, o áudio fica e a tela segue manual', async () => {
    await app.close()
    montar({})
    const { transcrita } = await ligacaoTranscrita()
    expect(transcrita.gravacao).toMatchObject({ transcricao: 'falhou', motivoDaFalha: MSG_TRANSCRICAO_DESLIGADA, trechos: [], audio: { partes: 1 } })
    expect(transcrita.conversa.analise).toBeUndefined()
    expect(JSON.stringify(transcrita)).not.toContain('Rua Exemplo das Acácias')
  })

  it('GGVP-133: a gravação sem áudio guardado (o áudio de mentira de antes) não é transcrita: falha com o motivo', async () => {
    const { id } = await ligacaoTranscrita()
    const { gravacao } = await json('ana', 'GET', `/api/conversas/${id}`)
    const antiga = { ...gravacao, transcricao: 'transcrevendo', trechos: [], audio: { nome: 'conversa.webm', formato: 'webm', tamanho: 1920000, partes: 1 } }
    await banco.update(gravacaoRecepcao).set({ dados: antiga }).where(eq(gravacaoRecepcao.id, gravacao.id))
    const r = await json('ana', 'POST', `/api/conversas/${id}/transcricao`, {})
    expect(r.gravacao).toMatchObject({ transcricao: 'falhou', motivoDaFalha: MSG_SEM_AUDIO, trechos: [] })
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
