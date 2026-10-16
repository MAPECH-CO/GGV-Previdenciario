import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { instalarConhecimentoDeTeste, recarregarBaseDeTeste } from '../banco/conhecimento-de-teste.ts'
import { usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_BENEFICIO_DESCONHECIDO } from './conhecimento.ts'

// GGVP-163 R5: a página de cada benefício, com a síntese e as taxas da base histórica (dados inventados).
const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const pagina = async (apelido: string, beneficio: string) => app.inject({ method: 'GET', url: `/api/base-historica/${beneficio}`, cookies: await cookieDe(apelido) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['igor', 'juridico_adm'], ['lauro', 'socio'], ['ana', 'atendimento'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  app = criarServidor({ banco })
})
afterEach(() => fechar())

describe('GGVP-163 R5 · GET /api/base-historica/:beneficio', () => {
  it('CA3 · o Jurídico e o Sócio veem a página do LOAS deficiente: a síntese na ordem e as taxas com o número de casos e a data da base ("4 de 115")', async () => {
    await instalarConhecimentoDeTeste(banco)
    for (const apelido of ['gabi', 'helena', 'igor', 'lauro']) {
      const r = await pagina(apelido, 'bpc_loas_deficiente')
      expect(r.statusCode, apelido).toBe(200)
      const p = r.json()
      expect([p.beneficio, p.nome, p.dataDaBase]).toEqual(['bpc_loas_deficiente', 'BPC/LOAS Deficiente', '2026-10-16'])
      expect(p.sintese.map((s: { ordem: number }) => s.ordem)).toEqual([1, 2])
      expect(p.indicadores.find((i: { indicador: string }) => i.indicador === 'exito_com_laudo_desfavoravel')).toEqual({
        indicador: 'exito_com_laudo_desfavoravel',
        nome: 'Êxito com laudo desfavorável',
        recorte: 'geral',
        chave: '*',
        n: 115,
        sim: 4,
        valor: expect.closeTo(0.035, 3),
        baseEm: '2026-10-16',
      })
      expect(p.indicadores.map((i: { recorte: string }) => i.recorte)).not.toContain('juiz')
    }
  })

  it('CA4 · a base recarregada mostra a data nova sem subir o portal', async () => {
    await instalarConhecimentoDeTeste(banco)
    expect((await pagina('gabi', 'bpc_loas_deficiente')).json().dataDaBase).toBe('2026-10-16')
    await recarregarBaseDeTeste(banco, '2026-10-20')
    const p = (await pagina('gabi', 'bpc_loas_deficiente')).json()
    expect([p.dataDaBase, p.indicadores[0].baseEm]).toEqual(['2026-10-20', '2026-10-20'])
  })

  it('sem a base histórica, a página diz que não há base: data nula, sem síntese e sem taxas, sem erro', async () => {
    expect((await pagina('gabi', 'bpc_loas_idoso')).json()).toEqual({ beneficio: 'bpc_loas_idoso', nome: 'BPC/LOAS Idoso', dataDaBase: null, sintese: [], indicadores: [] })
  })

  it('G22 · o Atendimento e o Financeiro não veem; o benefício desconhecido é 404', async () => {
    for (const apelido of ['ana', 'julia']) expect((await pagina(apelido, 'bpc_loas_deficiente')).statusCode, apelido).toBe(403)
    const r = await pagina('gabi', 'inventado')
    expect([r.statusCode, r.json().erro]).toEqual([404, MSG_BENEFICIO_DESCONHECIDO])
  })
})
