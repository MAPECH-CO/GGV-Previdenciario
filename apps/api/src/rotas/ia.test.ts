import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, pessoa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

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
const auditoria = async (apelido: string) => app.inject({ method: 'GET', url: `/api/casos/${casoId}/ia`, cookies: await cookieDe(apelido) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['ana', 'atendimento'], ['dora', 'documentacao'], ['julia', 'financeiro']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Paulo Mendes', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'auxilio_incapacidade_temporaria' }).returning()
  casoId = c.id
  const fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: 'Resumo para o cliente.' } }] }))
  const ia = criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste' }, fetch })
  await ia.sugerir('resumo_resultado', { casoId, quem: ids.gabi, conteudo: 'Sentença improcedente.', fontes: [{ tipo: 'caso', referencia: `caso:${casoId}` }] })
  await criarIa({ banco, ambiente: {} }).sugerir('resumo_resultado', { casoId, quem: ids.gabi, conteudo: 'x', fontes: [] })
})
afterEach(() => fechar())

describe('GGVP-106 CA4 · auditoria das chamadas à IA do caso', () => {
  it('o Jurídico vê cada chamada com a saída, e a leitura fica registrada', async () => {
    const r = (await auditoria('gabi')).json()
    expect(r.chamadas.map((c: { situacao: string; saida: string | null; quem: string; modelo: string }) => [c.situacao, c.saida, c.quem, c.modelo]).sort()).toEqual([
      ['desligada', null, 'gabi', 'gpt-4.1-mini'],
      ['ok', 'Resumo para o cliente.', 'gabi', 'gpt-4.1-mini'],
    ])
    const acessos = await banco.select().from(acessoDadoSensivel)
    expect(acessos.map((a) => [a.usuarioId, a.casoId, a.recurso.startsWith('chamada_ia:')])).toEqual([[ids.gabi, casoId, true]])
  })

  it('o Atendimento vê as chamadas sem a saída, e nada é registrado; o Financeiro nem abre', async () => {
    const r = (await auditoria('ana')).json()
    expect(r.chamadas.map((c: { saida: string | null }) => c.saida)).toEqual([null, null])
    expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
    expect((await auditoria('julia')).statusCode).toBe(403)
  })

  describe('o trecho das fontes pode trazer texto de laudo: só o Jurídico o recebe', () => {
    const trecho = 'Petição aprovada: o laudo descreve a doença do autor.'
    type Fonte = { tipo: string; referencia: string; trecho?: string }
    const fontesDe = (r: { chamadas: { fontes: Fonte[] }[] }) => r.chamadas.flatMap((c) => c.fontes)
    beforeEach(async () => {
      await criarIa({ banco, ambiente: {} }).sugerir('resumo_resultado', { casoId, quem: ids.gabi, conteudo: 'y', fontes: [{ tipo: 'acervo', referencia: 'acervo:peticao-1', trecho }] })
    })

    it('o Jurídico recebe o trecho, e a leitura da chamada com trecho fica registrada', async () => {
      expect(fontesDe((await auditoria('gabi')).json())).toContainEqual({ tipo: 'acervo', referencia: 'acervo:peticao-1', trecho })
      const acessos = await banco.select().from(acessoDadoSensivel)
      expect(acessos.map((a) => a.usuarioId)).toEqual([ids.gabi, ids.gabi])
    })

    it.each(['ana', 'dora'])('%s recebe as fontes só com tipo e referência, e nada é registrado', async (apelido) => {
      const fontes = fontesDe((await auditoria(apelido)).json())
      expect(fontes).toContainEqual({ tipo: 'acervo', referencia: 'acervo:peticao-1' })
      expect(fontes.filter((f) => 'trecho' in f)).toEqual([])
      expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
    })
  })
})
