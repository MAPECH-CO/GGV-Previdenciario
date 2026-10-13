import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, chamadaIa, credencialGovbr, documento, fichaRecepcao, usuario } from '../banco/esquema.ts'
import { chaveDoCofre, criarCofre } from '../cofre.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_FICHA_DIGITALIZADA } from './recepcao.ts'

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
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

async function lead() {
  return (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 52, pretende: 'Acidente no trabalho.', telefone: '11987654321', beneficioInteresse: 'auxilio-acidente', outraPessoa: false })).id as string
}
/** As respostas da segunda ficha em papel, sem a seção médica, que a tela do Atendimento não mostra. */
const PAPEL = { empresa: 'Exemplo Indústria Ltda', vinculo: 'CLT', acidenteEm: '01/06/2026', deTrabalho: 'sim', parteDoCorpo: 'mão', lado: 'direito', historico: 'Prendeu a mão na máquina.' }
const MEDICO = 'dor e perda de força na mão'

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  // A segunda ficha em papel daqui é a de exemplo, sem arquivo (GGVP-158 P4.10); a leitura de verdade tem o bloco no fim.
  app = criarServidor({ banco, agora: () => relogio, leituraSimulada: true })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 3c: a segunda ficha no servidor, com a seção médica só no Jurídico', () => {
  it('a leitura do papel guarda a seção médica à parte; a Atendimento não a recebe; a advogada lê, e a leitura fica registrada', async () => {
    const fichaId = await lead()
    const leitura = await json('ana', 'POST', `/api/fichas/${fichaId}/segunda-ficha/leitura`)
    expect(leitura).toMatchObject({ senhaLida: false, arquivo: { nome: 'Ficha de atendimento AUXILIO ACIDENTE - Joana Ribeiro - 2026-10-08.pdf', local: 'pessoais' } })
    expect(leitura.respostas).toMatchObject({ empresa: 'Exemplo Indústria Ltda', doencas: '', laudos: '' })
    expect(JSON.stringify(await banco.select().from(fichaRecepcao))).not.toContain(MEDICO)
    // Bloco 5a: a imagem fica na lista de arquivos da ficha do servidor; ler de novo não sobrescreve.
    expect((await json('ana', 'GET', `/api/fichas/${fichaId}`)).arquivos).toEqual([leitura.arquivo])
    const deNovo = await json('ana', 'POST', `/api/fichas/${fichaId}/segunda-ficha/leitura`)
    expect(deNovo.arquivo.nome).toBe('Ficha de atendimento AUXILIO ACIDENTE - Joana Ribeiro - 2026-10-08 (2).pdf')
    expect(deNovo.ficha.arquivos.map((a: { nome: string }) => a.nome)).toEqual([leitura.arquivo.nome, deNovo.arquivo.nome])

    expect((await chamar('ana', 'GET', `/api/fichas/${fichaId}/segunda-ficha`)).statusCode).toBe(403)
    expect(await json('gabi', 'GET', `/api/fichas/${fichaId}/segunda-ficha`)).toMatchObject({ lida: true, medicos: { doencas: MEDICO, cirurgia: 'nao' } })
    expect(await banco.select().from(acessoDadoSensivel)).toMatchObject([{ perfil: 'advogada', recurso: `segunda-ficha:${fichaId}` }])
  })

  it('salvar no papel: vale a seção médica lida; a ficha vai sem os campos médicos; a pendência se conclui', async () => {
    const fichaId = await lead()
    const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false }
    const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id
    expect((await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/analise`, { acidentario: true })).abertas.map((t: { acao: string }) => t.acao)).toContain(
      'Preencher segunda ficha',
    )
    await json('ana', 'POST', `/api/fichas/${fichaId}/segunda-ficha/leitura`)
    expect((await chamar('ana', 'PUT', `/api/fichas/${fichaId}/segunda-ficha`, { respostas: { ...PAPEL, historico: '' }, origem: 'papel' })).statusCode).toBe(400)

    const salva = await json('ana', 'PUT', `/api/fichas/${fichaId}/segunda-ficha`, { respostas: PAPEL, origem: 'papel' })
    expect(salva.ficha.segundaFicha).toMatchObject({ data: '2026-10-08', origem: 'papel', respostas: { empresa: 'Exemplo Indústria Ltda', acidenteEm: '01/06/2026', doencas: '' } })
    expect(salva.tarefas.find((t: { acao: string }) => t.acao === 'Preencher segunda ficha')).toMatchObject({ concluida: true })
    expect(salva.ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Salvou a segunda ficha (auxílio acidentário, papel, conferida)' })

    // A Atendimento abre a ficha e a cópia das telas: sem os campos médicos.
    expect(JSON.stringify(await json('ana', 'GET', `/api/fichas/${fichaId}`))).not.toContain(MEDICO)
    expect(JSON.stringify(await json('ana', 'GET', '/api/recepcao'))).not.toContain(MEDICO)
    expect(await json('gabi', 'GET', `/api/fichas/${fichaId}/segunda-ficha`)).toMatchObject({ lida: false, medicos: { doencas: MEDICO } })
  })

  it('revalida o NB no servidor: inválido não altera a segunda ficha nem o histórico', async () => {
    const fichaId = await lead()
    const url = `/api/fichas/${fichaId}/segunda-ficha`
    const valida = await chamar('ana', 'PUT', url, { respostas: { ...PAPEL, nb: '123.456.789-0' }, origem: 'papel' })
    expect(valida.statusCode).toBe(200)
    const antes = valida.json().ficha
    for (const nb of ['123456789', '12345678901', '0000000000']) {
      const recusada = await chamar('ana', 'PUT', url, { respostas: { ...PAPEL, nb }, origem: 'papel' })
      expect(recusada.statusCode).toBe(400)
      expect(recusada.json()).toEqual({ erro: 'Segunda ficha inválida.' })
    }
    const depois = await json('ana', 'GET', `/api/fichas/${fichaId}`)
    expect(depois.segundaFicha).toEqual(antes.segundaFicha)
    expect(depois.historico).toEqual(antes.historico)
  })

  it('no tablet, o cliente preenche a seção médica; salvar de novo com ela em branco não apaga', async () => {
    const fichaId = await lead()
    await json('ana', 'PUT', `/api/fichas/${fichaId}/segunda-ficha`, { respostas: { ...PAPEL, doencas: 'Lesão no ombro', cirurgia: 'sim' }, origem: 'tablet' })
    const deNovo = await json('ana', 'PUT', `/api/fichas/${fichaId}/segunda-ficha`, { respostas: { ...PAPEL, empresa: 'Outra Indústria Ltda' }, origem: 'tablet' })
    expect(deNovo.ficha.segundaFicha.respostas).toMatchObject({ empresa: 'Outra Indústria Ltda', doencas: '' })
    expect(deNovo.ficha.historico.at(-1).quem).toBe('Cliente (tablet)')
    expect(await json('gabi', 'GET', `/api/fichas/${fichaId}/segunda-ficha`)).toMatchObject({ lida: false, medicos: { doencas: 'Lesão no ombro', cirurgia: 'sim' } })
    // Campo que a tela não conhece não entra.
    await json('ana', 'PUT', `/api/fichas/${fichaId}/segunda-ficha`, { respostas: { ...PAPEL, senha: 'gov-123' }, origem: 'tablet' })
    expect(JSON.stringify(await banco.select().from(fichaRecepcao))).not.toContain('gov-123')
  })
})

describe('GGVP-158 P4.2 · a segunda ficha em papel lida pela IA', () => {
  const SENHA_DO_PAPEL = 'Senha#Meu#INSS-2026'
  const PDF = Buffer.from('%PDF-1.4 a segunda ficha preenchida à mão')
  const LIDA = { respostas: { empresa: 'Exemplo Indústria Ltda', lado: 'direito', doencas: MEDICO, campoQueNaoExiste: 'x' }, senha: SENHA_DO_PAPEL }
  const cofre = criarCofre(chaveDoCofre())
  const ler = async (fichaId: string, arquivo?: Buffer) => {
    const f = '----ggv'
    const corpo =
      arquivo &&
      Buffer.concat([Buffer.from(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="segunda.pdf"\r\nContent-Type: application/pdf\r\n\r\n`), arquivo, Buffer.from(`\r\n--${f}--\r\n`)])
    return app.inject({
      method: 'POST',
      url: `/api/fichas/${fichaId}/segunda-ficha/leitura`,
      cookies: await cookieDe('ana'),
      ...(corpo && { payload: corpo, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }),
    })
  }

  beforeEach(async () => {
    await app.close()
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(LIDA) } }] })))
    // A seção médica é dado de saúde: a leitura usa a autorização do escritório (IA_PERMITE_DADO_DE_SAUDE).
    const ia = criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste-openai', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch, agora: () => relogio })
    app = criarServidor({ banco, agora: () => relogio, ia, cofre, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  })

  it('a IA lê os campos da ficha; a seção médica vai só ao Jurídico; a senha vai ao cofre e a nenhum outro lugar', async () => {
    const fichaId = await lead()
    expect((await ler(fichaId)).json()).toEqual({ erro: MSG_FICHA_DIGITALIZADA })
    const leitura = (await ler(fichaId, PDF)).json()
    expect(leitura).toMatchObject({ senhaLida: true, respostas: { empresa: 'Exemplo Indústria Ltda', lado: 'direito', doencas: '' } })
    expect(leitura.respostas.campoQueNaoExiste).toBeUndefined()
    expect(await json('gabi', 'GET', `/api/fichas/${fichaId}/segunda-ficha`)).toMatchObject({ lida: true, medicos: { doencas: MEDICO } })
    const [credencial] = await banco.select().from(credencialGovbr)
    expect(cofre.decifrar(credencial)).toBe(SENHA_DO_PAPEL)
    for (const onde of [leitura, await banco.select().from(fichaRecepcao), await banco.select().from(chamadaIa)]) expect(JSON.stringify(onde)).not.toContain(SENHA_DO_PAPEL)
    const [d] = await banco.select().from(documento)
    expect([d.tipo, d.sensivel]).toEqual(['ficha-acidente', true])
  })
})
