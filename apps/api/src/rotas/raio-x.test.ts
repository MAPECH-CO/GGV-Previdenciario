import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { eventoAuditoria, perito, processoAcervo, usuario } from '../banco/esquema.ts'
import { conferenciaDoAcervo } from '../fluxo/acervo.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_RAIO_X_MUDOU, MSG_RAIO_X_SEM_NOVOS } from './raio-x.ts'

// GGVP-158 P7.7 (GGVP-148): o importador do Raio-X. A planilha é inventada (números CNJ válidos, pessoas de mentira).
const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const ids: Record<string, string> = {}

const PLANILHA = [
  'cnj,nome,cpf,beneficio,desfecho,data_decisao,perito,vara,juiz,laudo',
  '5000101-36.2023.4.03.6301,Fulana de Tal,52998224725,BPC/LOAS Idoso,Procedente,05/10/2026,Dra. Ana Souza,1ª Vara do JEF,Carlos Lima,sim',
  ',Beltrano,11144477735,BPC/LOAS Idoso,Improcedente,01/09/2026,Dr. Paulo Reis,2ª Vara do JEF,Carlos Lima,não',
  '5000303-67.2021.4.03.6338,Ciclana,,Auxílio por Incapacidade Temporária,improcedente,20/08/2025,Dr. Paulo Reis,Vara de Mauá,Rita Alves,não',
].join('\n')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const simular = (apelido: string, arquivo = PLANILHA) => chamar(apelido, 'POST', '/api/acervo/raio-x/simulacao', { arquivo })
const carregar = (conferido: string, arquivo = PLANILHA) => chamar('helena', 'POST', '/api/acervo/raio-x', { arquivo, conferido, confirmo: true })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['helena', 'senior'], ['ana', 'atendimento'], ['lauro', 'socio'], ['julia', 'financeiro']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
})
afterEach(() => fechar())

describe('GGVP-158 P7.7 · o importador do Raio-X', () => {
  it('a simulação não grava; a confirmação grava uma vez, conferida pela Sênior, com o perito pelo nome; a mesma planilha não duplica', async () => {
    expect((await simular('ana')).statusCode).toBe(403)
    const r = (await simular('helena')).json()
    expect(r).toMatchObject({
      processos: { novos: 2, jaNoAcervo: 0 },
      peritos: ['Dr. Paulo Reis', 'Dra. Ana Souza'],
      juizes: ['Carlos Lima', 'Rita Alves'],
      varas: ['1ª Vara do JEF', 'Vara de Mauá'],
      dataDeCorte: '2026-10-05',
      erros: [{ linha: 3, motivo: 'sem o número do processo.' }],
      colunasIgnoradas: ['nome', 'cpf'],
    })
    expect(await banco.select().from(processoAcervo)).toEqual([])
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'raio_x_importado'))).toEqual([])

    // A marca de outra planilha (aqui, a de uma linha só) recusa, e nada entra.
    const outra = PLANILHA.split('\n').slice(0, 2).join('\n')
    const deOutra = (await simular('helena', outra)).json().conferido
    expect((await carregar(deOutra)).json()).toEqual({ erro: MSG_RAIO_X_MUDOU })
    expect(await banco.select().from(processoAcervo)).toEqual([])

    const feito = await carregar(r.conferido)
    expect([feito.statusCode, feito.json()]).toEqual([201, { processos: { novos: 2, jaNoAcervo: 0 }, linhasComErro: 1 }])
    const acervo = await banco.select().from(processoAcervo)
    const peritos = new Map((await banco.select().from(perito)).map((p) => [p.id, p.nome]))
    expect(acervo.map((a) => [a.numeroCnj, a.beneficio, a.desfecho, a.dataDecisao, a.vara, a.juiz, a.laudoFavoravel, a.fonte, a.desfechoConferidoPor, peritos.get(a.peritoId!)])).toEqual([
      ['50001013620234036301', 'bpc_loas_idoso', 'procedente_total', '2026-10-05', '1ª Vara do JEF', 'Carlos Lima', true, 'raio_x', ids.helena, 'Dra. Ana Souza'],
      ['50003036720214036338', 'auxilio_incapacidade_temporaria', 'improcedente', '2025-08-20', 'Vara de Mauá', 'Rita Alves', false, 'raio_x', ids.helena, 'Dr. Paulo Reis'],
    ])
    // O acervo não guarda dado pessoal, e o histórico só as contagens.
    for (const pessoal of ['Fulana', 'Ciclana', '52998224725']) expect(JSON.stringify(acervo)).not.toContain(pessoal)
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'raio_x_importado'))
    expect(ev.detalhe).toMatchObject({ processos: 2, linhasComErro: 1 })
    // Confirmados pela Sênior, os desfechos não voltam à fila "Conferir desfechos do lote".
    expect((await conferenciaDoAcervo(banco)).pendentes).toEqual([])

    // A mesma planilha de novo: os dois já estão no acervo, e nada a gravar.
    const deNovo = (await simular('helena')).json()
    expect(deNovo.processos).toEqual({ novos: 0, jaNoAcervo: 2 })
    expect((await carregar(deNovo.conferido)).json()).toEqual({ erro: MSG_RAIO_X_SEM_NOVOS })
    expect(await banco.select().from(processoAcervo)).toHaveLength(2)
  })

  it('os indicadores saem da base importada, com o número de casos e a data da base; sem base, vazio; o Atendimento não vê', async () => {
    expect((await chamar('lauro', 'GET', '/api/acervo/raio-x')).json()).toMatchObject({ processos: 0, dataDaBase: null, ondeJulgam: [] })
    await carregar((await simular('helena')).json().conferido)
    const raioX = (await chamar('lauro', 'GET', '/api/acervo/raio-x')).json()
    expect([raioX.processos, raioX.dataDaBase]).toEqual([2, '2026-10-05'])
    expect(raioX.indicadores.find((i: { chave: string }) => i.chave === 'exito')).toMatchObject({ casos: 2, valor: 0.5 })
    expect(raioX.indicadores.find((i: { chave: string }) => i.chave === 'laudo_favoravel')).toMatchObject({ casos: 2, valor: 0.5 })
    expect((await chamar('ana', 'GET', '/api/acervo/raio-x')).statusCode).toBe(403)
  })

  it('GGVP-156 CA3 e P5.13 · o "Onde julgam" (a taxa por juízo) só para o Jurídico e o Sócio; o Financeiro vê o resto', async () => {
    await carregar((await simular('helena')).json().conferido)
    expect((await chamar('lauro', 'GET', '/api/acervo/raio-x')).json().ondeJulgam.length).toBeGreaterThan(0)
    const doFinanceiro = (await chamar('julia', 'GET', '/api/acervo/raio-x')).json()
    expect([doFinanceiro.processos, doFinanceiro.ondeJulgam]).toEqual([2, []])
    expect(doFinanceiro.indicadores.find((i: { chave: string }) => i.chave === 'exito')).toMatchObject({ casos: 2, valor: 0.5 })
  })
})
