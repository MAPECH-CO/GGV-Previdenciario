// GGVP-24 CA9 no servidor: a senha do gov.br guardada a partir da ficha não aparece no kit do contrato (PDF e Word) nem na
// exportação do histórico do caso. Senha de teste, dados inventados; o conversor de PDF é de mentira e devolve o texto do Word.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { fichaRecepcao, usuario } from '../banco/esquema.ts'
import { docxDeTeste, formularioDoArquivo, textoDoDocx } from '../kit/docx-de-teste.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { CONFERENCIAS } from '../../../web/src/regras/contrato.ts'

const SENHA = 'senha-do-portal-1'
/** A senha de teste do gov.br: não pode aparecer em nenhum arquivo que sai do portal (G9). */
const SENHA_DE_TESTE = 'Gov#Teste-Kit-7319'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const convertidos: string[] = []

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

/** O modelo de teste: texto inventado, com as variáveis que os modelos do escritório usam. */
const MODELO = [
  'CONTRATO. {{NOME COMPLETO}}, {{ESTADO CIVIL}}, {{NACIONALIDADE}}, {{PROFISSÃO}}, CPF {{NÚMERO DO CPF}}, RG {{NÚMERO DO RG}}, {{ENDEREÇO COMPLETO}} nº {{Nº}}, {{BAIRRO}}, {{CIDADE}}/{{UF}}, CEP {{CEP}}, telefone {{TELEFONE}}, contato {{TELEFONE P/ CONTATO}}.',
  'São Paulo, {{DATA DE HOJE}}.',
  'PROCURAÇÃO de {{NOME COMPLETO}}.',
]
/** Valores válidos para os campos do modelo que a ficha do balcão ainda não tem. */
const VALIDOS: Record<string, string> = {
  cpf: '52998224725',
  rg: '12.345.678-9',
  estadoCivil: 'Viúvo(a)',
  profissao: 'Do lar',
  endereco: 'Rua das Flores, 10, Centro, Osasco/SP',
  telefone: '11987654321',
  nome: 'Joana Ribeiro',
  nacionalidade: 'brasileira',
}
const TODAS = Object.fromEntries(CONFERENCIAS.map((c) => [c.id, true]))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  convertidos.length = 0
  app = criarServidor({
    banco,
    agora: () => new Date('2026-10-08T15:00:00Z'),
    armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'kit-'))),
    // O "PDF" é o texto do Word que chegou ao conversor: o teste procura a senha no que viraria o PDF.
    conversor: async (docx) => {
      const texto = textoDoDocx(docx)
      convertidos.push(texto)
      return Buffer.from(texto)
    },
    leituraSimulada: true,
  })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['helena', 'senior'], ['lauro', 'socio']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  // O kit é do LOAS: o modelo de teste dele já está na Configuração.
  const subiu = await app.inject({ method: 'PUT', url: '/api/configuracao/modelos/contrato-completo-loas', cookies: await cookieDe('helena'), ...formularioDoArquivo(docxDeTeste(MODELO)) })
  expect(subiu.statusCode).toBe(201)
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-24 · a senha do gov.br não sai do cofre', () => {
  it('GGVP-24 CA9 · a senha de teste guardada pela ficha não aparece no kit (PDF e Word) nem na exportação do histórico', async () => {
    // A ficha do balcão, com a senha que a tela manda ao cofre e, por engano, também no envio da ficha.
    const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer o BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false }))
      .id as string
    const completar = { bairro: 'Vila Exemplo', cidadeUf: 'Osasco / SP', cep: '06010000' }
    await banco.update(fichaRecepcao).set({ documento: sql`${fichaRecepcao.documento} || ${JSON.stringify(completar)}::jsonb` }).where(eq(fichaRecepcao.pessoaId, fichaId))
    expect((await chamar('ana', 'POST', `/api/pessoas/${fichaId}/cofre`, { senha: SENHA_DE_TESTE })).statusCode).toBe(201)
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/cofre/gov`, { acao: 'guardou' })).senhaGov.situacao).toBe('no-cofre')
    const ENVIO = { nome: 'Joana Ribeiro', cpf: VALIDOS.cpf, nascimento: '10/05/1958', telefone: '11987654321', endereco: 'Rua B, 20', beneficioInteresse: 'loas-idoso', origem: 'papel', modelo: 'GGV' }
    expect((await chamar('ana', 'PUT', `/api/fichas/${fichaId}/ficha-de-atendimento`, { ...ENVIO, senha: SENHA_DE_TESTE })).statusCode).toBe(200)

    // O caso e o kit gerado com a ficha.
    const { processo } = await json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-idoso' })
    const base = `/api/processos/${processo.id}/contrato`
    const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    const correcoes = Object.fromEntries(((faltam.campos as string[] | undefined) ?? []).map((c) => [c, VALIDOS[c]]))
    expect((await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias: TODAS, correcoes })).resultado).toBe('gerado')

    const pdf = await chamar('ana', 'GET', `${base}/kit`)
    expect([pdf.statusCode, pdf.headers['content-type']]).toEqual([200, 'application/pdf'])
    expect(convertidos).toHaveLength(1)
    expect(convertidos[0]).toContain('Joana Ribeiro')
    expect(pdf.rawPayload.toString()).not.toContain(SENHA_DE_TESTE)
    const word = await chamar('ana', 'GET', `${base}/kit?formato=docx`)
    expect(word.statusCode).toBe(200)
    expect(textoDoDocx(word.rawPayload)).toContain('Joana Ribeiro')
    expect(textoDoDocx(word.rawPayload)).not.toContain(SENHA_DE_TESTE)

    // A exportação do histórico do caso: a gestão pede, o Sócio autoriza, quem pediu baixa.
    const exportacao = `/api/casos/${processo.id}/historico/exportacao`
    expect((await chamar('helena', 'POST', exportacao, { motivo: 'Pedido do titular dos dados (LGPD)' })).statusCode).toBe(201)
    expect((await chamar('lauro', 'POST', `${exportacao}/autorizacao`)).statusCode).toBe(201)
    const exportado = await chamar('helena', 'GET', exportacao)
    expect(exportado.statusCode).toBe(200)
    expect(exportado.json().eventos.length).toBeGreaterThan(0)
    expect(exportado.body).not.toContain(SENHA_DE_TESTE)
  })
})
