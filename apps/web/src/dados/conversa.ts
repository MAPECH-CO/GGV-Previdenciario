// EXEMPLO. Servidor de exemplo da conversa com o lead ou o cliente (fluxo D5, GGVP-12), sobre o mesmo banco de servidor.ts.
// A gravação é a mesma da entrevista (GGVP-40): uma Gravacao em banco.gravacoes, com as mesmas ações (registrarAcao) e o
// mesmo cofre, e a transcrição usa o mesmo motor (montarTranscricao). Sem microfone e sem OpenAI: a conversa é a de
// exemplo. Nada aqui apaga áudio (Q11, Lucas 06/10). Ligar no servidor: trocar o corpo de cada função por fetch no
// endpoint da design.md (change ggvp-12).
import { hojeIso, hora } from '../regras/datas.ts'
import {
  CANAIS_DO_REGISTRO,
  COM_QUEM,
  motivoParaNaoAbrir,
  papelDoPerfil,
  type CanalDoRegistro,
  type ComQuem,
  type Dito,
  type ModoDoRegistro,
  type PapelNaConversa,
} from '../regras/conversa.ts'
import { ehAudio, minutos, partesDoAudio } from '../regras/entrevista.ts'
import { BYTES_POR_SEGUNDO, montarTranscricao } from './entrevista.ts'
import type { IdPerfil } from './perfis.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Gravacao, Tarefa, Trecho } from './tipos.ts'

/** A conversa do D5: quem conduziu, o canal, com quem e como foi registrada. Espelho do Zod da design.md. */
export type Conversa = {
  id: string
  fichaId: string
  /** Lead sem processo: a conversa fica na ficha dele, que é a mesma tela do cliente (Lucas, 06/10). */
  processoId?: string
  canal: CanalDoRegistro
  comQuem: ComQuem
  modo: ModoDoRegistro
  /** Quem conduziu e registrou: o nome do perfil. */
  quem: string
  papel: PapelNaConversa
  /** Data e hora ISO. */
  abertaEm: string
  /** A gravação (o mesmo motor da entrevista) ou o registro sem áudio, em banco.gravacoes. */
  gravacaoId?: string
  /** O registro escrito, sem áudio. */
  registro?: string
  /** Data e hora ISO em que a conversa foi finalizada (gravada, anexada ou escrita). */
  finalizadaEm?: string
  /** O que a pessoa contou ao abrir, para a Central (a ligação da semente). */
  motivo?: string
}

/** O que a tela pede ao abrir a conversa (Figma 2144:2). */
export type NovaConversa = { canal: CanalDoRegistro; comQuem: ComQuem; modo: ModoDoRegistro; processoId?: string; registro?: string }

/** O áudio da ligação já feita, com a confirmação de que ele começa com o aviso de gravação (G10). */
export type AudioDaLigacao = { nome: string; tipo: string; tamanho: number; avisoNaGravacao: true }

/** Quem age na tela: o nome e o perfil do "Trocar perfil". Ao ligar no servidor, vem da sessão. */
export type QuemAge = { quem: string; perfil: IdPerfil | undefined }

export type ConversaAberta = { conversa: Conversa; ficha: Ficha; gravacao?: Gravacao }

/** Uma fala da conversa de exemplo, com o que a IA tira dela (GGVP-80). */
export type FalaDaConversa = Trecho & { diz?: Dito[]; combinado?: string; senha?: true }

/** A ligação de hoje do Pedro Exemplo, esperando a gravação subir: a tarefa "Registrar conversa" da Central (CA8). */
export function conversasDeExemplo(hoje: string): Conversa[] {
  return [
    {
      id: 'conversa-pedro-ligacao',
      fichaId: 'pedro-exemplo',
      processoId: 'pedro-exemplo-1',
      canal: 'ligacao',
      comQuem: 'cliente',
      modo: 'arquivo',
      quem: 'Bruna (exemplo)',
      papel: 'atendimento',
      abertaEm: new Date(`${hoje}T09:15:00`).toISOString(),
      motivo: 'ligou com informação nova sobre a exigência do INSS',
    },
  ]
}

function conversasDo(banco: Banco): Conversa[] {
  banco.conversas ??= conversasDeExemplo(hojeIso(agora()))
  return banco.conversas
}

function acharConversa(banco: Banco, conversaId: string): { conversa: Conversa; ficha: Ficha; gravacao?: Gravacao } {
  const conversa = conversasDo(banco).find((c) => c.id === conversaId)
  const ficha = banco.fichas.find((f) => f.id === conversa?.fichaId)
  if (!conversa || !ficha) throw new Error('Conversa não encontrada')
  return { conversa, ficha, gravacao: banco.gravacoes.find((g) => g.id === conversa.gravacaoId) }
}

/** O nome que aparece na transcrição: sem o "(exemplo)" das pessoas da semente. */
const falado = (quem: string) => quem.replace(/\s*\(exemplo\)$/, '')

function interlocutor(ficha: Ficha, comQuem: ComQuem): string {
  return comQuem === 'cliente' ? ficha.nome : COM_QUEM[comQuem].toLowerCase()
}

/**
 * O que a gravação simulada "ouve" (GGVP-76, CA9): o endereço e o telefone novos, a perícia remarcada e a ida ao hospital
 * (só com processo), a senha dita em voz alta (G9) e o combinado. Curta de propósito, para a demonstração no localhost.
 */
export function falasDaConversa(ficha: Ficha, c: Pick<Conversa, 'canal' | 'comQuem' | 'processoId' | 'quem' | 'papel'>): FalaDaConversa[] {
  const primeiro = ficha.nome.split(' ')[0]
  const outro = c.comQuem === 'cliente' ? primeiro : c.comQuem === 'familiar' ? 'Familiar' : 'Clínica'
  const eu = (aos: number, texto: string, extra: Partial<FalaDaConversa> = {}): FalaDaConversa => ({
    aos,
    quem: falado(c.quem),
    papel: c.papel === 'juridico' ? 'advogada' : 'atendimento',
    texto,
    ...extra,
  })
  const ele = (aos: number, texto: string, extra: Partial<FalaDaConversa> = {}): FalaDaConversa => ({ aos, quem: outro, papel: 'cliente', texto, ...extra })
  const gravando = c.canal === 'ligacao' ? 'esta ligação está sendo gravada' : 'esta conversa vai ser gravada'
  const falas = [
    eu(0, `${primeiro}, ${gravando} e transcrita para atualizar a sua ficha. Tudo bem?`),
    ele(6, 'Tudo bem.'),
    eu(12, 'Em que posso ajudar?'),
    ele(20, 'Mudei de casa. Agora moro na Rua Exemplo das Acácias, 45.', { diz: [{ onde: 'ficha', campo: 'endereco', valor: 'Rua Exemplo das Acácias, 45' }] }),
    eu(30, 'Anotado. E o telefone, continua o mesmo?'),
    ele(38, 'Não, troquei de número: agora é (11) 90000-0044.', { diz: [{ onde: 'ficha', campo: 'telefone', valor: '11900000044' }] }),
  ]
  if (c.processoId) {
    falas.push(
      eu(48, 'E o INSS, mandou alguma coisa?'),
      ele(56, 'Mandou: remarcaram a perícia para 16/10, às 8h30.', { diz: [{ onde: 'processo', campo: 'pericia', valor: '2026-10-16' }] }),
      ele(66, 'E fiquei três dias no hospital no fim de setembro. Trouxe o relatório da alta.', {
        diz: [
          { onde: 'processo', campo: 'fato', valor: 'Três dias no hospital no fim de setembro', saude: true },
          { onde: 'processo', campo: 'documento', valor: 'Relatório da alta hospitalar' },
        ],
      }),
    )
  }
  falas.push(
    eu(78, 'Se precisar da senha do gov.br, você digita no cofre. Não precisa falar em voz alta.'),
    ele(86, 'A minha senha do gov.br é Exemplo@2026, pode anotar.', { senha: true }),
    c.processoId
      ? eu(96, 'Não precisa: a senha vai para o cofre. A Documentação vai receber o relatório da alta.', {
          combinado: 'Documentação: receber e digitalizar o relatório da alta hospitalar.',
        })
      : eu(96, 'Não precisa: a senha vai para o cofre. Traga o comprovante do endereço novo, por favor.', {
          combinado: 'Atendimento: pedir o comprovante do endereço novo.',
        }),
    ele(106, 'Combinado.'),
  )
  return falas
}

/** GET /api/conversas/:id. Nulo quando a conversa não existe. */
export async function obterConversa(conversaId: string): Promise<ConversaAberta | null> {
  try {
    return acharConversa(ler(), conversaId)
  } catch {
    return null
  }
}

function novaGravacao(banco: Banco, ficha: Ficha, c: Conversa, origem: Gravacao['origem']): Gravacao {
  banco.seq += 1
  return {
    id: `gravacao-${banco.seq}`,
    fichaId: ficha.id,
    data: hojeIso(agora()),
    titulo: `${CANAIS_DO_REGISTRO[c.canal].rotulo} · ${COM_QUEM[c.comQuem].toLowerCase()}`,
    canal: c.canal === 'ligacao' ? 'ligação' : 'presencial',
    // Quem registrou vem primeiro (CA7).
    participantes: [c.quem, interlocutor(ficha, c.comQuem)],
    duracao: 0,
    origem,
    estado: 'gravando',
    acoes: [],
    transcricao: 'transcrevendo',
    trechos: [],
    extraidas: [],
    documentos: [],
    // Conversa com a advogada pode ter dado de saúde: como a entrevista, só o Jurídico abre.
    soJuridico: c.papel === 'juridico',
    marcas: [],
  }
}

const comQuemFalado = (c: Conversa) => `${CANAIS_DO_REGISTRO[c.canal].rotulo.toLowerCase()}, com ${COM_QUEM[c.comQuem].toLowerCase()}`

/**
 * POST /api/fichas/:id/conversas. Abre a conversa no card do lead ou do cliente (CA3, CA4, CA9). Só escrita, já fica
 * registrada como "só registro" (GGVP-80, CA9). O servidor confere de novo o perfil e os campos.
 */
export async function abrirConversa(fichaId: string, pedido: NovaConversa, por: QuemAge): Promise<Conversa> {
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const papel = papelDoPerfil(por.perfil)
  const motivo = motivoParaNaoAbrir(pedido, papel, ficha.processos.map((p) => p.id))
  if (motivo) throw new Error(motivo)
  banco.seq += 1
  const conversa: Conversa = {
    id: `conversa-${banco.seq}`,
    fichaId,
    processoId: pedido.processoId ?? ficha.processos[0]?.id,
    canal: pedido.canal,
    comQuem: pedido.comQuem,
    modo: pedido.modo,
    quem: por.quem,
    papel: papel!,
    abertaEm: agora().toISOString(),
  }
  conversasDo(banco).push(conversa)
  if (pedido.modo === 'escrito') {
    const g = novaGravacao(banco, ficha, conversa, 'registro')
    Object.assign(g, { estado: 'encerrada', transcricao: 'sem-audio', registro: pedido.registro!.trim() })
    banco.gravacoes.push(g)
    Object.assign(conversa, { gravacaoId: g.id, registro: g.registro, finalizadaEm: conversa.abertaEm })
    ficha.historico.push(evento(`Registrou a conversa sem áudio (${comQuemFalado(conversa)}): só registro`, por.quem))
  } else {
    const falta = pedido.modo === 'arquivo' ? 'falta subir a gravação da ligação' : 'grava depois do aviso (G10)'
    ficha.historico.push(evento(`Abriu a conversa (${comQuemFalado(conversa)}): ${falta}`, por.quem))
  }
  gravar(banco)
  return conversa
}

/** POST /api/conversas/:id/gravacao. Só grava com o aviso registrado, com a hora (CA1, CA5, G10). */
export async function gravarConversa(conversaId: string, inicio: { avisei: true }): Promise<Gravacao> {
  await esperar()
  if (inicio.avisei !== true) throw new Error('Avise que a conversa será gravada antes de gravar (G10).')
  const banco = ler()
  const { conversa, ficha, gravacao } = acharConversa(banco, conversaId)
  if (conversa.modo !== 'tempo-real') throw new Error('Esta conversa não é gravada agora.')
  // Clique duplo ou página recarregada: a mesma gravação.
  if (gravacao) return gravacao
  const g = novaGravacao(banco, ficha, conversa, 'portal')
  g.avisoEm = agora().toISOString()
  g.acoes.push({ acao: 'avisou', quando: g.avisoEm, aos: 0 }, { acao: 'gravou', quando: g.avisoEm, aos: 0 })
  banco.gravacoes.push(g)
  conversa.gravacaoId = g.id
  ficha.historico.push(evento(`Avisou às ${hora(g.avisoEm)} que a conversa seria gravada (G10) e começou a gravar`, conversa.quem))
  gravar(banco)
  return g
}

function guardarNoCard(ficha: Ficha, g: Gravacao, nome: string, tamanho: number) {
  g.estado = 'encerrada'
  g.audio = { nome, formato: nome.split('.').at(-1)?.toLowerCase() ?? '', tamanho, partes: partesDoAudio(tamanho) }
  g.transcricao = 'transcrevendo'
  ficha.transcricoes += 1
}

/** POST /api/conversas/:id/finalizar. O áudio fica no card do lead ou cliente e vai para a transcrição (CA6, CA9). */
export async function finalizarConversa(conversaId: string, fim: { aos: number }): Promise<ConversaAberta> {
  await esperar()
  const banco = ler()
  const { conversa, ficha, gravacao: g } = acharConversa(banco, conversaId)
  if (!g) throw new Error('Grave a conversa antes de finalizar.')
  if (g.estado === 'encerrada') return { conversa, ficha, gravacao: g }
  g.acoes.push({ acao: 'encerrou', quando: agora().toISOString(), aos: fim.aos })
  g.duracao = Math.max(g.duracao, fim.aos)
  guardarNoCard(ficha, g, `conversa-${ficha.id}-${g.data}.webm`, g.duracao * BYTES_POR_SEGUNDO)
  conversa.finalizadaEm = agora().toISOString()
  ficha.historico.push(evento(`Finalizou a conversa gravada (${minutos(g.duracao)}); o áudio ficou no card e foi para a transcrição`, conversa.quem))
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

/** POST /api/conversas/:id/audio. A ligação já feita sobe gravada, de qualquer formato e tamanho, com o aviso nela (CA2, G10). */
export async function anexarAudio(conversaId: string, arquivo: AudioDaLigacao): Promise<ConversaAberta> {
  await esperar()
  if (arquivo.avisoNaGravacao !== true) throw new Error('Confirme que a ligação começou com o aviso de gravação (G10).')
  if (!ehAudio(arquivo) || arquivo.tamanho < 1) throw new Error('Esse arquivo não é de áudio.')
  const banco = ler()
  const { conversa, ficha, gravacao } = acharConversa(banco, conversaId)
  if (conversa.modo !== 'arquivo') throw new Error('Esta conversa não espera um áudio.')
  if (gravacao) return { conversa, ficha, gravacao }
  const g = novaGravacao(banco, ficha, conversa, 'arquivo')
  g.acoes.push({ acao: 'subiu-arquivo', quando: agora().toISOString(), aos: 0 })
  guardarNoCard(ficha, g, arquivo.nome, arquivo.tamanho)
  banco.gravacoes.push(g)
  Object.assign(conversa, { gravacaoId: g.id, finalizadaEm: agora().toISOString() })
  ficha.historico.push(evento(`Subiu a gravação da ligação (${arquivo.nome}); o áudio ficou no card e foi para a transcrição`, conversa.quem))
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

/**
 * POST /api/conversas/:id/transcricao. A OpenAI simulada, com o mesmo motor da entrevista: as falas da conversa de
 * exemplo, nas partes do áudio, com quem fala e sem senha (G9). `falhar` simula a falha; chamar de novo tenta outra vez.
 */
export async function transcreverConversa(conversaId: string, opcoes: { falhar?: boolean } = {}): Promise<ConversaAberta> {
  await esperar()
  const banco = ler()
  const { conversa, ficha, gravacao: g } = acharConversa(banco, conversaId)
  if (!g || g.estado !== 'encerrada' || (g.transcricao !== 'transcrevendo' && g.transcricao !== 'falhou')) return { conversa, ficha, gravacao: g }
  if (opcoes.falhar) {
    g.transcricao = 'falhou'
    g.motivoDaFalha = 'o serviço de transcrição não respondeu'
  } else {
    g.trechos = montarTranscricao(g, falasDaConversa(ficha, conversa)).trechos
    g.resumo = `Conversa por ${comQuemFalado(conversa)}, registrada por ${conversa.quem}.`
    g.transcricao = 'pronta'
    g.motivoDaFalha = undefined
    // O texto fica no card, nas Transcrições, com acesso por perfil; o histórico só registra o fato (GGVP-80, CA1).
    ficha.historico.push(evento('A transcrição da conversa ficou pronta: está nas Transcrições do card', 'Sistema (IA)'))
  }
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

/** O que falta na conversa aberta, para a Central; nulo quando não falta nada nesta etapa. */
function faltaNaConversa(c: Conversa, g: Gravacao | undefined): string | null {
  if (c.modo === 'arquivo' && !g) return 'subir a gravação da ligação'
  if (c.modo === 'tempo-real' && !g) return 'gravar depois do aviso (G10)'
  if (g && g.estado !== 'encerrada') return 'finalizar a conversa'
  return null
}

/** "nome · Registrar conversa" para quem abriu a conversa e não terminou (CA8). */
export function tarefasDeRegistrarConversa(usuario: string | undefined): Tarefa[] {
  const banco = ler()
  return conversasDo(banco)
    .filter((c) => c.quem === usuario)
    .flatMap((c) => {
      const ficha = banco.fichas.find((f) => f.id === c.fichaId)
      const falta = faltaNaConversa(c, banco.gravacoes.find((g) => g.id === c.gravacaoId))
      if (!ficha || !falta) return []
      return [
        {
          id: `registrar-${c.id}`,
          codigo: 'D5.01',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Registrar conversa',
          detalhe: [c.motivo ?? comQuemFalado(c), `${c.canal === 'ligacao' ? 'ligou' : 'chegou'} às ${hora(c.abertaEm)}`, falta].join(' · '),
          prazo: 'hoje',
          href: `/conversas/${c.id}`,
          processoId: c.processoId,
        },
      ]
    })
}
