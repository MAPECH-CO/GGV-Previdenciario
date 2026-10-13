import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, juizo as juizoTabela, pessoa, processoAcervo, usuario } from '../banco/esquema.ts'
import { SENHA_DE_EXEMPLO } from '../banco/exemplo.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { juizosParaLer } from '../fluxo/juizo.ts'
import { MSG_SEM_NUMERO } from './juizo.ts'

const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-08T15:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const juizo = async (apelido: string, id = casoId) => app.inject({ method: 'GET', url: `/api/casos/${id}/juizo`, cookies: await cookieDe(apelido) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const ids: Record<string, string> = {}
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['igor', 'juridico_adm'], ['ana', 'atendimento'], ['julia', 'financeiro']] as const)
    ids[apelido] = (await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false }).returning())[0].id
  const [p] = await banco.insert(pessoa).values({ nome: 'Pessoa (exemplo)' }).returning()
  casoId = (await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning())[0].id
  await banco.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: '0001234-96.2026.4.03.6301' })
  await banco.insert(processoAcervo).values([
    { numeroCnj: '00000011220204036301', beneficio: 'bpc_loas_deficiente', desfecho: 'procedente_total', desfechoConferidoPor: ids.helena, fonte: 'importacao' },
    { numeroCnj: '00000021220204036301', beneficio: 'bpc_loas_deficiente', desfecho: 'improcedente', desfechoConferidoPor: ids.helena, fonte: 'importacao' },
  ])
  app = criarServidor({ banco, agora: () => AGORA })
})
afterEach(() => fechar())

describe('GGVP-64 · GET /api/casos/:id/juizo', () => {
  it('CA1, CA2, CA4 · o Jurídico vê o juízo pelo número do processo e a procedência com os processos e a data da base', async () => {
    for (const apelido of ['gabi', 'helena', 'igor']) {
      const r = await juizo(apelido)
      expect(r.statusCode, apelido).toBe(200)
      expect(r.json()).toMatchObject({ juizo: 'TRF3 · 6301', base: '2026-10-08', porBeneficio: [{ beneficio: 'bpc_loas_deficiente', texto: '50% em 2 processos · base de 08/10' }] })
    }
  })

  it('parte 2 · CA1, CA2 · a vara e o juiz conferidos no caso e os entendimentos do juízo, com os processos de exemplo', async () => {
    expect((await juizo('gabi')).json()).toMatchObject({ vara: null, juiz: null, entendimentos: [] })
    await banco.update(caso).set({ vara: '1ª Vara-Gabinete do JEF de São Paulo', juiz: 'Dra. Exemplo' }).where(eq(caso.id, casoId))
    const entendimentos = [{ texto: 'Exige o estudo social atualizado.', processos: ['00000011220204036301'] }]
    await banco.insert(juizoTabela).values({ tribunal: 'TRF3', nome: 'TRF3 · 6301', entendimentos, entendimentosEm: AGORA })
    expect((await juizo('gabi')).json()).toMatchObject({ vara: '1ª Vara-Gabinete do JEF de São Paulo', juiz: 'Dra. Exemplo', entendimentos })
  })

  it('G22 · a jurimetria é interna: o Atendimento e o Financeiro não veem', async () => {
    for (const apelido of ['ana', 'julia']) expect((await juizo(apelido)).statusCode, apelido).toBe(403)
  })

  it('Dados de exemplo · a advogada de exemplo vê o juízo de um processo judicial de exemplo, com a taxa e o tempo até a sentença', async () => {
    const semeado = await abrirBancoEmbutido(undefined, true)
    try {
      const servidor = criarServidor({ banco: semeado.banco, agora: () => AGORA })
      const entrada = await servidor.inject({ method: 'POST', url: '/api/sessao', payload: { email: 'advogada@exemplo.ggv', senha: SENHA_DE_EXEMPLO } })
      const [i] = await semeado.banco.select({ casoId: identificadorCaso.casoId }).from(identificadorCaso).where(eq(identificadorCaso.valor, CNJ_EXEMPLO.exigencia))
      const r = await servidor.inject({ method: 'GET', url: `/api/casos/${i.casoId}/juizo`, cookies: { [COOKIE]: entrada.cookies.find((c) => c.name === COOKIE)!.value } })
      expect(r.statusCode).toBe(200)
      const j = r.json()
      expect(j.porBeneficio.find((b: { beneficio: string }) => b.beneficio === 'bpc_loas_deficiente').texto).toBe('67% em 3 processos · base de 08/10')
      expect(j.tempoAteASentenca).toEqual({ meses: 12, processos: 1 })
      // Parte 2: o processo da Marta tem a vara e o juiz conferidos, e o JEF de exemplo tem decisões para a IA ler.
      const [marta] = await semeado.banco.select({ casoId: identificadorCaso.casoId }).from(identificadorCaso).where(eq(identificadorCaso.valor, '00034567120254036301'))
      const daMarta = (await servidor.inject({ method: 'GET', url: `/api/casos/${marta.casoId}/juizo`, cookies: { [COOKIE]: entrada.cookies.find((c) => c.name === COOKIE)!.value } })).json()
      expect([daMarta.vara, daMarta.juiz]).toEqual(['1ª Vara-Gabinete do JEF de São Paulo (exemplo)', 'Dra. Helena Prates (exemplo)'])
      expect(await juizosParaLer(semeado.banco)).toContain('TRF3 · 6301')
    } finally {
      await semeado.fechar()
    }
  })

  it('CA1 · caso sem número de processo: 404 com a mensagem', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Outra pessoa (exemplo)' }).returning()
    const [semNumero] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso' }).returning()
    const r = await juizo('gabi', semNumero.id)
    expect([r.statusCode, r.json().erro]).toEqual([404, MSG_SEM_NUMERO])
  })
})
