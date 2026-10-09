import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, pessoa, prestacaoContas, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const painel = async (apelido: string, mes?: string) => app.inject({ method: 'GET', url: `/api/financeiro${mes ? `?mes=${mes}` : ''}`, cookies: await cookieDe(apelido) })

/** Relógio fixo: 09/10/2026 de manhã em Brasília. */
const AGORA = new Date('2026-10-09T13:00:00Z')

async function novoCaso(nome: string, fase = 'administrativa') {
  const [p] = await banco.insert(pessoa).values({ nome, situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase, advogadaResponsavelId: ids.gabi }).returning()
  return c.id
}
const versao = (casoId: string, versao: number, honorarios: string, prazo: string, recebida?: Date) =>
  banco.insert(prestacaoContas).values({
    casoId,
    versao,
    valorRecebido: '1.00',
    honorarios,
    valorCliente: '1.00',
    prazoPagamento: prazo,
    okAdvogadaPor: ids.gabi,
    okAdvogadaEm: AGORA,
    ...(recebida && { recebidaPor: ids.julia, recebidaEm: recebida }),
  })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA })
  for (const [apelido, perfil] of [
    ['gabi', 'advogada'],
    ['julia', 'financeiro'],
    ['otavio', 'socio'],
    ['helena', 'senior'],
    ['ana', 'atendimento'],
  ] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  // Recebida em 02/10, pelo Financeiro.
  const vera = await novoCaso('Vera Lúcia')
  await versao(vera, 1, '3703.70', '2026-09-30', new Date('2026-10-02T15:00:00Z'))
  await banco.insert(identificadorCaso).values({ casoId: vera, tipo: 'nb', valor: '1872234410' })
  // Duas versões: vale a segunda, ainda sem recebimento; o prazo de 30/10 não venceu.
  const otavio = await novoCaso('Otávio Nery', 'judicial')
  await versao(otavio, 1, '1000.00', '2026-10-30')
  await versao(otavio, 2, '2000.00', '2026-10-30')
  // Deferido, esperando a advogada prestar contas (G8).
  const lucia = await novoCaso('Lúcia Prado')
  await banco.insert(tarefa).values({ casoId: lucia, passo: 'D2.06', titulo: 'Prestar contas', perfilDono: 'advogada' })
})
afterEach(() => fechar())

describe('GGVP-78 · GET /api/financeiro', () => {
  it('o Financeiro vê os cartões, o mês do período e uma linha por caso, com a versão atual', async () => {
    const r = (await painel('julia', '2026-10')).json()
    expect([r.mes, r.recebidoNoMes, r.aReceber, r.processosAReceber, r.aLancar, r.aguardandoOk]).toEqual(['2026-10', '3703.70', '2000.00', 1, 2, 1])
    expect(r.porMes.at(-1)).toEqual({ mes: '2026-10', recebido: '3703.70', previsto: '2000.00' })
    expect(r.porOrigem).toEqual([{ origem: 'inss', valor: '3703.70', fatia: 100 }])
    expect(r.lancamentos.map((l: { cliente: string; status: string; valor: string | null; responsavel: string; origem: string }) => [l.cliente, l.status, l.valor, l.responsavel, l.origem])).toEqual([
      ['Lúcia Prado', 'aguardando_ok', null, 'Advogada · gabi', 'inss'],
      ['Otávio Nery', 'a_receber', '2000.00', 'Financeiro', 'justica'],
      ['Vera Lúcia', 'recebido', '3703.70', 'Financeiro · julia', 'inss'],
    ])
    expect(r.lancamentos[2]).toMatchObject({ processo: 'INSS · 187.223.441-0', recebidoEm: '2026-10-02', vencimento: '2026-09-30', beneficio: 'BPC/LOAS Idoso' })
  })

  it('sem o mês, vale o mês de hoje em Brasília; mês inválido é recusado', async () => {
    expect((await painel('julia')).json().mes).toBe('2026-10')
    expect((await painel('julia', '2026-13')).statusCode).toBe(400)
  })

  it('o Sócio vê os totais, sem nenhuma linha de cliente (valores.ver_totais)', async () => {
    const r = (await painel('otavio', '2026-10')).json()
    expect([r.recebidoNoMes, r.aReceber, r.lancamentos]).toEqual(['3703.70', '2000.00', null])
    expect(JSON.stringify(r)).not.toContain('Vera')
  })

  it('a Sênior, a advogada e o Atendimento não abrem o painel', async () => {
    for (const apelido of ['helena', 'gabi', 'ana']) expect((await painel(apelido)).statusCode).toBe(403)
  })
})
