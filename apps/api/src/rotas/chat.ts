// GGVP-142: o chat das Centrais e a aba Suporte pelo servidor (POST /api/chat). Antes do modelo, como código, as mesmas
// regras puras da tela (regras/chat.ts, parecer.ts e pericia.ts): as recusas, o portão citado, os portões do pedido e o
// pedido de outro perfil. Nesses casos o modelo não é chamado (CA2). Depois, o agente do motor (ADR-016), com o caso que
// o perfil vê. O chat é de todos os perfis (`chat.usar`, GGVP-158), e cada dado segue a permissão de quem pergunta.
import { randomUUID } from 'node:crypto'
import {
  ConfirmacaoDoCartao,
  PerguntaDoChat,
  pode,
  type CartaoDeAcao,
  type Erro,
  type FonteDaIa,
  type LinkDoChat,
  type ProcessoDoCaso,
  type RespostaDoChat,
  type TarefaDaCentral,
  type TarefaDaTela,
  type TextoDaFala,
  type WidgetDoChat,
} from '@ggv/contratos'
import { tool, type Tool } from '@openai/agents'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, documentacaoMedica, etapa, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { MSG_IA_DESLIGADA, MSG_IA_SEM_RESPOSTA, MSG_IA_SEM_SAUDE } from '../fluxo/transcricao.ts'
import { MSG_SEM_REFERENCIA, SEM_CASO, buscarNoAcervo } from '../ia/acervo.ts'
import { comoDado, conversar, type Rodada } from '../ia/chat.ts'
import { temCid, type Ia } from '../ia/ia.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { dataDe, montarBlocos, widgetDoAcervo, widgetsDasTarefas, widgetsDoCaso, type Oferta } from './widgetsDoChat.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
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
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { etapaDaFicha } from '../../../web/src/regras/busca.ts'
import { recusaDoChat } from '../../../web/src/regras/parecer.ts'
import { recusaDoChatNaPericia } from '../../../web/src/regras/pericia.ts'
import { ehAudio, tirarSenhas } from '../../../web/src/regras/entrevista.ts'
import { lerFormulario } from './formulario.ts'
import { SETOR } from './processo.ts'
import { UUID } from './recepcao.ts'

/** A resposta que sai do código, não do modelo (CA2): não há chamada de IA a registrar. */
export const MODELO_DA_REGRA = 'regra do portal (sem IA)'

/** CA7 (Pedro, 14/10): sem cliente achado, o chat diz que não achou, em vez de pedir o nome completo em volta. */
export const MSG_CLIENTE_NAO_ACHADO =
  'Nenhum cliente achado na conversa, com caso ou sem caso. Se a pessoa já deu um nome, diga que não achou cliente com esse nome e indique a busca do topo, sem pedir o nome de novo. Se ela não citou ninguém, pergunte de qual cliente é.'

/** CA8 (Pedro, 14/10): a leitura recusada ao perfil vira "sem acesso", dito com clareza. */
export const MSG_SEM_ACESSO = 'Sem acesso: o perfil da pessoa não abre este caso. Diga a ela, com clareza, que o perfil dela não tem acesso a isso.'

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
    // CA8 (Pedro, 14/10): diz que o perfil não tem acesso; o cartão de tarefa só é prometido a quem cria tarefa.
    const pedir = pode(perfil ?? null, 'tarefa.atribuir') ? 'Peça a tarefa para quem faz, e eu mostro o cartão.' : 'Para pedir, fale com a Sênior ou a líder do Atendimento, que criam a tarefa.'
    const texto = `«${fora.acao}» é ${fora.quem}: seu perfil não tem acesso a isso. ${pedir}`
    return { resposta: daRegra('resposta', texto, [{ tipo: 'regra', referencia: 'lista fixa de ações do perfil' }], agora) }
  }
  return null
}

/** O cliente do contexto e o caso mais novo dele; `casoId` nulo é o cliente sem caso, o lead (CA6, Pedro 14/10). */
type Alvo = { casoId: string | null; pessoaId: string; beneficio: string | null }
const palavras = (texto: string) => ` ${semAcento(texto).replace(/[^a-z0-9]+/g, ' ').trim()} `
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
/** As palavras sem as ligações do nome: "Maria da Silva" e "maria silva" se encontram, "maria da penha" não. */
const semLigacoes = (texto: string) => ` ${palavras(texto).trim().split(' ').filter((p) => !LIGACOES.has(p)).join(' ')} `

/** GGVP-162: o caso abre na página do processo para quem a abre; o Atendimento, a Documentação e o lead, na ficha do cliente. */
const linkDoCaso = (perfil: string | null | undefined, alvo: Alvo): LinkDoChat =>
  alvo.casoId && pode(perfil, 'processo.abrir') ? { rotulo: 'Abrir o caso', href: `/casos/${alvo.casoId}` } : { rotulo: 'Abrir a ficha do cliente', href: `/clientes/${alvo.pessoaId}` }

/** O caso aberto no chat (o `processoId` do contexto). */
async function umCaso(banco: Banco, casoId: string): Promise<Alvo | null> {
  const [c] = await banco.select({ casoId: caso.id, pessoaId: caso.pessoaId, beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
  return c ?? null
}

/**
 * O cliente citado (CA6, Pedro 14/10): entre todos os clientes, com caso ou não, por nome e sobrenome (os dois primeiros
 * nomes do cadastro, sem as ligações); o caso mais novo dele, quando há. Os textos vão em ordem: a pergunta, depois as
 * mensagens anteriores da pessoa, da mais nova para a mais velha; vale o primeiro que cita alguém. Dois clientes no mesmo
 * texto: a pergunta "qual deles?". ponytail: lê os clientes a cada pergunta; com milhares, buscar no banco.
 */
async function clienteCitado(banco: Banco, textos: string[]): Promise<Alvo | { opcoes: string[] } | null> {
  const linhas = await banco
    .select({ casoId: caso.id, pessoaId: pessoa.id, beneficio: caso.beneficio, nome: pessoa.nome })
    .from(pessoa)
    .leftJoin(caso, eq(caso.pessoaId, pessoa.id))
    // O caso mais novo primeiro; o lead (sem caso) por último, para o homônimo com caso valer.
    .orderBy(sql`${caso.criadoEm} desc nulls last`)
  for (const texto of textos) {
    const t = semLigacoes(texto)
    const citados = new Map<string, Alvo>()
    for (const l of linhas) {
      const [nome, sobrenome] = semLigacoes(l.nome).trim().split(' ')
      if (sobrenome && t.includes(` ${nome} ${sobrenome} `) && !citados.has(l.nome)) citados.set(l.nome, { casoId: l.casoId, pessoaId: l.pessoaId, beneficio: l.beneficio })
    }
    if (citados.size > 1) return { opcoes: [...citados.keys()] }
    if (citados.size) return citados.values().next().value!
  }
  return null
}

const SEM_IA: Record<Extract<Rodada, { tipo: 'sem-ia' }>['motivo'], string> = {
  desligada: `O chat não respondeu: ${MSG_IA_DESLIGADA}.`,
  'sem-saude': `O chat não respondeu: ${MSG_IA_SEM_SAUDE}.`,
  falhou: `O chat não respondeu: ${MSG_IA_SEM_RESPOSTA}. Tente de novo em instantes.`,
}

/** A resposta da rodada do agente, com os links do código (o caso), nunca do texto do modelo (CA2). */
function daRodada(rodada: Rodada, link: LinkDoChat | null, fontes: FonteDaIa[], agora: Date, widgets: Map<string, WidgetDoChat>): RespostaDoChat {
  const links: LinkDoChat[] = link ? [link] : []
  if (rodada.tipo === 'resposta') {
    // 12/10: os marcadores {{wN}} viram os widgets que as ferramentas montaram; o texto do registro fica sem eles.
    const { texto, blocos } = montarBlocos(rodada.texto, widgets)
    const sugestao = { chamadaId: rodada.chamadaId, sugestao: true as const, texto, fontes, modelo: rodada.modelo, geradaEm: agora.toISOString(), alerta: rodada.alerta }
    return { tipo: 'resposta', sugestao, links, ...(blocos ? { blocos } : {}) }
  }
  if (rodada.tipo === 'sem-ia') return { ...daRegra('resposta', SEM_IA[rodada.motivo], [], agora), links }
  return { ...daRegra('resposta', SEM_IA.falhou, [], agora), links }
}

/**
 * CA3: o que depende de enviar arquivo (laudo, comprovante do INSS, comprovante do pagamento, documento, lote do acervo)
 * leva à tela onde a pessoa sobe e confere, até a rota de envio existir no servidor (Recepção, PR #22; GGVP-55).
 */
function arquivosPeloChat(texto: string, anexos: { nome: string }[], casoId: string | null, principal: LinkDoChat | null, agora: Date): RespostaDoChat {
  const tipo = tipoDoAnexo(texto, anexos.map((a) => a.nome))
  const doCaso = (sufixo: string, rotulo: string): LinkDoChat[] => (casoId ? [{ rotulo, href: `/casos/${casoId}${sufixo}` }] : [])
  const abrir = principal ? [principal] : []
  const destino = {
    laudo: { texto: 'Para subir o laudo novo, abra o caso e envie pela pasta do cliente: o Jurídico confere o laudo.', links: abrir },
    'comprovante-inss': {
      texto: 'Para marcar a perícia com o comprovante do INSS, abra a perícia do caso: lá a IA lê a data, a hora e o local, e você confere antes de marcar.',
      links: doCaso('/pericia', 'Abrir a perícia'),
    },
    'comprovante-rpv': {
      texto: 'Para lançar o comprovante do pagamento, abra a prestação de contas do caso: o aviso ao cliente só sai depois do OK da Sênior.',
      links: doCaso('/prestacao', 'Abrir a prestação de contas'),
    },
    documento: { texto: 'Para enviar o documento, abra o caso e suba pela pasta do cliente: a Documentação confere a leitura.', links: abrir },
    acervo: { texto: 'Para subir processos no acervo, use a base do acervo na Gestão.', links: [{ rotulo: 'Abrir a base do acervo', href: '/gestao/resultados' }] },
  }[tipo]
  const semCaso = casoId || tipo === 'acervo' ? '' : ' Diga de qual cliente é, com o nome completo.'
  const resposta = daRegra('resposta', `O chat ainda não sobe arquivo no servidor. ${destino.texto}${semCaso}`, [{ tipo: 'regra', referencia: 'envio de arquivo pela tela' }], agora)
  return { ...resposta, links: destino.links }
}

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
  /** Os widgets que as ferramentas ofereceram nesta rodada (12/10), por id: w1, w2… */
  widgets: Map<string, WidgetDoChat>
  /** O dia de hoje em Brasília, para os prazos dos widgets. */
  hoje: string
  /** A lista da Central que a tela mandou (Pedro, 16/10): mais completa que a do servidor (perícia, chat, setor). */
  tarefasDaTela?: TarefaDaTela[]
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
/**
 * Guarda os widgets da ferramenta e devolve a linha que o modelo lê para escolher (12/10). Para quem não vê saúde, o
 * widget com código de doença não é oferecido (G20).
 */
function oferecer(x: Ambiente, ofertas: Oferta[]): string {
  const linhas = ofertas.flatMap(({ widget, descricao }) => {
    if (!x.saude && temCid(JSON.stringify(widget))) return []
    const id = `w${x.widgets.size + 1}`
    x.widgets.set(id, widget)
    return [`{{${id}}} ${descricao}`]
  })
  return linhas.length ? `\n\nWidgets prontos (escreva o marcador sozinho numa linha para mostrar):\n${linhas.join('\n')}` : ''
}

/**
 * GGVP-162 CA6: quem não abre o processo (o Atendimento, a líder e a Documentação) lê o caso como a ficha do cliente mostra:
 * o número, o benefício, a etapa, o que fazer agora e o prazo. A ficha vem da rota da tela, com a sessão de quem pergunta.
 */
async function casoPelaFicha(x: Ambiente, alvo: Alvo) {
  const r = await x.app.inject({ method: 'GET', url: `/api/fichas/${alvo.pessoaId}`, headers: { cookie: x.cookie } })
  if (r.statusCode !== 200) return MSG_SEM_ACESSO
  const ficha = r.json() as Ficha
  // CA6 (Pedro, 14/10): o cliente sem caso, o lead, é lido pela ficha: sem CPF, contato nem endereço (LGPD: o mínimo).
  if (!alvo.casoId) {
    x.fontes.push({ tipo: 'caso', referencia: `ficha:${alvo.pessoaId}` })
    const agendamentos = (ficha.agendamentos ?? []).map((a) => ({ data: a.data, hora: a.hora, oQue: a.oQue, com: a.com }))
    const lido = { cliente: ficha.nome, semCaso: true, situacao: ficha.situacao, desde: ficha.desde, etapa: etapaDaFicha(ficha, x.hoje), beneficioDeInteresse: ficha.beneficioInteresse ?? null, agendamentos }
    return comoDado(JSON.stringify(lido))
  }
  const processos = ficha.processos as Partial<Record<'id' | 'numero' | 'beneficio' | 'etapa' | 'proximaAcao' | 'prazo', string>>[]
  const p = processos.find((q) => q.id === alvo.casoId)
  if (!p) return 'Este caso ainda não aparece na ficha do cliente.'
  x.fontes.push({ tipo: 'caso', referencia: `caso:${alvo.casoId}` })
  return comoDado(JSON.stringify({ cliente: ficha.nome, processo: { numero: p.numero, beneficio: p.beneficio, etapa: p.etapa, proximaAcao: p.proximaAcao, prazo: p.prazo } }))
}

function ferramentasDeLeitura(x: Ambiente): Tool[] {
  return [
    tool({
      name: 'ler_caso',
      description:
        'Lê o caso do contexto como o perfil da pessoa vê: situação, etapas, tarefas abertas com prazo, documentos (sem conteúdo) e a perícia. Cliente sem caso: o que a ficha mostra.',
      parameters: z.object({}),
      execute: async () => {
        if (!x.alvo) return MSG_CLIENTE_NAO_ACHADO
        if (!pode(x.perfil, 'processo.abrir') || !x.alvo.casoId) return casoPelaFicha(x, x.alvo)
        const r = await x.app.inject({ method: 'GET', url: `/api/casos/${x.alvo.casoId}/processo`, headers: { cookie: x.cookie } })
        if (r.statusCode !== 200) return MSG_SEM_ACESSO
        x.fontes.push({ tipo: 'caso', referencia: `caso:${x.alvo.casoId}` })
        // O modelo não precisa do CPF nem da data de nascimento para responder (LGPD: o mínimo).
        const { pessoa: quem, ...resto } = r.json() as { pessoa?: { nome: string } }
        const visto = JSON.stringify({ ...resto, ...(quem ? { pessoa: { nome: quem.nome } } : {}) })
        const dado = comoDado(`${visto}${x.perfil === 'socio' ? await resumoMedicoParaOSocio(x, x.alvo.casoId) : ''}`)
        return dado + oferecer(x, widgetsDoCaso(r.json() as ProcessoDoCaso, x.hoje))
      },
    }),
    tool({
      name: 'buscar_no_acervo',
      description: 'Busca no acervo da casa casos parecidos (petições aprovadas, decisões, motivos de indeferimento, pareceres e perícias conferidos), sem dado pessoal.',
      parameters: z.object({ consulta: z.string().min(3).max(300) }),
      execute: async ({ consulta }) => {
        const achados = await buscarNoAcervo(x.banco, { casoId: x.alvo?.casoId ?? SEM_CASO, beneficio: x.alvo?.beneficio ?? null, consulta, saude: x.saude, ia: x.ia })
        x.fontes.push(...achados)
        return achados.length ? comoDado(achados.map((f) => f.trecho).join('\n')) + oferecer(x, widgetDoAcervo(achados)) : MSG_SEM_REFERENCIA
      },
    }),
    tool({
      name: 'minhas_tarefas',
      description: 'As tarefas abertas da pessoa, como na Central dela, com o cliente, o prazo e a urgência.',
      parameters: z.object({}),
      execute: async () => {
        // A lista que a pessoa vê, quando a tela mandou; senão, a do servidor.
        let tarefas: TarefaDaCentral[]
        if (x.tarefasDaTela) {
          tarefas = x.tarefasDaTela.map((t, i) => ({ id: `tela-${i}`, casoId: null, passo: null, cliente: null, contexto: t.quem || null, titulo: t.acao, detalhe: t.detalhe, tela: t.href, prazo: t.prazo, urgente: t.urgente }))
        } else {
          const r = await x.app.inject({ method: 'GET', url: '/api/tarefas', headers: { cookie: x.cookie } })
          if (r.statusCode !== 200) return 'Não deu para ler as tarefas agora.'
          tarefas = r.json() as TarefaDaCentral[]
        }
        x.fontes.push({ tipo: 'regra', referencia: 'tarefas da Central' })
        // CA9 (Pedro, 14/10): o atraso sai do código, com o dia de hoje; o modelo só repete o que veio marcado.
        const marcadas = tarefas.map((t) => {
          const prazo = dataDe(t.prazo)
          return { ...t, atrasada: Boolean(prazo && prazo < x.hoje), venceHoje: prazo === x.hoje }
        })
        return comoDado(JSON.stringify({ hoje: x.hoje, tarefas: marcadas })) + oferecer(x, widgetsDasTarefas(tarefas, x.hoje))
      },
    }),
    tool({
      name: 'explicar_portao',
      description: 'Explica um portão de governança do escritório.',
      parameters: z.object({ portao: z.string().regex(/^G\d{1,2}$/) }),
      execute: async ({ portao }) => {
        if (!PORTOES[portao]) return 'Portão desconhecido.'
        x.fontes.push(regra(portao))
        return `${portao}: ${PORTOES[portao]}`
      },
    }),
    // GGVP-158 L1 (16/10): o acervo é material jurídico (peças, decisões, pareceres, modelos de petição e a conversa e a
    // entrevista de outros clientes). Só quem vê as peças recebe a ferramenta; para os outros, ela nem vai ao modelo.
  ].filter((t) => t.name !== 'buscar_no_acervo' || pode(x.perfil, 'peticao.ver'))
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
  // GGVP-158 P7.3: criar tarefa pelo chat é de quem atribui tarefa (a Sênior e o líder do Atendimento); confere de novo.
  if (!pode(x.perfil, 'tarefa.atribuir')) return falhou(x, 'criar tarefa pelo chat é da Sênior e do líder do Atendimento.')
  const casoId = x.alvo!.casoId!
  const pessoas = await pessoasDoEscritorio(x.banco)
  const quem = x.confirmacao?.responsavel ? pessoas.find((p) => p.nome === x.confirmacao!.responsavel) : responsavelCitado(para, pessoas)
  if (!quem) return falhou(x, 'escolha quem vai fazer a tarefa.')
  const grupo = grupoDe(quem.perfil)
  const daLista = ACOES_DO_PERFIL[grupo].find((a) => semAcento(a) === semAcento(acao)) ?? acaoDaLista(acao, grupo)
  if (!daLista) return falhou(x, `«${acao}» não está na lista de ações de ${quem.nome}.`)
  const cliente = await clienteDoCaso(x.banco, casoId)
  await x.banco.insert(tarefa).values({ casoId, titulo: daLista, perfilDono: quem.perfil, responsavelId: quem.id, prazo })
  await x.evento('tarefa_criada_pelo_chat', `caso:${casoId}`, { titulo: daLista, responsavel: quem.id, peloChat: true })
  x.resultado = { texto: `✓ Feito: tarefa «${tituloDaTarefa(cliente.nome, daLista)}» criada para ${quem.nome}.`, links: [linkDoCaso(x.perfil, x.alvo!)] }
  return x.resultado.texto
}

export const MSG_PECA_ANTES_DO_DESPACHO = 'A petição é pedida depois do despacho da Sênior.'

/**
 * CA3: pedir a peça, depois do clique. A IA não assina nem pede sozinha (G6). GGVP-158 P7.3: a peça espera o despacho da
 * Sênior, que abre "Pedir a petição" (D3.05); o chat aponta para a mesma tarefa, sem criar outra, e o pedido de verdade
 * sai da tela da petição, com o G17.
 */
async function pedirPecaPeloChat(x: Ambiente, peca: string) {
  const casoId = x.alvo!.casoId!
  const [aberta] = await x.banco
    .select({ id: tarefa.id, titulo: tarefa.titulo })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.05'), isNull(tarefa.concluidaEm)))
    .limit(1)
  if (!aberta) return falhou(x, MSG_PECA_ANTES_DO_DESPACHO)
  const cliente = await clienteDoCaso(x.banco, casoId)
  await x.evento('peca_pedida_pelo_chat', `caso:${casoId}`, { tarefa: aberta.id, peca, peloChat: true })
  const texto = `✓ Feito: a tarefa «${tituloDaTarefa(cliente.nome, aberta.titulo)}» (${peca}) já está aberta, com a minuta da IA pronta para você conferir e assinar.`
  x.resultado = { texto, links: [{ rotulo: 'Abrir a petição', href: `/casos/${casoId}/peticao` }] }
  return texto
}

/**
 * CA3: as ferramentas de ação, só com um caso no contexto e só as que o perfil pode. Cada uma pede a aprovação da pessoa
 * (o cartão) antes de rodar. Os parâmetros sem valor vão como nulo: o modelo da OpenAI pede o esquema estrito.
 */
function ferramentasDeAcao(x: Ambiente): Tool[] {
  // CA6: sem caso (o lead), não há ação em caso.
  if (!x.alvo?.casoId) return []
  const lista: Tool[] = []
  // GGVP-158 P7.3: só quem atribui tarefa recebe a ferramenta de criar tarefa.
  if (pode(x.perfil, 'tarefa.atribuir'))
    lista.push(
    tool({
      name: 'criar_tarefa',
      description: 'Cria, no caso do contexto, uma tarefa da lista fixa de ações para alguém do escritório (para: o nome da pessoa). Pede a confirmação da pessoa antes.',
      parameters: z.object({ acao: z.string().min(3).max(80), para: z.string().max(80), prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
      needsApproval: true,
      execute: ({ acao, para, prazo }) => criarTarefaPeloChat(x, acao, para, prazo),
    }),
    )
  if (pode(x.perfil, 'peticao.pedir')) {
    lista.push(
      tool({
        name: 'pedir_peca',
        description: 'Abre para a pessoa a tarefa "Pedir petição" do caso, com a minuta da IA pronta para ela conferir e assinar. Pede a confirmação antes.',
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
  const casoId = x.alvo!.casoId!
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
      passos: ['Abrir a tarefa «Pedir a petição» que o despacho da Sênior abriu, com a minuta da IA pronta', 'Registrar no histórico do caso: feito pelo chat'],
      conferir: ['A peça certa para o caso'],
      travas: [
        'A IA não assina nem protocola: você confere e assina',
        'Sem o despacho da Sênior, a peça não é pedida',
        'Sem o parecer médico "Suficiente" confirmado, o pedido não sai',
      ],
      rotuloConfirmar: 'Abrir a tarefa',
    }
  }
  return null
}

/** O cartão em aberto, com quem pediu e o estado da conversa, até o clique. ponytail: em memória; reiniciar perde os abertos. */
type Pendente = { quem: string; perfil: string | null; alvo: Alvo; estado: string; criadoEm: number }
const VALIDADE_DO_CARTAO_MS = 30 * 60_000
export const MSG_CARTAO_VENCIDO = 'Esse cartão já foi usado ou expirou. Peça de novo.'

/** A fala do chat (12/10): até 10 MB, que passam com folga dos 2 minutos de gravação. */
export const TAMANHO_MAXIMO_DA_FALA = 10 * 1024 * 1024
export const MSG_FALA_SEM_AUDIO = 'Mande a fala como arquivo de áudio.'
export const MSG_FALA_GRANDE = 'A fala passou de 10 MB: grave de novo, mais curta.'

export function registrarRotasChat(app: FastifyInstance, { banco, agora = () => new Date(), ia }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const usar = { preHandler: exigir(banco, 'chat.usar', agora) }
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
    widgets: new Map(),
    hoje: hojeEmBrasilia(agora()),
    evento: (acao, alvoDoEvento, detalhe) => historico(pedido.usuario!.id, acao, pedido, alvoDoEvento, detalhe),
    confirmacao,
  })
  const ferramentas = (x: Ambiente) => [...ferramentasDeLeitura(x), ...ferramentasDeAcao(x)]

  app.post('/api/chat', usar, async (pedido, resposta) => {
    const entrada = PerguntaDoChat.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Pergunta inválida.')
    const { texto, processoId } = entrada.data
    // Quem não vê o caso (`caso.ver`) conversa sem caso no contexto e sem ação em caso; quem vê o caso sem abrir o processo
    // (o Atendimento e a Documentação) lê o caso pela ficha (GGVP-162).
    const abreCaso = pode(pedido.perfilAtivo, 'caso.ver')
    const noProcesso = processoId && UUID.test(processoId) ? processoId : undefined
    const doCaso = abreCaso ? noProcesso : undefined
    const antes = antesDoModelo(texto, pedido.perfilAtivo ?? undefined, doCaso ? await contextoDoCaso(banco, doCaso) : {}, agora())
    if (antes) {
      // A recusa da perícia fica no histórico sem o texto do pedido, que pode trazer dado de saúde.
      if (antes.registrar) await historico(pedido.usuario!.id, 'chat_recusa', pedido, doCaso ? `caso:${doCaso}` : 'chat', { portao: antes.resposta.portao, perfil: pedido.perfilAtivo })
      return antes.resposta
    }

    // CA6 (Pedro, 14/10): sem cliente na pergunta, vale o citado antes pela pessoa, da mensagem mais nova para a mais velha.
    const daPessoa = entrada.data.anteriores.filter((m) => m.de === 'pessoa').map((m) => m.texto).reverse()
    const alvo = doCaso ? await umCaso(banco, doCaso) : abreCaso ? await clienteCitado(banco, [texto, ...daPessoa]) : null
    if (alvo && 'opcoes' in alvo) return { ...daRegra('pergunta', 'De qual cliente? Escolha um.', [], agora()), opcoes: alvo.opcoes }
    const casoId = alvo?.casoId ?? null
    // O link só leva à tela, que confere a permissão dela (a prestação de contas é do Financeiro, que não abre o caso).
    const link = alvo ? linkDoCaso(pedido.perfilAtivo, alvo) : null
    if (entrada.data.anexos.length) return arquivosPeloChat(texto, entrada.data.anexos, casoId ?? noProcesso ?? null, link, agora())
    const x = ambiente(pedido, alvo)
    x.tarefasDaTela = entrada.data.tarefasDaTela
    // GGVP-158 A1 (G9): a senha do gov.br sai da pergunta e do histórico antes da IA, pela regra da entrevista: a mensagem
    // logo depois da que fala de senha também conta ("qual a senha?" e depois só a senha).
    const limpas = tirarSenhas([...entrada.data.anteriores, { de: 'pessoa' as const, texto }].map((m, i) => ({ aos: i, quem: m.de, papel: 'cliente' as const, texto: m.texto })))
    const anteriores = entrada.data.anteriores.map((m, i) => ({ ...m, texto: limpas[i].texto }))
    const rodada = await conversar({ ia, quem: x.quem, casoId, saude: x.saude, ferramentas: ferramentas(x), fontes: x.fontes, anteriores, hoje: x.hoje }, limpas.at(-1)!.texto)
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
    return daRodada(rodada, link, x.fontes, agora(), x.widgets)
  })

  // CA3: o clique em "Confirmar". Só quem pediu, com o mesmo perfil; o kit continua e a ação roda pelo código, com as travas.
  app.post<{ Params: { id: string } }>('/api/chat/acoes/:id', usar, async (pedido, resposta) => {
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
    await conversar({ ia, quem: x.quem, casoId: p.alvo.casoId, saude: x.saude, ferramentas: ferramentas(x), fontes: x.fontes, hoje: x.hoje }, { estado: p.estado, aprovar: true })
    if (x.resultado) return { ...x.resultado, estado: 'feito' as const }
    return negar(resposta, 400, x.falha ? `Não foi feito: ${x.falha}` : 'A ação não foi feita. Peça de novo.')
  })

  // Cancelar: o cartão some e nada acontece.
  app.delete<{ Params: { id: string } }>('/api/chat/acoes/:id', usar, async (pedido, resposta) => {
    const p = pendentes.get(pedido.params.id)
    if (p && p.quem !== pedido.usuario!.id) return negar(resposta, 403, 'Só quem pediu cancela o cartão.')
    pendentes.delete(pedido.params.id)
    return resposta.code(204).send()
  })

  // 12/10: a fala do microfone vira texto para a pessoa conferir na caixa. O áudio não é guardado; o motor registra só
  // o tamanho e o hash. Saúde: a mesma regra do chat (o Jurídico e o Sócio pedem a autorização do escritório).
  app.post('/api/chat/fala', usar, async (pedido, resposta) => {
    if (!pedido.isMultipart()) return negar(resposta, 415, MSG_FALA_SEM_AUDIO)
    const formulario = await lerFormulario(pedido)
    const arquivo = formulario?.arquivo
    if (!arquivo || !ehAudio({ nome: arquivo.nome, tipo: arquivo.mime })) return negar(resposta, 415, MSG_FALA_SEM_AUDIO)
    if (arquivo.conteudo.length > TAMANHO_MAXIMO_DA_FALA) return negar(resposta, 413, MSG_FALA_GRANDE)
    const sensivel = veSaudeNoChat(pedido.perfilAtivo)
    const feita = await ia.transcrever({ quem: pedido.usuario!.id, casoId: null, audio: new Uint8Array(arquivo.conteudo), mime: arquivo.mime, nome: arquivo.nome, sensivel, referencia: 'chat:fala' })
    if (!feita) {
      const motivo = !ia.ligada ? MSG_IA_DESLIGADA : sensivel && !ia.saudeAutorizada ? MSG_IA_SEM_SAUDE : MSG_IA_SEM_RESPOSTA
      return negar(resposta, 503, `A transcrição não funcionou: ${motivo}.`)
    }
    // GGVP-158 A1 (G9): a senha dita no microfone não volta para a caixa de texto (nem, dali, para a IA).
    const falas = tirarSenhas(feita.falas.map((f) => ({ aos: f.inicio, quem: f.falante, papel: 'cliente' as const, texto: f.texto.trim() })))
    return { texto: falas.map((f) => f.texto).join(' ').trim() } satisfies TextoDaFala
  })
}
