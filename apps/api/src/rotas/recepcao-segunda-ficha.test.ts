import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, fichaRecepcao, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

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
  app = criarServidor({ banco, agora: () => relogio })
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
