// EXEMPLO. O motor do chat (GGVP-82): o caminho único de toda pergunta, de toda Central e da aba Suporte. A IA é simulada
// aqui, no servidor de exemplo: as respostas saem das regras (regras/chat.ts) e dos dados do caso; os números vêm do código.
// O chat herda exatamente as permissões do perfil de quem pergunta. Para executar algo, devolve um cartão; nada acontece
// sem "Confirmar" (confirmarAcao).
//
// Ponta para ligar no motor de IA (pedido #26, feat/GGVP-14-ia-juridica, do Mateus): `perguntar` vira POST /api/chat e a
// `sugestao` passa a vir do motor (SugestaoDaIa, com as fontes e o modelo de verdade); as recusas, os portões, a regra do
// responsável e os números continuam no servidor, como código, antes e depois do modelo.
import type { CartaoDeAcao, FonteDaIa, LinkDoChat, RespostaDoChat, SugestaoDaIa } from '@ggv/contratos'
import { dataParaIso, normalizarData } from '../campos.ts'
import { somarDias } from '../regras/agenda.ts'
import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { etapaAtual, podeVerValor, visaoDoPerfil } from '../regras/caso.ts'
import {
  acaoDaLista,
  entenderPedido,
  foraDoPerfil,
  grupoDoPerfil,
  portaoCitado,
  portaoDoPedido,
  PORTOES,
  responsavelDaTarefa,
  semAcento,
  tipoDoAnexo,
  tituloDaTarefa,
  type Intencao,
  type Pessoa,
} from '../regras/chat.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { recusaDoChat } from '../regras/parecer.ts'
import { NOMES_DO_TIPO, numerosDaJurimetria, prazosDaPericia, recusaDoChatNaPericia } from '../regras/pericia.ts'
import { LEMBRETE_DA_IDENTIDADE } from '../regras/seguranca.ts'
import { complementoDo, jurimetriaDoJuizoDoCaso, juizosDeExemplo, obterCaso, type QuemPergunta } from './caso.ts'
import { tarefasDeDecidirCobranca } from './cobranca.ts'
import { pessoasDoEscritorio } from './conversa.ts'
import { enviarArquivos, identificarCliente } from './documentos.ts'
import {
  clienteLigou,
  comoOPeritoAvalia,
  dicaParaAPericia,
  lerComprovante,
  periciaDoCliente,
  periciaParaMarcarDaFicha,
  periciasDaSemana,
  periciasParaMarcar,
  registrarMarcacao,
  registrarRecusaDoChat,
  type ItemDoChat,
} from './pericia.ts'
import type { IdPerfil } from './perfis.ts'
import { perfilDoPerito, peritosDo } from './peritos.ts'
import { agora, esperar, gravar, ler } from './servidor.ts'
import type { Tarefa } from './tipos.ts'

export type { QuemPergunta }

/** Um arquivo anexado: o nome e o tamanho vão na pergunta; o conteúdo só sobe na confirmação. */
export type AnexoNaPergunta = { nome: string; tamanho: number }

/** A tarefa criada pelo chat: entra na Central de quem vai fazer e no caso, com "criada pelo chat" (CA5, CA7, CA9). */
export type TarefaDoChat = {
  id: string
  processoId?: string
  cliente?: { id: string; nome: string }
  acao: string
  titulo: string
  detalhe: string
  responsavel: string
  setor: string
  /** aaaa-mm-dd */
  prazo?: string
  criadaPor: string
  criadaEm: string
  concluida?: boolean
}

/** O que o servidor guarda de cada cartão até a confirmação. Nada disso executa antes do clique (CA3). */
type Pendente = { acao: CartaoDeAcao; quem: QuemPergunta; texto: string; dados: Record<string, unknown> }

const pendentes = new Map<string, Pendente>()
let seq = 0

const MODELO = 'simulado · servidor de exemplo'

function sugestao(texto: string, fontes: FonteDaIa[] = []): SugestaoDaIa {
  return { chamadaId: crypto.randomUUID(), sugestao: true, texto, fontes, modelo: MODELO, geradaEm: agora().toISOString(), alerta: null }
}

const resposta = (texto: string, links: LinkDoChat[] = [], fontes: FonteDaIa[] = []): RespostaDoChat => ({ tipo: 'resposta', sugestao: sugestao(texto, fontes), links })
const recusa = (texto: string, portao?: string, extra: Partial<RespostaDoChat> = {}): RespostaDoChat => ({
  tipo: 'recusa',
  sugestao: sugestao(texto, portao ? [{ tipo: 'regra', referencia: portao }] : []),
  links: [],
  ...(portao ? { portao } : {}),
  ...extra,
})
const pergunta = (texto: string, opcoes: string[]): RespostaDoChat => ({ tipo: 'pergunta', sugestao: sugestao(texto), links: [], opcoes })

function comCartao(texto: string, acao: Omit<CartaoDeAcao, 'id'>, quem: QuemPergunta, pedido: string, dados: Record<string, unknown> = {}, extra: Partial<RespostaDoChat> = {}): RespostaDoChat {
  const id = `acao-${++seq}`
  const cartao = { ...acao, id }
  pendentes.set(id, { acao: cartao, quem, texto: pedido, dados })
  return { tipo: 'acao', sugestao: sugestao(texto, acao.processoId ? [{ tipo: 'caso', referencia: acao.processoId }] : []), links: [], acao: cartao, ...extra }
}

const link = (i: ItemDoChat): LinkDoChat => ({ rotulo: `${i.cliente} · ${i.acao}`, sub: i.sub, href: i.href })
const primeiro = (nome: string) => nome.split(' ')[0]
/**
 * As pessoas de exemplo por perfil, para o chat dizer de quem é a tarefa. Eram as do "Trocar perfil", que saiu com o login
 * (o Atendimento é a Ana, como na semente do servidor). Ao ligar no servidor (GGVP-125), vêm de lá.
 */
const PESSOAS_POR_PERFIL: { id: IdPerfil; rotulo: string; usuario: string }[] = [
  { id: 'atendimento', rotulo: 'Atendimento', usuario: 'Ana (exemplo)' },
  { id: 'atendimento-lider', rotulo: 'Atendimento · líder', usuario: 'Carla (exemplo)' },
  { id: 'advogada', rotulo: 'Advogada', usuario: 'Dra. Paula (exemplo)' },
  { id: 'senior', rotulo: 'Sênior', usuario: 'Dra. Renata (exemplo)' },
  { id: 'financeiro', rotulo: 'Financeiro', usuario: 'Marcos (exemplo)' },
  { id: 'documentacao', rotulo: 'Documentação', usuario: 'Jéssica (exemplo)' },
  { id: 'juridico-adm', rotulo: 'Jurídico administrativo', usuario: 'Igor (exemplo)' },
]
const rotuloDoPerfil = (id: string) => PESSOAS_POR_PERFIL.find((p) => p.id === id)?.rotulo ?? 'Atendimento'

/** A pessoa do perfil, pelo nome, com o setor do escritório (pessoasDoEscritorio, a mesma da conversa). */
function pessoas(): Pessoa[] {
  const vistas = new Set<string>()
  return pessoasDoEscritorio().filter((p) => !vistas.has(p.nome) && vistas.add(p.nome))
}
const perfilDaPessoa = (nome: string) => PESSOAS_POR_PERFIL.find((p) => p.usuario === nome)?.id
const advogadaDoCaso = () => PESSOAS_POR_PERFIL.find((p) => p.id === 'advogada')!.usuario
/** "Dra. Paula (exemplo)" → "a Dra. Paula"; "Igor (exemplo)" → "Igor". */
const comArtigo = (nome: string) => {
  const curto = nome.replace(/\s*\(exemplo\)$/, '')
  return /^(Dra|Sra)\.? /.test(curto) ? `a ${curto}` : /^(Dr|Sr)\.? /.test(curto) ? `o ${curto}` : curto
}

/**
 * As recusas que valem antes de tudo, na hora (sem esperar o servidor): pular o parecer médico (G17) e pedir para esconder
 * ou mudar a situação real na perícia (G11, a recusa fica registrada). As mesmas em toda Central e na aba Suporte.
 */
export function recusaImediata(texto: string, quem: string): string | null {
  const parecer = recusaDoChat(texto)
  if (parecer) return parecer
  const fraude = recusaDoChatNaPericia(texto)
  if (fraude) {
    registrarRecusaDoChat(texto, quem)
    return fraude
  }
  return null
}

/** O cliente citado na mensagem: um, nenhum ou vários. */
async function clienteCitado(texto: string) {
  const achados = await identificarCliente(texto)
  return achados
}

/** O caso citado: o cliente da mensagem (e o processo dele, quando tem) ou o processo do contexto (o chat aberto num caso). */
type Citado = { ficha: { id: string; nome: string }; processoId?: string }

async function casoCitado(texto: string, processoId: string | undefined): Promise<Citado | { erro: string } | null> {
  const achados = await clienteCitado(texto)
  if (achados.length > 1) return { erro: `O nome bate com mais de um cliente (${achados.map((a) => a.nome).join(', ')}). Escreva o nome completo.` }
  const banco = ler()
  if (achados.length === 1) {
    const ficha = banco.fichas.find((f) => f.id === achados[0].id)!
    // Com mais de um processo, o benefício citado escolhe; sem citar, o primeiro.
    const t = semAcento(texto)
    const processo = ficha.processos.find((p) => t.includes(semAcento(p.beneficio).split('-').slice(-1)[0])) ?? ficha.processos[0]
    return { ficha: { id: ficha.id, nome: ficha.nome }, processoId: processo?.id }
  }
  if (processoId) {
    const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
    if (ficha) return { processoId, ficha: { id: ficha.id, nome: ficha.nome } }
  }
  return null
}

/** CA1: o caso que o perfil vê, citado e com o passo onde ele está, com o link para abrir. Lead sem processo: a ficha. */
async function consultarCaso(texto: string, quem: QuemPergunta, processoId?: string): Promise<RespostaDoChat> {
  const achado = await casoCitado(texto, processoId)
  if (!achado) return resposta('Não identifiquei o cliente nem o caso. Escreva o nome completo do cliente, ou pergunte de dentro da página do processo.')
  if ('erro' in achado) return resposta(achado.erro)
  if (!achado.processoId) {
    const ficha = ler().fichas.find((f) => f.id === achado.ficha.id)!
    const hoje = hojeIso(agora())
    const agendado = ficha.agendamentos.find((a) => a.data >= hoje)
    return resposta(
      `${ficha.nome} ainda é lead, sem processo aberto.${agendado ? ` ${agendado.oQue} em ${dataCurta(agendado.data, hoje)}, às ${agendado.hora}${agendado.com ? `, com ${agendado.com}` : ''}.` : ''}`,
      [{ rotulo: `${ficha.nome} · Abrir a ficha`, sub: 'lead', href: `/clientes/${ficha.id}` }],
      [{ tipo: 'caso', referencia: ficha.id }],
    )
  }
  const caso = (await obterCaso(achado.processoId, quem))!
  const atual = caso.etapas.find((e) => e.estado === 'atual')!
  const partes = [`${caso.ficha.nome} (${caso.beneficio.toLowerCase()}) está em ${atual.rotulo} · ${caso.passoAtual} (${caso.identificacao.rotulo} ${caso.identificacao.valor}).`]
  if (caso.processo.proximaAcao) partes.push(`Próxima ação: ${caso.processo.proximaAcao}${caso.processo.prazo ? `, ${caso.processo.prazo}` : ''}.`)
  if (caso.emPericia) partes.push(`${caso.emPericia.rotulo}: ${caso.emPericia.situacao.toLowerCase()}, com ${caso.emPericia.responsavel}.`)
  if (caso.pendentes?.setores.length) partes.push(`Falta ${caso.pendentes.setores.join(' e ')} subir o card.`)
  for (const e of caso.esperas) partes.push(`Esperando ${e.quem === 'inss' ? 'o INSS' : e.quem === 'justica' ? 'a Justiça' : `o ${e.quem}`}: ${e.oQue}${e.prazo ? ` (prazo ${dataCurta(e.prazo, hojeIso(agora()))})` : ''}.`)
  return resposta(
    partes.join(' '),
    [{ rotulo: `${caso.ficha.nome} · Abrir o caso`, sub: `${atual.rotulo} · ${caso.passoAtual}`, href: `/casos/${achado.processoId}` }],
    [{ tipo: 'caso', referencia: achado.processoId }, ...caso.linha.slice(-1).map((e): FonteDaIa => ({ tipo: 'caso', referencia: `${e.passo} · ${e.oQue}` }))],
  )
}

/** CA2: valores só com a permissão do perfil (podeVerValor); sem ela, responde que não tem acesso e não revela nada. */
async function consultarValor(texto: string, quem: QuemPergunta, processoId?: string): Promise<RespostaDoChat> {
  const achado = await casoCitado(texto, processoId)
  const t = semAcento(texto)
  const tipo = /prestac|rpv|atrasad|recebe/.test(t) ? 'prestacao-de-contas' : /renda/.test(t) ? 'renda-por-pessoa' : 'causa'
  const banco = ler()
  const c = achado && !('erro' in achado) && achado.processoId ? complementoDo(banco, achado.processoId) : undefined
  const pode = podeVerValor(quem.id, tipo, { advogadaDoCaso: !!c && quem.usuario === c.advogada, naPrestacaoDeContas: !!c?.naPrestacaoDeContas })
  if (!pode) {
    return recusa(
      `Seu perfil (${rotuloDoPerfil(quem.id)}) não tem acesso a esse valor: valores são do Financeiro e do Sócio${tipo === 'prestacao-de-contas' ? ' (a advogada vê a prestação de contas do caso dela)' : ''}. Não posso mostrar o dado.`,
    )
  }
  if (!achado || 'erro' in achado || !achado.processoId) return resposta('De qual cliente? Escreva o nome completo.')
  const valor = (c?.valores ?? []).find((v) => v.tipo === tipo)
  if (!valor) return resposta(`${achado.ficha.nome} ainda não tem ${tipo === 'causa' ? 'valor da causa' : tipo === 'renda-por-pessoa' ? 'renda por pessoa' : 'prestação de contas'} lançado no caso.`)
  return resposta(`${valor.rotulo} de ${achado.ficha.nome}: ${valor.valor}. O valor vem do documento do caso; não calculo valor nem honorários (G19).`, [
    { rotulo: `${achado.ficha.nome} · Abrir o caso`, href: `/casos/${achado.processoId}` },
  ], [{ tipo: 'documento', referencia: `${achado.processoId} · ${valor.rotulo}` }])
}

/** CA10: a jurimetria do perito ou do juízo. Os números vêm do sistema, com o número de casos e sem amostra mínima; a IA só resume e cita as fontes. */
function jurimetria(texto: string, quem: QuemPergunta): RespostaDoChat {
  if (visaoDoPerfil(quem.id) !== 'juridico') return recusa('A jurimetria é do Jurídico: seu perfil não tem acesso a ela.')
  const banco = ler()
  const t = semAcento(texto)
  const nome = (n: string) => semAcento(n.replace(/\s*\(exemplo\)$/, ''))
  const perito = peritosDo(banco).find((p) => t.includes(nome(p.nome).split(' ').at(-1)!))
  if (perito) {
    const perfil = perfilDoPerito(perito)
    const j = perfil.jurimetria
    const doAssunto = perfil.porAssunto.find((a) => t.includes(semAcento(a.assunto).split(' ')[0]))
    const hoje = hojeIso(agora())
    const numeros = `laudos favoráveis ${numerosDaJurimetria(j, hoje)}${doAssunto ? `; em ${doAssunto.assunto}, ${numerosDaJurimetria(doAssunto.jurimetria, hoje)}` : ''}; laudo em ${j.diasAteOLaudo} dias em média`
    const links = (comoOPeritoAvalia(texto)?.itens ?? []).map(link)
    return resposta(
      `${perito.nome}, pelo acervo: ${numeros}. Pelos laudos, costuma observar ${perfil.observou.slice(0, 2).join(' e ')} e perguntar ${perfil.perguntou.join(' e ')}. Os números são do sistema; eu só resumo os laudos.`,
      links,
      [
        { tipo: 'regra', referencia: 'jurimetria calculada pelo sistema, sem amostra mínima (Lucas, 06/10)' },
        ...perito.laudos.slice(-3).map((l): FonteDaIa => ({ tipo: 'acervo', referencia: l.caso, trecho: `${l.assunto} · ${l.resultado === 'favoravel' ? 'favorável' : 'desfavorável'}` })),
      ],
    )
  }
  const juizo = (banco.juizos ?? juizosDeExemplo()).find((j) => t.includes(semAcento(j.nome).replace(/\s*\(exemplo\)$/, '').split(' ').slice(-2).join(' ')))
  if (juizo) {
    const j = jurimetriaDoJuizoDoCaso(juizo.id)!
    return resposta(
      `${juizo.nome}, pelo acervo: ${j.numeros.porBeneficio.map((b) => `${b.nome.toLowerCase()} ${b.texto}`).join('; ')}; sentença em ${j.numeros.mesesAteASentenca} meses em média. Entendimentos: ${juizo.entendimentos[0].toLowerCase()}.`,
      j.processos.map((p) => ({ rotulo: `${p.cliente} · Abrir o caso`, sub: p.sub, href: `/casos/${p.processoId}` })),
      [{ tipo: 'regra', referencia: 'jurimetria calculada pelo sistema, sem amostra mínima (Lucas, 06/10)' }, { tipo: 'acervo', referencia: `${juizo.id} · ${j.numeros.casos} decisões` }],
    )
  }
  return resposta('Diga o nome do perito ou do juízo: eu mostro os números do sistema e o que ele costuma avaliar.')
}

/** "O cliente me ligou" no Atendimento (GGVP-111, CA7): a próxima tarefa, sempre com o lembrete de confirmar a identidade. */
async function clienteLigouNoAtendimento(texto: string): Promise<RespostaDoChat> {
  const achados = await clienteCitado(texto)
  if (achados.length !== 1) {
    return resposta(
      achados.length === 0
        ? 'Não identifiquei o cliente. Escreva o nome completo de quem ligou.'
        : `O nome bate com mais de um cliente (${achados.map((a) => a.nome).join(', ')}). Escreva o nome completo.`,
    )
  }
  const ficha = ler().fichas.find((f) => f.id === achados[0].id)!
  const nome = primeiro(ficha.nome)
  const caso = ficha.processos[0]
  // A perícia vive na tela dela (épico GGVP-10): o caso em perícia não tem a próxima ação do Atendimento no processo.
  const pericia = caso && periciaDoCliente(ficha.id)
  const proxima = caso?.proximaAcao
    ? `A próxima tarefa de ${nome} (${caso.etapa}) é ${caso.proximaAcao}${caso.prazo ? `, ${caso.prazo}` : ''}.`
    : pericia
      ? `${nome} está em perícia (${pericia}): a próxima tarefa é do Jurídico administrativo, na página da perícia.`
      : `${nome} não tem caso em andamento: veja a ficha.`
  return resposta(`${proxima} ${LEMBRETE_DA_IDENTIDADE}`, caso ? [{ rotulo: `${ficha.nome} · Abrir o caso`, sub: caso.etapa, href: `/casos/${caso.id}` }] : [])
}

/** O prazo citado no pedido: "hoje", "amanhã" ou uma data (pela biblioteca campos). */
function prazoCitado(texto: string): string | undefined {
  const hoje = hojeIso(agora())
  const t = semAcento(texto)
  if (/\bamanha\b/.test(t)) return somarDias(hoje, 1)
  if (/\bhoje\b/.test(t)) return hoje
  const data = /\b(\d{1,2}\/\d{1,2}(\/\d{2,4})?)\b/.exec(texto)?.[1]
  if (!data) return undefined
  const completa = data.split('/').length === 2 ? `${data}/${hoje.slice(0, 4)}` : data
  return dataParaIso(normalizarData(completa)) ?? undefined
}

/** CA7, CA9: monta o cartão da tarefa com o responsável pela regra e o título pela lista fixa de quem vai fazer. */
async function cartaoDaTarefa(
  texto: string,
  quem: QuemPergunta,
  processoId?: string,
  fixo?: { pessoa: Pessoa; acao: string; foraDoPerfil?: string; /** Tarefa sem cliente: o contexto no lugar do nome (Glossário 2110:2). */ contexto?: string },
): Promise<RespostaDoChat> {
  const achado = await casoCitado(texto, processoId)
  if (achado && 'erro' in achado) return resposta(achado.erro)
  const cliente = achado?.ficha
  const quemPediu = pessoas().find((p) => p.nome === quem.usuario) ?? { nome: quem.usuario, setor: 'Atendimento' }
  let pessoa = fixo?.pessoa
  if (!pessoa) {
    const r = responsavelDaTarefa(texto, quemPediu, pessoas())
    if (r.tipo === 'perguntar-setor') return pergunta(`Quem do setor ${r.setor} fica com a tarefa?`, r.opcoes.map((p) => p.nome))
    if (r.tipo === 'perguntar-quem') return pergunta('Para quem é a tarefa?', r.opcoes.map((p) => p.nome))
    pessoa = r.pessoa
  }
  if (!cliente && !fixo?.contexto) return resposta('De qual cliente é a tarefa? Escreva o nome completo; o título da tarefa leva o nome dele.')
  const grupo = grupoDoPerfil(perfilDaPessoa(pessoa.nome))
  const acao = fixo?.acao ?? acaoDaLista(texto, grupo)
  if (!acao) return pergunta(`Qual é a tarefa de ${pessoa.nome}? O título usa uma ação da lista fixa do perfil dela.`, [...ACOES_SUGERIDAS(grupo)])
  const prazo = prazoCitado(texto)
  const titulo = tituloDaTarefa(cliente?.nome ?? fixo!.contexto!, acao)
  const hoje = hojeIso(agora())
  const processo = achado?.processoId
  const texto1 = fixo?.foraDoPerfil ?? `${pessoa.nome} (${pessoa.setor}) fica com a tarefa. Confira antes de eu criar.`
  return comCartao(
    texto1,
    {
      tipo: 'criar-tarefa',
      titulo,
      cliente,
      processoId: processo,
      passos: [`Criar a tarefa «${titulo}» na Central de ${pessoa.nome}${prazo ? `, para ${dataCurta(prazo, hoje)}` : ''}`, 'Registrar no histórico do caso: feito pelo chat, com o seu nome e a hora'],
      conferir: ['O cliente e a ação', 'Quem fica com a tarefa (Trocar, se não for essa pessoa)'],
      travas: [],
      responsavel: { nome: pessoa.nome, setor: pessoa.setor },
      foraDoPerfil: fixo?.foraDoPerfil ? true : undefined,
      rotuloConfirmar: fixo?.foraDoPerfil ? `Criar tarefa para ${comArtigo(pessoa.nome)}` : 'Confirmar e criar a tarefa',
    },
    quem,
    texto,
    { prazo, detalhe: texto.slice(0, 140) },
  )
}

/** As ações da lista fixa que o chat oferece quando o pedido não cita uma (as primeiras da lista de quem vai fazer). */
function ACOES_SUGERIDAS(grupo: ReturnType<typeof grupoDoPerfil>): string[] {
  return ({
    atendimento: ['Cobrar documento', 'Cumprir pendência', 'Recontatar lead', 'Agendar ida ao banco'],
    'juridico-adm': ['Marcar perícia', 'Orientar para a perícia', 'Protocolar no INSS'],
    advogada: ['Analisar laudo novo', 'Pedir petição', 'Ligar para o cliente', 'Responder exigência do INSS'],
    senior: ['Aprovar pedido', 'Despachar caso', 'Decidir cobrança'],
    financeiro: ['Lançar prestação de contas', 'Confirmar recebimento'],
  } as const)[grupo] as unknown as string[]
}

/** CA8: fora do perfil, o chat recusa, diz de quem é e oferece o cartão "Criar tarefa para" quem pode. */
async function foraDoMeuPerfil(texto: string, intencao: Intencao, quem: QuemPergunta, processoId?: string): Promise<RespostaDoChat | null> {
  const fora = foraDoPerfil(intencao, quem.id)
  if (!fora) return null
  const dono = fora.dono === 'advogada' ? advogadaDoCaso() : PESSOAS_POR_PERFIL.find((p) => grupoDoPerfil(p.id) === fora.dono)!.usuario
  const pessoa = pessoas().find((p) => p.nome === dono)!
  const oQue = intencao === 'pedir-peca' ? 'não gera peça jurídica' : intencao === 'subir-acervo' ? 'não alimenta o acervo' : 'não marca a perícia'
  const explica = `Seu perfil (${rotuloDoPerfil(quem.id)}) ${oQue}: isso é ${fora.quem}. Posso criar a tarefa para ${comArtigo(dono)}.`
  const r = await cartaoDaTarefa(texto, quem, processoId, { pessoa, acao: fora.acao, foraDoPerfil: explica, contexto: intencao === 'subir-acervo' ? 'Acervo' : undefined })
  return r.tipo === 'acao' ? { ...r, tipo: 'recusa', acao: r.acao } : r
}

/** O pedido de peça da advogada (Figma 2186:211): a IA escreve a minuta para ela conferir e assinar (G6). Escrever é da GGVP-63. */
async function pedirPeca(texto: string, quem: QuemPergunta, processoId?: string): Promise<RespostaDoChat> {
  const achado = await casoCitado(texto, processoId)
  if (!achado || 'erro' in achado || !achado.processoId) return resposta(achado && 'erro' in achado ? achado.erro : 'De qual cliente é a peça? Escreva o nome completo.')
  const t = semAcento(texto)
  const acao = /manifest|exigenc|laudo/.test(t) ? 'Manifestar no processo' : 'Pedir petição'
  const titulo = tituloDaTarefa(achado.ficha.nome, acao)
  return comCartao(
    `Vou pedir a minuta com o modelo da casa e as decisões parecidas do acervo. Confira antes de eu pedir.`,
    {
      tipo: 'pedir-peca',
      titulo,
      cliente: achado.ficha,
      processoId: achado.processoId,
      passos: ['Pedir à IA a minuta, com o modelo da casa e as decisões parecidas do acervo (fontes citadas na minuta)', `A minuta entra na sua tarefa «${tituloDaTarefa(achado.ficha.nome, 'Conferir petição')}»`],
      conferir: ['O cliente e o tipo de peça'],
      travas: ['Você confere e assina (G6): a IA não assina nem protocola', 'Petição só com o parecer médico "Suficiente" confirmado por pessoa (G17)'],
      rotuloConfirmar: 'Confirmar e pedir a minuta',
    },
    quem,
    texto,
  )
}

/** CA12: o arquivo anexado vira um cartão com os passos, o que conferir e as travas do caso. */
async function anexos(texto: string, arquivos: AnexoNaPergunta[], quem: QuemPergunta, processoId?: string): Promise<RespostaDoChat> {
  for (const a of arquivos) {
    const problema = problemaDoArquivo(a)
    if (problema) return resposta(`Esse arquivo não segue: ${problema}`)
  }
  const nomes = arquivos.map((a) => a.nome)
  const tipo = tipoDoAnexo(texto, nomes)
  const grupo = grupoDoPerfil(quem.id)

  if (tipo === 'acervo') {
    const fora = await foraDoMeuPerfil(texto, 'subir-acervo', quem, processoId)
    if (fora) return fora
    return comCartao(
      `Recebi ${arquivos.length} PDFs para o acervo. Confira antes de eu guardar.`,
      {
        tipo: 'subir-acervo',
        titulo: `Acervo · ${arquivos.length} processos`,
        passos: [`Guardar os ${arquivos.length} PDFs no acervo`, 'A IA lê cada um e tira o nome e o CPF: o acervo guarda só a referência do caso', 'O que não der para ler fica de fora das contas, e nada trava', 'O sistema recalcula a jurimetria'],
        conferir: ['Os arquivos são de processos do escritório'],
        travas: ['O acervo não guarda dado pessoal do cliente', 'Toda jurimetria do acervo conta, sem amostra mínima (Lucas, 06/10)'],
        rotuloConfirmar: 'Confirmar e guardar no acervo',
      },
      quem,
      texto,
      { arquivos: nomes },
    )
  }

  const achados = await identificarCliente(`${texto} ${nomes.join(' ')}`)
  const doQue = tipo === 'laudo' ? 'o laudo' : tipo === 'documento' ? 'o documento' : 'o comprovante'
  if (achados.length !== 1) {
    return resposta(
      achados.length === 0
        ? `Não identifiquei de quem é ${doQue}. Escreva o nome completo do cliente e envie de novo com o arquivo.`
        : `O nome bate com mais de um cliente (${achados.map((a) => a.nome).join(', ')}). Escreva o nome completo e envie de novo com o arquivo.`,
    )
  }
  const [cliente] = achados
  const ficha = ler().fichas.find((f) => f.id === cliente.id)!
  const caso = ficha.processos[0]
  const arquivo = arquivos[0]

  if (tipo === 'comprovante-inss') {
    if (grupo !== 'juridico-adm' && grupo !== 'advogada') return (await foraDoMeuPerfil(texto, 'marcar', quem, processoId))!
    if (formatoDoArquivo(arquivo.nome) !== 'pdf') return resposta('Esse arquivo não segue: o comprovante do INSS é um PDF.')
    const pericia = periciaParaMarcarDaFicha(cliente.id)
    if (!pericia) return resposta(`${cliente.nome} não tem perícia esperando marcação. Confira o cliente e envie de novo.`)
    const lido = await lerComprovante(pericia.processoId, arquivo.nome)
    const hoje = hojeIso(agora())
    return comCartao(
      `Li o comprovante do INSS e identifiquei o cliente: ${cliente.nome} (${pericia.beneficio.toLowerCase()}). O PDF traz data, hora, local e tipo da perícia; o perito não vem no comprovante.`,
      {
        tipo: 'marcar-pericia',
        titulo: `Marcar a perícia · ${cliente.nome}`,
        cliente: { id: cliente.id, nome: cliente.nome },
        processoId: pericia.processoId,
        passos: [`Subir ${arquivo.nome} na pasta do cliente`, `Agendar: ${NOMES_DO_TIPO[lido.tipo]} em ${dataCurta(lido.data, hoje)}, ${lido.hora}, ${lido.local}`, 'Dar baixa no DP.02; o próximo passo é ligar e orientar (DP.06)'],
        conferir: ['Data, hora e local, no comprovante'],
        travas: ['Você confere data, hora e local antes de confirmar. A IA não escolhe nem sugere o perito.'],
        escolha: { pergunta: 'A perícia pede documento novo?', opcoes: ['Sim: atribuir à Documentação', 'Não'] },
        rotuloConfirmar: 'Confirmar e marcar',
      },
      quem,
      texto,
      { lido, arquivo: arquivo.nome },
    )
  }

  if (tipo === 'comprovante-rpv') {
    if (grupo !== 'financeiro' && quem.id !== 'socio') {
      return recusa(`Lançar o comprovante na prestação de contas é do Financeiro. Seu perfil (${rotuloDoPerfil(quem.id)}) pode subir o arquivo na pasta pela ficha do cliente.`)
    }
    return comCartao(
      `Li o arquivo e identifiquei o cliente: ${cliente.nome}. É um comprovante de pagamento (RPV). Confira antes de eu lançar.`,
      {
        tipo: 'lancar-comprovante',
        titulo: `${cliente.nome} · Lançar prestação de contas`,
        cliente: { id: cliente.id, nome: cliente.nome },
        processoId: caso?.id,
        passos: [`Subir ${arquivo.nome} na pasta do processo`, 'Lançar na prestação de contas o valor que está no comprovante: você confere', `Pedir o OK da advogada na prestação de contas (tarefa «${tituloDaTarefa(cliente.nome, 'Aprovar prestação de contas')}»)`],
        conferir: ['O cliente e o processo do comprovante', 'O valor e a data, no próprio comprovante'],
        travas: ['O valor vem do comprovante; a IA não calcula honorários (G19)', 'O aviso ao cliente só sai depois do OK da advogada (G8)'],
        rotuloConfirmar: 'Confirmar e lançar',
      },
      quem,
      texto,
      { arquivo: arquivo.nome, tipoDoArquivo: 'outro' },
    )
  }

  if (tipo === 'laudo') {
    return comCartao(
      `Li o arquivo e identifiquei o cliente: ${cliente.nome}${cliente.beneficio ? ` (${cliente.beneficio.toLowerCase()})` : ''}. Posso subir na pasta dele e avisar o Jurídico. A IA lê, resume e compara com o laudo em uso para a advogada; você só sobe e confirma.`,
      {
        tipo: 'anexar-laudo',
        titulo: `Atualizar o laudo · ${cliente.nome}`,
        cliente: { id: cliente.id, nome: cliente.nome },
        processoId: caso?.id,
        passos: [`Subir ${arquivo.nome} na pasta do cliente`, 'Marcar «Laudo novo» na ficha e no processo', 'Avisar a advogada responsável (D1.21M), com o resumo e a comparação da IA'],
        conferir: ['O cliente do laudo'],
        travas: [visaoDoPerfil(quem.id) === 'juridico' ? 'Você confere o resumo e a comparação da IA na análise do laudo (D1.21M).' : 'Você não vê o conteúdo do laudo (G17); só a advogada vê o resumo.'],
        rotuloConfirmar: 'Confirmar e enviar ao Jurídico',
      },
      quem,
      texto,
      { arquivo: arquivo.nome, tipoDoArquivo: 'laudo' },
    )
  }

  return comCartao(
    `Li o arquivo e identifiquei o cliente: ${cliente.nome}. Confira antes de eu subir.`,
    {
      tipo: 'enviar-documento',
      titulo: `Subir documento · ${cliente.nome}`,
      cliente: { id: cliente.id, nome: cliente.nome },
      processoId: caso?.id,
      passos: [`Subir ${arquivos.length === 1 ? arquivo.nome : `${arquivos.length} arquivos`} na pasta do cliente`, 'A IA lê e classifica; a Documentação confere (D1.18)'],
      conferir: ['O cliente certo'],
      travas: visaoDoPerfil(quem.id) === 'juridico' ? [] : ['Se for documento médico, o conteúdo é só do Jurídico'],
      rotuloConfirmar: 'Confirmar e subir',
    },
    quem,
    texto,
    { arquivos: nomes, tipoDoArquivo: 'outro' },
  )
}

/**
 * POST /api/chat: o caminho único do chat (CA1 a CA12). Na ordem: as recusas, os portões, os anexos, o que é de outro
 * perfil, as ações (com cartão) e as consultas. Nada executa aqui.
 */
export async function perguntar(p: { texto: string; anexos?: AnexoNaPergunta[]; processoId?: string }, quem: QuemPergunta): Promise<RespostaDoChat> {
  await esperar()
  const texto = p.texto.trim()
  const imediata = recusaImediata(texto, quem.usuario)
  if (imediata) return recusa(imediata, /\(G(\d+)\)/.exec(imediata)?.[0].slice(1, -1))
  if (p.anexos?.length) return anexos(texto, p.anexos, quem, p.processoId)

  // "O que é o G8?": o Suporte explica o portão (Figma 60:2).
  const g = portaoCitado(texto)
  if (g && !/\b(cri|abr)\w* (uma |a )?tarefa/i.test(texto)) return resposta(`${g}: ${PORTOES[g]} Nenhuma tela nem o chat contornam um portão.`, [], [{ tipo: 'regra', referencia: g }])

  const intencao = entenderPedido(texto)
  const grupo = grupoDoPerfil(quem.id)

  if (intencao === 'protocolar') {
    const achado = await casoCitado(texto, p.processoId)
    const caso = achado && !('erro' in achado) && achado.processoId ? await obterCaso(achado.processoId, quem) : null
    const portao = portaoDoPedido(intencao, texto, { fase: caso?.fase, aprovadoPelaSenior: caso?.linha.some((e) => e.passo === 'D2.01') })
    if (portao) return recusa(portao.texto, portao.portao)
    const igor = pessoas().find((x) => perfilDaPessoa(x.nome) === 'juridico-adm')!
    return cartaoDaTarefa(texto, quem, p.processoId, { pessoa: igor, acao: 'Protocolar no INSS' })
  }
  const portao = portaoDoPedido(intencao, texto)
  if (portao) return recusa(portao.texto, portao.portao)

  const fora = await foraDoMeuPerfil(texto, intencao, quem, p.processoId)
  if (fora) return fora

  switch (intencao) {
    case 'criar-tarefa':
      return cartaoDaTarefa(texto, quem, p.processoId)
    case 'pedir-peca':
      return pedirPeca(texto, quem, p.processoId)
    case 'marcar': {
      const t = semAcento(texto)
      if (/pericia|avaliac/.test(t) && grupo === 'advogada') {
        const igor = pessoas().find((x) => perfilDaPessoa(x.nome) === 'juridico-adm')!
        return cartaoDaTarefa(texto, quem, p.processoId, { pessoa: igor, acao: 'Marcar perícia' })
      }
      if (/pericia|avaliac/.test(t)) {
        return resposta('Para marcar a perícia, marque no Meu INSS e anexe aqui o comprovante (PDF): eu leio data, hora, local e tipo e mostro o cartão para você confirmar.', periciasParaMarcar().map(link))
      }
      const achado = await casoCitado(texto, p.processoId)
      if (!achado || 'erro' in achado) return resposta(achado ? achado.erro : 'De qual cliente? Escreva o nome completo.')
      return resposta('Escolha o horário livre na agenda: a tela mostra a sala e quem está livre.', [{ rotulo: `${achado.ficha.nome} · Marcar na agenda`, href: `/agenda/marcar/${achado.ficha.id}` }])
    }
    case 'pericias-semana': {
      const r = periciasDaSemana()
      return resposta(r.texto, r.itens.map(link), [{ tipo: 'regra', referencia: 'perícias marcadas de hoje a seis dias (código)' }])
    }
    case 'pericias-marcar': {
      const itens = periciasParaMarcar()
      if (itens.length === 0) return resposta('Nenhuma perícia espera marcação agora.')
      const n = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove'][itens.length] ?? String(itens.length)
      return resposta(`${n} ${itens.length === 1 ? 'perícia espera' : 'perícias esperam'} você. Marque no portal do INSS e suba o comprovante: eu leio data, hora, local e tipo.`, itens.map(link))
    }
    case 'cliente-ligou':
      if (grupo === 'juridico-adm') {
        const r = clienteLigou(texto)
        return resposta(r.texto, (r.itens ?? []).map(link))
      }
      return clienteLigouNoAtendimento(texto)
    case 'dica-pericia': {
      if (visaoDoPerfil(quem.id) !== 'juridico') return recusa('A orientação da perícia é do Jurídico administrativo: seu perfil não tem acesso a ela.')
      const dica = await dicaParaAPericia(texto)
      return dica ? resposta(dica.texto, dica.itens.map(link)) : resposta('Não achei a orientação: diga o nome do cliente da perícia marcada.')
    }
    case 'jurimetria':
      return jurimetria(texto, quem)
    case 'prestacoes': {
      if (!podeVerValor(quem.id, 'prestacao-de-contas', { advogadaDoCaso: quem.id === 'advogada', naPrestacaoDeContas: true })) {
        return recusa(`Seu perfil (${rotuloDoPerfil(quem.id)}) não tem acesso à prestação de contas: é do Financeiro e do Sócio. Não posso mostrar o dado.`)
      }
      const banco = ler()
      const casos = (banco.casos ?? []).filter((c) => c.naPrestacaoDeContas && (quem.id !== 'advogada' || c.advogada === quem.usuario))
      const links = casos.map((c) => {
        const ficha = banco.fichas.find((f) => f.processos.some((x) => x.id === c.processoId))!
        return { rotulo: tituloDaTarefa(ficha.nome, 'Lançar prestação de contas'), sub: 'aguardando o OK da advogada (G8)', href: `/casos/${c.processoId}` }
      })
      return resposta(
        casos.length ? `${casos.length === 1 ? 'Uma prestação espera' : `${casos.length} prestações esperam`} o OK da advogada antes do lançamento (G8).` : 'Nenhuma prestação de contas chegou.',
        links,
      )
    }
    case 'limite': {
      const itens = tarefasDeDecidirCobranca()
      return resposta(
        itens.length ? `${itens.length === 1 ? 'Um caso passou' : `${itens.length} casos passaram`} do limite de cobranças (G15).` : 'Nenhum caso passou do limite hoje.',
        itens.map((t: Tarefa) => ({ rotulo: `${t.cliente?.nome ?? t.contexto} · ${t.acao}`, sub: t.detalhe, href: t.href ?? '/' })),
        [{ tipo: 'regra', referencia: 'G15' }],
      )
    }
    case 'subir-acervo':
      return resposta('Anexe os PDFs dos processos encerrados: eu mostro o cartão com o que vou fazer antes de guardar no acervo.')
    case 'valor':
      return consultarValor(texto, quem, p.processoId)
    default:
      return consultarCaso(texto, quem, p.processoId)
  }
}

/** A ação feita pelo chat entra no histórico do caso com o nome, a hora e "feito pelo chat" (CA5). */
function registrarNoCaso(processoId: string | undefined, quem: string, oQue: string, passo: string) {
  if (!processoId) return
  const banco = ler()
  const processo = banco.fichas.flatMap((f) => f.processos).find((p) => p.id === processoId)
  if (!processo) return
  complementoDo(banco, processoId).linha.push({ quando: agora().toISOString(), quem, tipo: 'pessoa', oQue, passo, etapa: etapaAtual(processo.etapa), peloChat: true })
  gravar(banco)
}

/** Grava a tarefa criada pelo chat: entra na Central de quem vai fazer e no caso. */
function criarTarefa(t: Omit<TarefaDoChat, 'id' | 'criadaEm'>): TarefaDoChat {
  const banco = ler()
  const tarefa = { ...t, id: `chat-${(banco.tarefasDoChat?.length ?? 0) + 1}`, criadaEm: agora().toISOString() }
  ;(banco.tarefasDoChat ??= []).push(tarefa)
  gravar(banco)
  return tarefa
}

export type ResultadoDaAcao = { texto: string; links: LinkDoChat[]; estado: 'feito' | 'sem-pasta' }

/**
 * POST /api/chat/acoes/:id: o clique em "Confirmar". Só aqui a ação acontece, pelas funções que já existem no servidor de
 * exemplo, com as mesmas travas. `arquivos`: o conteúdo dos anexos, para o hash e o envio.
 */
export async function confirmarAcao(
  acaoId: string,
  quem: QuemPergunta,
  o: { responsavel?: string; escolha?: string; arquivos?: { nome: string; tamanho: number; conteudo: ArrayBuffer }[] } = {},
): Promise<ResultadoDaAcao> {
  const p = pendentes.get(acaoId)
  if (!p) throw new Error('Esse cartão já foi usado ou expirou. Peça de novo.')
  if (p.quem.usuario !== quem.usuario) throw new Error('Só quem pediu confirma o cartão.')
  const { acao } = p
  if (acao.escolha && !o.escolha) throw new Error(`Responda antes: ${acao.escolha.pergunta}`)
  const arquivo = async (nome: string, tipo: string) => {
    const a = o.arquivos?.find((x) => x.nome === nome)
    const formato = formatoDoArquivo(nome)
    if (!a || !formato) throw new Error('Anexe o arquivo de novo.')
    return { nome, formato, tamanho: a.tamanho, tipo, hash: await hashDoConteudo(a.conteudo) }
  }
  let r: ResultadoDaAcao
  switch (acao.tipo) {
    case 'criar-tarefa': {
      const nome = o.responsavel ?? acao.responsavel!.nome
      const pessoa = pessoas().find((x) => x.nome === nome)
      if (!pessoa) throw new Error('Escolha alguém do escritório.')
      // Trocou o responsável: a ação vem da lista fixa do novo perfil, quando o pedido cita uma (CA9).
      const acaoDoTitulo = nome === acao.responsavel!.nome ? acao.titulo.split(' · ').slice(1).join(' · ') : (acaoDaLista(p.texto, grupoDoPerfil(perfilDaPessoa(nome))) ?? acao.titulo.split(' · ').slice(1).join(' · '))
      const titulo = tituloDaTarefa(acao.cliente?.nome ?? acao.titulo.split(' · ')[0], acaoDoTitulo)
      criarTarefa({ processoId: acao.processoId, cliente: acao.cliente, acao: acaoDoTitulo, titulo, detalhe: String(p.dados.detalhe ?? ''), responsavel: pessoa.nome, setor: pessoa.setor, prazo: p.dados.prazo as string | undefined, criadaPor: quem.usuario })
      registrarNoCaso(acao.processoId, quem.usuario, `Criou a tarefa «${titulo}» para ${pessoa.nome}`, 'GGVP-82')
      r = { estado: 'feito', texto: `✓ Feito: tarefa «${titulo}» criada para ${pessoa.nome}.`, links: acao.processoId ? [{ rotulo: 'Abrir o caso', href: `/casos/${acao.processoId}` }] : [] }
      break
    }
    case 'pedir-peca': {
      const titulo = tituloDaTarefa(acao.cliente!.nome, 'Conferir petição')
      criarTarefa({ processoId: acao.processoId, cliente: acao.cliente, acao: 'Conferir petição', titulo, detalhe: `minuta pedida pelo chat: ${acao.titulo.split(' · ')[1].toLowerCase()}`, responsavel: quem.usuario, setor: 'Jurídico', criadaPor: quem.usuario })
      registrarNoCaso(acao.processoId, quem.usuario, `Pediu a minuta (${acao.titulo.split(' · ')[1].toLowerCase()}) à IA`, 'D3.05')
      r = { estado: 'feito', texto: `✓ Feito: a minuta foi pedida e entra na sua tarefa «${titulo}» para conferir e assinar (G6).`, links: [{ rotulo: 'Abrir o caso', href: `/casos/${acao.processoId}` }] }
      break
    }
    case 'anexar-laudo': {
      const enviado = await enviarArquivos(acao.cliente!.id, { origem: 'chat', arquivos: [await arquivo(String(p.dados.arquivo), 'laudo')] })
      if (enviado.resultado !== 'enviado') return { estado: 'sem-pasta', texto: '', links: [] }
      registrarNoCaso(acao.processoId, quem.usuario, 'Subiu o laudo novo e avisou o Jurídico', 'D1.21M')
      r = { estado: 'feito', texto: '', links: [] }
      break
    }
    case 'marcar-pericia': {
      const nome = String(p.dados.arquivo)
      const a = o.arquivos?.find((x) => x.nome === nome)
      await registrarMarcacao(
        acao.processoId!,
        { comprovante: { nome, hash: a ? await hashDoConteudo(a.conteudo) : undefined }, lido: p.dados.lido as Parameters<typeof registrarMarcacao>[1]['lido'], pedeDocumentoNovo: o.escolha!.startsWith('Sim') },
        quem.usuario,
      )
      registrarNoCaso(acao.processoId, quem.usuario, 'Marcou a perícia com o comprovante do INSS', 'DP.02')
      const lido = p.dados.lido as { data: string }
      r = {
        estado: 'feito',
        texto: `✓ Feito: a perícia de ${acao.cliente!.nome} está na agenda e na ficha; o lembrete da véspera sai em ${dataCurta(prazosDaPericia(lido.data).vespera, hojeIso(agora()))}.`,
        links: [{ rotulo: 'Abrir a perícia', href: `/casos/${acao.processoId}/pericia` }],
      }
      break
    }
    case 'lancar-comprovante': {
      const enviado = await enviarArquivos(acao.cliente!.id, { origem: 'chat', arquivos: [await arquivo(String(p.dados.arquivo), 'outro')] })
      if (enviado.resultado !== 'enviado') return { estado: 'sem-pasta', texto: '', links: [] }
      const advogada = complementoDo(ler(), acao.processoId ?? '').advogada ?? advogadaDoCaso()
      const titulo = tituloDaTarefa(acao.cliente!.nome, 'Aprovar prestação de contas')
      criarTarefa({ processoId: acao.processoId, cliente: acao.cliente, acao: 'Aprovar prestação de contas', titulo, detalhe: 'comprovante lançado pelo Financeiro · o aviso ao cliente só depois do OK (G8)', responsavel: advogada, setor: 'Jurídico', criadaPor: quem.usuario })
      registrarNoCaso(acao.processoId, quem.usuario, 'Lançou o comprovante na prestação de contas; pediu o OK da advogada (G8)', 'D3b.02')
      r = { estado: 'feito', texto: `✓ Feito: o comprovante está na pasta e a advogada recebeu «${titulo}». O aviso ao cliente só sai depois do OK dela (G8).`, links: [{ rotulo: 'Abrir o caso', href: `/casos/${acao.processoId}` }] }
      break
    }
    case 'enviar-documento': {
      const nomes = p.dados.arquivos as string[]
      const enviado = await enviarArquivos(acao.cliente!.id, { origem: 'chat', arquivos: await Promise.all(nomes.map((n) => arquivo(n, 'outro'))) })
      if (enviado.resultado !== 'enviado') return { estado: 'sem-pasta', texto: '', links: [] }
      registrarNoCaso(acao.processoId, quem.usuario, `Subiu ${nomes.length === 1 ? nomes[0] : `${nomes.length} arquivos`} na pasta`, 'D1.18')
      r = { estado: 'feito', texto: `✓ Feito: ${nomes.length === 1 ? 'o arquivo está' : 'os arquivos estão'} na pasta de ${acao.cliente!.nome}; a Documentação confere a leitura.`, links: [{ rotulo: 'Abrir a ficha', href: `/clientes/${acao.cliente!.id}` }] }
      break
    }
    case 'subir-acervo': {
      // Ponta da GGVP-131 (acervo que aprende): IA simulada; o PDF com "ilegivel" no nome não dá para ler.
      const nomes = p.dados.arquivos as string[]
      const fora = nomes.filter((n) => /ilegivel/i.test(n)).length
      const banco = ler()
      ;(banco.lotesDoAcervo ??= []).push({ quando: agora().toISOString(), quem: quem.usuario, entraram: nomes.length - fora, ficaramDeFora: fora })
      gravar(banco)
      r = {
        estado: 'feito',
        texto: `✓ Pronto: ${nomes.length - fora} processos entraram no acervo e já contam na jurimetria.${fora ? ` ${fora} PDFs não deu para ler: ficaram de fora das contas e nada trava.` : ''}`,
        links: [],
      }
      break
    }
  }
  pendentes.delete(acaoId)
  return r
}

/** O cartão cancelado: nada acontece e ele some. */
export function cancelarAcao(acaoId: string) {
  pendentes.delete(acaoId)
}

/** As tarefas que o chat criou para a pessoa, na Central dela (Figma 2086:2). */
export function tarefasCriadasPeloChat(usuario: string | undefined): Tarefa[] {
  if (!usuario) return []
  const hoje = hojeIso(agora())
  return (ler().tarefasDoChat ?? [])
    .filter((t) => t.responsavel === usuario && !t.concluida)
    .map((t) => ({
      id: t.id,
      codigo: 'Chat',
      cliente: t.cliente ?? null,
      acao: t.acao,
      detalhe: `criada pelo chat por ${t.criadaPor}${t.detalhe ? ` · ${t.detalhe}` : ''}`,
      prazo: t.prazo ? (t.prazo === hoje ? 'hoje' : `vence ${dataCurta(t.prazo, hoje)}`) : undefined,
      urgente: t.prazo !== undefined && t.prazo <= hoje,
      href: t.processoId ? `/casos/${t.processoId}` : undefined,
      processoId: t.processoId,
    }))
}
