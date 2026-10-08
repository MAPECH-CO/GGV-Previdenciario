import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, decisao, etapa, eventoAuditoria, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { MSG_SEM_REFERENCIA } from '../ia/acervo.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_IA_SEM_ANALISE, MSG_NADA_A_DESPACHAR } from './indeferimento.ts'

const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-07T13:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()

/** O caso esperando o INSS e o registro do indeferido com a carta e os dois motivos (GGVP-48, GGVP-52; ajuste de 06/10). */
async function indeferido() {
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
  await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: AGORA })
  await banco.insert(tarefa).values({ casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  const campos = {
    tipo: 'decisao',
    resultado: 'indeferido',
    texto: 'Benefício negado.',
    motivoInss: 'Renda per capita acima de 1/4 do salário mínimo',
    motivoEscrito: 'O INSS somou a renda do filho',
  }
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="carta-inss.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 carta\r\n`)
  const r = await app.inject({
    method: 'POST',
    url: `/api/casos/${casoId}/vigilia`,
    cookies: await cookieDe('gabi'),
    payload: partes.join('') + `--${f}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${f}` },
  })
  expect(r.json().aberto).toBe('justica')
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await indeferido()
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-54 · a Sênior despacha', () => {
  const despachar = async (corpo: object, apelido = 'helena') =>
    app.inject({ method: 'POST', url: `/api/casos/${casoId}/despacho`, cookies: await cookieDe(apelido), payload: corpo })
  const despacho = async (apelido = 'helena') => (await app.inject({ method: 'GET', url: `/api/casos/${casoId}/despacho`, cookies: await cookieDe(apelido) })).json()

  it('CA1, CA10 e GGVP-52 CA7 · a Sênior recebe "Despachar caso" com o histórico: a decisão do INSS, a carta e o motivo escrito, com quem e quando', async () => {
    expect(await abertas()).toEqual(['senior · Despachar caso'])
    const x = await despacho()
    expect([x.indeferimento.motivoInss, x.indeferimento.carta.nome, x.indeferimento.motivoEscrito]).toEqual([
      'Renda per capita acima de 1/4 do salário mínimo',
      'carta-inss.pdf',
      { texto: 'O INSS somou a renda do filho', por: 'gabi', em: AGORA.toISOString() },
    ])
    expect([x.despacho, x.podeDespachar, x.podeEncerrar]).toEqual([null, true, true])
    expect([(await despacho('gabi')).podeDespachar, (await despacho('gabi')).podeEncerrar]).toEqual([false, false])
  })

  it('CA8 · sem o perfil Sênior, o despacho é recusado no servidor e registrado', async () => {
    expect((await despachar({ decisao: 'nada_falta' }, 'gabi')).statusCode).toBe(403)
    const negados = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))
    expect(negados.map((e) => (e.detalhe as { acao: string }).acao)).toContain('caso.despachar_indeferimento')
    expect(await abertas()).toEqual(['senior · Despachar caso'])
  })

  it('CA3, CA4, CA9 · "nada falta" vai direto para "Pedir a petição", e o despacho fica com a autora e a data', async () => {
    expect((await despachar({ decisao: 'nada_falta' })).statusCode).toBe(201)
    expect(await abertas()).toEqual(['advogada · Pedir a petição'])
    const x = await despacho()
    expect([x.despacho, x.setores, x.faltam, x.podeDespachar]).toEqual([{ decisao: 'nada_falta', por: 'helena', em: AGORA.toISOString() }, [], [], false])
    expect((await despachar({ decisao: 'nada_falta' })).json().erro).toBe(MSG_NADA_A_DESPACHAR)
  })

  it('CA2, CA5 a CA7, CA9 · cada setor recebe "Cumprir pendência" com o prazo só quando dado; a perícia vai para o Jurídico administrativo', async () => {
    const r = await despachar({
      decisao: 'acionar',
      itens: [
        { setor: 'documentacao', descricao: 'Laudo atualizado', temPrazo: true, prazo: '20/10/2026' },
        { setor: 'atendimento', descricao: 'Quem mora com a cliente', temPrazo: false },
      ],
      tiposPericia: ['medica'],
    })
    expect(r.statusCode).toBe(201)
    expect(await abertas()).toEqual([
      'advogada · Pedir a petição',
      'atendimento · Cumprir pendência',
      'documentacao · Cumprir pendência',
      'juridico_adm · Marcar perícia médica (despacho da Sênior)',
    ])
    const prazos = await banco.select({ dono: tarefa.perfilDono, prazo: tarefa.prazo }).from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.04')))
    expect(prazos.map((t) => [t.dono, t.prazo]).sort()).toEqual([
      ['atendimento', null],
      ['documentacao', '2026-10-20'],
    ])
    const x = await despacho()
    expect(x.setores.map((s: { setor: string; descricao: string; prazo: string | null; situacao: string }) => [s.setor, s.descricao, s.prazo, s.situacao])).toEqual([
      ['atendimento', 'Quem mora com a cliente', null, 'pendente'],
      ['documentacao', 'Laudo atualizado', '2026-10-20', 'pendente'],
    ])
    expect([x.pericias, x.faltam]).toEqual([[{ tipo: 'medica', resultado: null }], ['Atendimento', 'Documentação', 'Perícia']])
    const [d] = await banco.select().from(decisao).where(eq(decisao.casoId, casoId))
    expect([d.passo, d.tipo, d.resultado, d.justificativa, d.sugestaoIa, d.decididoEm.toISOString()]).toEqual([
      'D3.03',
      'despacho',
      'acionar',
      'documentacao, atendimento, pericia:medica',
      null,
      AGORA.toISOString(),
    ])
    const etapas = (await banco.select().from(etapa).where(eq(etapa.casoId, casoId))).map((e) => `${e.passo} ${e.situacao}`)
    expect(etapas).toEqual(expect.arrayContaining(['D3.03 concluida', 'D3.E1 aguardando_externo', 'D3.05 aberta']))
  })

  it('CA2, CA6 · o mesmo setor duas vezes é recusado: cada setor recebe um pedido só (ajuste de 06/10)', async () => {
    const pedido = { setor: 'atendimento', descricao: 'teste', temPrazo: false }
    expect((await despachar({ decisao: 'acionar', itens: [pedido, pedido] })).json().erro).toBe('Cada setor recebe um pedido só')
    expect(await abertas()).toEqual(['senior · Despachar caso'])
  })
})

describe('Épico IA · a IA analisa o indeferimento e a Sênior despacha (GGVP-54 CA1, CA4; G4)', () => {
  const LEITURA = {
    analise: 'O INSS somou a renda do filho que mora à parte. Provar a moradia separada rebate o motivo.',
    nadaFalta: false,
    itens: [{ setor: 'documentacao', descricao: 'Comprovante de residência do filho' }],
    pericias: ['social'],
  }
  let enviado = ''
  const comIa = (resposta: string) => {
    const fetch = async (_url: unknown, init?: RequestInit) => {
      enviado = JSON.parse(String(init?.body)).messages[1].content
      return new Response(JSON.stringify({ choices: [{ message: { content: resposta } }] }))
    }
    app = criarServidor({
      banco,
      agora: () => AGORA,
      armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))),
      ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }),
    })
  }
  const analisar = async (apelido = 'helena') => app.inject({ method: 'POST', url: `/api/casos/${casoId}/despacho/analise`, cookies: await cookieDe(apelido) })

  it('CA1 · a Sênior recebe a análise com o motivo, os documentos e o acervo; o Atendimento não pode pedir; nada é gravado', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Rosa Antunes' }).returning()
    const [outro] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
    await banco.insert(resultadoInss).values({ casoId: outro.id, resultado: 'indeferido', dataDecisao: '2026-08-01', motivoEscrito: 'O INSS somou a renda do filho casado de Rosa Antunes.' })
    comIa(JSON.stringify(LEITURA))
    expect((await analisar('ana')).statusCode).toBe(403)
    const r = (await analisar()).json()
    expect([r.sugestao.texto, r.sugestao.sugestao, r.leitura.itens, r.leitura.pericias, r.motivo, r.aviso]).toEqual([LEITURA.analise, true, LEITURA.itens, ['social'], null, null])
    expect(r.sugestao.fontes.map((f: { tipo: string; referencia: string }) => f.tipo)).toEqual(['caso', 'acervo'])
    for (const trecho of ['BPC/LOAS Idoso', 'Renda per capita acima de 1/4', 'O INSS somou a renda do filho', 'carta-inss.pdf', 'Trechos do acervo da casa']) expect(enviado).toContain(trecho)
    expect(enviado).not.toContain('Rosa')
    expect(await banco.select().from(decisao).where(eq(decisao.tipo, 'despacho'))).toEqual([])
    expect(await abertas()).toEqual(['senior · Despachar caso'])
  })

  it('Sugestão pronta (07/10) · a rodada deixa a análise pronta antes de a Sênior abrir; o que falhou não volta na rodada', async () => {
    let chamadas = 0
    let resposta = 'fora do ar'
    const fetch = async () => {
      chamadas++
      return resposta === 'fora do ar' ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ choices: [{ message: { content: resposta } }] }))
    }
    app = criarServidor({
      banco,
      agora: () => AGORA,
      armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))),
      ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }),
    })
    await app.prepararSugestoes()
    await app.prepararSugestoes()
    expect(chamadas).toBe(1)
    resposta = JSON.stringify(LEITURA)
    const r = (await analisar()).json()
    expect([r.leitura.itens, chamadas]).toEqual([LEITURA.itens, 2])
    const outra = (await analisar()).json()
    expect([outra.sugestao.chamadaId, chamadas]).toEqual([r.sugestao.chamadaId, 2])
  })

  it('CA1 · resposta fora do formato vira "sem sugestão"; sem nada parecido no acervo, avisa', async () => {
    comIa('Acho que falta o CNIS.')
    expect((await analisar()).json()).toEqual({ sugestao: null, leitura: null, motivo: MSG_IA_SEM_ANALISE, aviso: MSG_SEM_REFERENCIA })
  })

  it('CA4 · a Sênior despacha diferente da sugestão: o despacho vale e a chamada da IA fica à parte; sem despacho esperando, não há análise', async () => {
    comIa(JSON.stringify(LEITURA))
    const r = (await analisar()).json()
    const feito = await app.inject({ method: 'POST', url: `/api/casos/${casoId}/despacho`, cookies: await cookieDe('helena'), payload: { decisao: 'nada_falta', chamadaIaId: r.sugestao.chamadaId } })
    expect(feito.statusCode).toBe(201)
    const [d] = await banco.select().from(decisao).where(eq(decisao.tipo, 'despacho'))
    expect([d.resultado, d.sugestaoIa]).toEqual(['nada_falta', { chamadaId: r.sugestao.chamadaId }])
    expect((await analisar()).json().erro).toBe(MSG_NADA_A_DESPACHAR)
  })
})
