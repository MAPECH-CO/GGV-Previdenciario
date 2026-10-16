import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { leituraDocumento, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  (await app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })).json()

/** Uma leitura do balcão, só com o que a regra do ilegível lê: a ficha, o tipo, a situação e quando foi lida. */
const leitura = (fichaId: string, nome: string, tipo: string, situacao: string, lidoEm: string) =>
  banco.insert(leituraDocumento).values({ id: `${fichaId}/${nome}`, pessoaId: fichaId, dados: { id: `${fichaId}/${nome}`, fichaId, nome, tipo, situacao, lidoEm, confianca: 0, lidos: {} } })
const pedirLegivel = (fichaId: string) =>
  banco
    .select({ situacao: tarefa.situacao, prazo: tarefa.prazo, detalhe: tarefa.detalhe, perfilDono: tarefa.perfilDono })
    .from(tarefa)
    .where(and(eq(tarefa.pessoaId, fichaId), eq(tarefa.titulo, 'Pedir documento legível')))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z') })
  await banco.insert(usuario).values({ email: 'ana@exemplo.ggv', nome: 'ana', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['atendimento'], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-158 P12.4 · o ilegível vira "Pedir documento legível" no servidor (GGVP-95 CA3)', () => {
  it('a leitura ilegível abre a linha do Atendimento, uma por pessoa, com os tipos; o legível do mesmo tipo depois a fecha', async () => {
    const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer o BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
    await leitura(fichaId, 'RG.pdf', 'rg', 'ilegivel', '2026-10-07T13:00:00.000Z')
    await leitura(fichaId, 'Comprovante.pdf', 'comprovante-residencia', 'ilegivel', '2026-10-08T13:00:00.000Z')
    await app.sincronizarRecepcao()
    expect(await pedirLegivel(fichaId)).toEqual([
      {
        situacao: 'aberta',
        prazo: '2026-10-07',
        detalhe: 'Documento pessoal (RG) e Comprovante de residência · a leitura falhou: pedir o reenvio legível ao cliente',
        perfilDono: 'atendimento',
      },
    ])
    const central = (await json('ana', 'GET', '/api/tarefas')) as { id: string }[]
    expect(central.find((t) => t.id === `legivel-${fichaId}`)).toMatchObject({ passo: 'D1.18', titulo: 'Pedir documento legível', tela: `/clientes/${fichaId}` })

    // Chegou o RG legível: fica só o comprovante. Chegou o comprovante: a linha fecha.
    await leitura(fichaId, 'RG (2).pdf', 'rg', 'a-conferir', '2026-10-08T14:00:00.000Z')
    await app.sincronizarRecepcao()
    expect((await pedirLegivel(fichaId)).map((t) => [t.situacao, t.prazo, t.detalhe])).toEqual([
      ['aberta', '2026-10-08', 'Comprovante de residência · a leitura falhou: pedir o reenvio legível ao cliente'],
    ])
    await leitura(fichaId, 'Comprovante (2).pdf', 'comprovante-residencia', 'a-conferir', '2026-10-08T14:30:00.000Z')
    await app.sincronizarRecepcao()
    expect((await pedirLegivel(fichaId)).map((t) => t.situacao)).toEqual(['concluida'])
  })

  it('o arquivo ilegível enviado pelo card abre a linha na hora, sem esperar a rodada', async () => {
    // A leitura de exemplo, pelo nome do arquivo: "ilegivel" no nome é a leitura que falhou.
    await app.close()
    app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z'), leituraSimulada: true })
    const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer o BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
    const enviado = await json('ana', 'POST', `/api/fichas/${fichaId}/arquivos`, { origem: 'card', arquivos: [{ nome: 'RG ilegivel.pdf', formato: 'pdf', tamanho: 1000, tipo: 'rg', hash: 'c'.repeat(64) }] })
    expect(enviado.leituras.map((l: { situacao: string }) => l.situacao)).toEqual(['ilegivel'])
    expect((await pedirLegivel(fichaId)).map((t) => [t.situacao, t.detalhe])).toEqual([['aberta', 'Documento pessoal (RG) · a leitura falhou: pedir o reenvio legível ao cliente']])
  })
})
