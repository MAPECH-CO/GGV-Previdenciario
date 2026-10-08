// EXEMPLO. Servidor de exemplo da entrevista gravada (GGVP-40), sobre o mesmo banco de servidor.ts. Sem microfone e sem
// OpenAI: a gravação é um relógio e a transcrição é a conversa de exemplo, já sem senha (G9). Nada aqui apaga áudio
// (CA13). Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da design.md (change ggvp-6), gravar com
// o MediaRecorder e transcrever pela OpenAI. GGVP-133: nas fichas do servidor, o áudio de verdade (do microfone, em
// partes, ou o arquivo de fora) vai para lá, e a transcrição vem da OpenAI pelo motor de IA do servidor.
import type { ChaveAoVivo } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { dataCurta, hojeIso, hora } from '../regras/datas.ts'
import { documentosDaEntrevista, ehAudio, juntarPartes, partesDoAudio, resumoDaEntrevista, tirarSenhas } from '../regras/entrevista.ts'
import { TIPOS_DE_ENTREVISTA, nomeBeneficio } from './catalogos.ts'
import { conversaDeExemplo } from './exemplo.ts'
import { QUEM_ADVOGADA, agendamentoDoServidor, agora, esperar, evento, gravacaoDoServidor, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type {
  AcaoNaGravacao,
  Agendamento,
  AudioDeFora,
  Entrevista,
  Ficha,
  Gravacao,
  RespostaDoEncerramento,
  TarefaEncaminhada,
  Trecho,
} from './tipos.ts'

/** Áudio de voz a 128 kbit/s: 16 kB por segundo. Só para o tamanho do arquivo simulado. */
export const BYTES_POR_SEGUNDO = 16_000

const advogadaDa = (a: Agendamento) => a.com ?? 'Advogada'
const canalDo = (a: Agendamento) => (TIPOS_DE_ENTREVISTA.find((t) => t.id === (a.tipo ?? 'presencial'))?.nome ?? 'presencial').split(' ')[0].toLowerCase()

function acharEntrevista(banco: Banco, agendamentoId: string): { ficha: Ficha; agendamento: Agendamento } | null {
  for (const ficha of banco.fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === agendamentoId)
    if (agendamento) return { ficha, agendamento }
  }
  return null
}

type DoServidor = { gravacao: Gravacao; tarefa?: TarefaEncaminhada; ficha?: Ficha; tarefas?: TarefaEncaminhada[] }

/** GGVP-133: uma parte do áudio de verdade, gravada pelo microfone, e onde ela começa na gravação (segundos). */
export type ParteDoAudio = { audio: Blob; inicio: number }
const extensaoDo = (tipo: string) => (tipo.includes('ogg') ? 'ogg' : tipo.includes('mp4') ? 'm4a' : 'webm')

/** GGVP-125, bloco 3a: a entrevista das fichas do servidor grava lá; a cópia daqui recebe a gravação, a ficha e as tarefas. */
async function pedirAoServidor(caminho: string, corpo: object | FormData): Promise<DoServidor> {
  const r = await noBanco<DoServidor>(caminho, { method: 'POST', corpo })
  receber(r)
  return r
}
const encerramento = ({ gravacao, tarefa }: DoServidor): RespostaDoEncerramento => ({ gravacao, tarefa })

function acharGravacao(banco: Banco, gravacaoId: string): { gravacao: Gravacao; ficha: Ficha; agendamento?: Agendamento } {
  const gravacao = banco.gravacoes.find((g) => g.id === gravacaoId)
  const ficha = banco.fichas.find((f) => f.id === gravacao?.fichaId)
  if (!gravacao || !ficha) throw new Error('Gravação não encontrada')
  return { gravacao, ficha, agendamento: ficha.agendamentos.find((a) => a.id === gravacao.agendamentoId) }
}

function acao(g: Gravacao, nome: AcaoNaGravacao['acao'], aos: number) {
  g.acoes.push({ acao: nome, quando: agora().toISOString(), aos })
  g.duracao = Math.max(g.duracao, aos)
}

function novaGravacao(banco: Banco, ficha: Ficha, a: Agendamento, origem: Gravacao['origem']): Gravacao {
  banco.seq += 1
  return {
    id: `gravacao-${banco.seq}`,
    fichaId: ficha.id,
    agendamentoId: a.id,
    data: hojeIso(agora()),
    titulo: 'Entrevista com a advogada',
    canal: canalDo(a),
    participantes: [advogadaDa(a), ficha.nome],
    duracao: 0,
    origem,
    estado: 'gravando',
    acoes: [],
    transcricao: 'transcrevendo',
    trechos: [],
    extraidas: [],
    documentos: [],
    soJuridico: true,
    marcas: [],
  }
}

/**
 * O fim da entrevista (CA5): o compromisso vira realizado, o "Preparar entrevista" sai da fila e, para o lead, a advogada
 * recebe "Cadastrar lead" (D1.10).
 */
function fecharEntrevista(banco: Banco, ficha: Ficha, a: Agendamento, g: Gravacao): TarefaEncaminhada | undefined {
  a.estado = 'realizado'
  if (g.audio) ficha.transcricoes += 1
  const preparar = banco.tarefas.find((t) => t.id === `preparar-${a.id}`)
  if (preparar) preparar.concluida = true
  // A advogada define o benefício com a sugestão do acervo (D1.12, GGVP-51).
  if (!banco.tarefas.some((t) => t.id === `definir-${ficha.id}` && !t.concluida)) {
    banco.tarefas.push({
      id: `definir-${ficha.id}`,
      codigo: 'D1.12',
      cliente: { id: ficha.id, nome: ficha.nome },
      acao: 'Definir benefício',
      detalhe: [nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir', 'benefício sugerido, você decide (G3)'].join(' · '),
      prazo: 'hoje',
      href: `/entrevista/${a.id}/beneficio`,
      setor: 'Jurídico',
    })
  }
  if (ficha.situacao !== 'lead') return undefined
  const id = `cadastrar-${ficha.id}`
  const existente = banco.tarefas.find((t) => t.id === id && !t.concluida)
  if (existente) return existente
  const hoje = hojeIso(agora())
  const tarefa: TarefaEncaminhada = {
    id,
    codigo: 'D1.10',
    cliente: { id: ficha.id, nome: ficha.nome },
    acao: 'Cadastrar lead',
    detalhe: [
      nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir',
      `entrevista de ${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)}`,
      'dados da ficha e da entrevista para conferir',
    ].join(' · '),
    prazo: 'hoje',
    href: `/clientes/${ficha.id}/cadastro`,
    setor: 'Jurídico',
  }
  banco.tarefas.push(tarefa)
  return tarefa
}

/** O que a IA "ouve" ao vivo (simulado). Ligar no servidor: a transcrição ao vivo da OpenAI, por stream. */
export function falasAoVivo({ ficha, agendamento }: Entrevista) {
  return conversaDeExemplo(ficha, advogadaDa(agendamento))
}

/** GET /api/entrevistas/:id. Nulo quando o compromisso não existe. A gravação é a última desta entrevista. */
export async function obterEntrevista(agendamentoId: string): Promise<Entrevista | null> {
  const banco = ler()
  const achado = acharEntrevista(banco, agendamentoId)
  if (!achado) return null
  return { ...achado, gravacao: banco.gravacoes.filter((g) => g.agendamentoId === agendamentoId).at(-1) }
}

/** POST /api/entrevistas/:id/gravacoes. Só grava com o aviso ao cliente registrado, com a hora (CA4, G10). */
export async function iniciarGravacao(agendamentoId: string, inicio: { avisei: true }): Promise<Gravacao> {
  if (inicio.avisei !== true) throw new Error('Avise o cliente que a conversa será gravada antes de gravar (G10).')
  if (agendamentoDoServidor(agendamentoId)) return (await pedirAoServidor(`/entrevistas/${agendamentoId}/gravacoes`, inicio)).gravacao
  await esperar()
  const banco = ler()
  const achado = acharEntrevista(banco, agendamentoId)
  if (!achado) throw new Error('Entrevista não encontrada')
  const aberta = banco.gravacoes.find((g) => g.agendamentoId === agendamentoId && g.estado !== 'encerrada')
  if (aberta) return aberta
  const { ficha, agendamento } = achado
  const g = novaGravacao(banco, ficha, agendamento, 'portal')
  g.avisoEm = agora().toISOString()
  acao(g, 'avisou', 0)
  acao(g, 'gravou', 0)
  banco.gravacoes.push(g)
  ficha.historico.push(evento(`Avisou o cliente às ${hora(g.avisoEm)} que a conversa seria gravada (G10) e começou a gravar a entrevista`, QUEM_ADVOGADA))
  gravar(banco)
  return g
}

const ESTADO_DEPOIS: Partial<Record<AcaoNaGravacao['acao'], Gravacao['estado']>> = {
  pausou: 'pausada',
  'abriu-cofre': 'pausada',
  retomou: 'gravando',
  'guardou-senha': 'gravando',
  falhou: 'falhou',
}

/** POST /api/gravacoes/:id/acoes. Cada ação fica registrada com a hora e o ponto do áudio (CA5, CA6, CA8). */
export async function registrarAcao(gravacaoId: string, nome: 'pausou' | 'retomou' | 'abriu-cofre' | 'guardou-senha' | 'falhou', aos: number): Promise<Gravacao> {
  if (gravacaoDoServidor(gravacaoId)) return (await pedirAoServidor(`/gravacoes/${gravacaoId}/acoes`, { acao: nome, aos })).gravacao
  await esperar()
  const banco = ler()
  const { gravacao: g } = acharGravacao(banco, gravacaoId)
  if (g.estado === 'encerrada') throw new Error('A gravação já foi encerrada')
  acao(g, nome, aos)
  g.estado = ESTADO_DEPOIS[nome]!
  gravar(banco)
  return g
}

function audioDaGravacao(ficha: Ficha, g: Gravacao): Gravacao['audio'] {
  const tamanho = g.duracao * BYTES_POR_SEGUNDO
  return { nome: `entrevista-${ficha.id}-${g.data}.webm`, formato: 'webm', tamanho, partes: partesDoAudio(tamanho) }
}

/** POST /api/gravacoes/:id/encerrar. O áudio fica no caso e vai para a transcrição; sem internet, espera (CA2, CA5, CA12). */
export async function encerrarGravacao(gravacaoId: string, fim: { aos: number; online: boolean }): Promise<RespostaDoEncerramento> {
  if (gravacaoDoServidor(gravacaoId)) return encerramento(await pedirAoServidor(`/gravacoes/${gravacaoId}/encerrar`, fim))
  await esperar()
  const banco = ler()
  const { gravacao: g, ficha, agendamento } = acharGravacao(banco, gravacaoId)
  if (g.estado === 'encerrada') return { gravacao: g }
  acao(g, 'encerrou', fim.aos)
  g.estado = 'encerrada'
  g.audio = audioDaGravacao(ficha, g)
  g.transcricao = fim.online ? 'transcrevendo' : 'aguardando-internet'
  const tarefa = agendamento && fecharEntrevista(banco, ficha, agendamento, g)
  ficha.historico.push(evento(`Encerrou a entrevista gravada (${Math.max(1, Math.round(g.duracao / 60))} min); o áudio ficou no caso`, QUEM_ADVOGADA))
  gravar(banco)
  return { gravacao: g, tarefa }
}

/** POST /api/gravacoes/:id/audio. A internet voltou: o áudio guardado no computador sobe uma vez só (CA12). */
export async function enviarAudioGuardado(gravacaoId: string, partes: ParteDoAudio[] = []): Promise<Gravacao> {
  if (gravacaoDoServidor(gravacaoId) && partes.length > 0) {
    let g: Gravacao | undefined
    for (const [i, parte] of partes.entries()) g = await enviarParteDoAudio(gravacaoId, parte, i === partes.length - 1)
    return g!
  }
  if (gravacaoDoServidor(gravacaoId)) return (await pedirAoServidor(`/gravacoes/${gravacaoId}/audio`, {})).gravacao
  await esperar()
  const banco = ler()
  const { gravacao: g } = acharGravacao(banco, gravacaoId)
  if (g.transcricao !== 'aguardando-internet') return g
  acao(g, 'enviou-audio', g.duracao)
  g.transcricao = 'transcrevendo'
  gravar(banco)
  return g
}

/** POST /api/gravacoes/:id/sem-audio. A gravação falhou e a advogada registra a entrevista sem áudio (CA8). */
export async function registrarSemAudio(gravacaoId: string, notas: string): Promise<RespostaDoEncerramento> {
  await esperar()
  const texto = notas.trim()
  if (texto.length < 3 || texto.length > 4000) throw new Error('Escreva o que foi conversado.')
  if (gravacaoDoServidor(gravacaoId)) return encerramento(await pedirAoServidor(`/gravacoes/${gravacaoId}/sem-audio`, { notas: texto }))
  const banco = ler()
  const { gravacao: g, ficha, agendamento } = acharGravacao(banco, gravacaoId)
  acao(g, 'sem-audio', g.duracao)
  g.estado = 'encerrada'
  g.transcricao = 'sem-audio'
  g.registro = texto
  // O que foi gravado até a falha fica guardado no caso.
  if (g.duracao > 0) g.audio = audioDaGravacao(ficha, g)
  const tarefa = agendamento && fecharEntrevista(banco, ficha, agendamento, g)
  ficha.historico.push(evento('Registrou a entrevista sem áudio: a gravação falhou', QUEM_ADVOGADA))
  gravar(banco)
  return { gravacao: g, tarefa }
}

/** POST /api/entrevistas/:id/audio. Áudio gravado fora do portal, de qualquer formato e tamanho (CA9, CA10). */
export async function subirAudio(agendamentoId: string, arquivo: AudioDeFora, conteudo?: Blob): Promise<RespostaDoEncerramento> {
  await esperar()
  if (!ehAudio(arquivo)) throw new Error('Esse arquivo não é de áudio.')
  // GGVP-133 CA2: na ficha do servidor, o arquivo de verdade (a ligação baixada do Chatwoot) vai para a pasta do cliente.
  if (agendamentoDoServidor(agendamentoId) && conteudo) {
    const corpo = new FormData()
    corpo.append('arquivo', conteudo, arquivo.nome)
    return encerramento(await pedirAoServidor(`/entrevistas/${agendamentoId}/audio`, corpo))
  }
  if (agendamentoDoServidor(agendamentoId)) return encerramento(await pedirAoServidor(`/entrevistas/${agendamentoId}/audio`, arquivo))
  const banco = ler()
  const achado = acharEntrevista(banco, agendamentoId)
  if (!achado) throw new Error('Entrevista não encontrada')
  const { ficha, agendamento } = achado
  const g = novaGravacao(banco, ficha, agendamento, 'arquivo')
  g.estado = 'encerrada'
  g.audio = { nome: arquivo.nome, formato: arquivo.nome.split('.').at(-1)?.toLowerCase() ?? '', tamanho: arquivo.tamanho, partes: partesDoAudio(arquivo.tamanho) }
  acao(g, 'subiu-arquivo', 0)
  banco.gravacoes.push(g)
  const tarefa = fecharEntrevista(banco, ficha, agendamento, g)
  ficha.historico.push(evento(`Subiu o áudio da entrevista gravado fora do portal (${arquivo.nome}); foi para a transcrição`, QUEM_ADVOGADA))
  gravar(banco)
  return { gravacao: g, tarefa }
}

/**
 * O motor da transcrição simulada, o mesmo da entrevista e da conversa com o cliente (GGVP-80): as falas até onde gravou,
 * divididas nas partes do áudio e juntadas de novo (CA10), com quem fala (GGVP-46, CA8) e sem senha (CA3). O áudio que
 * subiu de fora dura a conversa inteira.
 */
export function montarTranscricao<F extends Trecho>(g: Gravacao, falas: F[]): { trechos: Trecho[]; ditas: F[] } {
  if (g.origem === 'arquivo') g.duracao = falas.at(-1)!.aos + 10
  const ditas = falas.filter((f) => f.aos <= g.duracao)
  const partes = g.audio?.partes ?? 1
  const tamanho = Math.ceil((g.duracao + 1) / partes)
  const trechos = juntarPartes(
    Array.from({ length: partes }, (_, i) => ({
      inicio: i * tamanho,
      trechos: ditas.filter((f) => f.aos >= i * tamanho && f.aos < (i + 1) * tamanho).map((f) => ({ aos: f.aos - i * tamanho, quem: f.quem, papel: f.papel, texto: f.texto })),
    })),
  )
  return { trechos: tirarSenhas(trechos), ditas }
}

/**
 * POST /api/gravacoes/:id/transcricao. A OpenAI simulada: a conversa de exemplo até onde gravou, dividida nas partes do
 * áudio e juntada de novo (CA10), com quem fala (GGVP-46, CA8) e sem senha (CA3). `falhar` simula a falha (GGVP-46, CA3).
 */
export async function transcrever(gravacaoId: string, opcoes: { falhar?: boolean } = {}): Promise<Gravacao> {
  if (gravacaoDoServidor(gravacaoId)) return (await pedirAoServidor(`/gravacoes/${gravacaoId}/transcricao`, opcoes)).gravacao
  await esperar()
  const banco = ler()
  const { gravacao: g, ficha, agendamento } = acharGravacao(banco, gravacaoId)
  if (g.estado !== 'encerrada' || (g.transcricao !== 'transcrevendo' && g.transcricao !== 'falhou')) return g
  if (opcoes.falhar) {
    g.transcricao = 'falhou'
    g.motivoDaFalha = 'o serviço de transcrição não respondeu'
    gravar(banco)
    return g
  }
  const { trechos, ditas } = montarTranscricao(g, conversaDeExemplo(ficha, agendamento ? advogadaDa(agendamento) : 'Advogada'))
  const extraidas = ditas.flatMap((f) => f.extrai ?? [])
  if (g.acoes.some((x) => x.acao === 'guardou-senha')) {
    extraidas.push({ id: 'senha', rotulo: 'Senha do gov.br', valor: 'digitada no cofre: não consta na transcrição (G9)', destino: 'cofre' })
  }
  g.trechos = trechos
  g.extraidas = extraidas
  g.resumo = resumoDaEntrevista(ficha, extraidas)
  g.documentos = documentosDaEntrevista(ficha, extraidas)
  g.transcricao = 'pronta'
  g.motivoDaFalha = undefined
  gravar(banco)
  return g
}

/** POST /api/gravacoes/:id/audio (GGVP-133): uma parte do áudio de verdade vai para a pasta do cliente, no servidor. */
export async function enviarParteDoAudio(gravacaoId: string, parte: ParteDoAudio, ultima = false): Promise<Gravacao> {
  const corpo = new FormData()
  corpo.append('inicio', String(Math.round(parte.inicio)))
  if (ultima) corpo.append('ultima', 'sim')
  corpo.append('arquivo', parte.audio, `parte-${Math.round(parte.inicio)}.${extensaoDo(parte.audio.type)}`)
  return (await pedirAoServidor(`/gravacoes/${gravacaoId}/audio`, corpo)).gravacao
}

/** POST /api/gravacoes/:id/chave-ao-vivo (GGVP-133 CA4): a chave temporária do texto ao vivo, ou o motivo de não ter. */
export async function pedirChaveAoVivo(gravacaoId: string): Promise<ChaveAoVivo | { erro: string }> {
  const r = await chamarApi<ChaveAoVivo>(`/gravacoes/${gravacaoId}/chave-ao-vivo`, { method: 'POST' })
  return r.ok ? r.dados : { erro: r.erro }
}
