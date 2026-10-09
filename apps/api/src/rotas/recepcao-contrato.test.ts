import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { CONFERENCIAS } from '../../../web/src/regras/contrato.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
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

async function lead(nome = 'Joana Ribeiro', telefone = '11987654321', cpf?: string) {
  return (await json('ana', 'POST', '/api/fichas', { nome, idade: 66, pretende: 'Quer o BPC.', telefone, cpf, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
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
}

beforeEach(async () => {
  relogio = INICIO
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
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
    expect(oQue.at(-1)).toMatch(/^Gerou o contrato de .+ \(versão 1\)/)
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
    // Bloco 5a: o arquivo assinado fica na pasta do processo, na ficha do servidor.
    expect(retorno.ficha.arquivos).toContainEqual(expect.objectContaining({ nome: retorno.arquivo.nome, local: retorno.contrato.processoId, aguardaLeitura: true }))
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

    const digitalizado = await json('ana', 'POST', `${base}/digitalizacao`)
    const { arquivo } = digitalizado
    expect(arquivo).toMatchObject({ tipo: 'contrato', origem: 'scanner', aguardaLeitura: true })
    expect(digitalizado.ficha.arquivos).toContainEqual(arquivo)
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
    expect(corrigir.ficha.arquivos).toContainEqual(corrigir.arquivo)
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
