import bcrypt from 'bcryptjs'
import { and, eq, inArray } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import {
  acessoDadoSensivel,
  caso,
  decisao,
  documentacaoMedica,
  documento,
  documentoMedico,
  etapa,
  eventoAuditoria,
  exigencia,
  exigenciaItem,
  identificadorCaso,
  parecerMedico,
  pericia,
  perito,
  pessoa,
  prazo,
  prestacaoContas,
  publicacao,
  tarefa,
  usuario,
} from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CASO_NAO_ENCONTRADO } from './processo.ts'
import { etapaDaOrigem, setoresPendentes } from '../../../web/src/regras/caso.ts'

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
const ver = async (apelido: string, id = casoId) => app.inject({ method: 'GET', url: `/api/casos/${id}/processo`, cookies: await cookieDe(apelido) })

function arquivo(nome: string, tipo: string, sensivel = false, dia = 1) {
  return { casoId, tipo, sensivel, chaveArmazenamento: `teste/${nome}`, nomeOriginal: nome, mime: 'application/pdf', tamanho: 1, hashSha256: nome, origem: 'portal', criadoEm: new Date(Date.UTC(2026, 9, dia, 15)) }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-07T15:00:00Z') })
  const perfis = [
    ['ana', 'atendimento'],
    ['eva', 'atendimento_lider'],
    ['fabio', 'documentacao'],
    ['gabi', 'advogada'],
    ['rosa', 'advogada'],
    ['helena', 'senior'],
    ['igor', 'juridico_adm'],
    ['julia', 'financeiro'],
    ['lauro', 'socio'],
  ] as const
  for (const [apelido, perfil] of perfis) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', cpf: '27183946509', dataNascimento: '1960-03-10', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa', advogadaResponsavelId: ids.gabi }).returning()
  casoId = c.id
  await banco.insert(identificadorCaso).values({ casoId, tipo: 'nb', valor: '4561237895' })

  // Onde o caso está: a decisão da perícia (D2.03) concluída e o caso esperando o cliente entregar o documento.
  const [d203] = await banco
    .insert(etapa)
    .values({ casoId, diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', iniciadaEm: new Date('2026-10-02T12:00:00Z'), concluidaEm: new Date('2026-10-02T13:00:00Z') })
    .returning()
  await banco
    .insert(etapa)
    .values({ casoId, diagrama: 'D2', passo: 'D2.E3', situacao: 'aguardando_externo', aguardando: 'cliente entregar o documento', iniciadaEm: new Date('2026-10-03T12:00:00Z') })
  await banco.insert(tarefa).values([
    { casoId, passo: 'D2.05d', titulo: 'Cumprir exigência do INSS', perfilDono: 'documentacao' },
    { casoId, passo: 'D2.03', titulo: 'Conferir resultado da perícia', perfilDono: 'advogada', responsavelId: ids.gabi, prazo: '2026-10-08' },
    { casoId, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm', situacao: 'concluida' },
  ])

  // Documentos: um comum, o laudo (dado de saúde, com o CID na classificação) e a peça em preparo.
  await banco.insert(documento).values(arquivo('rg-e-cpf.pdf', 'rg_e_cpf', false, 1))
  const [laudo] = await banco.insert(documento).values(arquivo('laudo-ortopedista.pdf', 'laudo', true, 2)).returning()
  await banco.insert(documento).values(arquivo('pacote-peticao.pdf', 'pacote_peticao', false, 3))
  await banco.insert(documentoMedico).values({ documentoId: laudo.id, tipo: 'laudo', dataEmissao: '2026-09-20', profissional: 'Dr. Ortopedista', cid: 'M54.5' })
  await banco.insert(parecerMedico).values({ casoId, roteiroVersao: 1, resultado: 'suficiente', confirmadoPor: ids.gabi, confirmadoEm: new Date('2026-10-02T12:00:00Z') })

  // A perícia: marcada, compareceu e o resultado favorável (status, todo mundo do caso vê).
  const [pe] = await banco.insert(perito).values({ nome: 'Dr. Perito', nomeNormalizado: 'dr perito' }).returning()
  await banco.insert(pericia).values({
    casoId,
    tipo: 'medica',
    chamadaPorEtapaId: d203.id,
    agendadaPara: new Date('2026-10-05T13:30:00Z'),
    local: 'Agência Santo Amaro',
    peritoId: pe.id,
    compareceu: true,
    resultado: 'favoravel',
  })

  await banco.insert(exigencia).values({ casoId, origem: 'inss', descricao: 'Ficha do grupo familiar', recebidaEm: '2026-10-01', prazo: '2026-10-15' })
  await banco.insert(prazo).values([
    { casoId, origem: 'publicacao_exigencia', inicio: '2026-09-01', fim: '2026-09-20', regra: '15 dias úteis' },
    { casoId, origem: 'publicacao_exigencia', inicio: '2026-10-01', fim: '2026-10-20', regra: '15 dias úteis' },
  ])
  await banco.insert(publicacao).values({ fonte: 'DJEN', casoId, disponibilizadaEm: '2026-10-01', texto: 'Intime-se.', hash: 'h1', classe: 'andamento' })
  await banco.insert(prestacaoContas).values([
    { casoId, versao: 1, valorRecebido: '1000.00', honorarios: '300.00', valorCliente: '700.00' },
    { casoId, versao: 2, valorRecebido: '18900.00', honorarios: '5670.00', valorCliente: '13230.00' },
  ])
  await banco.insert(decisao).values({ casoId, passo: 'D2.01', tipo: 'aprovacao_inss', resultado: 'aprovado', decididoPor: ids.helena, perfil: 'senior', decididoEm: new Date('2026-10-01T12:00:00Z') })
  await banco.insert(eventoAuditoria).values({ quem: ids.gabi, acao: 'pericia_decidida', alvo: `caso:${casoId}`, quando: new Date('2026-10-02T13:00:00Z'), detalhe: { passo: 'D2.03' } })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-146 (parte 5) · a página do processo lê o caso do banco', () => {
  it('a advogada do caso: o caso inteiro, com o conteúdo médico; os valores da prestação, não (são da Sênior, Mateus 14/10); o acesso ao dado de saúde fica registrado', async () => {
    const r = await ver('gabi')
    expect(r.statusCode).toBe(200)
    const p = r.json()
    expect([p.pessoa.nome, p.pessoa.cpf, p.pessoa.nascimento, p.beneficio, p.fase, p.etapaAtual]).toEqual([
      'Vera Lúcia',
      '27183946509',
      '1960-03-10',
      'loas-deficiente',
      'administrativa',
      'inss',
    ])
    expect(p.identificadores).toEqual({ nb: '4561237895', protocolo: null, cnj: null })
    // GGVP-158 P12.2: a espera do cliente traz o prazo da exigência aberta e o lembrete da cobrança, com o limite da Configuração.
    expect(p.etapas).toEqual([
      {
        diagrama: 'D2',
        passo: 'D2.E3',
        aguardando: 'cliente entregar o documento',
        desde: '2026-10-03T12:00:00.000Z',
        prazo: '2026-10-15',
        lembrete: 'cobrança: 2 tentativas, com 3 dias entre elas; depois, a Sênior',
      },
    ])
    // Sem parecer registrado, o laudo guardado ainda não é "novo" (GGVP-158 P12.1).
    expect(p.laudoNovoEm).toBeNull()
    // As tarefas abertas, do prazo mais perto ao sem prazo, com o setor e a tela do passo; a concluída não entra.
    expect(p.tarefas.map((t: { setor: string; titulo: string; responsavel: string | null; prazo: string | null; tela: string | null }) => [t.setor, t.titulo, t.responsavel, t.prazo, t.tela])).toEqual([
      ['Jurídico', 'Conferir resultado da perícia', 'gabi', '2026-10-08', `/casos/${casoId}/pericia/decidir`],
      ['Documentação', 'Cumprir exigência do INSS', null, null, `/casos/${casoId}/exigencia/documentos`],
    ])
    expect(p.proximoPasso).toEqual({ oQue: 'Conferir resultado da perícia', setor: 'Jurídico', prazo: '2026-10-08', tela: `/casos/${casoId}/pericia/decidir` })
    expect(p.documentos.map((d: { nome: string | null; tipo: string; sensivel: boolean; data: string }) => [d.nome, d.tipo, d.sensivel, d.data])).toEqual([
      ['pacote-peticao.pdf', 'pacote_peticao', false, '2026-10-03'],
      ['laudo-ortopedista.pdf', 'laudo', true, '2026-10-02'],
      ['rg-e-cpf.pdf', 'rg_e_cpf', false, '2026-10-01'],
    ])
    expect(p.pericia).toEqual({
      tipo: 'medica',
      origem: 'd2-necessidade',
      situacao: 'concluida',
      marcada: { data: '2026-10-05', hora: '10:30', local: 'Agência Santo Amaro' },
      marcadaPeloSistema: false,
      perito: 'Dr. Perito',
      resultado: 'favoravel',
    })
    expect(p.exigencias).toEqual([{ origem: 'inss', descricao: 'Ficha do grupo familiar', prazo: '2026-10-15', situacao: 'aberta', recebidaEm: '2026-10-01', itens: [] }])
    // G12: prazo sem tarefa aberta ligada não tem mais o que cumprir e não aparece.
    expect(p.prazos).toEqual([])
    expect(p.publicacoes).toEqual([{ data: '2026-10-01', fonte: 'DJEN', classe: 'andamento' }])
    expect(p.linha.map((l: { quem: string; passo: string | null; descricao: string }) => [l.quem, l.passo, l.descricao])).toEqual([
      ['helena', 'D2.01', 'OK da Sênior para o INSS: aprovado'],
      ['gabi', 'D2.03', 'Decisão sobre a perícia'],
    ])
    expect(p.valores).toBeNull()
    expect(p.saude).toEqual({
      documentos: [{ tipo: 'laudo', emitidoEm: '2026-09-20', profissional: 'Dr. Ortopedista', cid: 'M54.5' }],
      parecer: { resultado: 'suficiente', confirmadoEm: '2026-10-02T12:00:00.000Z' },
    })
    const acessos = await banco.select().from(acessoDadoSensivel)
    expect(acessos.map((a) => [a.usuarioId, a.perfil, a.casoId, a.recurso])).toEqual([[ids.gabi, 'advogada', casoId, `processo:${casoId}`]])
  })

  it('GGVP-162 CA1 · o Atendimento, a líder e a Documentação não abrem o processo: 403, nada do caso e a tentativa registrada', async () => {
    for (const apelido of ['ana', 'eva', 'fabio']) {
      const r = await ver(apelido)
      expect([apelido, r.statusCode]).toEqual([apelido, 403])
      expect(r.body).not.toMatch(/Vera|laudo|rg-e-cpf/)
    }
    const negados = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'acesso_negado')
    expect(negados.map((e) => [(e.detalhe as { casoId?: string }).casoId, (e.detalhe as { acao: string }).acao])).toEqual(Array(3).fill([casoId, 'processo.abrir']))
    expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
  })

  it('GGVP-158 P5.14 · o resumo do processo traz a vara, o juiz e o nome do perito (desde a GGVP-162, só para quem abre o processo)', async () => {
    await banco.update(caso).set({ vara: '1ª Vara-Gabinete do JEF de São Paulo', juiz: 'Dra. Maria Souza' }).where(eq(caso.id, casoId))
    const p = (await ver('igor')).json()
    expect([p.vara, p.juiz, p.pericia.perito]).toEqual(['1ª Vara-Gabinete do JEF de São Paulo', 'Dra. Maria Souza', 'Dr. Perito'])
  })

  it('a outra advogada não recebe os valores do caso; a Sênior e o Jurídico administrativo recebem o médico, sem valores', async () => {
    const rosa = (await ver('rosa')).json()
    expect([rosa.valores, rosa.saude?.documentos[0].cid]).toEqual([null, 'M54.5'])
    for (const apelido of ['helena', 'igor']) {
      const p = (await ver(apelido)).json()
      expect([p.valores, p.saude.parecer.resultado, p.documentos.map((d: { nome: string }) => d.nome)]).toEqual([
        null,
        'suficiente',
        ['pacote-peticao.pdf', 'laudo-ortopedista.pdf', 'rg-e-cpf.pdf'],
      ])
    }
  })

  it('o Financeiro não abre o caso, e a tentativa fica no histórico do caso', async () => {
    expect((await ver('julia')).statusCode).toBe(403)
    const negados = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'acesso_negado')
    expect(negados.map((e) => [(e.detalhe as { casoId?: string }).casoId, (e.detalhe as { acao: string }).acao])).toEqual([[casoId, 'processo.abrir']])
  })

  it('GGVP-96 · o Sócio lê o caso inteiro: os valores (Lucas, 07/10), o conteúdo médico e a peça (Pedro, 09/10); a leitura fica no registro', async () => {
    const p = (await ver('lauro')).json()
    expect([p.valores, p.saude.documentos[0].cid, p.saude.parecer.resultado]).toEqual([{ versao: 2, recebido: '18900.00', honorarios: '5670.00', cliente: '13230.00' }, 'M54.5', 'suficiente'])
    expect(p.documentos.map((d: { nome: string | null }) => d.nome)).toEqual(['pacote-peticao.pdf', 'laudo-ortopedista.pdf', 'rg-e-cpf.pdf'])
    expect((await banco.select().from(acessoDadoSensivel)).map((a) => [a.usuarioId, a.perfil, a.casoId])).toEqual([[ids.lauro, 'socio', casoId]])
  })

  it('caso que não existe ou id torto: 404', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'antonio-exemplo-1']) {
      const r = await ver('gabi', id)
      expect([r.statusCode, r.json().erro]).toEqual([404, MSG_CASO_NAO_ENCONTRADO])
    }
  })

  it('o que o banco não tem vem vazio: caso recém-aberto, sem etapa, tarefa, documento nem perícia; a perícia do juiz ainda sem data', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Caio Novo', situacao: 'lead' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, fase: 'atendimento' }).returning()
    const novo = (await ver('gabi', c.id)).json()
    expect([novo.beneficio, novo.etapaAtual, novo.tarefas, novo.documentos, novo.pericia, novo.proximoPasso, novo.valores, novo.linha]).toEqual([
      null,
      'entrevista',
      [],
      [],
      null,
      null,
      null,
      [],
    ])
    expect([novo.saude, novo.senhaGovNoCofre, novo.transcricoes]).toEqual([{ documentos: [], parecer: null }, false, 0])

    // A perícia que o juiz pediu (D3a.03), aberta pelo despacho e ainda sem a tela da perícia: nasce liberada, para marcar.
    const [e] = await banco.insert(etapa).values({ casoId: c.id, diagrama: 'D3a', passo: 'D3a.03', situacao: 'concluida' }).returning()
    await banco.insert(pericia).values({ casoId: c.id, tipo: 'social', chamadaPorEtapaId: e.id })
    const doJuiz = (await ver('igor', c.id)).json()
    expect(doJuiz.pericia).toEqual({ tipo: 'social', origem: 'd3a-juiz', situacao: 'marcar', marcada: null, marcadaPeloSistema: false, perito: null, resultado: null })
    expect(doJuiz.proximoPasso).toBeNull()
  })

  it('G12, G21 · o prazo do juiz aparece uma vez só e só enquanto há o que cumprir; os itens por setor vêm com quem cumpriu', async () => {
    const cookies = await cookieDe('gabi')
    const publicar = async (texto: string, hash: string) => {
      const [pub] = await banco.insert(publicacao).values({ fonte: 'aasp', casoId, disponibilizadaEm: '2026-10-05', texto, hash }).returning()
      await app.inject({ method: 'POST', url: `/api/publicacoes/${pub.id}/classificacao`, cookies, payload: { classe: 'exigencia', dias: 15 } })
    }
    const decidir = (payload: object) => app.inject({ method: 'POST', url: `/api/casos/${casoId}/exigencia-juiz`, cookies, payload })
    const doJuiz = (p: { exigencias: { origem: string }[] }) => p.exigencias.filter((x) => x.origem === 'juizo')

    // Na análise da advogada: o prazo do processo, uma vez.
    await publicar('Diga a parte autora sobre o laudo.', 'j1')
    expect((await ver('gabi')).json().prazos).toEqual([{ fim: '2026-10-27', regra: expect.any(String) }])
    // Só ciência: nada a cumprir, o prazo sai.
    expect((await decidir({ decisao: 'ciencia' })).statusCode).toBe(201)
    expect((await ver('gabi')).json().prazos).toEqual([])

    // Precisa cumprir: o prazo aparece só como a exigência, com os itens por setor.
    await publicar('Junte a parte autora o CNIS e a carteira de trabalho.', 'j2')
    const itens = [
      { setor: 'documentacao', descricao: 'Juntar o CNIS', prazoInterno: '20/10/2026' },
      { setor: 'atendimento', descricao: 'Pedir a carteira de trabalho', prazoInterno: '15/10/2026' },
    ]
    expect((await decidir({ decisao: 'cumprir', itens })).statusCode).toBe(201)
    await banco
      .update(exigenciaItem)
      .set({ situacao: 'cumprido', cumpridoEm: new Date('2026-10-06T14:00:00Z'), cumpridoPor: ids.ana })
      .where(eq(exigenciaItem.descricao, 'Pedir a carteira de trabalho'))
    let p = (await ver('gabi')).json()
    expect(p.prazos).toEqual([])
    expect(doJuiz(p)).toEqual([
      {
        origem: 'juizo',
        descricao: 'Junte a parte autora o CNIS e a carteira de trabalho.',
        prazo: '2026-10-27',
        situacao: 'aberta',
        recebidaEm: '2026-10-05',
        itens: [
          { setor: 'Atendimento', descricao: 'Pedir a carteira de trabalho', situacao: 'cumprido', cumpridoEm: '2026-10-06T14:00:00.000Z', cumpridoPor: 'ana' },
          { setor: 'Documentação', descricao: 'Juntar o CNIS', situacao: 'pendente', cumpridoEm: null, cumpridoPor: null },
        ],
      },
    ])

    // Cumprida (a manifestação protocolada fecha a exigência e as tarefas dela): nem a exigência nem o prazo ficam na página.
    await banco.update(exigencia).set({ situacao: 'cumprida' }).where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo')))
    await banco
      .update(tarefa)
      .set({ situacao: 'concluida', concluidaEm: new Date('2026-10-07T12:00:00Z') })
      .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.passo, ['D3a.03', 'D3a.04'])))
    p = (await ver('gabi')).json()
    expect([p.prazos, doJuiz(p)]).toEqual([[], []])
  })
})

describe('GGVP-86 CA14 · os dados do processo dentro da tarefa (Pedro, 14/10)', () => {
  const resumo = async (apelido: string, id = casoId) => app.inject({ method: 'GET', url: `/api/casos/${id}/resumo`, cookies: await cookieDe(apelido) })

  it('quem vê o caso recebe só a identificação: o cliente, o benefício, a fase, os números e a vara; nada de saúde, estratégia nem valores', async () => {
    await banco.update(caso).set({ vara: '1ª Vara Federal de Osasco' }).where(eq(caso.id, casoId))
    await banco.update(pessoa).set({ telefone: '11987654321' }).where(eq(pessoa.cpf, '27183946509'))
    for (const apelido of ['ana', 'eva', 'fabio', 'gabi', 'helena', 'igor', 'lauro']) {
      const r = await resumo(apelido)
      expect([apelido, r.statusCode]).toEqual([apelido, 200])
      expect(r.json()).toEqual({
        casoId,
        pessoa: { id: expect.any(String), nome: 'Vera Lúcia', cpf: '27183946509', telefone: '11987654321' },
        beneficio: 'loas-deficiente',
        fase: 'administrativa',
        identificadores: { nb: '4561237895', protocolo: null, cnj: null },
        vara: '1ª Vara Federal de Osasco',
      })
    }
    // Nada do caso médico nem dos valores passa pela rota leve, e ninguém leu dado de saúde.
    expect(JSON.stringify((await resumo('ana')).json())).not.toMatch(/M54|laudo|honor|estrateg/i)
    expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
  })

  it('o Financeiro, que não vê o caso, não recebe o resumo; caso que não existe ou id torto: 404', async () => {
    expect((await resumo('julia')).statusCode).toBe(403)
    for (const id of ['00000000-0000-4000-8000-000000000000', 'antonio-exemplo-1']) expect((await resumo('gabi', id)).statusCode).toBe(404)
  })
})

describe('GGVP-158 P12 · a página do processo completa: o laudo novo, a espera e as perícias (GGVP-86 CA5, CA8 e CA9)', () => {
  it('P12.1 · com parecer registrado, o laudo não conferido é laudo novo, com a data dele; conferido, deixa de ser', async () => {
    await banco.insert(documentacaoMedica).values({ casoId, parte: 'parecer', documento: { processoId: casoId, fichaId: 'ficha-inventada', analises: [], registros: [{ situacao: 'suficiente' }] } })
    expect((await ver('gabi')).json().laudoNovoEm).toBe('2026-10-02')
    // Só a data, para quem abre o processo: o Jurídico administrativo também vê, sem o conteúdo do laudo.
    expect((await ver('igor')).json().laudoNovoEm).toBe('2026-10-02')
    await banco.update(documentoMedico).set({ confirmadoEm: new Date('2026-10-06T12:00:00Z'), confirmadoPor: ids.gabi })
    expect((await ver('gabi')).json().laudoNovoEm).toBeNull()
  })

  it('P12.2 · a espera do INSS traz o lembrete da vigília e o prazo da tarefa do mesmo passo', async () => {
    await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: new Date('2026-10-04T12:00:00Z') })
    await banco.insert(tarefa).values({ casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada', prazo: '2026-10-09' })
    const inss = (await ver('gabi')).json().etapas.find((e: { passo: string }) => e.passo === 'D2.04')
    expect([inss.aguardando, inss.prazo, inss.lembrete]).toEqual(['INSS decidir', '2026-10-09', 'a vigília confere o Meu INSS todo dia útil'])
  })

  it('P12.3 · as perícias abertas e a última com resultado, cada uma com o responsável e o prazo; o campo de hoje não muda', async () => {
    await banco.insert(pericia).values([
      { casoId, tipo: 'medica', agendadaPara: new Date('2026-10-20T13:00:00Z'), local: 'Agência Centro', criadoEm: new Date('2026-10-06T12:00:00Z') },
      { casoId, tipo: 'social', criadoEm: new Date('2026-10-06T13:00:00Z') },
    ])
    await banco.insert(tarefa).values([
      { casoId, passo: 'DP.06', titulo: 'Orientar para a perícia médica', perfilDono: 'juridico_adm', responsavelId: ids.igor, prazo: '2026-10-17' },
      { casoId, passo: 'DP.02', titulo: 'Marcar avaliação social', perfilDono: 'juridico_adm', prazo: '2026-10-12' },
    ])
    const p = (await ver('gabi')).json()
    // A social, sem data e sem pessoa na tarefa: o setor e o prazo da tarefa. A médica marcada: quem orienta e a data marcada.
    // A favorável, concluída: sem responsável nem prazo.
    expect(p.pericias.map((x: { tipo: string; responsavel: string | null; prazo: string | null; resultado: string | null }) => [x.tipo, x.responsavel, x.prazo, x.resultado])).toEqual([
      ['social', 'Jurídico administrativo', '2026-10-12', null],
      ['medica', 'igor', '2026-10-20', null],
      ['medica', null, null, 'favoravel'],
    ])
    expect(Object.keys(p.pericia)).not.toContain('responsavel')
  })
})

describe('GGVP-86 · a página do processo do caso do servidor', () => {
  /** A etapa da decisão da perícia (D2.03), que o caso de exemplo já concluiu. */
  const daDecisao = async () => (await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.03'))))[0].id

  it('GGVP-86 CA2 · a perícia em andamento vem no bloco da perícia, ligada à etapa que a pediu (o INSS, no D2.03)', async () => {
    // Antes: a única perícia do caso já tem resultado, e o bloco "Em perícia" não aparece.
    expect((await ver('gabi')).json().pericia.situacao).toBe('concluida')
    await banco.insert(pericia).values({ casoId, tipo: 'social', chamadaPorEtapaId: await daDecisao(), criadoEm: new Date(Date.now() + 60_000) })
    const { pericia: p } = (await ver('gabi')).json()
    expect([p.tipo, p.origem, p.marcada, p.perito, p.resultado]).toEqual(['social', 'd2-necessidade', null, null, null])
    expect(p.situacao).not.toBe('concluida')
    expect(etapaDaOrigem(p.origem)).toBe('inss')
  })

  it('GGVP-86 CA3 · o caso esperando setores: os itens vêm por setor, com quem cumpriu, e só o setor que não subiu o card fica pendente', async () => {
    const [x] = await banco.insert(exigencia).values({ casoId, origem: 'inss', descricao: 'Declaração de composição do grupo familiar', recebidaEm: '2026-10-04', prazo: '2026-10-19' }).returning()
    await banco.insert(exigenciaItem).values([
      { exigenciaId: x.id, perfilResponsavel: 'documentacao', descricao: 'Montar a declaração', situacao: 'cumprido', cumpridoEm: new Date('2026-10-06T14:00:00Z'), cumpridoPor: ids.fabio },
      { exigenciaId: x.id, perfilResponsavel: 'atendimento', descricao: 'Colher a assinatura do cliente', situacao: 'pendente' },
    ])
    const doGrupo = (await ver('gabi')).json().exigencias.find((e: { descricao: string }) => e.descricao === x.descricao)
    expect(doGrupo.itens).toEqual([
      { setor: 'Atendimento', descricao: 'Colher a assinatura do cliente', situacao: 'pendente', cumpridoEm: null, cumpridoPor: null },
      { setor: 'Documentação', descricao: 'Montar a declaração', situacao: 'cumprido', cumpridoEm: '2026-10-06T14:00:00.000Z', cumpridoPor: 'fabio' },
    ])
    const lacos = doGrupo.itens.map((i: { setor: string; situacao: string; cumpridoEm: string | null }) => ({ setor: i.setor, subiu: i.situacao === 'cumprido' && i.cumpridoEm ? i.cumpridoEm : undefined }))
    expect(setoresPendentes(lacos)).toEqual(['Atendimento'])
  })

  it('GGVP-86 CA11 · cada documento do caso vem com a origem (por onde chegou) e a data', async () => {
    await banco.insert(documento).values({ ...arquivo('comprovante-de-endereco.pdf', 'comprovante_residencia', false, 4), origem: 'scanner' })
    const docs = (await ver('gabi')).json().documentos.map((d: { nome: string; origem: string; data: string }) => [d.nome, d.origem, d.data])
    expect(docs).toEqual([
      ['comprovante-de-endereco.pdf', 'scanner', '2026-10-04'],
      ['pacote-peticao.pdf', 'portal', '2026-10-03'],
      ['laudo-ortopedista.pdf', 'portal', '2026-10-02'],
      ['rg-e-cpf.pdf', 'portal', '2026-10-01'],
    ])
  })
})
