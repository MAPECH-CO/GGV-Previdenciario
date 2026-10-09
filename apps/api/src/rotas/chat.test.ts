import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RespostaDoChat } from '@ggv/contratos'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, chamadaIa, documentacaoMedica, documento, documentoMedico, eventoAuditoria, peticao, peticaoVersao, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MODELO_DA_REGRA } from './chat.ts'

const SENHA = 'senha-do-portal-1'
const CHAVE = { OPENAI_API_KEY: 'chave-de-teste' }
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

/**
 * CA4: o serviço de IA é um `fetch` falso. Cada chamada leva a próxima mensagem do roteiro (a resposta do modelo, com
 * ou sem ferramenta); `chamadas` guarda o que o kit mandou.
 */
let roteiro: Record<string, unknown>[] = []
let chamadas: { url: string; corpo: { messages: { role: string; content: unknown }[]; tools?: { function: { name: string } }[] } }[] = []
const falso: typeof fetch = async (url, init) => {
  chamadas.push({ url: String(url), corpo: JSON.parse(String(init?.body ?? '{}')) })
  const message = roteiro.shift() ?? { role: 'assistant', content: 'Resposta de teste.' }
  const corpo = { id: `chatcmpl-${chamadas.length}`, object: 'chat.completion', created: 0, model: 'gpt-4.1-mini', choices: [{ index: 0, message, finish_reason: 'tool_calls' in message ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
  return new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } })
}
const montar = (ambiente: Record<string, string> = CHAVE) => {
  app = criarServidor({ banco, agora: () => new Date('2026-10-09T15:00:00Z'), ia: criarIa({ banco, ambiente, fetch: falso }) })
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
async function perguntar(apelido: string, texto: string, processoId?: string) {
  const r = await app.inject({ method: 'POST', url: '/api/chat', cookies: await cookieDe(apelido), payload: { texto, ...(processoId ? { processoId } : {}) } })
  expect(r.statusCode, r.body).toBe(200)
  return RespostaDoChat.parse(r.json())
}
const registros = () => banco.select().from(chamadaIa)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  roteiro = []
  chamadas = []
  montar()
  for (const [apelido, perfil] of [
    ['ana', 'atendimento'],
    ['gabi', 'advogada'],
    ['julia', 'financeiro'],
    ['lauro', 'socio'],
    ['helena', 'senior'],
  ] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Vera Lúcia', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'administrativa', advogadaResponsavelId: ids.gabi }).returning()
  casoId = c.id
})
afterEach(() => fechar())

describe('GGVP-142 · as travas antes do modelo, como código (CA2)', () => {
  afterEach(() => expect(chamadas, 'a trava não chama o modelo').toEqual([]))

  it('16.2 · pular o parecer é recusado pelo G17, sem modelo', async () => {
    const r = await perguntar('gabi', 'Dá para liberar o caso da Vera sem o parecer?', casoId)
    expect(r).toMatchObject({ tipo: 'recusa', portao: 'G17' })
    expect(r.sugestao.modelo).toBe(MODELO_DA_REGRA)
    expect(r.sugestao.texto).toMatch(/^Não posso pular o parecer médico/)
  })

  it('16.2 · esconder a situação na perícia é recusado pelo G11 e vai ao histórico sem o texto do pedido', async () => {
    const r = await perguntar('ana', 'Como faço para esconder a renda do filho na avaliação social?', casoId)
    expect(r).toMatchObject({ tipo: 'recusa', portao: 'G11' })
    const [e] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'chat_recusa'))
    expect(e).toMatchObject({ quem: ids.ana, alvo: `caso:${casoId}` })
    expect(e.detalhe).toMatchObject({ portao: 'G11', perfil: 'atendimento' })
    expect(JSON.stringify(e.detalhe)).not.toContain('renda')
  })

  it('16.2 · "o que é o G8?" sai da regra, com a fonte', async () => {
    const r = await perguntar('julia', 'O que é o G8?')
    expect(r.tipo).toBe('resposta')
    expect(r.sugestao.texto).toMatch(/^G8: O aviso ao cliente só nasce depois do OK da advogada/)
    expect(r.sugestao.fontes).toEqual([{ tipo: 'regra', referencia: 'G8' }])
  })

  it('16.2 · os portões do pedido: a senha do gov.br (G9) e o protocolo sem o OK da sênior (G2)', async () => {
    expect(await perguntar('ana', 'Qual a senha do gov.br da Vera?')).toMatchObject({ tipo: 'recusa', portao: 'G9' })
    expect(await perguntar('gabi', 'Protocola o pedido da Vera no INSS', casoId)).toMatchObject({ tipo: 'recusa', portao: 'G2' })
  })

  it('16.2 · o pedido de outro perfil diz de quem é, sem cartão', async () => {
    const r = await perguntar('julia', 'Marca a perícia da Vera para amanhã', casoId)
    expect(r.tipo).toBe('resposta')
    expect(r.acao).toBeUndefined()
    expect(r.sugestao.texto).toMatch(/^«Marcar perícia» é do Jurídico administrativo/)
  })

  it('16.2 · pergunta vazia é recusada pelo contrato', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/chat', cookies: await cookieDe('ana'), payload: { texto: '  ' } })
    expect(r.statusCode).toBe(400)
  })
})

describe('GGVP-142 · o agente do motor (CA1, CA4)', () => {
  it('16.3 · a resposta vem do modelo, com o modelo, o link do caso e a chamada registrada como "chat"', async () => {
    roteiro = [{ role: 'assistant', content: 'O caso espera o laudo novo.' }]
    const r = await perguntar('ana', 'O que falta no caso?', casoId)
    expect(r).toMatchObject({ tipo: 'resposta', links: [{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }] })
    expect(r.sugestao).toMatchObject({ texto: 'O caso espera o laudo novo.', modelo: 'gpt-4.1-mini', alerta: null })
    expect(chamadas.map((c) => c.url)).toEqual(['https://api.openai.com/v1/chat/completions'])
    const [chamada] = await registros()
    expect(chamada).toMatchObject({ id: r.sugestao.chamadaId, finalidade: 'chat', situacao: 'ok', casoId, pedidaPor: ids.ana, saida: 'O caso espera o laudo novo.' })
  })

  it('16.3 · a advogada e o Sócio usam a finalidade com saúde: sem a autorização do escritório, nada vai ao modelo', async () => {
    const r = await perguntar('gabi', 'O que falta no caso?', casoId)
    expect(r.sugestao.texto).toBe('O chat não respondeu: a IA não está autorizada a ler dado de saúde neste ambiente.')
    expect(chamadas).toEqual([])
    expect(await registros()).toMatchObject([{ finalidade: 'chat_juridico', situacao: 'recusada' }])

    montar({ ...CHAVE, IA_PERMITE_DADO_DE_SAUDE: 'sim' })
    roteiro = [{ role: 'assistant', content: 'Resumo para o Sócio.' }]
    expect((await perguntar('lauro', 'Resumo do caso', casoId)).sugestao.texto).toBe('Resumo para o Sócio.')
    expect((await registros()).at(-1)).toMatchObject({ finalidade: 'chat_juridico', situacao: 'ok', pedidaPor: ids.lauro })
  })

  it('16.3 · sem a chave, o chat diz que a IA está desligada e dá o link do caso, sem inventar', async () => {
    montar({})
    const r = await perguntar('ana', 'O que falta no caso?', casoId)
    expect(r.sugestao.texto).toBe('O chat não respondeu: a IA está desligada neste ambiente (falta a chave do serviço).')
    expect(r.links).toEqual([{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }])
    expect(await registros()).toMatchObject([{ finalidade: 'chat', situacao: 'desligada' }])
  })

  it('16.3 · CA2 · para quem não vê dado de saúde, a resposta com código de doença não chega à tela', async () => {
    roteiro = [{ role: 'assistant', content: 'A cliente tem CID M54.5 no laudo.' }]
    const r = await perguntar('ana', 'O que diz o laudo?', casoId)
    expect(r.sugestao.texto).toBe('O chat não respondeu: a IA não respondeu agora. Tente de novo em instantes.')
    expect(await registros()).toMatchObject([{ finalidade: 'chat', situacao: 'recusada', alerta: 'saída com código de doença (G20)' }])
  })

  it('16.3 · o cliente citado pelo nome inteiro vira o caso do contexto; nomes de dois clientes viram a pergunta "qual deles?"', async () => {
    roteiro = [{ role: 'assistant', content: 'Certo.' }]
    expect((await perguntar('ana', 'O que falta para a Vera Lúcia?')).links).toEqual([{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }])
    const [p] = await banco.insert(pessoa).values({ nome: 'Rui Barbosa', situacao: 'cliente' }).returning()
    await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'aposentadoria_idade', fase: 'administrativa' })
    const r = await perguntar('ana', 'Compare a Vera Lúcia com o Rui Barbosa')
    expect(r).toMatchObject({ tipo: 'pergunta', opcoes: expect.arrayContaining(['Vera Lúcia', 'Rui Barbosa']) })
  })
})

/** A mensagem do modelo que pede uma ferramenta, no formato do chat completions. */
const ferramenta = (name: string, args: Record<string, unknown> = {}) => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id: `call_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
})
/** O que a ferramenta devolveu ao modelo, na chamada seguinte. */
const saidaDaFerramenta = (i: number) => String(chamadas[i].corpo.messages.find((m) => m.role === 'tool')?.content ?? '')

describe('GGVP-142 · as ferramentas de leitura (CA1, CA2)', () => {
  async function laudoNoCaso() {
    const [d] = await banco
      .insert(documento)
      .values({ casoId, tipo: 'laudo', sensivel: true, chaveArmazenamento: 'teste/laudo', nomeOriginal: 'laudo-ortopedista.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h1', origem: 'portal' })
      .returning()
    await banco.insert(documentoMedico).values({ documentoId: d.id, tipo: 'laudo', dataEmissao: '2026-09-20', cid: 'M54.5' })
  }

  it('16.4 · o modelo recebe as quatro ferramentas de leitura e, com um caso, a de criar tarefa (a de ação pede o clique)', async () => {
    await perguntar('ana', 'Oi', casoId)
    expect(chamadas[0].corpo.tools?.map((t) => t.function.name).sort()).toEqual(['buscar_no_acervo', 'criar_tarefa', 'explicar_portao', 'ler_caso', 'minhas_tarefas'])
  })

  it('16.4 · o caso vem da página do processo na visão do Atendimento: sem o laudo nem o CID; a fonte é o caso', async () => {
    await laudoNoCaso()
    roteiro = [ferramenta('ler_caso'), { role: 'assistant', content: 'O caso está na via administrativa.' }]
    const r = await perguntar('ana', 'Como está o caso?', casoId)
    expect(r.sugestao.texto).toBe('O caso está na via administrativa.')
    const lido = saidaDaFerramenta(1)
    expect(lido).toMatch(/^<conteudo>/)
    expect(lido).toContain('"fase":"administrativa"')
    expect(lido).toContain('"pessoa":{"nome":"Vera Lúcia"}')
    for (const dado of ['M54.5', 'laudo-ortopedista', 'cpf', 'nascimento']) expect(lido).not.toContain(dado)
    expect(r.sugestao.fontes).toEqual([{ tipo: 'caso', referencia: `caso:${casoId}` }])
  })

  it('16.4 · o Sócio recebe o resumo médico do caso, por exceção do chat, com o acesso registrado', async () => {
    montar({ ...CHAVE, IA_PERMITE_DADO_DE_SAUDE: 'sim' })
    await banco.insert(documentacaoMedica).values({
      casoId,
      parte: 'parecer',
      documento: {
        analises: [{ quando: 'a1', documentos: [{ tipo: 'laudo', data: '2026-09-20', resumo: 'Lombalgia com limitação para esforço.' }] }],
        registros: [{ situacao: 'suficiente', analise: 'a1' }],
      },
    })
    roteiro = [ferramenta('ler_caso'), { role: 'assistant', content: 'Parecer suficiente.' }]
    await perguntar('lauro', 'Como está o caso?', casoId)
    expect(saidaDaFerramenta(1)).toContain('Resumo médico do caso (só para o Sócio, no chat):\nParecer médico: suficiente.\nlaudo de 2026-09-20: Lombalgia com limitação para esforço.')
    expect(await banco.select().from(acessoDadoSensivel)).toMatchObject([{ usuarioId: ids.lauro, perfil: 'socio', casoId, recurso: 'chat:documentacao_medica' }])
  })

  it('16.4 · o acervo traz à advogada o trecho de outro caso, com a fonte; as tarefas e o portão também viram fonte', async () => {
    montar({ ...CHAVE, IA_PERMITE_DADO_DE_SAUDE: 'sim' })
    const [p] = await banco.insert(pessoa).values({ nome: 'Joana Pereira Lima', situacao: 'cliente' }).returning()
    const [outro] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
    const [pe] = await banco.insert(peticao).values({ casoId: outro.id, tipo: 'inicial' }).returning()
    await banco.insert(peticaoVersao).values({ peticaoId: pe.id, numero: 1, conteudo: 'A renda per capita não afasta a miserabilidade.', hash: 'h', geradaPor: 'gabi', aprovadaEm: new Date() })
    roteiro = [
      ferramenta('buscar_no_acervo', { consulta: 'renda per capita' }),
      ferramenta('minhas_tarefas'),
      ferramenta('explicar_portao', { portao: 'G8' }),
      { role: 'assistant', content: 'Há um caso parecido no acervo.' },
    ]
    const r = await perguntar('gabi', 'Tem caso parecido com renda per capita?', casoId)
    expect(saidaDaFerramenta(1)).toContain('miserabilidade')
    expect(r.sugestao.fontes).toEqual([
      expect.objectContaining({ tipo: 'acervo', referencia: `caso:${outro.id}` }),
      { tipo: 'regra', referencia: 'tarefas da Central' },
      { tipo: 'regra', referencia: 'G8' },
    ])
  })
})

describe('GGVP-142 · a ação só com o clique de quem pediu (CA3)', () => {
  const COM_SAUDE = { ...CHAVE, IA_PERMITE_DADO_DE_SAUDE: 'sim' }
  const confirmar = async (apelido: string, id: string, corpo: Record<string, unknown> = {}) =>
    app.inject({ method: 'POST', url: `/api/chat/acoes/${id}`, cookies: await cookieDe(apelido), payload: corpo })

  it('16.5 · criar tarefa: o pedido vira cartão e nada acontece antes do clique; o clique cria a tarefa na Central da Ana, com "feito pelo chat"', async () => {
    montar(COM_SAUDE)
    roteiro = [ferramenta('criar_tarefa', { acao: 'Cobrar documento', para: 'Ana', prazo: '2026-10-12' })]
    const r = await perguntar('gabi', 'Cria uma tarefa para a Ana cobrar o laudo da Vera', casoId)
    expect(r).toMatchObject({
      tipo: 'acao',
      acao: { tipo: 'criar-tarefa', titulo: 'Vera Lúcia · Cobrar documento', responsavel: { nome: 'ana', setor: 'Atendimento' }, rotuloConfirmar: 'Criar tarefa' },
    })
    expect(await banco.select().from(tarefa)).toEqual([])

    roteiro = [{ role: 'assistant', content: 'Feito.' }]
    const c = await confirmar('gabi', r.acao!.id)
    expect(c.statusCode, c.body).toBe(200)
    expect(c.json()).toEqual({ estado: 'feito', texto: '✓ Feito: tarefa «Vera Lúcia · Cobrar documento» criada para ana.', links: [{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }] })
    expect(await banco.select().from(tarefa)).toMatchObject([{ casoId, titulo: 'Cobrar documento', perfilDono: 'atendimento', responsavelId: ids.ana, prazo: '2026-10-12' }])
    const [e] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'tarefa_criada_pelo_chat'))
    expect(e).toMatchObject({ quem: ids.gabi, alvo: `caso:${casoId}` })
    expect(e.detalhe).toMatchObject({ peloChat: true, titulo: 'Cobrar documento' })
    expect((await confirmar('gabi', r.acao!.id)).statusCode, 'o mesmo cartão não serve duas vezes').toBe(410)
  })

  it('16.5 · outra pessoa não confirma; cancelar descarta o cartão', async () => {
    montar(COM_SAUDE)
    roteiro = [ferramenta('criar_tarefa', { acao: 'Cobrar documento', para: 'Ana', prazo: null })]
    const r = await perguntar('gabi', 'Cria uma tarefa para a Ana cobrar o laudo', casoId)
    expect((await confirmar('ana', r.acao!.id)).statusCode).toBe(403)
    expect(await banco.select().from(tarefa)).toEqual([])
    const d = await app.inject({ method: 'DELETE', url: `/api/chat/acoes/${r.acao!.id}`, cookies: await cookieDe('gabi') })
    expect(d.statusCode).toBe(204)
    expect((await confirmar('gabi', r.acao!.id)).statusCode).toBe(410)
    expect(await banco.select().from(tarefa)).toEqual([])
  })

  it('16.5 · CA2 · a ação fora da lista de quem vai fazer não é feita, mesmo confirmada', async () => {
    montar(COM_SAUDE)
    roteiro = [ferramenta('criar_tarefa', { acao: 'Despachar caso', para: 'Ana', prazo: null })]
    const r = await perguntar('gabi', 'Cria uma tarefa para a Ana despachar o caso', casoId)
    roteiro = [{ role: 'assistant', content: 'Não deu.' }]
    const c = await confirmar('gabi', r.acao!.id)
    expect(c.statusCode).toBe(400)
    expect(c.json().erro).toBe('Não foi feito: «Despachar caso» não está na lista de ações de ana.')
    expect(await banco.select().from(tarefa)).toEqual([])
  })

  it('16.5 · pedir a peça é só da advogada e da sênior; o clique abre "Pedir petição" para ela, e a IA não assina (G6)', async () => {
    await perguntar('ana', 'Oi', casoId)
    expect(chamadas[0].corpo.tools?.map((t) => t.function.name)).not.toContain('pedir_peca')

    montar(COM_SAUDE)
    chamadas = []
    roteiro = [ferramenta('pedir_peca', { peca: 'Petição inicial' })]
    const r = await perguntar('gabi', 'Faz a petição inicial da Vera', casoId)
    expect(chamadas[0].corpo.tools?.map((t) => t.function.name)).toContain('pedir_peca')
    expect(r.acao).toMatchObject({ tipo: 'pedir-peca', titulo: 'Vera Lúcia · Petição inicial', travas: expect.arrayContaining([expect.stringContaining('(G6)')]) })
    roteiro = [{ role: 'assistant', content: 'Aberta.' }]
    const c = await confirmar('gabi', r.acao!.id)
    expect(c.json()).toMatchObject({ estado: 'feito', links: [{ rotulo: 'Abrir a petição', href: `/casos/${casoId}/peticao` }] })
    expect(await banco.select().from(tarefa)).toMatchObject([{ casoId, titulo: 'Pedir petição', passo: 'D3.05', perfilDono: 'advogada', responsavelId: ids.gabi }])
  })
})

describe('GGVP-142 · o que depende de enviar arquivo leva à tela (CA3)', () => {
  afterEach(() => expect(chamadas, 'o anexo não chama o modelo').toEqual([]))
  const comArquivos = async (apelido: string, texto: string, nomes: string[], processoId?: string) => {
    const payload = { texto, anexos: nomes.map((nome) => ({ nome, tamanho: 1000 })), ...(processoId ? { processoId } : {}) }
    const r = await app.inject({ method: 'POST', url: '/api/chat', cookies: await cookieDe(apelido), payload })
    expect(r.statusCode, r.body).toBe(200)
    return RespostaDoChat.parse(r.json())
  }

  it('16.7 · o laudo, o comprovante do INSS e o do pagamento levam ao caso, à perícia e à prestação, sem executar nada', async () => {
    const laudo = await comArquivos('ana', 'Subir laudo novo', ['laudo-ortopedista.pdf'], casoId)
    expect(laudo.sugestao.texto).toMatch(/^O chat ainda não sobe arquivo no servidor\. Para subir o laudo novo/)
    expect(laudo.links).toEqual([{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }])
    expect((await comArquivos('ana', 'Comprovante da perícia do INSS', ['agendamento.pdf'], casoId)).links).toEqual([{ rotulo: 'Abrir a perícia', href: `/casos/${casoId}/pericia` }])
    expect((await comArquivos('julia', 'Comprovante de pagamento do RPV', ['rpv.pdf'], casoId)).links).toEqual([{ rotulo: 'Abrir a prestação de contas', href: `/casos/${casoId}/prestacao` }])
    expect(await banco.select().from(tarefa)).toEqual([])
  })

  it('16.7 · o lote do acervo leva à base do acervo; sem caso, pede o nome do cliente', async () => {
    expect((await comArquivos('helena', 'Subir no acervo os processos antigos', ['a.pdf', 'b.pdf'])).links).toEqual([{ rotulo: 'Abrir a base do acervo', href: '/gestao/resultados' }])
    const semCaso = await comArquivos('ana', 'Documento novo', ['rg.pdf'])
    expect(semCaso.sugestao.texto).toMatch(/Diga de qual cliente é, com o nome completo\.$/)
    expect(semCaso.links).toEqual([])
  })
})

describe('GGVP-142 · quem não abre caso conversa sem caso (CA2, permissão)', () => {
  it('16.5 · o Financeiro cita o cliente e pede uma tarefa: o chat fica sem caso, sem ação no caso e sem o link', async () => {
    roteiro = [{ role: 'assistant', content: 'Não consigo abrir o caso pelo seu perfil.' }]
    const r = await perguntar('julia', 'Cria uma tarefa para a Ana cobrar o laudo da Vera Lúcia')
    expect(r.links).toEqual([])
    expect(chamadas[0].corpo.tools?.map((t) => t.function.name)).not.toContain('criar_tarefa')
    expect(await banco.select().from(tarefa)).toEqual([])
    expect((await registros())[0]).toMatchObject({ casoId: null })
  })
})
