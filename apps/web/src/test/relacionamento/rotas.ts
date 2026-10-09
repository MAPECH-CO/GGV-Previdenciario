// SÓ PARA OS TESTES (GGVP-138). As rotas do Relacionamento no servidor falso: o mesmo caminho e a mesma forma das rotas
// da API (apps/api/src/rotas/conversa.ts, mensagens.ts e seguranca.ts), respondidas pelo antigo servidor de exemplo, com a
// semente. Quem age é a pessoa da sessão do teste (`entrarComo`); sem sessão, quem conduziu a conversa ou a Ana.
// O setup dos testes instala em todo teste; o teste que troca o `fetch` chama `responderRelacionamento` se precisar.
import type { IdPerfil } from '../../dados/perfis.ts'
import { perfilDeTeste, usuarioDeTeste } from '../../dados/sessaoDeTeste.tsx'
import { registrarAcao } from '../../dados/entrevista.ts'
import type { IdDoModelo } from '../../regras/mensagens.ts'
import * as conversa from './conversa.ts'
import * as mensagens from './mensagens.ts'
import * as seguranca from './seguranca.ts'

type Corpo = Record<string, unknown>
const json = (dados: unknown, status = 200) => new Response(JSON.stringify(dados ?? null), { status, headers: { 'content-type': 'application/json' } })

/** Quem age: a sessão do teste; sem ela, quem conduziu a conversa (a advogada, na do Jurídico) ou a Ana. */
function quemAge(juridico = false): conversa.QuemAge {
  const perfil = perfilDeTeste()
  if (perfil) return { quem: usuarioDeTeste(perfil).nome, perfil: (perfil === 'senior-2' ? 'senior' : perfil.replace('_', '-')) as IdPerfil }
  return juridico ? { quem: 'Dra. Paula (exemplo)', perfil: 'advogada' } : { quem: 'Ana (exemplo)', perfil: 'atendimento' }
}

async function aberta(id: string) {
  const r = await conversa.obterConversa(id)
  if (!r) throw Object.assign(new Error('Conversa não encontrada.'), { status: 404 })
  return r
}
const daConversa = async (id: string) => quemAge((await conversa.obterConversa(id))?.conversa.papel === 'juridico')

/** A resposta da rota, ou nulo quando o caminho não é do Relacionamento. */
async function rota(metodo: string, caminho: string, busca: URLSearchParams, corpo: Corpo): Promise<unknown | undefined> {
  let m: RegExpMatchArray | null
  if (metodo === 'POST' && caminho === '/api/conversas') {
    const { fichaId, ...pedido } = corpo as { fichaId: string } & conversa.NovaConversa
    return aberta((await conversa.abrirConversa(fichaId, pedido, quemAge())).id)
  }
  if (metodo === 'GET' && caminho === '/api/conversas/responsaveis') return conversa.pessoasDoEscritorio()
  if (metodo === 'GET' && caminho === '/api/conversas/tarefas') {
    const por = quemAge()
    return [...conversa.tarefasDeRegistrarConversa(por.quem), ...conversa.tarefasDePendencia({ usuario: por.quem, id: por.perfil! })]
  }
  if ((m = caminho.match(/^\/api\/conversas\/([^/]+)(\/.*)?$/))) {
    const [, id, resto = ''] = m
    if (metodo === 'GET' && resto === '') return aberta(id)
    if (metodo !== 'POST') return undefined
    if (resto === '/gravacao') await conversa.gravarConversa(id, corpo as { avisei: true })
    else if (resto === '/acoes') {
      const g = (await aberta(id)).gravacao
      if (!g) throw new Error('Grave a conversa antes.')
      await registrarAcao(g.id, corpo.acao as Parameters<typeof registrarAcao>[1], corpo.aos as number)
    } else if (resto === '/finalizar') await conversa.finalizarConversa(id, corpo as { aos: number })
    else if (resto === '/audio') await conversa.anexarAudio(id, corpo as conversa.AudioDaLigacao)
    else if (resto === '/transcricao') await conversa.transcreverConversa(id, corpo as { falhar?: boolean })
    else if (resto === '/conferencia') await conversa.conferirConversa(id, corpo as conversa.Conferencia, await daConversa(id))
    else if (resto === '/pendencia/cumprida') await conversa.cumprirPendencia(id, quemAge())
    else if (resto === '/pendencia/prazo') await conversa.novoPrazoDaPendencia(id, corpo.prazo as string, quemAge())
    else return undefined
    return aberta(id)
  }
  if ((m = caminho.match(/^\/api\/fichas\/([^/]+)\/versoes$/)) && metodo === 'GET') return conversa.obterVersoes(m[1])
  if ((m = caminho.match(/^\/api\/fichas\/([^/]+)\/versoes\/([^/]+)\/volta$/)) && metodo === 'POST') {
    const alvo = { fichaId: m[1], campo: m[2], onde: corpo.onde, ...(corpo.processoId ? { processoId: corpo.processoId } : {}) } as Parameters<typeof conversa.voltarParaVersao>[0]
    return conversa.voltarParaVersao(alvo, corpo.versao as number, quemAge())
  }
  if ((m = caminho.match(/^\/api\/fichas\/([^/]+)\/mensagens\/([^/]+)$/)) && metodo === 'GET') {
    return mensagens.prepararMensagem(m[1], m[2] as IdDoModelo, busca.get('processo') ?? undefined)
  }
  if ((m = caminho.match(/^\/api\/fichas\/([^/]+)\/mensagens$/))) {
    if (metodo === 'GET') return mensagens.mensagensDoCliente(m[1])
    if (metodo === 'POST') return mensagens.enviarMensagem(m[1], corpo as mensagens.PedidoDeMensagem, quemAge())
  }
  if ((m = caminho.match(/^\/api\/fichas\/([^/]+)\/dados-bancarios(\/confirmacao)?$/))) {
    if (metodo === 'GET' && !m[2]) return seguranca.obterDadosBancarios(m[1])
    if (metodo === 'POST' && !m[2]) return seguranca.pedirMudancaBancaria(m[1], corpo as Parameters<typeof seguranca.pedirMudancaBancaria>[1], quemAge())
    if (metodo === 'POST' && m[2]) return seguranca.confirmarMudancaBancaria(m[1], quemAge())
  }
  return undefined
}

/** GGVP-133: o arquivo da ligação chega como formulário; aqui vira o nome, o tipo e o tamanho, como antes. */
function doFormulario(formulario: FormData): Corpo {
  const arquivo = formulario.get('arquivo')
  if (!(arquivo instanceof Blob)) return {}
  const nome = arquivo instanceof File ? arquivo.name : 'audio'
  return { nome, tipo: arquivo.type, tamanho: arquivo.size, avisoNaGravacao: formulario.get('avisoNaGravacao') === 'sim' } as Corpo
}

/** Responde a rota do Relacionamento; nulo quando o caminho é de outra parte da API. */
export async function responderRelacionamento(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response | null> {
  const url = new URL(String(entrada), 'http://localhost')
  const metodo = init?.method ?? 'GET'
  const corpo = init?.body instanceof FormData ? doFormulario(init.body) : init?.body ? (JSON.parse(String(init.body)) as Corpo) : {}
  try {
    const dados = await rota(metodo, url.pathname, url.searchParams, corpo)
    return dados === undefined ? null : json(dados)
  } catch (falha) {
    const status = (falha as { status?: number }).status ?? 400
    return json({ erro: falha instanceof Error ? falha.message : 'Algo deu errado.' }, status)
  }
}

/** O `fetch` dos testes: o Relacionamento no servidor falso; o resto, como antes (sem servidor, a chamada falha). */
const original = globalThis.fetch
export function instalarRelacionamentoFalso() {
  globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => (await responderRelacionamento(entrada, init)) ?? original(entrada, init)) as typeof fetch
}
