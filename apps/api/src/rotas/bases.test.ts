import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POR_PAGINA } from '@ggv/contratos'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import {
  atendimento,
  caso,
  eventoAuditoria,
  fichaRecepcao,
  identificadorCaso,
  juizo,
  pericia,
  perito,
  pessoa,
  peticao,
  peticaoVersao,
  processoAcervo,
  protocoloJudicial,
  usuario,
} from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

// GGVP-78 · Clientes e Processos, as bases do topo (Figma 1927:605 e 1927:888). Dados fictícios.
const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const listar = async (apelido: string, url: string) => app.inject({ method: 'GET', url, cookies: await cookieDe(apelido) })
const buscar = async (apelido: string, url: string, payload: object) => app.inject({ method: 'POST', url, payload, cookies: await cookieDe(apelido) })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-09T15:00:00Z') })
  for (const [apelido, perfil] of [['eva', 'atendimento_lider'], ['gabi', 'advogada'], ['julia', 'financeiro'], ['rui', 'socio']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  // Sebastião: judicial, com CNJ, foro e perito do acervo e a petição inicial protocolada.
  const [seb] = await banco.insert(pessoa).values({ nome: 'Sebastião Nunes', cpf: '52998224725', telefone: '11955551234', cidade: 'São Paulo', uf: 'SP', situacao: 'cliente' }).returning()
  const [cs] = await banco.insert(caso).values({ pessoaId: seb.id, beneficio: 'auxilio_acidente', fase: 'judicial' }).returning()
  await banco.insert(identificadorCaso).values({ casoId: cs.id, tipo: 'cnj', valor: '50052908720264036301' })
  const [j] = await banco.insert(juizo).values({ tribunal: 'TRF3', nome: 'JEF São Paulo' }).returning()
  const [rui] = await banco.insert(perito).values({ nome: 'Dr. Rui Tavares', nomeNormalizado: 'rui tavares' }).returning()
  await banco.insert(processoAcervo).values({ casoId: cs.id, numeroCnj: '50052908720264036301', juizoId: j.id, peritoId: rui.id, desfecho: 'improcedente', fonte: 'lote' })
  const [pet] = await banco.insert(peticao).values({ casoId: cs.id, tipo: 'inicial' }).returning()
  const [v] = await banco.insert(peticaoVersao).values({ peticaoId: pet.id, numero: 1, conteudo: 'x', hash: 'x', geradaPor: 'advogada' }).returning()
  await banco.insert(protocoloJudicial).values({ peticaoVersaoId: v.id, tribunal: 'TRF3', protocoladoEm: new Date('2026-02-10T13:00:00Z'), protocoladoPor: ids.gabi })
  // Clara: no INSS, com NB, perícia social e uma conversa ontem.
  const [cla] = await banco.insert(pessoa).values({ nome: 'Clara Nunes', cpf: '11144477735', telefone: '11966660000', cidade: 'Guarulhos', uf: 'SP', situacao: 'cliente' }).returning()
  const [cc] = await banco.insert(caso).values({ pessoaId: cla.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa' }).returning()
  await banco.insert(identificadorCaso).values({ casoId: cc.id, tipo: 'nb', valor: '1234567890' })
  const [elcio] = await banco.insert(perito).values({ nome: 'Sr. Élcio Ramos', nomeNormalizado: 'elcio ramos' }).returning()
  await banco.insert(pericia).values({ casoId: cc.id, tipo: 'social', peritoId: elcio.id })
  await banco.insert(atendimento).values({ pessoaId: cla.id, casoId: cc.id, canal: 'telefone', inicio: new Date('2026-10-08T14:00:00Z') })
  // Maria: ganhou.
  const [mar] = await banco.insert(pessoa).values({ nome: 'Maria Souza', situacao: 'cliente', cidade: 'Santo André', uf: 'SP' }).returning()
  await banco.insert(caso).values({ pessoaId: mar.id, beneficio: 'pensao_morte', fase: 'encerrado', desfecho: 'procedente_parcial' })
  // Fernanda: lead ativo; Otávio: lead arquivado, pela ficha da Recepção.
  const [fer] = await banco.insert(pessoa).values({ nome: 'Fernanda Ruiz', situacao: 'lead', telefone: '11977770000' }).returning()
  const [ota] = await banco.insert(pessoa).values({ nome: 'Otávio Nery', situacao: 'lead' }).returning()
  await banco.insert(fichaRecepcao).values({
    pessoaId: ota.id,
    documento: { id: ota.id, situacao: 'lead', nome: 'Otávio Nery', telefone: '', contatos: [{ data: '2026-09-01', canal: 'telefone', texto: 'x' }], fechamento: { situacao: 'arquivado' } },
  })
  Object.assign(ids, { seb: seb.id, cs: cs.id, cla: cla.id, cc: cc.id, mar: mar.id, fer: fer.id, ota: ota.id })
})

afterEach(async () => {
  await app.close()
  await fechar()
})

describe('Clientes (GGVP-78)', () => {
  it('quem vê o caso lista a base com CPF mascarado, benefício, cidade, processos, situação e último contato, sem nada além', async () => {
    const r = await listar('eva', '/api/clientes')
    expect(r.statusCode).toBe(200)
    const lista = r.json()
    expect(lista).toMatchObject({ total: 4, leads: 1, pagina: 1, paginas: 1 })
    // Ordem do Figma: último contato primeiro; sem contato, pelo nome.
    expect(lista.clientes.map((c: { nome: string }) => c.nome)).toEqual(['Clara Nunes', 'Fernanda Ruiz', 'Maria Souza', 'Sebastião Nunes'])
    expect(lista.clientes.find((c: { id: string }) => c.id === ids.seb)).toEqual({
      id: ids.seb,
      nome: 'Sebastião Nunes',
      cpf: '***.982.247-**',
      beneficio: 'Auxílio Acidentário',
      cidade: 'São Paulo · SP',
      processos: 1,
      situacao: 'em_andamento',
      ultimoContato: null,
    })
    expect(lista.clientes.find((c: { id: string }) => c.id === ids.cla)).toMatchObject({ situacao: 'administrativo', ultimoContato: '2026-10-08' })
    expect(lista.clientes.find((c: { id: string }) => c.id === ids.mar)).toMatchObject({ situacao: 'exito' })
    expect(lista.clientes.find((c: { id: string }) => c.id === ids.fer)).toMatchObject({ situacao: 'lead', processos: 0 })
    expect(lista.opcoes).toEqual({ beneficios: ['Auxílio Acidentário', 'LOAS Deficiente', 'Pensão por Morte'], cidades: ['Guarulhos · SP', 'Santo André · SP', 'São Paulo · SP'] })
  })

  it('a busca por nome, CPF ou telefone vem no corpo; os filtros e a situação cortam a lista', async () => {
    const nomes = async (corpo: object) => (await buscar('gabi', '/api/clientes/busca', corpo)).json().clientes.map((c: { nome: string }) => c.nome)
    expect(await nomes({ busca: 'nunes' })).toEqual(['Clara Nunes', 'Sebastião Nunes'])
    expect(await nomes({ busca: '529.982' })).toEqual(['Sebastião Nunes'])
    expect(await nomes({ busca: '97777' })).toEqual(['Fernanda Ruiz'])
    const filtrar = async (consulta: string) => (await listar('gabi', `/api/clientes?${consulta}`)).json().clientes.map((c: { nome: string }) => c.nome)
    expect(await filtrar(`beneficio=${encodeURIComponent('Pensão por Morte')}`)).toEqual(['Maria Souza'])
    expect(await filtrar(`cidade=${encodeURIComponent('Guarulhos · SP')}`)).toEqual(['Clara Nunes'])
    expect(await filtrar('exito=exito')).toEqual(['Maria Souza'])
    expect(await filtrar('situacao=leads')).toEqual(['Fernanda Ruiz'])
    // Ativos (o padrão) esconde o lead arquivado; Todos mostra.
    expect(await filtrar('situacao=todos')).toContain('Otávio Nery')
    expect(await filtrar('ordem=nome')).toEqual(['Clara Nunes', 'Fernanda Ruiz', 'Maria Souza', 'Sebastião Nunes'])
  })

  it(`pagina de ${POR_PAGINA} em ${POR_PAGINA}`, async () => {
    await banco.insert(pessoa).values(Array.from({ length: POR_PAGINA }, (_, i) => ({ nome: `Lead ${String(i).padStart(2, '0')}`, situacao: 'lead' })))
    const p2 = (await listar('eva', '/api/clientes?pagina=2')).json()
    expect(p2).toMatchObject({ total: POR_PAGINA + 4, pagina: 2, paginas: 2 })
    expect(p2.clientes).toHaveLength(4)
  })

  it('a página além da última vira a última: a busca nova na página 3 não cai numa lista vazia', async () => {
    const r = (await buscar('eva', '/api/clientes/busca', { busca: 'nunes', pagina: 3 })).json()
    expect(r).toMatchObject({ total: 2, pagina: 1, paginas: 1 })
    expect(r.clientes).toHaveLength(2)
  })

  it('um catálogo só: o lead que quer LOAS e o cliente com caso LOAS caem na mesma opção; "Não sei ainda" fica sem benefício', async () => {
    const [liv] = await banco.insert(pessoa).values({ nome: 'Lívia Prado', situacao: 'lead' }).returning()
    const [dav] = await banco.insert(pessoa).values({ nome: 'Davi Prado', situacao: 'lead' }).returning()
    await banco.insert(fichaRecepcao).values([
      { pessoaId: liv.id, documento: { id: liv.id, situacao: 'lead', nome: 'Lívia Prado', telefone: '', contatos: [], beneficioInteresse: 'loas-deficiente' } },
      { pessoaId: dav.id, documento: { id: dav.id, situacao: 'lead', nome: 'Davi Prado', telefone: '', contatos: [], beneficioInteresse: 'nao-sei' } },
    ])
    const lista = (await listar('eva', '/api/clientes')).json()
    expect(lista.opcoes.beneficios).toEqual(['Auxílio Acidentário', 'LOAS Deficiente', 'Pensão por Morte'])
    expect(lista.clientes.find((c: { id: string }) => c.id === dav.id).beneficio).toBeNull()
    const nomes = (await listar('eva', `/api/clientes?beneficio=${encodeURIComponent('LOAS Deficiente')}`)).json().clientes.map((c: { nome: string }) => c.nome)
    expect(nomes).toEqual(['Clara Nunes', 'Lívia Prado'])
  })

  it('filtro fora da lista é recusado', async () => {
    expect((await listar('eva', '/api/clientes?situacao=talvez')).statusCode).toBe(400)
  })
})

describe('Processos (GGVP-78)', () => {
  it('cada caso numa linha: número, autor, benefício, fase, foro, perito, desfecho e ajuizamento', async () => {
    const lista = (await listar('gabi', '/api/processos')).json()
    expect(lista).toMatchObject({ total: 3, doAcervo: 1, pagina: 1, paginas: 1 })
    // Ajuizado primeiro; os outros, pelo mais novo.
    expect(lista.processos[0]).toEqual({
      id: ids.cs,
      numero: '5005290-87.2026.4.03.6301',
      clienteId: ids.seb,
      autor: 'Sebastião Nunes',
      beneficio: 'Auxílio Acidentário',
      fase: 'judicial',
      foro: 'JEF São Paulo',
      juiz: null,
      perito: 'Dr. Rui Tavares',
      // A leitura do acervo sem conferência não vira desfecho.
      desfecho: 'em_andamento',
      ajuizadoEm: '2026-02-10',
    })
    expect(lista.processos.find((p: { id: string }) => p.id === ids.cc)).toMatchObject({ numero: '123.456.789-0', perito: 'Sr. Élcio Ramos (social)', fase: 'administrativa', ajuizadoEm: null })
    expect(lista.processos.find((p: { clienteId: string }) => p.clienteId === ids.mar)).toMatchObject({ desfecho: 'exito', numero: null })
    expect(lista.opcoes).toEqual({ beneficios: ['Auxílio Acidentário', 'LOAS Deficiente', 'Pensão por Morte'], foros: ['JEF São Paulo'], juizes: [], peritos: ['Dr. Rui Tavares', 'Sr. Élcio Ramos (social)'] })
  })

  it('o desfecho conferido pela Sênior conta', async () => {
    await banco.update(processoAcervo).set({ desfechoConferidoPor: ids.gabi }).where(eq(processoAcervo.casoId, ids.cs))
    const lista = (await listar('gabi', '/api/processos')).json()
    expect(lista.processos.find((p: { id: string }) => p.id === ids.cs).desfecho).toBe('perdido')
  })

  it('a busca acha pelo número do processo, o NB e o CPF; os filtros cortam', async () => {
    const autores = async (corpo: object) => (await buscar('eva', '/api/processos/busca', corpo)).json().processos.map((p: { autor: string }) => p.autor)
    expect(await autores({ busca: '5005290-87.2026' })).toEqual(['Sebastião Nunes'])
    expect(await autores({ busca: '123.456.789' })).toEqual(['Clara Nunes'])
    expect(await autores({ busca: '111.444' })).toEqual(['Clara Nunes'])
    expect(await autores({ busca: 'souza' })).toEqual(['Maria Souza'])
    const filtrar = async (consulta: string) => (await listar('eva', `/api/processos?${consulta}`)).json().processos.map((p: { autor: string }) => p.autor)
    expect(await filtrar('fase=administrativa')).toEqual(['Clara Nunes'])
    expect(await filtrar(`perito=${encodeURIComponent('Dr. Rui Tavares')}`)).toEqual(['Sebastião Nunes'])
    expect(await filtrar(`foro=${encodeURIComponent('JEF São Paulo')}`)).toEqual(['Sebastião Nunes'])
    expect(await filtrar('exito=exito')).toEqual(['Maria Souza'])
    expect(await filtrar(`cliente=${ids.cla}`)).toEqual(['Clara Nunes'])
    expect(await filtrar('ordem=autor')).toEqual(['Clara Nunes', 'Maria Souza', 'Sebastião Nunes'])
  })
})

describe('quem vê e o que fica registrado (GGVP-78)', () => {
  it('o Financeiro, que não vê o caso, recebe 403 nas duas listas; o Sócio, que lê tudo (GGVP-96), abre as duas', async () => {
    for (const url of ['/api/clientes', '/api/processos']) {
      expect((await listar('julia', url)).statusCode, `julia ${url}`).toBe(403)
      expect((await listar('rui', url)).statusCode, `rui ${url}`).toBe(200)
    }
  })

  it('Exportar CSV traz o filtro inteiro e fica no histórico com quem e quantas linhas, sem o termo da busca', async () => {
    const r = await buscar('eva', '/api/clientes/busca', { busca: '529.982', tudo: '1' })
    expect(r.json()).toMatchObject({ total: 1, pagina: 1, paginas: 1 })
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'lista_exportada'))
    expect(ev).toMatchObject({ quem: ids.eva, alvo: 'clientes', detalhe: { linhas: 1, perfil: 'atendimento_lider' } })
    expect(JSON.stringify(ev.detalhe)).not.toContain('529')
  })
})
