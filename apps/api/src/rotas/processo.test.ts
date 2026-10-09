import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import {
  acessoDadoSensivel,
  caso,
  decisao,
  documento,
  documentoMedico,
  etapa,
  eventoAuditoria,
  exigencia,
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
  it('a advogada do caso: o caso inteiro, com o conteúdo médico e os valores; o acesso ao dado de saúde fica registrado', async () => {
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
    expect(p.etapas).toEqual([{ diagrama: 'D2', passo: 'D2.E3', aguardando: 'cliente entregar o documento', desde: '2026-10-03T12:00:00.000Z' }])
    // As tarefas abertas, do prazo mais perto ao sem prazo, com o setor e a tela do passo; a concluída não entra.
    expect(p.tarefas.map((t: { setor: string; titulo: string; responsavel: string | null; prazo: string | null; tela: string | null }) => [t.setor, t.titulo, t.responsavel, t.prazo, t.tela])).toEqual([
      ['Jurídico', 'Conferir resultado da perícia', 'gabi', '2026-10-08', `/casos/${casoId}/pericia`],
      ['Documentação', 'Cumprir exigência do INSS', null, null, `/casos/${casoId}/exigencia/documentos`],
    ])
    expect(p.proximoPasso).toEqual({ oQue: 'Conferir resultado da perícia', setor: 'Jurídico', prazo: '2026-10-08', tela: `/casos/${casoId}/pericia` })
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
      perito: 'Dr. Perito',
      resultado: 'favoravel',
    })
    expect(p.exigencias).toEqual([{ origem: 'inss', descricao: 'Ficha do grupo familiar', prazo: '2026-10-15', situacao: 'aberta' }])
    expect(p.prazos).toEqual([{ fim: '2026-10-20', regra: '15 dias úteis' }])
    expect(p.publicacoes).toEqual([{ data: '2026-10-01', fonte: 'DJEN', classe: 'andamento' }])
    expect(p.linha.map((l: { quem: string; passo: string | null; descricao: string }) => [l.quem, l.passo, l.descricao])).toEqual([
      ['helena', 'D2.01', 'OK da Sênior para o INSS: aprovado'],
      ['gabi', 'D2.03', 'Decisão sobre a perícia'],
    ])
    expect(p.valores).toEqual({ versao: 2, recebido: '18900.00', honorarios: '5670.00', cliente: '13230.00' })
    expect(p.saude).toEqual({
      documentos: [{ tipo: 'laudo', emitidoEm: '2026-09-20', profissional: 'Dr. Ortopedista', cid: 'M54.5' }],
      parecer: { resultado: 'suficiente', confirmadoEm: '2026-10-02T12:00:00.000Z' },
    })
    const acessos = await banco.select().from(acessoDadoSensivel)
    expect(acessos.map((a) => [a.usuarioId, a.perfil, a.casoId, a.recurso])).toEqual([[ids.gabi, 'advogada', casoId, `processo:${casoId}`]])
  })

  it('o Atendimento e a Documentação: status, datas e o resultado da perícia; sem valores, sem conteúdo médico, sem o nome do laudo e sem a peça', async () => {
    for (const apelido of ['ana', 'fabio']) {
      const p = (await ver(apelido)).json()
      expect([p.valores, p.saude]).toEqual([null, null])
      expect(p.documentos.map((d: { nome: string | null; tipo: string; sensivel: boolean }) => [d.nome, d.tipo, d.sensivel])).toEqual([
        [null, 'laudo', true],
        ['rg-e-cpf.pdf', 'rg_e_cpf', false],
      ])
      expect([p.pericia.situacao, p.pericia.resultado, p.pericia.perito]).toEqual(['concluida', 'favoravel', 'Dr. Perito'])
      expect(p.tarefas).toHaveLength(2)
      expect(p.linha).toHaveLength(2)
    }
    expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
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

  it('o Financeiro e o Sócio não abrem o caso, e a tentativa fica no histórico do caso', async () => {
    for (const apelido of ['julia', 'lauro']) expect((await ver(apelido)).statusCode).toBe(403)
    const negados = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'acesso_negado')
    expect(negados.map((e) => [(e.detalhe as { casoId?: string }).casoId, (e.detalhe as { acao: string }).acao])).toEqual([
      [casoId, 'caso.ver'],
      [casoId, 'caso.ver'],
    ])
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
    const doJuiz = (await ver('ana', c.id)).json()
    expect(doJuiz.pericia).toEqual({ tipo: 'social', origem: 'd3a-juiz', situacao: 'marcar', marcada: null, perito: null, resultado: null })
    expect(doJuiz.proximoPasso).toBeNull()
  })
})
