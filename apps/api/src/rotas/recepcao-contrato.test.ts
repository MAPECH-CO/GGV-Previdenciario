import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, fichaRecepcao, pessoa, usuario } from '../banco/esquema.ts'
import { docxDeTeste, formularioDoArquivo, textoDoDocx } from '../kit/docx-de-teste.ts'
import type { ConversorDePdf } from '../kit/pdf.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { CONFERENCIAS } from '../../../web/src/regras/contrato.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let arquivos: Armazenamento
// Quinta, 08/10/2026, meio-dia em Brasília.
const INICIO = new Date('2026-10-08T15:00:00Z')
let relogio = INICIO

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

/** O que o cadastro do lead já traz e o balcão não: bairro, cidade, UF e CEP (e, no LOAS representado, o representante). */
async function completarFicha(fichaId: string, extra: object = {}) {
  const dados = { bairro: 'Vila Exemplo', cidadeUf: 'Osasco / SP', cep: '06010000', ...extra }
  await banco.update(fichaRecepcao).set({ documento: sql`${fichaRecepcao.documento} || ${JSON.stringify(dados)}::jsonb` }).where(eq(fichaRecepcao.pessoaId, fichaId))
}

async function lead(nome = 'Joana Ribeiro', telefone = '11987654321', cpf?: string, completa: boolean | object = true) {
  const id = (await json('ana', 'POST', '/api/fichas', { nome, idade: 66, pretende: 'Quer o BPC.', telefone, cpf, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
  if (completa) await completarFicha(id, completa === true ? {} : completa)
  return id
}
const fechou = (fichaId: string, beneficio = 'loas-idoso') => json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio })
const TODAS = Object.fromEntries(CONFERENCIAS.map((c) => [c.id, true]))
/** Valores válidos para os campos do modelo que a ficha do balcão ainda não tem. */
const VALIDOS: Record<string, string> = {
  cpf: '52998224725',
  rg: '12.345.678-9',
  estadoCivil: 'Viúvo(a)',
  profissao: 'Do lar',
  endereco: 'Rua das Flores, 10, Centro, Osasco/SP',
  telefone: '11987654321',
  nome: 'Joana Ribeiro',
  // O kit de verdade (GGVP-136) pede mais: a nacionalidade, o representante e o curatelado.
  nacionalidade: 'brasileira',
  representanteNacionalidade: 'brasileira',
  curateladoNome: 'Pedro Exemplo Lima',
  curateladoNascimento: '12/03/1950',
  curateladoNacionalidade: 'brasileiro',
  curateladoRg: '11.222.333-4',
  curateladoCpf: '11144477735',
}

/** O modelo de teste: texto inventado, com as variáveis que os modelos do escritório usam. A 1ª data é a do contrato. */
const MODELO_COMUM = [
  'CONTRATO. {{NOME COMPLETO}}, {{ESTADO CIVIL}}, {{NACIONALIDADE}}, {{PROFISSÃO}}, CPF {{NÚMERO DO CPF}}, RG {{NÚMERO DO RG}}, {{ENDEREÇO COMPLETO}} nº {{Nº}}, {{BAIRRO}}, {{CIDADE}}/{{UF}}, CEP {{CEP}}, telefone {{TELEFONE}}, contato {{TELEFONE P/ CONTATO}}.',
  'São Paulo, {{DATA DE HOJE}}.',
  'PROCURAÇÃO de {{NOME COMPLETO}}.',
  '{{CIDADE}}, {{DATA DE HOJE}}.',
]
async function subirModelo(id: string, paragrafos = MODELO_COMUM) {
  const r = await app.inject({ method: 'PUT', url: `/api/configuracao/modelos/${id}`, cookies: await cookieDe('helena'), ...formularioDoArquivo(docxDeTeste(paragrafos)) })
  expect(r.statusCode).toBe(201)
}

beforeEach(async () => {
  relogio = INICIO
  ;({ banco, fechar } = await abrirBancoEmbutido())
  arquivos = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'kit-')))
  // Os testes de antes são do ZapSign contratado (simulado); o kit sai em Word, sem conversor de PDF.
  app = criarServidor({ banco, agora: () => relogio, armazenamento: arquivos, zapsign: true, conversor: null })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['julia', 'financeiro'], ['helena', 'senior']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  // Os contratos dos testes são do LOAS: o modelo dele já está na Configuração (versão 1).
  await subirModelo('contrato-completo-loas')
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 4a: o "fechou" vira caso no banco, com o contrato', () => {
  it('o caso nasce em atendimento, com o benefício do portal; a pessoa vira cliente; o contrato vai à cópia das telas', async () => {
    const fichaId = await lead()
    expect((await chamar('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'nao-sei' })).statusCode).toBe(400)
    expect((await chamar('julia', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-idoso' })).statusCode).toBe(403)

    const r = await fechou(fichaId)
    expect(r.processo).toMatchObject({ beneficio: 'loas-idoso', etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato' })
    expect(r.contrato).toMatchObject({ processoId: r.processo.id, fichaId, etapa: 'preparar', kit: { documentos: expect.any(Array) } })
    expect(r.ficha).toMatchObject({ situacao: 'cliente', desde: '10/2026', processos: [{ id: r.processo.id, etapa: 'Contrato · preparar' }] })
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Fechou .+: processo novo com o kit /)

    const [novo] = await banco.select().from(caso).where(eq(caso.pessoaId, fichaId))
    expect(novo).toMatchObject({ id: r.processo.id, beneficio: 'bpc_loas_idoso', fase: 'atendimento' })
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, fichaId)))[0].situacao).toBe('cliente')
    expect((await json('gabi', 'GET', '/api/recepcao')).contratos).toMatchObject([{ processoId: r.processo.id, etapa: 'preparar' }])
  })

  it('as condições mudam o kit antes de gerar; o contrato só gera com os campos; a correção vai à ficha e ao histórico', async () => {
    const fichaId = await lead()
    const { processo } = await fechou(fichaId)
    const base = `/api/processos/${processo.id}/contrato`
    const condicoes = await json('ana', 'PUT', `${base}/condicoes`, { representado: false, moradia: true, uniaoEstavel: false, separacaoDeFato: false })
    expect(condicoes.contrato.condicoes.moradia).toBe(true)
    expect(condicoes.ficha.historico.at(-1).oQue).toContain('comprovante de residência em nome de outra pessoa')

    expect((await chamar('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: {}, correcoes: {} })).statusCode).toBe(400)
    const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    expect(faltam.resultado).toBe('faltam')
    const correcoes = Object.fromEntries((faltam.campos as string[]).map((c) => [c, VALIDOS[c]]))
    expect(Object.values(correcoes).every(Boolean)).toBe(true)

    const gerado = await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias: TODAS, correcoes })
    expect(gerado).toMatchObject({ resultado: 'gerado', contrato: { etapa: 'assinatura', documento: { versao: 1 }, versoes: [{ versao: 1, motivo: 'corrigido: faltavam dados do cadastro' }] } })
    expect(gerado.ficha.processos[0]).toMatchObject({ etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' })
    const oQue = gerado.ficha.historico.map((e: { oQue: string }) => e.oQue)
    expect(oQue).toContainEqual(expect.stringMatching(/^Corrigiu no contrato: .+ \(faltavam dados do cadastro\)$/))
    expect(oQue.at(-1)).toMatch(/^Gerou o contrato de .+ pelo modelo contrato-completo-loas-v1 \(versão 1\), guardado na pasta do cliente/)
    expect((await chamar('ana', 'PUT', `${base}/condicoes`, { representado: false, moradia: false, uniaoEstavel: false, separacaoDeFato: false })).statusCode).toBe(400)
  })

  it('CPF de outra ficha não gera o contrato', async () => {
    await lead('Marta Lima', '11955554444', '11144477735')
    const fichaId = await lead()
    const { processo } = await fechou(fichaId)
    const base = `/api/processos/${processo.id}/contrato`
    const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    const correcoes = { ...Object.fromEntries((faltam.campos as string[]).map((c) => [c, VALIDOS[c]])), cpf: '11144477735' }
    expect(await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'cpf da cliente', conferencias: TODAS, correcoes })).toEqual({
      resultado: 'cpf-de-outra-ficha',
      nome: 'Marta Lima',
    })
  })
})

/** O contrato gerado, pronto para assinar: fecha e gera com os campos que faltam (o CPF, um por ficha). */
async function gerado(fichaId: string, cpf = VALIDOS.cpf) {
  const { processo } = await fechou(fichaId)
  const base = `/api/processos/${processo.id}/contrato`
  const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
  const correcoes = Object.fromEntries((faltam.campos as string[]).map((c) => [c, { ...VALIDOS, cpf }[c]]))
  expect((await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias: TODAS, correcoes })).resultado).toBe('gerado')
  return base
}

describe('GGVP-125 · bloco 4b: a assinatura do contrato no servidor', () => {
  it('ZapSign: um documento por kit; a segunda tentativa sem assinatura sobe para a sênior (G15); o retorno anexa uma vez e encerra a tarefa', async () => {
    const base = await gerado(await lead())
    expect((await chamar('julia', 'POST', `${base}/zapsign`)).statusCode).toBe(403)
    // GGVP-96: o contrato é da raia do Atendimento (contrato.conduzir); a advogada fecha o caso, mas não conduz o contrato.
    expect((await chamar('gabi', 'POST', `${base}/zapsign`)).statusCode).toBe(403)
    const envio = await json('ana', 'POST', `${base}/zapsign`)
    expect(envio).toMatchObject({ resultado: 'gerado', contrato: { assinatura: { forma: 'digital', tentativas: [], zapsign: { status: 'enviado' } } } })
    const { documentoId, link } = envio.contrato.assinatura.zapsign
    expect(envio.mensagem).toContain(link)
    expect((await json('ana', 'POST', `${base}/zapsign`)).contrato.assinatura.zapsign.documentoId).toBe(documentoId)

    expect((await chamar('ana', 'POST', `${base}/tentativas`, { canal: 'whatsapp' })).statusCode).toBe(400)
    const primeira = await json('ana', 'POST', `${base}/tentativas`, { canal: 'whatsapp', mensagem: envio.mensagem })
    expect(primeira.contrato.assinatura.tentativas).toMatchObject([{ data: '2026-10-08', canal: 'whatsapp', quem: 'ana' }])
    expect(primeira.ficha.contatos.at(-1)).toMatchObject({ canal: 'WhatsApp', texto: 'Link do ZapSign enviado para assinar o contrato.' })
    expect(await json('ana', 'POST', `${base}/tentativas`, { canal: 'ligacao' })).toEqual({ erro: 'Ainda não é dia de tentar de novo.' })

    // Três dias depois, sem assinatura: a segunda tentativa é a última do Atendimento.
    relogio = new Date('2026-10-11T15:00:00Z')
    const segunda = await json('ana', 'POST', `${base}/tentativas`, { canal: 'ligacao' })
    expect(segunda.contrato.assinatura).toMatchObject({ naSenior: true, tentativas: [{ canal: 'whatsapp' }, { canal: 'ligacao' }] })
    const daSenior = { acao: 'Colher assinatura · limite de tentativas', setor: 'Jurídico', urgente: true }
    expect(segunda.tarefas).toContainEqual(expect.objectContaining(daSenior))
    expect(segunda.ficha.historico.at(-1).oQue).toBe('Subiu para a advogada sênior: 2 tentativas sem assinatura (G15)')
    expect((await chamar('ana', 'POST', `${base}/tentativas`, { canal: 'ligacao' })).statusCode).toBe(400)

    const retorno = await json('ana', 'POST', `${base}/zapsign/retorno-simulado`)
    expect(retorno).toMatchObject({
      resultado: 'anexado',
      arquivo: { tipo: 'contrato', origem: 'card', aguardaLeitura: true },
      contrato: { etapa: 'leitura', assinatura: { zapsign: { status: 'assinado', eventos: [`${documentoId}-assinado`] } } },
    })
    expect(retorno.contrato.assinatura.arquivo).toBe(retorno.arquivo.nome)
    expect(retorno.ficha.processos[0]).toMatchObject({ etapa: 'Contrato assinado em 11/10', proximaAcao: 'ler e arquivar o contrato assinado' })
    expect(retorno.tarefas).toContainEqual(expect.objectContaining({ ...daSenior, concluida: true }))
    expect((await json('gabi', 'GET', '/api/recepcao')).tarefas.map((t: { acao: string }) => t.acao)).not.toContain(daSenior.acao)
    expect((await json('ana', 'POST', `${base}/zapsign/retorno-simulado`)).resultado).toBe('repetido')
  })

  it('papel na hora: só na entrevista presencial; imprime, digitaliza e só conclui com a digitalização; depois, nada de ZapSign', async () => {
    const base = await gerado(await lead())
    expect(await json('ana', 'POST', `${base}/digitalizacao`)).toEqual({ erro: 'Imprima o kit antes.' })
    expect(await json('ana', 'POST', `${base}/assinatura-em-papel`)).toEqual({ erro: 'Anexe a digitalização do contrato assinado.' })
    const impresso = await json('ana', 'POST', `${base}/impressao`)
    expect(impresso.contrato.assinatura).toMatchObject({ forma: 'papel', impressoEm: expect.any(String) })
    expect(impresso.datas.length).toBe(impresso.contrato.kit.documentos.length)
    expect(impresso.datas.filter((d: { data: string }) => d.data !== 'em branco, à mão na assinatura')).toHaveLength(1)

    const { arquivo } = await json('ana', 'POST', `${base}/digitalizacao`)
    expect(arquivo).toMatchObject({ tipo: 'contrato', origem: 'scanner', aguardaLeitura: true })
    expect(await json('ana', 'POST', `${base}/digitalizacao`)).toEqual({ erro: 'O contrato assinado já foi digitalizado.' })
    expect(await json('ana', 'POST', `${base}/zapsign`)).toEqual({ erro: 'O contrato assinado em papel já foi digitalizado.' })

    const concluido = await json('ana', 'POST', `${base}/assinatura-em-papel`)
    expect(concluido.contrato).toMatchObject({ etapa: 'leitura', assinatura: { forma: 'papel', arquivo: arquivo.nome, assinadoEm: expect.any(String) } })
    expect(concluido.ficha.processos[0]).toMatchObject({ etapa: 'Contrato assinado em 08/10' })
    expect(concluido.ficha.historico.at(-1).oQue).toBe('Concluiu a assinatura em papel, com a digitalização anexada; segue para a leitura')
  })

  it('entrevista por vídeo: a assinatura vai pelo ZapSign, sem papel; com o documento no ZapSign, papel também não', async () => {
    const fichaId = await lead()
    const marcada = await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, {
      tipo: 'video', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false,
    })
    expect(marcada.resultado).toBe('marcado')
    const base = await gerado(fichaId)
    expect(await json('ana', 'POST', `${base}/impressao`)).toEqual({ erro: 'Papel só na entrevista presencial: a assinatura vai pelo ZapSign.' })

    const presencial = await gerado(await lead('Marta Lima', '11955554444'), '11144477735')
    await json('ana', 'POST', `${presencial}/zapsign`)
    expect(await json('ana', 'POST', `${presencial}/impressao`)).toEqual({ erro: 'O documento já foi para o ZapSign.' })
  })
})

describe('GGVP-125 · bloco 4c: a leitura, a conferência e a cópia do contrato no servidor', () => {
  /** O contrato assinado em papel, esperando a leitura. */
  async function assinadoEmPapel(fichaId: string, cpf?: string) {
    const base = await gerado(fichaId, cpf)
    await json('ana', 'POST', `${base}/impressao`)
    await json('ana', 'POST', `${base}/digitalizacao`)
    expect((await json('ana', 'POST', `${base}/assinatura-em-papel`)).contrato.etapa).toBe('leitura')
    return base
  }
  const ENTREGA = { copiaDaVersaoAssinada: true, entregueEm: '08/10/2026', quemRecebeu: '  Joana   Ribeiro ', observacao: '' }

  it('a leitura simulada aponta a página cortada; a conferência manda corrigir, e a versão assinada fica no histórico', async () => {
    const base = await assinadoEmPapel(await lead())
    expect((await chamar('julia', 'POST', `${base}/leitura-simulada`)).statusCode).toBe(403)
    const lido = await json('ana', 'POST', `${base}/leitura-simulada`)
    expect(lido.contrato).toMatchObject({ etapa: 'conferir', leitura: { pendencias: ['a página da assinatura veio cortada'] } })
    expect(lido.ficha.processos[0]).toMatchObject({ etapa: 'Contrato · conferência', proximaAcao: 'conferir o contrato assinado' })
    expect(await json('ana', 'POST', `${base}/leitura-simulada`)).toEqual({ erro: 'Este contrato não está esperando a leitura.' })

    expect(await json('ana', 'POST', `${base}/conferencia/aviso`, { mensagem: ' ' })).toEqual({ erro: 'Escreva a mensagem.' })
    const avisado = await json('ana', 'POST', `${base}/conferencia/aviso`, { mensagem: 'Joana, falta a página 4 assinada.' })
    expect(avisado.ficha.contatos.at(-1)).toMatchObject({ canal: 'WhatsApp', texto: 'Avisado da pendência no contrato assinado.' })

    expect(await json('ana', 'POST', `${base}/verificacao`, { tudoCerto: false, oQueCorrigir: 'x' })).toEqual({ erro: 'Escreva o que corrigir.' })
    expect(await json('ana', 'POST', `${base}/verificacao`, { tudoCerto: false, oQueCorrigir: 'página 4', paginaCorrigida: { nome: 'pagina.exe', tamanho: 10 } })).toEqual({
      erro: 'Página corrigida inválida.',
    })
    const pagina = { nome: 'pagina 4 corrigida.pdf', tamanho: 2048 }
    const corrigir = await json('ana', 'POST', `${base}/verificacao`, { tudoCerto: false, oQueCorrigir: 'falta a rubrica da página 4', paginaCorrigida: pagina })
    expect(corrigir.contrato).toMatchObject({
      etapa: 'preparar',
      verificacao: { tudoCerto: false, oQueCorrigir: 'falta a rubrica da página 4', paginaCorrigida: pagina.nome, quem: 'ana' },
      anteriores: [{ versao: 1, motivo: 'falta a rubrica da página 4' }],
    })
    expect(corrigir.contrato.assinatura).toBeUndefined()
    expect(corrigir.arquivo).toMatchObject({ nome: pagina.nome, tipo: 'contrato', aguardaLeitura: false })
    expect(corrigir.ficha.processos[0]).toMatchObject({ etapa: 'Contrato · corrigir e reenviar' })
    // Volta a preparar: a versão 2 sai pelo mesmo caminho.
    expect((await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })).contrato.documento.versao).toBe(2)
  })

  it('está certo: vai à cópia; imprime, marca a visita e registra a entrega, que leva ao checklist do benefício', async () => {
    const base = await assinadoEmPapel(await lead())
    await json('ana', 'POST', `${base}/leitura-simulada`)
    expect((await json('ana', 'POST', `${base}/verificacao`, { tudoCerto: true })).contrato).toMatchObject({ etapa: 'copia', verificacao: { tudoCerto: true } })

    expect((await json('ana', 'POST', `${base}/copia/impressao`)).contrato.copia.impressaEm).toEqual(expect.any(String))
    expect(await json('ana', 'POST', `${base}/copia/visita`, { data: '07/10/2026', hora: '10:00' })).toEqual({ erro: 'Visita inválida.' })
    const primeira = await json('ana', 'POST', `${base}/copia/visita`, { data: '13/10/2026', hora: '10:00' })
    expect(primeira.visita).toMatchObject({ data: '2026-10-13', hora: '10:00', oQue: 'Entregar cópia do contrato', tipo: 'presencial' })
    const segunda = await json('ana', 'POST', `${base}/copia/visita`, { data: '14/10/2026', hora: '15:30' })
    const agenda = segunda.ficha.agendamentos.filter((a: { oQue: string }) => a.oQue === 'Entregar cópia do contrato')
    expect(agenda.map((a: { data: string; estado?: string }) => [a.data, a.estado ?? 'marcado'])).toEqual([
      ['2026-10-13', 'remarcado'],
      ['2026-10-14', 'marcado'],
    ])

    expect(await json('ana', 'POST', `${base}/copia/entrega`, { ...ENTREGA, copiaDaVersaoAssinada: false })).toEqual({ erro: 'Entrega inválida.' })
    const entregue = await json('ana', 'POST', `${base}/copia/entrega`, ENTREGA)
    expect(entregue.contrato).toMatchObject({ etapa: 'entregue', copia: { entrega: { entregueEm: '2026-10-08', quemRecebeu: 'Joana Ribeiro', quem: 'ana' } } })
    expect(entregue.ficha.processos[0]).toEqual(
      expect.objectContaining({ etapa: 'Documentação · checklist do benefício', proximaAcao: 'conferir o checklist do benefício (D1.21)' }),
    )
    expect(entregue.ficha.processos[0].prazo).toBeUndefined()
    expect(entregue.ficha.agendamentos.find((a: { data: string }) => a.data === '2026-10-14').estado).toBe('realizado')
    expect(entregue.ficha.contatos.at(-1)).toMatchObject({ data: '2026-10-08', canal: 'Presencial', texto: 'Recebeu a cópia do contrato assinado.' })
    expect(await json('ana', 'POST', `${base}/copia/entrega`, ENTREGA)).toEqual({ erro: 'Este contrato não está para entregar a cópia.' })
  })

  it('assinado pelo ZapSign, a leitura reconhece e segue direto para a cópia, sem conferência', async () => {
    const base = await gerado(await lead())
    await json('ana', 'POST', `${base}/zapsign`)
    await json('ana', 'POST', `${base}/zapsign/retorno-simulado`)
    const lido = await json('ana', 'POST', `${base}/leitura-simulada`)
    expect(lido.contrato).toMatchObject({ etapa: 'copia', leitura: { faltam: [], pendencias: [] } })
    expect(lido.ficha.historico.at(-1).oQue).toBe('A IA leu o contrato assinado e reconheceu: tudo certo; segue para a cópia do contrato')
    expect(await json('ana', 'POST', `${base}/verificacao`, { tudoCerto: true })).toEqual({ erro: 'Este contrato não está para conferir.' })
  })
})

/** Fecha, pede o que falta e gera: devolve a resposta da geração e o endereço do contrato. */
async function gerar(fichaId: string, beneficio = 'loas-idoso') {
  const { processo } = await fechou(fichaId, beneficio)
  const base = `/api/processos/${processo.id}/contrato`
  const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
  expect(faltam.resultado).toBe('faltam')
  const correcoes = Object.fromEntries((faltam.campos as string[]).map((c) => [c, VALIDOS[c]]))
  expect(Object.values(correcoes).every(Boolean)).toBe(true)
  const r = await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias: TODAS, correcoes })
  return { r, base, processoId: processo.id as string }
}
const kitsDoCaso = (processoId: string) => banco.select().from(documento).where(eq(documento.casoId, processoId))

describe('GGVP-136 · o kit de verdade: o Word do escritório, preenchido e guardado na pasta do cliente', () => {
  it('CA2, CA3 e CA6 · gera o Word da versão em vigor do modelo da linha, preenchido com a ficha e o caso, e guarda na pasta do cliente', async () => {
    await subirModelo('contrato-completo-loas') // a versão 2 passa a valer
    const fichaId = await lead()
    const { r, processoId } = await gerar(fichaId)
    expect(r.resultado).toBe('gerado')
    expect(r.contrato.documento).toMatchObject({
      versao: 1,
      modelo: { id: 'contrato-completo-loas', versao: 2 },
      arquivo: { documentoId: expect.any(String), nome: 'Kit do contrato - versão 1.docx' },
    })

    const [kit] = await kitsDoCaso(processoId)
    expect(kit).toMatchObject({ id: r.contrato.documento.arquivo.documentoId, tipo: 'kit_contrato', pessoaId: fichaId, origem: 'portal', sensivel: false, nomeOriginal: 'Kit do contrato - versão 1.docx' })
    expect(kit.chaveArmazenamento.startsWith(`casos/${processoId}/`)).toBe(true)
    const linhas = textoDoDocx(await arquivos.ler(kit.chaveArmazenamento)).split('\n')
    expect(linhas).toEqual([
      'CONTRATO. Joana Ribeiro, viúvo(a), brasileira, do lar, CPF 529.982.247-25, RG 12.345.678-9, Rua das Flores nº 10, Vila Exemplo, Osasco/SP, CEP 06010-000, telefone (11) 98765-4321, contato .',
      'São Paulo, 8 de outubro de 2026.',
      'PROCURAÇÃO de Joana Ribeiro.',
      // No papel, só a data do contrato de honorários sai preenchida; as outras ficam em branco para a assinatura.
      'Osasco, dia ____________ de ________________ de 2026.',
    ])
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Gerou o contrato de .+ pelo modelo contrato-completo-loas-v2 \(versão 1\), guardado na pasta do cliente/)
  })

  it('CA1 · o kit usa sempre a versão em vigor: a que vale na hora de gerar, e o kit guarda qual foi', async () => {
    const fichaId = await lead()
    const { processo } = await fechou(fichaId)
    await subirModelo('contrato-completo-loas', ['KIT NOVO de {{NOME COMPLETO}}'])
    const base = `/api/processos/${processo.id}/contrato`
    const { cpf, rg, estadoCivil, profissao, endereco, nacionalidade } = VALIDOS
    const correcoes = { cpf, rg, estadoCivil, profissao, endereco, nacionalidade }
    const r = await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'dados do cadastro', conferencias: TODAS, correcoes })
    expect(r.contrato.documento.modelo).toEqual({ id: 'contrato-completo-loas', versao: 2 })
    const [kit] = await kitsDoCaso(processo.id)
    expect(textoDoDocx(await arquivos.ler(kit.chaveArmazenamento))).toBe('KIT NOVO de Joana Ribeiro')
  })

  it('CA4 · falta dado na ficha: não gera, lista o que falta e nada é guardado; completa a ficha, gera', async () => {
    const fichaId = await lead('Joana Ribeiro', '11987654321', undefined, false)
    const { processo } = await fechou(fichaId)
    const base = `/api/processos/${processo.id}/contrato`
    const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    const correcoes = Object.fromEntries((faltam.campos as string[]).map((c) => [c, VALIDOS[c]]))
    const envio = { aprovados: false, oQueCorrigir: 'dados do cadastro', conferencias: TODAS, correcoes }
    expect(await json('ana', 'POST', `${base}/gerar`, envio)).toEqual({ resultado: 'faltam-na-ficha', faltam: ['Bairro', 'Cidade', 'Estado (UF)', 'CEP'] })
    expect(await kitsDoCaso(processo.id)).toEqual([])
    expect((await json('gabi', 'GET', '/api/recepcao')).contratos.find((c: { processoId: string }) => c.processoId === processo.id).etapa).toBe('preparar')

    await completarFicha(fichaId)
    expect((await json('ana', 'POST', `${base}/gerar`, envio)).resultado).toBe('gerado')
    expect(await kitsDoCaso(processo.id)).toHaveLength(1)
  })

  it('CA4 · endereço sem o número também falta: o modelo pede o número em variável própria', async () => {
    const fichaId = await lead()
    const { processo } = await fechou(fichaId)
    const base = `/api/processos/${processo.id}/contrato`
    const correcoes = { ...VALIDOS, endereco: 'Rua das Flores' }
    const r = await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'dados do cadastro', conferencias: TODAS, correcoes })
    expect(r).toEqual({ resultado: 'faltam-na-ficha', faltam: ['Número do endereço'] })
  })

  it('sem modelo: o kit da linha que ainda não tem arquivo subido, e o da linha que não tem modelo, avisam e não geram', async () => {
    const comArquivoFaltando = await fechou(await lead(), 'emprestimo-indevido')
    expect(await json('ana', 'POST', `/api/processos/${comArquivoFaltando.processo.id}/contrato/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })).toEqual({
      resultado: 'sem-modelo',
      modelo: 'Modelo 8 (kit consumidor)',
    })
    const semLinha = await fechou(await lead('Marta Lima', '11955554444', '11144477735'), 'isencao-ir')
    expect(await json('ana', 'POST', `/api/processos/${semLinha.processo.id}/contrato/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })).toEqual({ resultado: 'sem-modelo' })
    expect(await kitsDoCaso(comArquivoFaltando.processo.id)).toEqual([])
  })

  it('CA3 · LOAS representado: o modelo dele, com o beneficiário (a ficha) e o genitor(a) (o representante)', async () => {
    await subirModelo('contrato-completo-loas-representado', [
      'REPRESENTADO {{NOME COMPLETO DO BENEFICIÁRIO}}, CPF {{NÚMERO DO CPF DO BENEFICIÁRIO}}, por sua genitora(o) {{NOME COMPLETO GENITOR(A)}}, {{ESTADO CIVIL GENITOR(A)}}, {{NACIONALIDADE GENITOR(A)}}, {{PROFISSÃO GENITOR(A)}}, CPF {{NÚMERO DO CPF GENITOR(A)}}, RG {{NÚMERO DO RG GENITOR(A)}}.',
    ])
    const representante = { nome: 'Joana Exemplo Lima', cpf: '52998224725', rg: '98.765.432-1', parentesco: 'Mãe', estadoCivil: 'Casado(a)', profissao: 'Do lar' }
    const fichaId = await lead('Joana Ribeiro', '11987654321', '11144477735', { representante })
    const { r, processoId } = await gerar(fichaId)
    expect(r.contrato.kit.modelo).toBe('contrato-completo-loas-representado')
    expect(r.contrato.documento.modelo).toEqual({ id: 'contrato-completo-loas-representado', versao: 1 })
    const [kit] = await kitsDoCaso(processoId)
    expect(textoDoDocx(await arquivos.ler(kit.chaveArmazenamento))).toBe(
      'REPRESENTADO Joana Ribeiro, CPF 111.444.777-35, por sua genitora(o) Joana Exemplo Lima, casado(a), brasileira, do lar, CPF 529.982.247-25, RG 98.765.432-1.',
    )
  })

  it('CA3 · curatela: o modelo 6, com quem contrata (a ficha) e o curatelado (os campos do contrato)', async () => {
    await subirModelo('modelo-6', ['CURATELA de {{NOME COMPLETO DO BENEFICIÁRIO}}, nascido em {{DATA DE NASCIMENTO DO BENEFICIÁRIO}}, {{NACIONALIDADE DO BENEFICIÁRIO}}, RG {{NÚMERO DO RG DO BENEFICIÁRIO}}, CPF {{NÚMERO DO CPF DO BENEFICIÁRIO}}, pedida por {{NOME COMPLETO}}.'])
    const { r, processoId } = await gerar(await lead(), 'curatela')
    expect(r.resultado).toBe('gerado')
    const [kit] = await kitsDoCaso(processoId)
    expect(textoDoDocx(await arquivos.ler(kit.chaveArmazenamento))).toBe('CURATELA de Pedro Exemplo Lima, nascido em 12/03/1950, brasileiro, RG 11.222.333-4, CPF 111.444.777-35, pedida por Joana Ribeiro.')
  })

  it('cada geração guarda um kit novo: a versão 2 do contrato não apaga o arquivo da 1', async () => {
    const fichaId = await lead()
    const { r, base, processoId } = await gerar(fichaId)
    expect(r.resultado).toBe('gerado')
    // O papel assinado voltou com problema: o contrato volta a preparar e gera de novo (GGVP-85).
    await json('ana', 'POST', `${base}/impressao`)
    await json('ana', 'POST', `${base}/digitalizacao`)
    await json('ana', 'POST', `${base}/assinatura-em-papel`)
    await json('ana', 'POST', `${base}/leitura-simulada`)
    await json('ana', 'POST', `${base}/verificacao`, { tudoCerto: false, oQueCorrigir: 'falta a rubrica da página 4' })
    const v2 = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    expect(v2.contrato.documento).toMatchObject({ versao: 2, arquivo: { nome: 'Kit do contrato - versão 2.docx' } })
    const kits = await kitsDoCaso(processoId)
    expect(kits.map((k) => k.nomeOriginal).sort()).toEqual(['Kit do contrato - versão 1.docx', 'Kit do contrato - versão 2.docx'])
    for (const k of kits) expect((await arquivos.ler(k.chaveArmazenamento)).length).toBeGreaterThan(0)
  })
})

describe('GGVP-136 · imprimir o kit e assinar no papel, sem o ZapSign', () => {
  /** Sobe o servidor de novo com outro conversor de PDF ou outro estado do ZapSign; o banco e os arquivos são os mesmos. */
  async function reiniciar(opcoes: { conversor?: ConversorDePdf | null; zapsign?: boolean }) {
    await app.close()
    app = criarServidor({ banco, agora: () => relogio, armazenamento: arquivos, zapsign: false, conversor: null, ...opcoes })
  }
  const PDF = Buffer.from('%PDF-1.7 do kit')

  it('CA5 · com o conversor, o kit sai em PDF para abrir no navegador, convertido do Word guardado na pasta do cliente', async () => {
    const recebidos: Buffer[] = []
    await reiniciar({ conversor: async (docx) => (recebidos.push(docx), PDF) })
    const { base } = await gerar(await lead())
    const r = await chamar('ana', 'GET', `${base}/kit`)
    expect([r.statusCode, r.headers['content-type'], r.rawPayload]).toEqual([200, 'application/pdf', PDF])
    expect(r.headers['content-disposition']).toBe("inline; filename*=UTF-8''Kit%20do%20contrato%20-%20vers%C3%A3o%201.pdf")
    expect([r.headers['x-content-type-options'], r.headers['content-security-policy']]).toEqual(['nosniff', "sandbox; default-src 'none'"])
    expect(textoDoDocx(recebidos[0])).toContain('Joana Ribeiro')
  })

  it('CA5 · sem o conversor, o portal entrega o Word preenchido para baixar e imprimir', async () => {
    await reiniciar({ conversor: null })
    const { base } = await gerar(await lead())
    const r = await chamar('ana', 'GET', `${base}/kit`)
    expect([r.statusCode, r.headers['content-type']]).toEqual([200, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
    expect(r.headers['content-disposition']).toBe("attachment; filename*=UTF-8''Kit%20do%20contrato%20-%20vers%C3%A3o%201.docx")
    expect(textoDoDocx(r.rawPayload).split('\n')[1]).toBe('São Paulo, 8 de outubro de 2026.')
  })

  it('CA5 · o Word também sai a pedido, mesmo com o conversor; o conversor que falha dá 502 e o Word segue disponível', async () => {
    await reiniciar({ conversor: async () => Promise.reject(new Error('o Gotenberg caiu')) })
    const { base } = await gerar(await lead())
    const falhou = await chamar('ana', 'GET', `${base}/kit`)
    expect([falhou.statusCode, falhou.json()]).toEqual([502, { erro: 'O conversor de PDF não respondeu. Baixe o Word e imprima por ele.' }])
    const word = await chamar('ana', 'GET', `${base}/kit?formato=docx`)
    expect([word.statusCode, textoDoDocx(word.rawPayload)]).toEqual([200, expect.stringContaining('Joana Ribeiro')])
  })

  it('só o Atendimento baixa o kit; sem kit gerado ou sem contrato, 404', async () => {
    await reiniciar({ conversor: null })
    const { base } = await gerar(await lead())
    expect((await chamar('julia', 'GET', `${base}/kit`)).statusCode).toBe(403)
    expect((await chamar('gabi', 'GET', `${base}/kit`)).statusCode).toBe(403)
    const { processo } = await fechou(await lead('Marta Lima', '11955554444', '11144477735'))
    expect(await json('ana', 'GET', `/api/processos/${processo.id}/contrato/kit`)).toEqual({ erro: 'Este contrato ainda não tem o kit gerado.' })
    expect(await json('ana', 'GET', '/api/processos/00000000-0000-4000-8000-000000000000/contrato/kit')).toEqual({ erro: 'Contrato não encontrado.' })
  })

  it('CA5 e CA8 · o servidor diz o que oferece: o PDF, se há conversor; a assinatura pelo celular, se o ZapSign está contratado', async () => {
    await reiniciar({ conversor: async () => PDF, zapsign: false })
    expect(await json('ana', 'GET', '/api/contrato/servicos')).toEqual({ zapsign: false, pdf: true })
    expect((await app.inject({ method: 'GET', url: '/api/contrato/servicos' })).statusCode).toBe(401)
    await reiniciar({ conversor: null, zapsign: true })
    expect(await json('ana', 'GET', '/api/contrato/servicos')).toEqual({ zapsign: true, pdf: false })
  })

  it('CA7 e CA8 · sem o ZapSign, o papel vale para qualquer entrevista, e o assinado digitalizado segue o caminho de sempre', async () => {
    const fichaId = await lead()
    const marcada = await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, {
      tipo: 'video', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false,
    })
    expect(marcada.resultado).toBe('marcado')
    await reiniciar({ zapsign: false })
    const { base } = await gerar(fichaId)
    expect(await json('ana', 'POST', `${base}/zapsign`)).toEqual({ erro: 'O ZapSign não está contratado: a assinatura é em papel.' })
    const impresso = await json('ana', 'POST', `${base}/impressao`)
    expect(impresso.contrato.assinatura).toMatchObject({ forma: 'papel', impressoEm: expect.any(String) })
    expect((await json('ana', 'POST', `${base}/digitalizacao`)).arquivo).toMatchObject({ tipo: 'contrato', origem: 'scanner', aguardaLeitura: true })
    expect((await json('ana', 'POST', `${base}/assinatura-em-papel`)).contrato.etapa).toBe('leitura')
    expect((await json('ana', 'POST', `${base}/leitura-simulada`)).contrato.etapa).toBe('conferir')
  })

  it('com o ZapSign contratado, a regra de antes continua: papel só na entrevista presencial', async () => {
    const fichaId = await lead()
    await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, {
      tipo: 'video', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false,
    })
    await reiniciar({ zapsign: true })
    const { base } = await gerar(fichaId)
    expect(await json('ana', 'POST', `${base}/impressao`)).toEqual({ erro: 'Papel só na entrevista presencial: a assinatura vai pelo ZapSign.' })
  })
})

