// GGVP-142: o chat das Centrais e a aba Suporte pelo servidor (POST /api/chat). Antes do modelo, como código, as mesmas
// regras puras da tela (regras/chat.ts, parecer.ts e pericia.ts): as recusas, o portão citado, os portões do pedido e o
// pedido de outro perfil. Nesses casos o modelo não é chamado (CA2). Depois, o agente do motor (ADR-016), com o caso que
// o perfil vê. O chat é de todos os perfis: só a sessão, e cada dado segue a permissão de quem pergunta.
import { randomUUID } from 'node:crypto'
import { ConfirmacaoDoCartao, PerguntaDoChat, pode, type CartaoDeAcao, type Erro, type FonteDaIa, type LinkDoChat, type RespostaDoChat } from '@ggv/contratos'
import { tool, type Tool } from '@openai/agents'
import { and, desc, eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, documentacaoMedica, etapa, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { MSG_IA_DESLIGADA, MSG_IA_SEM_RESPOSTA, MSG_IA_SEM_SAUDE } from '../fluxo/transcricao.ts'
import { MSG_SEM_REFERENCIA, buscarNoAcervo } from '../ia/acervo.ts'
import { comoDado, conversar, type Rodada } from '../ia/chat.ts'
import type { Ia } from '../ia/ia.ts'
import { registrarHistorico } from '../sessao/rotas.ts'
import {
  ACOES_DO_PERFIL,
  acaoDaLista,
  entenderPedido,
  foraDoPerfil,
  grupoDoPerfil,
  portaoCitado,
  portaoDoPedido,
  PORTOES,
  semAcento,
  tipoDoAnexo,
  tituloDaTarefa,
} from '../../../web/src/regras/chat.ts'
import { recusaDoChat } from '../../../web/src/regras/parecer.ts'
import { recusaDoChatNaPericia } from '../../../web/src/regras/pericia.ts'
import { SETOR } from './processo.ts'
import { UUID } from './recepcao.ts'

/** A resposta que sai do código, não do modelo (CA2): não há chamada de IA a registrar. */
export const MODELO_DA_REGRA = 'regra do portal (sem IA)'

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** O grupo da lista fixa da tela tem hífen ("juridico-adm"); o perfil do servidor, sublinhado ("juridico_adm"). */
export const grupoDe = (perfil: string | undefined) => grupoDoPerfil(perfil?.replace('_', '-'))

/**
 * Quem recebe conteúdo médico no chat: o Jurídico, pela matriz, e o Sócio, por exceção só do chat (Mateus, 09/10), com o
 * acesso registrado.
 */
export const veSaudeNoChat = (perfil: string | null | undefined) => pode(perfil ?? null, 'dado_saude.ver_detalhe') || perfil === 'socio'

function daRegra(tipo: RespostaDoChat['tipo'], texto: string, fontes: FonteDaIa[], agora: Date, portao?: string): RespostaDoChat {
  const sugestao = { chamadaId: randomUUID(), sugestao: true as const, texto, fontes, modelo: MODELO_DA_REGRA, geradaEm: agora.toISOString(), alerta: null }
  return { tipo, sugestao, links: [], ...(portao ? { portao } : {}) }
}
const regra = (portao: string): FonteDaIa => ({ tipo: 'regra', referencia: portao })

/** O caso do contexto, para o portão do protocolo: a fase e se a sênior aprovou o pedido (D2.01). */
async function contextoDoCaso(banco: Banco, casoId: string) {
  const [c] = await banco.select({ fase: caso.fase }).from(caso).where(eq(caso.id, casoId))
  if (!c) return {}
  const [aprovado] = await banco
    .select({ id: etapa.id })
    .from(etapa)
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.01'), eq(etapa.situacao, 'concluida')))
    .limit(1)
  return { fase: c.fase as 'administrativa' | 'judicial', aprovadoPelaSenior: Boolean(aprovado) }
}

/**
 * CA2: o que o código responde antes do modelo, na ordem da tela: pular o parecer (G17), esconder a situação na perícia
 * (G11, vai ao histórico), "o que é o G8?", os portões do pedido e o pedido de outro perfil. Nulo: segue para o modelo.
 */
export function antesDoModelo(
  texto: string,
  perfil: string | undefined,
  caso: { fase?: 'administrativa' | 'judicial'; aprovadoPelaSenior?: boolean },
  agora: Date,
): { resposta: RespostaDoChat; registrar?: true } | null {
  const parecer = recusaDoChat(texto)
  if (parecer) return { resposta: daRegra('recusa', parecer, [regra('G17')], agora, 'G17') }
  const fraude = recusaDoChatNaPericia(texto)
  if (fraude) return { resposta: daRegra('recusa', fraude, [regra('G11')], agora, 'G11'), registrar: true }

  const g = portaoCitado(texto)
  if (g && !/\b(cri|abr)\w* (uma |a )?tarefa/i.test(texto)) {
    return { resposta: daRegra('resposta', `${g}: ${PORTOES[g]} Nenhuma tela nem o chat contornam um portão.`, [regra(g)], agora) }
  }

  const intencao = entenderPedido(texto)
  const portao = portaoDoPedido(intencao, texto, caso)
  if (portao) return { resposta: daRegra('recusa', portao.texto, portao.portao ? [regra(portao.portao)] : [], agora, portao.portao) }

  const fora = foraDoPerfil(intencao, grupoDe(perfil))
  if (fora) {
    const texto = `«${fora.acao}» é ${fora.quem}: não está na lista do seu perfil. Peça a tarefa para quem faz, e eu mostro o cartão.`
    return { resposta: daRegra('resposta', texto, [{ tipo: 'regra', referencia: 'lista fixa de ações do perfil' }], agora) }
  }
  return null
}

type Alvo = { casoId: string; beneficio: string | null }
const palavras = (texto: string) => ` ${semAcento(texto).replace(/[^a-z0-9]+/g, ' ').trim()} `

/** O caso aberto no chat (o `processoId` do contexto). */
async function umCaso(banco: Banco, casoId: string): Promise<Alvo | null> {
  const [c] = await banco.select({ casoId: caso.id, beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
  return c ?? null
}

/**
 * O cliente citado pelo nome inteiro, entre as pessoas que têm caso; o caso mais novo dele. Dois clientes na pergunta,
 * ou nomes iguais: a pergunta "qual deles?". ponytail: lê as pessoas com caso a cada pergunta; com milhares, buscar no banco.
 */
async function casoCitado(banco: Banco, texto: string): Promise<Alvo | { opcoes: string[] } | null> {
  const t = palavras(texto)
  const linhas = await banco
    .select({ casoId: caso.id, beneficio: caso.beneficio, nome: pessoa.nome })
    .from(caso)
    .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .orderBy(desc(caso.criadoEm))
  const citados = new Map<string, Alvo>()
  for (const l of linhas) {
    const nome = palavras(l.nome)
    if (nome.trim().split(' ').length >= 2 && t.includes(nome) && !citados.has(l.nome)) citados.set(l.nome, { casoId: l.casoId, beneficio: l.beneficio })
  }
  if (citados.size > 1) return { opcoes: [...citados.keys()] }
  return citados.values().next().value ?? null
}

const SEM_IA: Record<Extract<Rodada, { tipo: 'sem-ia' }>['motivo'], string> = {
  desligada: `O chat não respondeu: ${MSG_IA_DESLIGADA}.`,
  'sem-saude': `O chat não respondeu: ${MSG_IA_SEM_SAUDE}.`,
  falhou: `O chat não respondeu: ${MSG_IA_SEM_RESPOSTA}. Tente de novo em instantes.`,
}

/** A resposta da rodada do agente, com os links do código (o caso), nunca do texto do modelo (CA2). */
function daRodada(rodada: Rodada, casoId: string | null, fontes: FonteDaIa[], agora: Date): RespostaDoChat {
  const links: LinkDoChat[] = casoId ? [{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }] : []
  if (rodada.tipo === 'resposta') {
    const sugestao = { chamadaId: rodada.chamadaId, sugestao: true as const, texto: rodada.texto, fontes, modelo: rodada.modelo, geradaEm: agora.toISOString(), alerta: rodada.alerta }
    return { tipo: 'resposta', sugestao, links }
  }
  if (rodada.tipo === 'sem-ia') return { ...daRegra('resposta', SEM_IA[rodada.motivo], [], agora), links }
  return { ...daRegra('resposta', SEM_IA.falhou, [], agora), links }
}

/**
 * CA3: o que depende de enviar arquivo (laudo, comprovante do INSS, comprovante do pagamento, documento, lote do acervo)
 * leva à tela onde a pessoa sobe e confere, até a rota de envio existir no servidor (Recepção, PR #22; GGVP-55).
 */
function arquivosPeloChat(texto: string, anexos: { nome: string }[], casoId: string | null, agora: Date): RespostaDoChat {
  const tipo = tipoDoAnexo(texto, anexos.map((a) => a.nome))
  const doCaso = (sufixo: string, rotulo: string): LinkDoChat[] => (casoId ? [{ rotulo, href: `/casos/${casoId}${sufixo}` }] : [])
  const destino = {
    laudo: { texto: 'Para subir o laudo novo, abra o caso e envie pela pasta do cliente: o Jurídico confere o laudo (G17).', links: doCaso('', 'Abrir o caso') },
    'comprovante-inss': {
      texto: 'Para marcar a perícia com o comprovante do INSS, abra a perícia do caso: lá a IA lê a data, a hora e o local, e você confere antes de marcar.',
      links: doCaso('/pericia', 'Abrir a perícia'),
    },
    'comprovante-rpv': {
      texto: 'Para lançar o comprovante do pagamento, abra a prestação de contas do caso: o aviso ao cliente só sai depois do OK da advogada (G8).',
      links: doCaso('/prestacao', 'Abrir a prestação de contas'),
    },
    documento: { texto: 'Para enviar o documento, abra o caso e suba pela pasta do cliente: a Documentação confere a leitura.', links: doCaso('', 'Abrir o caso') },
    acervo: { texto: 'Para subir processos no acervo, use a base do acervo na Gestão.', links: [{ rotulo: 'Abrir a base do acervo', href: '/gestao/resultados' }] },
  }[tipo]
  const semCaso = casoId || tipo === 'acervo' ? '' : ' Diga de qual cliente é, com o nome completo.'
  const resposta = daRegra('resposta', `O chat ainda não sobe arquivo no servidor. ${destino.texto}${semCaso}`, [{ tipo: 'regra', referencia: 'envio de arquivo pela tela' }], agora)
  return { ...resposta, links: destino.links }
}

/** Sem caso no contexto, a busca no acervo não tem caso a deixar de fora. */
const SEM_CASO = '00000000-0000-0000-0000-000000000000'

/**
 * O que as ferramentas de uma pergunta conhecem: quem pergunta (com a sessão dele), o caso e as fontes usadas. Na
 * confirmação do cartão, também o responsável que a pessoa trocou, e o resultado (ou a falha) da ação.
 */
type Ambiente = {
  app: FastifyInstance
  banco: Banco
  ia: Ia
  quem: string
  perfil: string | null
  cookie: string
  alvo: Alvo | null
  saude: boolean
  fontes: FonteDaIa[]
  evento: (acao: string, alvo: string, detalhe: Record<string, unknown>) => Promise<unknown>
  confirmacao?: { responsavel?: string }
  resultado?: { texto: string; links: LinkDoChat[] }
  falha?: string
}

/**
 * A exceção do chat (Mateus, 09/10): o Sócio recebe o resumo médico do caso (o último parecer registrado e os documentos
 * da análise que ele conferiu), com o acesso registrado. A página do processo não dá isso ao Sócio, pela matriz.
 */
async function resumoMedicoParaOSocio(x: Ambiente, casoId: string) {
  const [d] = await x.banco
    .select({ documento: documentacaoMedica.documento })
    .from(documentacaoMedica)
    .where(and(eq(documentacaoMedica.casoId, casoId), eq(documentacaoMedica.parte, 'parecer')))
  type Parecer = { registros?: { situacao: string; analise: string }[]; analises?: { quando: string; documentos?: { tipo: string; data: string; resumo?: string }[] }[] }
  const doc = d?.documento as Parecer | undefined
  const ultimo = doc?.registros?.at(-1)
  if (!ultimo) return ''
  await x.banco.insert(acessoDadoSensivel).values({ usuarioId: x.quem, perfil: 'socio', casoId, recurso: 'chat:documentacao_medica' })
  const documentos = doc?.analises?.find((a) => a.quando === ultimo.analise)?.documentos ?? []
  const linhas = [`Parecer médico: ${ultimo.situacao}.`, ...documentos.filter((m) => m.resumo).map((m) => `${m.tipo} de ${m.data}: ${m.resumo}`)]
  return `\n\nResumo médico do caso (só para o Sócio, no chat):\n${linhas.join('\n')}`
}

/**
 * CA1, CA2: as ferramentas de leitura do agente. O caso e as tarefas vêm das rotas da tela, com a sessão de quem pergunta:
 * o modelo só vê o que o perfil vê, e o acesso a dado de saúde fica registrado pela própria rota.
 */
function ferramentasDeLeitura(x: Ambiente): Tool[] {
  return [
    tool({
      name: 'ler_caso',
      description: 'Lê o caso do contexto como o perfil da pessoa vê: situação, etapas, tarefas abertas com prazo, documentos (sem conteúdo) e a perícia.',
      parameters: z.object({}),
      execute: async () => {
        if (!x.alvo) return 'Nenhum caso no contexto: peça o nome completo do cliente.'
        const r = await x.app.inject({ method: 'GET', url: `/api/casos/${x.alvo.casoId}/processo`, headers: { cookie: x.cookie } })
        if (r.statusCode !== 200) return 'O perfil da pessoa não abre este caso.'
        x.fontes.push({ tipo: 'caso', referencia: `caso:${x.alvo.casoId}` })
        // O modelo não precisa do CPF nem da data de nascimento para responder (LGPD: o mínimo).
        const { pessoa: quem, ...resto } = r.json() as { pessoa?: { nome: string } }
        const visto = JSON.stringify({ ...resto, ...(quem ? { pessoa: { nome: quem.nome } } : {}) })
        return comoDado(`${visto}${x.perfil === 'socio' ? await resumoMedicoParaOSocio(x, x.alvo.casoId) : ''}`)
      },
    }),
    tool({
      name: 'buscar_no_acervo',
      description: 'Busca no acervo da casa casos parecidos (petições aprovadas, decisões, motivos de indeferimento, pareceres e perícias conferidos), sem dado pessoal.',
      parameters: z.object({ consulta: z.string().min(3).max(300) }),
      execute: async ({ consulta }) => {
        const achados = await buscarNoAcervo(x.banco, { casoId: x.alvo?.casoId ?? SEM_CASO, beneficio: x.alvo?.beneficio ?? null, consulta, saude: x.saude, ia: x.ia })
        x.fontes.push(...achados)
        return achados.length ? comoDado(achados.map((f) => f.trecho).join('\n')) : MSG_SEM_REFERENCIA
      },
    }),
    tool({
      name: 'minhas_tarefas',
      description: 'As tarefas abertas da pessoa, como na Central dela, com o cliente, o prazo e a urgência.',
      parameters: z.object({}),
      execute: async () => {
        const r = await x.app.inject({ method: 'GET', url: '/api/tarefas', headers: { cookie: x.cookie } })
        if (r.statusCode !== 200) return 'Não deu para ler as tarefas agora.'
        x.fontes.push({ tipo: 'regra', referencia: 'tarefas da Central' })
        return comoDado(r.body)
      },
    }),
    tool({
      name: 'explicar_portao',
      description: 'Explica um portão de governança do escritório (G1 a G22).',
      parameters: z.object({ portao: z.string().regex(/^G\d{1,2}$/) }),
      execute: async ({ portao }) => {
        if (!PORTOES[portao]) return 'Portão desconhecido.'
        x.fontes.push(regra(portao))
        return `${portao}: ${PORTOES[portao]}`
      },
    }),
  ]
}

type PessoaDoEscritorio = { id: string; nome: string; perfil: string; setor: string }

async function pessoasDoEscritorio(banco: Banco): Promise<PessoaDoEscritorio[]> {
  const usuarios = await banco.select({ id: usuario.id, nome: usuario.nome, perfis: usuario.perfis }).from(usuario)
  return usuarios.filter((u) => u.perfis.length).map((u) => ({ id: u.id, nome: u.nome, perfil: u.perfis[0], setor: SETOR[u.perfis[0]] ?? 'Sem setor' }))
}

/** A regra do responsável (CA2): a pessoa citada pelo nome (o primeiro nome basta). Sem ela, a pessoa escolhe no cartão. */
function responsavelCitado(para: string, pessoas: PessoaDoEscritorio[]) {
  const t = palavras(para)
  return pessoas.find((p) => t.includes(` ${palavras(p.nome).trim().split(' ')[0]} `))
}

async function clienteDoCaso(banco: Banco, casoId: string) {
  const [c] = await banco.select({ id: pessoa.id, nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
  return c
}

const falhou = (x: Ambiente, motivo: string) => {
  x.falha = motivo
  return `Não foi feito: ${motivo}`
}

/** CA3: criar tarefa, depois do clique. A ação vem da lista fixa de quem vai fazer (CA2); o histórico guarda "feito pelo chat". */
async function criarTarefaPeloChat(x: Ambiente, acao: string, para: string, prazo: string | null) {
  const casoId = x.alvo!.casoId
  const pessoas = await pessoasDoEscritorio(x.banco)
  const quem = x.confirmacao?.responsavel ? pessoas.find((p) => p.nome === x.confirmacao!.responsavel) : responsavelCitado(para, pessoas)
  if (!quem) return falhou(x, 'escolha quem vai fazer a tarefa.')
  const grupo = grupoDe(quem.perfil)
  const daLista = ACOES_DO_PERFIL[grupo].find((a) => semAcento(a) === semAcento(acao)) ?? acaoDaLista(acao, grupo)
  if (!daLista) return falhou(x, `«${acao}» não está na lista de ações de ${quem.nome}.`)
  const cliente = await clienteDoCaso(x.banco, casoId)
  await x.banco.insert(tarefa).values({ casoId, titulo: daLista, perfilDono: quem.perfil, responsavelId: quem.id, prazo })
  await x.evento('tarefa_criada_pelo_chat', `caso:${casoId}`, { titulo: daLista, responsavel: quem.id, peloChat: true })
  x.resultado = { texto: `✓ Feito: tarefa «${tituloDaTarefa(cliente.nome, daLista)}» criada para ${quem.nome}.`, links: [{ rotulo: 'Abrir o caso', href: `/casos/${casoId}` }] }
  return x.resultado.texto
}

/**
 * CA3: pedir a peça, depois do clique. A IA não assina nem pede sozinha (G6): abre para quem pediu a tarefa "Pedir
 * petição", com a minuta pronta na tela da petição, e o pedido de verdade sai de lá, com o G17.
 */
async function pedirPecaPeloChat(x: Ambiente, peca: string) {
  const casoId = x.alvo!.casoId
  const cliente = await clienteDoCaso(x.banco, casoId)
  await x.banco.insert(tarefa).values({ casoId, passo: 'D3.05', titulo: 'Pedir petição', perfilDono: x.perfil, responsavelId: x.quem })
  await x.evento('tarefa_criada_pelo_chat', `caso:${casoId}`, { titulo: 'Pedir petição', peca, responsavel: x.quem, peloChat: true })
  const texto = `✓ Feito: a tarefa «${tituloDaTarefa(cliente.nome, 'Pedir petição')}» (${peca}) está na sua Central, com a minuta da IA pronta para você conferir e assinar (G6).`
  x.resultado = { texto, links: [{ rotulo: 'Abrir a petição', href: `/casos/${casoId}/peticao` }] }
  return texto
}

/**
 * CA3: as ferramentas de ação, só com um caso no contexto e só as que o perfil pode. Cada uma pede a aprovação da pessoa
 * (o cartão) antes de rodar. Os parâmetros sem valor vão como nulo: o modelo da OpenAI pede o esquema estrito.
 */
function ferramentasDeAcao(x: Ambiente): Tool[] {
  if (!x.alvo) return []
  const lista: Tool[] = [
    tool({
      name: 'criar_tarefa',
      description: 'Cria, no caso do contexto, uma tarefa da lista fixa de ações para alguém do escritório (para: o nome da pessoa). Pede a confirmação da pessoa antes.',
      parameters: z.object({ acao: z.string().min(3).max(80), para: z.string().max(80), prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
      needsApproval: true,
      execute: ({ acao, para, prazo }) => criarTarefaPeloChat(x, acao, para, prazo),
    }),
  ]
  if (pode(x.perfil, 'peticao.pedir')) {
    lista.push(
      tool({
        name: 'pedir_peca',
        description: 'Abre para a pessoa a tarefa "Pedir petição" do caso, com a minuta da IA pronta para ela conferir e assinar (G6). Pede a confirmação antes.',
        parameters: z.object({ peca: z.string().min(3).max(80) }),
        needsApproval: true,
        execute: ({ peca }) => pedirPecaPeloChat(x, peca),
      }),
    )
  }
  return lista
}

/** CA3: o cartão a partir da aprovação pedida pelo kit: os passos, o que conferir, as travas e o responsável. */
async function cartaoDaAprovacao(x: Ambiente, ferramenta: string, argumentos: Record<string, unknown>): Promise<CartaoDeAcao | null> {
  const casoId = x.alvo!.casoId
  const cliente = await clienteDoCaso(x.banco, casoId)
  const comum = { id: `acao-${randomUUID()}`, cliente, processoId: casoId }
  if (ferramenta === 'criar_tarefa') {
    const quem = responsavelCitado(String(argumentos.para ?? ''), await pessoasDoEscritorio(x.banco))
    return {
      ...comum,
      tipo: 'criar-tarefa',
      titulo: tituloDaTarefa(cliente.nome, String(argumentos.acao ?? 'Tarefa')),
      passos: [quem ? `Criar a tarefa na Central de ${quem.nome}` : 'Criar a tarefa na Central de quem você escolher', 'Registrar no histórico do caso: feito pelo chat'],
      conferir: ['Quem vai fazer', ...(argumentos.prazo ? [`O prazo: ${String(argumentos.prazo)}`] : [])],
      travas: ['Nada acontece antes do seu "Confirmar"', 'A ação vem da lista fixa de quem vai fazer'],
      ...(quem ? { responsavel: { nome: quem.nome, setor: quem.setor } } : {}),
      rotuloConfirmar: 'Criar tarefa',
    }
  }
  if (ferramenta === 'pedir_peca') {
    return {
      ...comum,
      tipo: 'pedir-peca',
      titulo: tituloDaTarefa(cliente.nome, String(argumentos.peca ?? 'Petição')),
      passos: ['Abrir para você a tarefa «Pedir petição», com a minuta da IA pronta', 'Registrar no histórico do caso: feito pelo chat'],
      conferir: ['A peça certa para o caso'],
      travas: ['A IA não assina nem protocola: você confere e assina (G6)', 'Sem o parecer médico "Suficiente" confirmado, o pedido não sai (G17)'],
      rotuloConfirmar: 'Abrir a tarefa',
    }
  }
  return null
}

/** O cartão em aberto, com quem pediu e o estado da conversa, até o clique. ponytail: em memória; reiniciar perde os abertos. */
type Pendente = { quem: string; perfil: string | null; alvo: Alvo; estado: string; criadoEm: number }
const VALIDADE_DO_CARTAO_MS = 30 * 60_000
export const MSG_CARTAO_VENCIDO = 'Esse cartão já foi usado ou expirou. Peça de novo.'

export function registrarRotasChat(app: FastifyInstance, { banco, agora = () => new Date(), ia }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const pendentes = new Map<string, Pendente>()
  const ambiente = (pedido: FastifyRequest, alvo: Alvo | null, confirmacao?: Ambiente['confirmacao']): Ambiente => ({
    app,
    banco,
    ia,
    quem: pedido.usuario!.id,
    perfil: pedido.perfilAtivo,
    cookie: pedido.headers.cookie ?? '',
    alvo,
    saude: veSaudeNoChat(pedido.perfilAtivo),
    fontes: [],
    evento: (acao, alvoDoEvento, detalhe) => historico(pedido.usuario!.id, acao, pedido, alvoDoEvento, detalhe),
    confirmacao,
  })
  const ferramentas = (x: Ambiente) => [...ferramentasDeLeitura(x), ...ferramentasDeAcao(x)]

  app.post('/api/chat', async (pedido, resposta) => {
    const entrada = PerguntaDoChat.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Pergunta inválida.')
    const { texto, processoId } = entrada.data
    // Quem não abre caso (`caso.ver`, como na página do processo) conversa sem caso no contexto e sem ação em caso.
    const abreCaso = pode(pedido.perfilAtivo, 'caso.ver')
    const noProcesso = processoId && UUID.test(processoId) ? processoId : undefined
    const doCaso = abreCaso ? noProcesso : undefined
    const antes = antesDoModelo(texto, pedido.perfilAtivo ?? undefined, doCaso ? await contextoDoCaso(banco, doCaso) : {}, agora())
    if (antes) {
      // A recusa da perícia fica no histórico sem o texto do pedido, que pode trazer dado de saúde.
      if (antes.registrar) await historico(pedido.usuario!.id, 'chat_recusa', pedido, doCaso ? `caso:${doCaso}` : 'chat', { portao: antes.resposta.portao, perfil: pedido.perfilAtivo })
      return antes.resposta
    }

    const alvo = doCaso ? await umCaso(banco, doCaso) : abreCaso ? await casoCitado(banco, texto) : null
    if (alvo && 'opcoes' in alvo) return { ...daRegra('pergunta', 'De qual cliente? Escolha um.', [], agora()), opcoes: alvo.opcoes }
    const casoId = alvo?.casoId ?? null
    // O link só leva à tela, que confere a permissão dela (a prestação de contas é do Financeiro, que não abre o caso).
    if (entrada.data.anexos.length) return arquivosPeloChat(texto, entrada.data.anexos, casoId ?? noProcesso ?? null, agora())
    const x = ambiente(pedido, alvo)
    const rodada = await conversar({ ia, quem: x.quem, casoId, saude: x.saude, ferramentas: ferramentas(x), fontes: x.fontes }, texto)
    if (rodada.tipo === 'aprovacao' && alvo) {
      const cartao = await cartaoDaAprovacao(x, rodada.ferramenta, rodada.argumentos)
      if (cartao) {
        for (const [id, p] of pendentes) if (Date.now() - p.criadoEm > VALIDADE_DO_CARTAO_MS) pendentes.delete(id)
        pendentes.set(cartao.id, { quem: x.quem, perfil: x.perfil, alvo, estado: rodada.estado, criadoEm: Date.now() })
        const texto = 'Confira o cartão: nada acontece antes do seu "Confirmar".'
        const sugestao = { chamadaId: rodada.chamadaId, sugestao: true as const, texto, fontes: x.fontes, modelo: rodada.modelo, geradaEm: agora().toISOString(), alerta: null }
        return { tipo: 'acao', sugestao, links: [], acao: cartao } satisfies RespostaDoChat
      }
    }
    return daRodada(rodada, casoId, x.fontes, agora())
  })

  // CA3: o clique em "Confirmar". Só quem pediu, com o mesmo perfil; o kit continua e a ação roda pelo código, com as travas.
  app.post<{ Params: { id: string } }>('/api/chat/acoes/:id', async (pedido, resposta) => {
    const entrada = ConfirmacaoDoCartao.safeParse({ ...(pedido.body as object | null), acaoId: pedido.params.id })
    if (!entrada.success) return negar(resposta, 400, 'Confirmação inválida.')
    const p = pendentes.get(entrada.data.acaoId)
    if (!p || Date.now() - p.criadoEm > VALIDADE_DO_CARTAO_MS) {
      pendentes.delete(entrada.data.acaoId)
      return negar(resposta, 410, MSG_CARTAO_VENCIDO)
    }
    if (p.quem !== pedido.usuario!.id || p.perfil !== pedido.perfilAtivo) return negar(resposta, 403, 'Só quem pediu confirma o cartão, com o mesmo perfil.')
    if (!pode(pedido.perfilAtivo, 'caso.ver')) return negar(resposta, 403, 'Seu perfil não abre o caso.')
    pendentes.delete(entrada.data.acaoId)
    const x = ambiente(pedido, p.alvo, { responsavel: entrada.data.responsavel })
    await conversar({ ia, quem: x.quem, casoId: p.alvo.casoId, saude: x.saude, ferramentas: ferramentas(x), fontes: x.fontes }, { estado: p.estado, aprovar: true })
    if (x.resultado) return { ...x.resultado, estado: 'feito' as const }
    return negar(resposta, 400, x.falha ? `Não foi feito: ${x.falha}` : 'A ação não foi feita. Peça de novo.')
  })

  // Cancelar: o cartão some e nada acontece.
  app.delete<{ Params: { id: string } }>('/api/chat/acoes/:id', async (pedido, resposta) => {
    const p = pendentes.get(pedido.params.id)
    if (p && p.quem !== pedido.usuario!.id) return negar(resposta, 403, 'Só quem pediu cancela o cartão.')
    pendentes.delete(pedido.params.id)
    return resposta.code(204).send()
  })
}
