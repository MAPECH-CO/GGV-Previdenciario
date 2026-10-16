// GGVP-156 CA2 no servidor: quem vê a jurimetria do perito. A Documentação e o Atendimento abrem a perícia e veem o perito
// e a situação; os números dele e os laudos do perfil ficam com o Jurídico e o Sócio. Dados inventados; IA desligada.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, etapa, pericia, perito, pessoa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import type { LaudoDoPerfil } from '../../../web/src/dados/peritos.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let peritoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })

/** O perfil do perito: três laudos do acervo, dois favoráveis, sem dado do cliente (só a referência do caso). */
const LAUDOS: LaudoDoPerfil[] = [1, 2, 3].map((n) => ({
  id: `laudo-teste-${n}`,
  caso: `acervo-teste-00${n}`,
  data: `2026-0${n + 3}-1${n}`,
  tipo: 'medica',
  assunto: 'coluna',
  beneficio: 'loas-deficiente',
  resultado: n < 3 ? 'favoravel' : 'desfavoravel',
  dias: 10 + n,
  observou: ['como a pessoa senta e levanta'],
  perguntou: ['quanto tempo aguenta em pé'],
  pediu: ['exames de imagem recentes'],
}))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T13:00:00Z'), armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))), ia: criarIa({ banco, ambiente: {} }) })
  for (const [apelido, perfil] of [['igor', 'juridico_adm'], ['gabi', 'advogada'], ['ana', 'atendimento'], ['dora', 'documentacao'], ['lauro', 'socio']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Maria Souza', telefone: '11987654321', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  casoId = c.id
  const [d203] = await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', iniciadaEm: new Date('2026-10-02T12:00:00Z'), concluidaEm: new Date('2026-10-02T13:00:00Z') }).returning()
  await banco.insert(pericia).values({ casoId, tipo: 'medica', chamadaPorEtapaId: d203.id })
  ;[{ id: peritoId }] = await banco
    .insert(perito)
    .values({ nome: 'Dr. Teste Perito', nomeNormalizado: 'teste perito', especialidade: 'Perito médico do INSS', perfil: { tipo: 'medica', onde: 'Agência INSS', laudos: LAUDOS } })
    .returning()
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-156 · quem vê a jurimetria do perito', () => {
  it('GGVP-156 CA2 · a Documentação e o Atendimento abrem a perícia e veem o perito e a situação, sem os números nem os laudos dele; o Jurídico e o Sócio recebem', async () => {
    expect((await chamar('igor', 'POST', `/api/processos/${casoId}/pericia/perito`, { peritoId })).statusCode).toBe(200)
    const ver = async (apelido: string) => {
      const r = await chamar(apelido, 'GET', `/api/processos/${casoId}/pericia`)
      expect(r.statusCode).toBe(200)
      return r.json()
    }
    const juridico = await ver('gabi')
    expect(juridico.perfil.perito).toMatchObject({ nome: 'Dr. Teste Perito', laudos: LAUDOS })
    expect([juridico.perfil.versao, juridico.perfil.jurimetria.laudos, juridico.perfil.jurimetria.favoraveis]).toEqual([3, 3, 2])
    expect((await ver('lauro')).perfil.jurimetria).toEqual(juridico.perfil.jurimetria)

    for (const apelido of ['dora', 'ana']) {
      const t = await ver(apelido)
      // O perito e a situação da perícia (saúde simples): iguais para todos.
      expect([t.perfil.perito.nome, t.perfil.perito.especialidade, t.etapa, t.pericia.historico]).toEqual([
        'Dr. Teste Perito',
        'Perito médico do INSS',
        juridico.etapa,
        juridico.pericia.historico,
      ])
      // Nada dos números nem dos laudos do perito.
      expect(t.perfil).toMatchObject({ versao: 0, jurimetria: { laudos: 0, favoraveis: 0, taxa: 0, diasAteOLaudo: 0 }, porAssunto: [], porBeneficio: [], observou: [], perguntou: [], pediu: [] })
      expect(t.perfil.perito.laudos).toEqual([])
      for (const l of LAUDOS) expect(JSON.stringify(t)).not.toContain(l.caso)
    }
    // A lista de peritos da pergunta de um clique também vai sem os laudos.
    expect((await chamar('dora', 'GET', '/api/peritos?tipo=medica')).json()).toEqual([{ id: peritoId, nome: 'Dr. Teste Perito', especialidade: 'Perito médico do INSS', tipo: 'medica' }])
  })
})
