import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const tentativas = async (apelido: string) => app.inject({ method: 'GET', url: '/api/gestao/tentativas', cookies: await cookieDe(apelido) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['helena', 'senior'], ['gabi', 'advogada'], ['ana', 'atendimento'], ['julia', 'financeiro'], ['rui', 'socio']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
  casoId = c.id
})

afterEach(async () => {
  await app.close()
  await fechar()
})

describe('tentativas bloqueadas (GGVP-109)', () => {
  it('CA1, CA9 · a ação fora do perfil, pela API, fica registrada com o caso e aparece para a gestão', async () => {
    const r = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/peticao/pedido`, cookies: await cookieDe('ana'), payload: {} })
    expect(r.statusCode).toBe(403)
    const lista = (await tentativas('helena')).json().tentativas
    expect(lista).toEqual([
      { quando: expect.any(String), quem: 'ana', perfil: 'atendimento', casoId, cliente: 'Vera Lúcia', portao: 'perfil', descricao: 'Ação fora do perfil (peticao.pedir)' },
    ])
  })

  it('CA9 · a recusa de portão aparece com o que a pessoa tentou, das mais recentes para as mais antigas', async () => {
    const antes = new Date('2026-10-05T12:00:00Z')
    await banco.insert(eventoAuditoria).values([
      { quem: ids.ana, acao: 'portao_bloqueado', alvo: `caso:${casoId}`, quando: antes, detalhe: { portao: 'G8', passo: 'D3b.03', perfil: 'atendimento' } },
      { quem: ids.gabi, acao: 'portao_bloqueado', alvo: `caso:${casoId}`, detalhe: { portao: 'G21', passo: 'D3a.04', perfil: 'advogada', faltam: 2 } },
      { quem: ids.gabi, acao: 'peticao_pedida', alvo: `caso:${casoId}`, detalhe: {} },
    ])
    const lista = (await tentativas('rui')).json().tentativas
    expect(lista.map((t: { quem: string; descricao: string }) => [t.quem, t.descricao])).toEqual([
      ['gabi', 'Manifestar no processo sem prova em todos os itens (G21)'],
      ['ana', 'Avisar o cliente antes do OK da advogada na prestação de contas (G8)'],
    ])
  })

  it('CA9 · só a gestão vê as tentativas; o Financeiro, que no Figma vê só os Resultados, não (GGVP-96)', async () => {
    expect((await tentativas('gabi')).statusCode).toBe(403)
    expect((await tentativas('julia')).statusCode).toBe(403)
  })
})

describe('painel de resultado para os sócios (GGVP-75)', () => {
  const resultados = async (apelido: string, consulta = '') => app.inject({ method: 'GET', url: `/api/gestao/resultados${consulta}`, cookies: await cookieDe(apelido) })

  it('CA4 · o Sócio e o Financeiro recebem os totais em dinheiro; a Sênior vê o painel, e o servidor não manda os totais', async () => {
    for (const apelido of ['rui', 'julia']) expect((await resultados(apelido)).json().totais, apelido).toMatchObject({ honorariosRecebidos: '0.00', recebimentos: 0 })
    const daSenior = await resultados('helena')
    expect(daSenior.statusCode).toBe(200)
    expect(daSenior.json()).toMatchObject({ totais: null, operacao: 'sem_dados', baseDoAcervo: { situacao: 'sem_dados' } })
  })

  it('GGVP-149 CA5 · a líder do Atendimento vê os tempos e as taxas, e o servidor não manda nenhum valor em dinheiro', async () => {
    await banco
      .insert(usuario)
      .values({ email: 'lia@exemplo.ggv', nome: 'lia', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['atendimento_lider'], trocarSenha: false })
    const r = await resultados('lia')
    expect(r.statusCode).toBe(200)
    const painel = r.json()
    expect(painel.totais).toBeNull()
    expect(painel.indicadores.map((i: { chave: string }) => i.chave)).toEqual(expect.arrayContaining(['deferimento_inss', 'procedencia', 'dias_ate_sentenca', 'dias_ate_receber']))
    expect(JSON.stringify(painel)).not.toMatch(/honorarios|recebimentos/i)
  })

  it('só a gestão abre o painel', async () => {
    expect((await resultados('gabi')).statusCode).toBe(403)
  })

  it('o período padrão vai de 1º de janeiro até hoje, em Brasília; o pedido usa dd/mm/aaaa e o recorte', async () => {
    const hoje = hojeEmBrasilia(new Date())
    expect((await resultados('rui')).json().periodo).toEqual({ de: `${hoje.slice(0, 4)}-01-01`, ate: hoje })
    const r = (await resultados('rui', '?de=01/02/2026&ate=31/03/2026&recorte=juizo')).json()
    expect([r.periodo, r.recorte]).toEqual([{ de: '2026-02-01', ate: '2026-03-31' }, { por: 'juizo', grupos: [] }])
    // A data da base (G22) é o fim do período: depois de hoje não há dado.
    expect((await resultados('rui', '?ate=31/12/2099')).json().periodo.ate).toBe(hoje)
  })

  it('data inválida e período invertido voltam com a mensagem', async () => {
    const invalida = await resultados('rui', '?de=31/02/2026')
    expect([invalida.statusCode, invalida.json().erro]).toEqual([400, 'Informe a data inicial (dd/mm/aaaa)'])
    expect((await resultados('rui', '?de=01/05/2026&ate=01/04/2026')).json().erro).toBe('A data inicial vem antes da final.')
  })
})
