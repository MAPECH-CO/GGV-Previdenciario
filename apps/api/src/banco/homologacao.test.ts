import { PERFIS } from '@ggv/contratos'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { count, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from './conexao.ts'
import { caso, configuracao, tarefa, usuario } from './esquema.ts'
import { SENHA_DE_EXEMPLO, semearExemplos, usuariosDeExemplo } from './exemplo.ts'
import { limitesDeCobranca } from '../fluxo/exigencia.ts'
import { prepararHomologacao } from './homologacao.ts'

const HOMOLOGACAO = { AMBIENTE: 'homologacao' }
let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  // A homologação já tem o usuário de quem cuida dela (o do Mateus, criado com `usuario:criar`).
  await banco.insert(usuario).values({ email: 'quem-cuida@exemplo.ggv', nome: 'Quem cuida (exemplo)', senhaHash: 'x', perfis: ['socio'] })
})
afterEach(() => fechar())

const usuarios = async () => (await banco.select({ total: count() }).from(usuario))[0].total
/** Onde os casos estão parados: os passos das tarefas abertas, e quantos casos há. */
const retrato = async (b: Banco) => ({
  passos: [...new Set((await b.select({ passo: tarefa.passo }).from(tarefa).where(isNull(tarefa.concluidaEm))).map((t) => t.passo))].sort(),
  casos: (await b.select({ total: count() }).from(caso))[0].total,
})
const limites = async () => Object.fromEntries((await banco.select().from(configuracao)).map((c) => [c.chave, c.valor]))

describe('homologação com usuários e dados de teste (GGVP-126)', () => {
  it('CA5 · fora da homologação, recusa e não grava nada', async () => {
    for (const ambiente of [{}, { AMBIENTE: 'producao' }])
      await expect(prepararHomologacao(banco, ambiente)).rejects.toThrow('Recusado: os dados de teste só entram com AMBIENTE=homologacao')
    expect([await usuarios(), await limites()]).toEqual([1, {}])
  })

  it('CA3 · cada passo que a semente dos testes cobre fica com caso parado nele, mesmo com outro usuário no banco', async () => {
    // A referência é a semente no banco vazio da máquina do dev: o que ela deixa em cada passo, a homologação também tem.
    const referencia = await abrirBancoEmbutido()
    await semearExemplos(referencia.banco)
    const esperado = await retrato(referencia.banco)
    await referencia.fechar()
    await prepararHomologacao(banco, HOMOLOGACAO)
    expect(await retrato(banco)).toEqual(esperado)
    // Os passos do INSS que já têm servidor: conferência da Sênior, protocolo, perícia e vigília do Meu INSS. Recepção,
    // Abertura, documentação médica, Perícia e Relacionamento ganham caso no banco com a GGVP-125 e a GGVP-132.
    expect(esperado.passos).toEqual(expect.arrayContaining(['D2.01', 'D2.02', 'D2.03', 'D2.04']))
  })

  it('CA1 · a semente roda mesmo com outro usuário no banco; cada usuário de exemplo tem senha provisória própria, e a pública não vale', async () => {
    const credenciais = await prepararHomologacao(banco, HOMOLOGACAO)
    expect(credenciais.map((c) => c.email)).toEqual(usuariosDeExemplo.map((u) => u.email))
    expect(PERFIS.filter((p) => !credenciais.some((c) => c.perfis.includes(p)))).toEqual([])
    expect(new Set(credenciais.map((c) => c.senha)).size).toBe(credenciais.length)
    for (const c of credenciais) {
      const [u] = await banco.select().from(usuario).where(eq(usuario.email, c.email))
      expect([u.trocarSenha, await bcrypt.compare(c.senha, u.senhaHash), await bcrypt.compare(SENHA_DE_EXEMPLO, u.senhaHash)], c.email).toEqual([true, true, false])
    }
  })

  it('CA2 · grava os limites de cobrança do Lucas (2 tentativas, 3 dias); sem configuração, o servidor já usa os mesmos (G15)', async () => {
    expect(await limitesDeCobranca(banco)).toEqual({ limite: 2, intervaloDias: 3 })
    await prepararHomologacao(banco, HOMOLOGACAO)
    const l = await limites()
    expect([l['cobranca.limite'], l['cobranca.intervalo_dias']]).toEqual([2, 3])
    expect(await limitesDeCobranca(banco)).toEqual({ limite: 2, intervaloDias: 3 })
  })

  it('CA2 · o que o escritório já tinha configurado fica, mesmo com a semente gravando a configuração de exemplo', async () => {
    // Uma chave que a semente também grava e outra que só o escritório tem: as duas ficam como estavam.
    await banco.insert(configuracao).values([
      { chave: 'cobranca.limite', valor: 4 },
      { chave: 'escritorio.chave_propria', valor: { qualquer: 'valor' } },
    ])
    await prepararHomologacao(banco, HOMOLOGACAO)
    const l = await limites()
    expect([l['cobranca.limite'], l['cobranca.intervalo_dias'], l['escritorio.chave_propria']]).toEqual([4, 3, { qualquer: 'valor' }])
  })

  it('CA4 · rodar de novo não duplica nada e não troca a senha já entregue', async () => {
    await prepararHomologacao(banco, HOMOLOGACAO)
    const foto = async () => ({
      usuarios: await usuarios(),
      onde: await retrato(banco),
      limites: await limites(),
      hashes: await banco.select({ email: usuario.email, senhaHash: usuario.senhaHash }).from(usuario),
    })
    const antes = await foto()
    expect(antes.onde.casos).toBeGreaterThan(0)
    expect(await prepararHomologacao(banco, HOMOLOGACAO)).toEqual([])
    expect(await foto()).toEqual(antes)
  })

  it('as senhas aparecem antes do fim da transação: se mostrar falhar, nada fica gravado', async () => {
    const falha = prepararHomologacao(banco, HOMOLOGACAO, () => {
      throw new Error('o terminal caiu')
    })
    await expect(falha).rejects.toThrow('o terminal caiu')
    expect([await usuarios(), (await retrato(banco)).casos]).toEqual([1, 0])
  })

  it('CA5 · na linha de comando: sem DATABASE_URL avisa, e sem AMBIENTE=homologacao recusa antes de tocar no banco', () => {
    const comando = fileURLToPath(new URL('./homologacao.ts', import.meta.url))
    const rodar = (env: Record<string, string>) =>
      spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', comando, 'preparar'], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' })
    const semBanco = rodar({})
    expect([semBanco.status, semBanco.stderr.trim()]).toEqual([1, 'Sem DATABASE_URL: o comando roda no app de homologação, com o banco dele.'])
    // Porta 1: se o comando tentasse conectar, o erro seria de conexão, e não a recusa.
    const producao = rodar({ DATABASE_URL: 'postgres://ninguem@127.0.0.1:1/nenhum', AMBIENTE: 'producao' })
    expect([producao.status, producao.stderr.trim()]).toEqual([1, 'Recusado: os dados de teste só entram com AMBIENTE=homologacao, nunca em produção.'])
  })
})
