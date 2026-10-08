import bcrypt from 'bcryptjs'
import { BENEFICIOS } from '@ggv/contratos'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { BENEFICIOS as BENEFICIOS_DO_BANCO, caso, configuracao, eventoAuditoria, kitDocumento, modelo, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let relogio = new Date('2026-10-07T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'PUT', url: string, payload?: object) =>
  app.inject({ method: metodo, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const ver = async (apelido = 'helena') => (await chamar(apelido, 'GET', '/api/configuracao')).json()
const parametro = (chave: string, valor: unknown, apelido = 'helena') => chamar(apelido, 'PUT', `/api/configuracao/parametros/${chave}`, { valor })
const publicar = (beneficio: string, itens: { tipoDocumento: string; obrigatorio: boolean }[]) => chamar('helena', 'PUT', `/api/configuracao/kits/${beneficio}`, { itens })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-07T15:00:00Z')
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['helena', 'senior'], ['lauro', 'socio'], ['julia', 'financeiro'], ['gabi', 'advogada']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await banco.insert(configuracao).values([
    { chave: 'cobranca.limite', valor: 3 },
    { chave: 'cofre.alerta.hora_inicio', valor: 7 },
    { chave: 'cofre.alerta.hora_fim', valor: 20 },
  ])
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-104 · configuração do escritório', () => {
  it('a gestão vê os parâmetros com rótulo e faixa; só o Sócio e a Sênior editam; fora da gestão, nada', async () => {
    const c = await ver()
    expect(c.parametros.find((p: { chave: string }) => p.chave === 'cobranca.limite')).toEqual({
      chave: 'cobranca.limite',
      rotulo: 'Cobrança de documento: tentativas até subir para a Sênior',
      valor: 3,
      min: 1,
      max: 20,
    })
    expect([c.podeEditar, (await ver('lauro')).podeEditar, (await ver('julia')).podeEditar]).toEqual([true, true, false])
    expect((await chamar('gabi', 'GET', '/api/configuracao')).statusCode).toBe(403)
    expect((await parametro('cobranca.limite', '4', 'julia')).statusCode).toBe(403)
  })

  it('CA3, CA4 · o parâmetro muda na faixa, com o histórico do antes e do depois', async () => {
    expect((await parametro('cobranca.limite', '5')).json()).toEqual({ ok: true, valor: 5 })
    expect((await parametro('contato.janela_dias', '10')).statusCode).toBe(201)
    expect((await parametro('cobranca.limite', '0')).json().erro).toBe('Cobrança de documento: tentativas até subir para a Sênior: entre 1 e 20.')
    expect((await parametro('cobranca.limite', '2,5')).json().erro).toBe('Informe um número inteiro')
    expect((await parametro('cofre.alerta.hora_inicio', '21')).json().erro).toBe('O começo do horário sem alerta vem antes do fim.')
    expect((await parametro('nao.existe', '1')).statusCode).toBe(404)
    const [c] = await banco.select().from(configuracao).where(eq(configuracao.chave, 'cobranca.limite'))
    expect(c.valor).toBe(5)
    expect((await ver()).historico.map((h: { quem: string; descricao: string }) => [h.quem, h.descricao])).toEqual(
      expect.arrayContaining([
        ['helena', 'Cobrança de documento: tentativas até subir para a Sênior: 3 → 5'],
        ['helena', 'Cliente sumido: dias para as tentativas de contato: sem valor → 10'],
      ]),
    )
  })

  it('CA1, CA6 · o kit ganha versão: o caso aberto antes fica com o kit da época; o aberto depois usa o novo', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Rosa Lima', situacao: 'cliente' }).returning()
    relogio = new Date('2026-09-01T12:00:00Z')
    expect((await publicar('bpc_loas_idoso', [{ tipoDocumento: 'rg', obrigatorio: true }])).json()).toEqual({ ok: true, versao: 1 })
    const [antes] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa', criadoEm: new Date('2026-09-15T12:00:00Z') }).returning()
    relogio = new Date('2026-10-01T12:00:00Z')
    const v2 = [
      { tipoDocumento: 'rg', obrigatorio: true },
      { tipoDocumento: 'ficha_grupo_familiar', obrigatorio: true },
      { tipoDocumento: 'declaracao_de_moradia', obrigatorio: false },
    ]
    expect((await publicar('bpc_loas_idoso', v2)).json()).toEqual({ ok: true, versao: 2 })
    const [depois] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa', criadoEm: new Date('2026-10-05T12:00:00Z') }).returning()
    const faltam = async (casoId: string) => (await chamar('helena', 'GET', `/api/casos/${casoId}/conferencia`)).json().checklist.faltam
    expect(await faltam(antes.id)).toEqual(['rg'])
    expect((await faltam(depois.id)).sort()).toEqual(['ficha_grupo_familiar', 'rg'])
    const kit = (await ver()).kits.find((k: { beneficio: string }) => k.beneficio === 'bpc_loas_idoso')
    expect([kit.versao, kit.itens.length]).toEqual([2, 3])
    const revogados = await banco.select().from(kitDocumento).where(and(eq(kitDocumento.beneficio, 'bpc_loas_idoso'), eq(kitDocumento.versao, 1)))
    expect(revogados[0].revogadoEm?.toISOString()).toBe('2026-10-01T12:00:00.000Z')
    expect((await publicar('nao_existe', v2)).statusCode).toBe(404)
    expect((await publicar('bpc_loas_idoso', [])).json().erro).toBe('O kit precisa de ao menos um documento')
  })

  it('CA3 · a mensagem padrão ganha versão nova; a anterior fica guardada, desativada', async () => {
    const [m] = await banco.insert(modelo).values({ tipo: 'mensagem', nome: 'Confirmação da ida ao banco', conteudo: 'Olá, {cliente}!' }).returning()
    const r = await chamar('helena', 'PUT', `/api/configuracao/mensagens/${m.id}`, { conteudo: 'Olá, {cliente}! Leve o documento com foto.' })
    expect(r.json()).toEqual({ ok: true, versao: 2 })
    const todas = await banco.select().from(modelo).where(eq(modelo.nome, 'Confirmação da ida ao banco'))
    expect(todas.map((x) => [x.versao, x.ativo]).sort()).toEqual([
      [1, false],
      [2, true],
    ])
    expect((await ver()).mensagens.map((x: { conteudo: string }) => x.conteudo)).toEqual(['Olá, {cliente}! Leve o documento com foto.'])
    const [e] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'mensagem_alterada'))
    expect(e.detalhe).toMatchObject({ antes: 'Olá, {cliente}!', depois: 'Olá, {cliente}! Leve o documento com foto.' })
  })

  it('CA5 · o catálogo de benefícios do banco é o dos contratos', () => {
    expect(BENEFICIOS_DO_BANCO).toBe(BENEFICIOS)
  })
})
