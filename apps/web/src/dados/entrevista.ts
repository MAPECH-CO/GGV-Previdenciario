// EXEMPLO. Servidor de exemplo da entrevista gravada (GGVP-40), sobre o mesmo banco de servidor.ts. Sem microfone e sem
// OpenAI: a gravação é um relógio e a transcrição é a conversa de exemplo, já sem senha (G9). Nada aqui apaga áudio
// (CA13). Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da design.md (change ggvp-6), gravar com
// o MediaRecorder e transcrever pela OpenAI.
import { dataCurta, hojeIso, hora } from '../regras/datas.ts'
import { documentosDaEntrevista, ehAudio, juntarPartes, partesDoAudio, tirarSenhas } from '../regras/entrevista.ts'
import { TIPOS_DE_ENTREVISTA, nomeBeneficio } from './catalogos.ts'
import { conversaDeExemplo } from './exemplo.ts'
import { QUEM_ADVOGADA, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type {
  AcaoNaGravacao,
  Agendamento,
  AudioDeFora,
  Entrevista,
  Ficha,
  Gravacao,
  InformacaoExtraida,
  RespostaDoEncerramento,
  TarefaEncaminhada,
} from './tipos.ts'

/** Áudio de voz a 128 kbit/s: 16 kB por segundo. Só para o tamanho do arquivo simulado. */
const BYTES_POR_SEGUNDO = 16_000

const advogadaDa = (a: Agendamento) => a.com ?? 'Advogada'
const canalDo = (a: Agendamento) => (TIPOS_DE_ENTREVISTA.find((t) => t.id === (a.tipo ?? 'presencial'))?.nome ?? 'presencial').split(' ')[0].toLowerCase()

function acharEntrevista(banco: Banco, agendamentoId: string): { ficha: Ficha; agendamento: Agendamento } | null {
  for (const ficha of banco.fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === agendamentoId)
    if (agendamento) return { ficha, agendamento }
  }
  return null
}

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
  await esperar()
  if (inicio.avisei !== true) throw new Error('Avise o cliente que a conversa será gravada antes de gravar (G10).')
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
export async function enviarAudioGuardado(gravacaoId: string): Promise<Gravacao> {
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
export async function subirAudio(agendamentoId: string, arquivo: AudioDeFora): Promise<RespostaDoEncerramento> {
  await esperar()
  if (!ehAudio(arquivo)) throw new Error('Esse arquivo não é de áudio.')
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

/** O resumo que a IA faria da entrevista (simulado): junta o que foi dito, sem concluir o benefício (G3). */
function resumoDaEntrevista(ficha: Ficha, extraidas: InformacaoExtraida[]): string {
  const valor = (id: string) => extraidas.find((e) => e.id === id)?.valor
  const partes = [
    valor('desde') && `sem trabalhar desde ${valor('desde')}`,
    valor('vinculo') && `último vínculo: ${valor('vinculo')}`,
    valor('pedido') && `pedido anterior: ${valor('pedido')}`,
    valor('laudos') && `citou ${valor('laudos')}`,
    valor('estado-civil') && `estado civil: ${valor('estado-civil')}`,
  ].filter(Boolean)
  const beneficio = ficha.beneficioInteresse && ficha.beneficioInteresse !== 'nao-sei' ? ` Procura ${nomeBeneficio(ficha.beneficioInteresse)}.` : ''
  const dito = partes.length ? `${partes.join('; ')}.` : 'a gravação foi curta: pouco a resumir.'
  return `${ficha.nome}: ${dito}${beneficio} O benefício é a advogada que define (D1.12, G3).`
}

/**
 * POST /api/gravacoes/:id/transcricao. A OpenAI simulada: a conversa de exemplo até onde gravou, dividida nas partes do
 * áudio e juntada de novo (CA10), com quem fala (GGVP-46, CA8) e sem senha (CA3). `falhar` simula a falha (GGVP-46, CA3).
 */
export async function transcrever(gravacaoId: string, opcoes: { falhar?: boolean } = {}): Promise<Gravacao> {
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
  const falas = conversaDeExemplo(ficha, agendamento ? advogadaDa(agendamento) : 'Advogada')
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
  const extraidas = ditas.flatMap((f) => f.extrai ?? [])
  if (g.acoes.some((x) => x.acao === 'guardou-senha')) {
    extraidas.push({ id: 'senha', rotulo: 'Senha do gov.br', valor: 'digitada no cofre: não consta na transcrição (G9)', destino: 'cofre' })
  }
  g.trechos = tirarSenhas(trechos)
  g.extraidas = extraidas
  g.resumo = resumoDaEntrevista(ficha, extraidas)
  g.documentos = documentosDaEntrevista(ficha, extraidas)
  g.transcricao = 'pronta'
  g.motivoDaFalha = undefined
  gravar(banco)
  return g
}
