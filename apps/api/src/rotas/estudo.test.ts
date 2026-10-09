import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, decisao, pessoa, peticao, peticaoVersao, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { buscarNoAcervo } from '../ia/acervo.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_NADA_A_REVISAR, TITULO_REVISAR } from './estudo.ts'
import { TITULO_RESUMO } from './resultado.ts'

const SENHA = 'senha-do-portal-1'
const BPC = 'bpc_loas_idoso'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ESTUDO = {
  materia: 'BPC idoso, renda per capita',
  vara: '2ª Vara do JEF de Santo Amaro',
  tese: 'O benefício mínimo do marido idoso não entra na renda per capita.',
  resumo: 'O juiz considerou a renda do filho que mora junto.',
  motivo: 'Faltou provar que o filho mora em outra casa.',
  aprendizado: 'Juntar o comprovante de residência do filho já na inicial.',
  chance: 'maior',
  novoProcesso: true,
  oQueRefazer: 'Novo requerimento com o comprovante de residência do filho.',
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const estudos = async (apelido = 'gabi') => app.inject({ method: 'GET', url: '/api/estudos', cookies: await cookieDe(apelido) })
const revisar = async (apelido: string, corpo: object) =>
  app.inject({ method: 'POST', url: `/api/casos/${casoId}/estudo/revisao`, cookies: await cookieDe(apelido), payload: corpo })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const chamadasDoEstudo = async () => (await banco.select().from(chamadaIa).where(eq(chamadaIa.finalidade, 'estudo_de_caso'))).length

/** A IA falsa: devolve o estudo quando o pedido é de estudo de caso, e um texto simples nos outros. */
let enviado = ''
function comIa(estudo: object = ESTUDO) {
  const fetch = async (_url: unknown, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
    const doEstudo = corpo.messages[0].content.includes('estudo de caso')
    if (doEstudo) enviado = corpo.messages[1].content
    return new Response(JSON.stringify({ choices: [{ message: { content: doEstudo ? JSON.stringify(estudo) : 'Rascunho do resumo.' } }] }))
  }
  app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }) })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Rosa Antunes' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: BPC, fase: 'judicial', desfecho: 'improcedente' }).returning()
  casoId = c.id
  await banco.insert(publicacao).values({ fonte: 'aasp', casoId, disponibilizadaEm: '2026-09-20', texto: 'Sentença: julgo improcedente; a renda do filho que reside com a autora supera o limite.', hash: 'h-merito', classe: 'merito' })
  const [pet] = await banco.insert(peticao).values({ casoId, tipo: 'inicial' }).returning()
  await banco.insert(peticaoVersao).values({ peticaoId: pet.id, numero: 1, conteudo: 'DO DIREITO: o benefício mínimo do marido não entra na renda.', hash: 'h', geradaPor: 'gabi', aprovadaEm: new Date() })
  comIa()
})
afterEach(() => fechar())

describe('GGVP-19 · estudo de caso do processo perdido', () => {
  it('CA1, CA3, CA4, CA5 · a rodada faz o estudo sozinha, com a sentença e a petição; novo processo vira tarefa da Sênior; a explicação abre', async () => {
    await app.prepararSugestoes()
    for (const trecho of ['Benefício: BPC/LOAS Idoso', 'Resultado: Improcedente', 'a renda do filho que reside com a autora', 'Petição aprovada: DO DIREITO']) expect(enviado).toContain(trecho)
    expect(await abertas()).toEqual([`advogada · ${TITULO_RESUMO}`, `senior · ${TITULO_REVISAR}`])
    const r = (await estudos()).json()
    expect(r.estudos).toHaveLength(1)
    expect([r.estudos[0].estudo.motivo, r.estudos[0].estudo.aprendizado, r.estudos[0].resultado, r.estudos[0].aRevisar, r.podeRevisar]).toEqual([
      ESTUDO.motivo,
      ESTUDO.aprendizado,
      'Improcedente (o juiz negou o pedido)',
      true,
      false,
    ])
    await app.prepararSugestoes()
    expect(await chamadasDoEstudo()).toBe(1)
    expect((await abertas()).filter((t) => t.includes(TITULO_REVISAR))).toHaveLength(1)
  })

  it('CA3 · só a Sênior decide; a decisão guarda o estudo à parte, a tarefa fecha; o Atendimento não vê os estudos', async () => {
    await app.prepararSugestoes()
    expect((await estudos('ana')).statusCode).toBe(403)
    expect((await revisar('gabi', { novoProcesso: true })).statusCode).toBe(403)
    expect((await revisar('helena', {})).json().erro).toBe('Escolha se vamos entrar com novo processo')
    expect((await revisar('helena', { novoProcesso: true })).statusCode).toBe(201)
    const [d] = await banco.select().from(decisao).where(eq(decisao.tipo, 'estudo_caso'))
    const [estudo] = await banco.select().from(chamadaIa).where(eq(chamadaIa.finalidade, 'estudo_de_caso'))
    expect([d.passo, d.resultado, d.sugestaoIa]).toEqual(['D3b.05', 'novo_processo', { chamadaId: estudo.id }])
    expect(await abertas()).toEqual([`advogada · ${TITULO_RESUMO}`])
    const r = (await estudos('helena')).json()
    expect([r.estudos[0].aRevisar, r.estudos[0].revisao.novoProcesso, r.estudos[0].revisao.por, r.podeRevisar]).toEqual([false, true, 'helena', true])
    expect((await revisar('helena', { novoProcesso: false })).json().erro).toBe(MSG_NADA_A_REVISAR)
  })

  it('CA3 · sem indicação de novo processo, nenhuma tarefa da Sênior; caso ganho não ganha estudo; sem a petição, sem tese', async () => {
    comIa({ ...ESTUDO, novoProcesso: false, oQueRefazer: null, chance: 'menor', tese: null })
    const [p] = await banco.insert(pessoa).values({ nome: 'Ganhou' }).returning()
    await banco.insert(caso).values({ pessoaId: p.id, beneficio: BPC, fase: 'encerrado', desfecho: 'procedente_total' })
    await app.prepararSugestoes()
    expect(await abertas()).toEqual([`advogada · ${TITULO_RESUMO}`])
    expect(await chamadasDoEstudo()).toBe(1)
    expect([(await estudos()).json().estudos[0].estudo.chance, (await estudos()).json().estudos[0].estudo.tese]).toEqual(['menor', null])
  })

  it('CA1 · explicação ao cliente já aprovada antes do estudo: o estudo não reabre', async () => {
    comIa({ ...ESTUDO, novoProcesso: false, oQueRefazer: null })
    await banco.insert(tarefa).values({ casoId, passo: 'D3b.06r', titulo: TITULO_RESUMO, perfilDono: 'advogada', concluidaEm: new Date() })
    await app.prepararSugestoes()
    expect(await chamadasDoEstudo()).toBe(1)
    expect(await abertas()).toEqual([])
  })

  it('CA2 · o estudo entra no acervo como "Estudo de caso da IA", com o caso de origem', async () => {
    await app.prepararSugestoes()
    const [p] = await banco.insert(pessoa).values({ nome: 'Outra' }).returning()
    const [outro] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: BPC, fase: 'judicial' }).returning()
    // Como os fluxos do Jurídico buscam: o estudo é trecho só do Jurídico (GGVP-141 CA1).
    const fontes = await buscarNoAcervo(banco, { casoId: outro.id, beneficio: BPC, consulta: 'comprovante de residência do filho', saude: true })
    const doEstudo = fontes.find((f) => f.trecho?.startsWith('Estudo de caso da IA'))
    expect(doEstudo).toMatchObject({ tipo: 'acervo', referencia: `caso:${casoId}` })
    expect(doEstudo?.trecho).toContain('Juntar o comprovante de residência do filho')
  })
})
