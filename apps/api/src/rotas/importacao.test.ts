import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, identificadorCaso, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_NADA_A_GRAVAR, MSG_RELATORIO_MUDOU } from './importacao.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

/** Planilha inventada: nomes, CPFs e números de teste, nenhum real. A Ana já está no portal, com outro nome. */
const PLANILHA = [
  'nome;cpf;nascimento;telefone;beneficio;fase;nb;cnj',
  'Ana Teste;111.444.777-35;05/03/1958;11987654321;BPC/LOAS Idoso;;123.456.789-0;',
  'Bia Teste;52998224725;;;Auxílio-Acidente;judicial;;0001234-81.2026.4.03.0001',
  'Bia Teste;52998224725;;;pensao_morte;;;',
  'Caio Teste;39053344705;;;;;;',
  'D4vi;123;;;;;;',
].join('\n')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, url: string, payload: object) => app.inject({ method: 'POST', url, cookies: await cookieDe(apelido), payload })
const simular = (apelido = 'helena', arquivo = PLANILHA) => chamar(apelido, '/api/importacao/simulacao', { arquivo })
const gravar = (conferido: string, apelido = 'helena', arquivo = PLANILHA) => chamar(apelido, '/api/importacao', { arquivo, conferido, confirmo: true })
const contar = async () => ({
  pessoas: (await banco.select().from(pessoa)).length,
  casos: (await banco.select().from(caso)).length,
  numeros: (await banco.select().from(identificadorCaso)).length,
})

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['helena', 'senior'], ['lauro', 'socio'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await banco.insert(pessoa).values({ nome: 'Ana Souza Teste', cpf: '11144477735', situacao: 'cliente' })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-146 parte 2 · importar a planilha do escritório', () => {
  it('por perfil: só a gestão que muda a configuração (Sênior e Sócio) simula e grava', async () => {
    for (const apelido of ['ana', 'gabi', 'julia']) {
      expect((await simular(apelido)).statusCode).toBe(403)
      expect((await gravar('0'.repeat(64), apelido)).statusCode).toBe(403)
    }
    expect((await simular('lauro')).statusCode).toBe(200)
    expect((await simular('helena')).statusCode).toBe(200)
  })

  it('a simulação mostra o relatório e não grava nada', async () => {
    const antes = await contar()
    const r = (await simular()).json()
    expect(r.clientes).toEqual({ novos: 2, jaCadastrados: 1 })
    expect(r.processos).toEqual({ novos: 3, jaCadastrados: 0 })
    expect(r.erros).toEqual([{ linha: 6, motivo: 'nome inválido; CPF inválido.' }])
    expect(r.linhas.map((l: { linha: number; cliente: string; nomeNoPortal?: string; processo: string }) => [l.linha, l.cliente, l.nomeNoPortal, l.processo])).toEqual([
      [2, 'ja-cadastrado', 'Ana Souza Teste', 'novo'],
      [3, 'novo', undefined, 'novo'],
      [4, 'novo', undefined, 'novo'],
      [5, 'novo', undefined, 'sem-processo'],
    ])
    expect(r.conferido).toMatch(/^[0-9a-f]{64}$/)
    // O relatório mostra o nome e o que acontece; os dados da gravação (CPF, telefone) ficam no servidor.
    expect(JSON.stringify(r.linhas)).not.toMatch(/52998224725|11987654321/)
    expect(await contar()).toEqual(antes)
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'importacao_gravada'))).toEqual([])
  })

  it('só grava com a confirmação sobre o mesmo relatório; o cliente que já existe não duplica nem muda', async () => {
    const { conferido } = (await simular()).json()
    expect((await chamar('helena', '/api/importacao', { arquivo: PLANILHA, conferido })).statusCode).toBe(400)
    expect((await chamar('helena', '/api/importacao', { arquivo: PLANILHA, conferido, confirmo: false })).statusCode).toBe(400)
    expect((await gravar('0'.repeat(64))).json()).toEqual({ erro: MSG_RELATORIO_MUDOU })
    expect((await gravar(conferido, 'helena', `${PLANILHA}\nEva Teste;98765432100;;;;;;`)).json()).toEqual({ erro: MSG_RELATORIO_MUDOU })
    expect(await contar()).toEqual({ pessoas: 1, casos: 0, numeros: 0 })

    const r = await gravar(conferido)
    expect(r.json()).toEqual({ clientes: { novos: 2, jaCadastrados: 1 }, processos: { novos: 3, jaCadastrados: 0 }, linhasComErro: 1 })
    expect(await contar()).toEqual({ pessoas: 3, casos: 3, numeros: 2 })
    const pessoas = await banco.select().from(pessoa)
    expect(pessoas.find((p) => p.cpf === '11144477735')!.nome).toBe('Ana Souza Teste')
    expect(pessoas.filter((p) => p.origem === 'importacao').map((p) => [p.nome, p.situacao]).sort()).toEqual([
      ['Bia Teste', 'cliente'],
      ['Caio Teste', 'cliente'],
    ])
    const casos = await banco.select({ pessoa: pessoa.nome, beneficio: caso.beneficio, fase: caso.fase }).from(caso).innerJoin(pessoa, eq(pessoa.id, caso.pessoaId))
    expect(casos.map((c) => [c.pessoa, c.beneficio, c.fase]).sort()).toEqual([
      ['Ana Souza Teste', 'bpc_loas_idoso', 'administrativa'],
      ['Bia Teste', 'auxilio_acidente', 'judicial'],
      ['Bia Teste', 'pensao_morte', 'administrativa'],
    ])
    expect((await banco.select({ tipo: identificadorCaso.tipo, valor: identificadorCaso.valor }).from(identificadorCaso)).map((n) => `${n.tipo}:${n.valor}`).sort()).toEqual([
      'cnj:00012348120264030001',
      'nb:1234567890',
    ])

    // O histórico guarda só as contagens: nenhum nome nem CPF.
    const [registro] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'importacao_gravada'))
    expect(registro.detalhe).toMatchObject({ clientes: 2, processos: 3, linhasComErro: 1, conferido })
    expect(JSON.stringify(registro)).not.toMatch(/Teste|52998224725|11144477735/)
  })

  it('importar de novo a mesma planilha não duplica nada', async () => {
    await gravar((await simular()).json().conferido)
    const depois = await contar()
    const r = (await simular()).json()
    expect([r.clientes, r.processos]).toEqual([
      { novos: 0, jaCadastrados: 3 },
      { novos: 0, jaCadastrados: 3 },
    ])
    expect((await gravar(r.conferido)).json()).toEqual({ erro: MSG_NADA_A_GRAVAR })
    expect(await contar()).toEqual(depois)
  })

  it('se o portal mudou depois da simulação, não grava: simula de novo', async () => {
    const { conferido } = (await simular()).json()
    await banco.insert(pessoa).values({ nome: 'Caio Teste', cpf: '39053344705', situacao: 'lead' })
    expect((await gravar(conferido)).json()).toEqual({ erro: MSG_RELATORIO_MUDOU })
    expect(await contar()).toEqual({ pessoas: 2, casos: 0, numeros: 0 })
  })

  it('o cliente importado aparece na busca do balcão', async () => {
    await gravar((await simular()).json().conferido)
    const achados = (await chamar('ana', '/api/balcao/busca', { termo: '529.982.247-25' })).json()
    expect(achados.map((a: { nome: string }) => a.nome)).toEqual(['Bia Teste'])
  })
})
