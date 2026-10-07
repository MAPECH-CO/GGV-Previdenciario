import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, configuracao, etapa, exigencia, exigenciaItem, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_EVIDENCIA, MSG_INFORMACAO } from './exigencia-juiz.ts'

// GGVP-58: os laços dos setores no despacho da Sênior, pelas rotas do laço da exigência do juiz (decisão 32).
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
const chamar = async (apelido: string, metodo: 'GET' | 'POST', resto: string, payload?: object) =>
  app.inject({ method: metodo, url: `/api/casos/${casoId}${resto}`, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const PDF = { nome: 'laudo.pdf', mime: 'application/pdf', conteudo: '%PDF-1.4 laudo' }
async function enviar(apelido: string, resto: string, campos: Record<string, string> = {}, arquivo: typeof PDF | null = PDF) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return app.inject({
    method: 'POST',
    url: `/api/casos/${casoId}${resto}`,
    cookies: await cookieDe(apelido),
    payload: partes.join('') + `--${f}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${f}` },
  })
}
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const itemDo = async (setor: string) => (await banco.select().from(exigenciaItem).where(eq(exigenciaItem.perfilResponsavel, setor)))[0]

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => AGORA, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento'], ['dora', 'documentacao'], ['igor', 'juridico_adm']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await banco.insert(configuracao).values([{ chave: 'cobranca.limite', valor: 2 }])
  // O indeferido com o motivo de quem viu (GGVP-48, GGVP-52) e o despacho da Sênior (GGVP-54) aos dois setores.
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
  await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: AGORA })
  await banco.insert(tarefa).values({ casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' })
  await enviar('gabi', '/vigilia', {
    tipo: 'decisao',
    resultado: 'indeferido',
    texto: 'Benefício negado.',
    motivoInss: 'Renda acima do limite',
    motivoEscrito: 'O INSS somou a renda do filho',
  })
  await chamar('helena', 'POST', '/despacho', {
    decisao: 'acionar',
    itens: [
      { setor: 'documentacao', descricao: 'Laudo atualizado', temPrazo: true, prazo: '20/10/2026' },
      { setor: 'atendimento', descricao: 'Quem mora com a cliente', temPrazo: false },
    ],
  })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-58 · laços dos setores até subir o card', () => {
  it('CA5, CA13 · o setor vê o que foi pedido, quem pediu e o prazo de entrega só quando definido; sem prazo processual', async () => {
    expect(await abertas()).toEqual(['advogada · Pedir a petição', 'atendimento · Cumprir pendência', 'documentacao · Cumprir pendência'])
    const doc = (await chamar('dora', 'GET', '/pendencias/setor')).json()
    expect([doc.origem, doc.setor, doc.pedidoPor, doc.prazoProcessual]).toEqual(['despacho', 'documentacao', 'helena', null])
    expect(doc.itens.map((i: { descricao: string; prazoInterno: string | null; limite: number }) => [i.descricao, i.prazoInterno, i.limite])).toEqual([['Laudo atualizado', '2026-10-20', 2]])
    const atd = (await chamar('ana', 'GET', '/pendencias/setor')).json()
    expect(atd.itens.map((i: { descricao: string; prazoInterno: string | null }) => [i.descricao, i.prazoInterno])).toEqual([['Quem mora com a cliente', null]])
    // O Jurídico administrativo não tem laço no despacho: a perícia é a tarefa de marcar.
    expect((await chamar('igor', 'GET', '/pendencias/setor')).statusCode).toBe(403)
  })

  it('CA4, CA6, CA9 (G15) · a tentativa conta no limite; no limite, sobe para a Sênior e continua com o setor', async () => {
    const item = await itemDo('documentacao')
    const tentar = () => chamar('dora', 'POST', `/pendencias/itens/${item.id}/tentativas`, { canal: 'whatsapp', resultado: 'Cliente não respondeu' })
    expect((await tentar()).json()).toEqual({ ok: true, tentativas: 1, escalada: false })
    expect((await tentar()).json()).toEqual({ ok: true, tentativas: 2, escalada: true })
    expect(await abertas()).toEqual([
      'advogada · Pedir a petição',
      'atendimento · Cumprir pendência',
      'documentacao · Cumprir pendência',
      'senior · Pendência sem retorno: Laudo atualizado (limite de tentativas)',
    ])
    const doc = (await chamar('dora', 'GET', '/pendencias/setor')).json()
    expect([doc.itens[0].tentativas.length, doc.itens[0].escalada]).toEqual([2, true])
  })

  it('CA1, CA7, CA12 · o Atendimento sobe com a informação escrita; sem ela, nem documento, não sobe; o lembrete some', async () => {
    const item = await itemDo('atendimento')
    expect((await enviar('ana', `/pendencias/itens/${item.id}/prova`, {}, null)).json().erro).toBe(MSG_INFORMACAO)
    expect((await enviar('ana', `/pendencias/itens/${item.id}/prova`, { informacao: ' Mora com o filho e a nora ' }, null)).statusCode).toBe(201)
    const [i] = await banco.select().from(exigenciaItem).where(eq(exigenciaItem.id, item.id))
    const [t] = await banco.select().from(tarefa).where(eq(tarefa.id, item.tarefaId!))
    expect([i.situacao, i.informacao, t.situacao, t.prazo]).toEqual(['cumprido', 'Mora com o filho e a nora', 'concluida', null])
  })

  it('CA2, CA3, CA7, CA8, CA11 · a Documentação sobe com o documento; com todos os cards, a espera do cliente fecha e ninguém falta', async () => {
    const doc = await itemDo('documentacao')
    expect((await enviar('dora', `/pendencias/itens/${doc.id}/prova`, { informacao: 'Só texto' }, null)).json().erro).toBe(MSG_EVIDENCIA)
    expect((await enviar('dora', `/pendencias/itens/${doc.id}/prova`)).statusCode).toBe(201)
    let d = (await chamar('helena', 'GET', '/despacho')).json()
    expect([d.faltam, d.setores.map((s: { setor: string; situacao: string }) => [s.setor, s.situacao])]).toEqual([
      ['Atendimento'],
      [
        ['atendimento', 'pendente'],
        ['documentacao', 'cumprido'],
      ],
    ])
    const atd = await itemDo('atendimento')
    await enviar('ana', `/pendencias/itens/${atd.id}/prova`, { informacao: 'Mora sozinha' }, null)
    d = (await chamar('gabi', 'GET', '/despacho')).json()
    expect(d.faltam).toEqual([])
    const [x] = await banco.select().from(exigencia).where(eq(exigencia.casoId, casoId))
    const [espera] = await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.E1')))
    expect([x.situacao, espera.situacao]).toEqual(['cumprida', 'concluida'])
    expect(await abertas()).toEqual(['advogada · Pedir a petição'])
  })

  it('o laço do juiz não mexe no item do despacho, e o do despacho não mexe no do juiz', async () => {
    const doc = await itemDo('documentacao')
    expect((await enviar('dora', `/exigencia-juiz/itens/${doc.id}/prova`)).statusCode).toBe(404)
    expect((await chamar('dora', 'GET', '/exigencia-juiz/setor')).statusCode).toBe(404)
  })
})
