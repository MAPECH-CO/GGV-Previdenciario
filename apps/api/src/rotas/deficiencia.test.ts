import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, documento, documentoMedico, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const ver = async (apelido: string) => app.inject({ method: 'GET', url: `/api/processos/${casoId}/deficiencia`, cookies: await cookieDe(apelido) })
const salvar = async (apelido: string, corpo: object) => app.inject({ method: 'PUT', url: `/api/processos/${casoId}/deficiencia`, cookies: await cookieDe(apelido), payload: corpo })
const DADOS = { inicio: '2014-06-10', grau: 'leve', agravamentos: [{ data: '2019-03-01', grau: 'moderada' }], sexo: 'feminino' }

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z') })
  for (const [apelido, nome, perfil] of [
    ['gabi', 'Gabi', 'advogada'],
    ['ana', 'Ana', 'atendimento'],
    ['igor', 'Igor', 'juridico_adm'],
  ] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Cleide Exemplo', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'aposentadoria_pcd' }).returning()
  casoId = c.id
  const [d] = await banco
    .insert(documento)
    .values({ casoId, pessoaId: p.id, tipo: 'laudo', sensivel: true, chaveArmazenamento: 'x/1', nomeOriginal: 'laudo.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'card' })
    .returning()
  await banco.insert(documentoMedico).values({ documentoId: d.id, tipo: 'laudo', dataEmissao: '2015-04-20', profissional: 'Dra. Neuro Exemplo' })
  await banco.insert(documento).values({ casoId, pessoaId: p.id, tipo: 'aso', chaveArmazenamento: 'x/2', nomeOriginal: 'aso.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'card', criadoEm: new Date('2026-10-01T12:00:00Z') })
  await banco.insert(documento).values({ casoId, pessoaId: p.id, tipo: 'rg', chaveArmazenamento: 'x/3', nomeOriginal: 'rg.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'card' })
})
afterEach(() => fechar())

describe('GGVP-132 · a linha do tempo da deficiência no servidor (GGVP-42)', () => {
  it('CA3 · só o Jurídico abre: as provas da época vêm dos documentos do caso, e a leitura fica registrada', async () => {
    expect((await ver('ana')).statusCode).toBe(403)
    const r = (await ver('gabi')).json()
    expect([r.beneficio, r.dados, r.periodos, r.provas.map((p: { tipo: string; data: string }) => [p.tipo, p.data])]).toEqual([
      'PCD Aposentadoria por Contribuição',
      undefined,
      [],
      [
        ['laudo', '2015-04-20'],
        ['aso', '2026-10-01'],
      ],
    ])
    expect((await banco.select().from(acessoDadoSensivel)).map((a) => a.recurso)).toEqual([`deficiencia:${casoId}`])
  })

  it('CA1, CA2 · a advogada registra o início, o grau e o agravamento; o Jurídico administrativo e o Atendimento não registram', async () => {
    for (const quem of ['ana', 'igor']) expect((await salvar(quem, DADOS)).json().erro).toBe(MSG_SEM_PERMISSAO)
    const r = await salvar('gabi', DADOS)
    expect([r.statusCode, r.json().dados.grau, r.json().dados.agravamentos, r.json().dados.quem]).toEqual([200, 'leve', DADOS.agravamentos, 'Gabi'])
    const [evento] = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'deficiencia_registrada')
    expect(JSON.stringify(evento.detalhe)).not.toMatch(/leve|moderada/)
  })

  it('o servidor confere de novo: data futura ou agravamento para grau menor não salvam', async () => {
    expect((await salvar('gabi', { ...DADOS, inicio: '2027-01-01' })).statusCode).toBe(400)
    expect((await salvar('gabi', { ...DADOS, grau: 'grave', agravamentos: [{ data: '2019-03-01', grau: 'leve' }] })).statusCode).toBe(400)
    expect((await salvar('gabi', { ...DADOS, grau: 'gravissima' })).statusCode).toBe(400)
  })
})
