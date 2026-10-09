// GGVP-133: o áudio de verdade no navegador. O microfone grava em partes de 10 minutos (cada parte é um arquivo inteiro,
// que a OpenAI aceita sozinho, bem abaixo dos 25 MB), e o texto ao vivo vem da OpenAI, direto, pela chave temporária que
// o servidor entregou: a chave de verdade nunca chega aqui. Sem microfone, devolve o motivo e a tela avisa, sem inventar
// falas; sem WebRTC, só não há texto ao vivo.
import type { ParteDoAudio } from './entrevista.ts'

export const SEGUNDOS_POR_PARTE = 600
const TIPOS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
const OPENAI_AO_VIVO = 'https://api.openai.com/v1/realtime/calls'

export type Microfone = { pausar(): void; retomar(): void; parar(): Promise<void>; stream: MediaStream }

/** Por que o microfone não abriu, nas palavras da tela (permissão negada, sem aparelho, em uso). */
export function motivoSemMicrofone(falha: unknown): string {
  const nome = falha instanceof Error || falha instanceof DOMException ? falha.name : ''
  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'o navegador não deu permissão ao microfone'
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'nenhum microfone foi encontrado neste computador'
  if (nome === 'NotReadableError') return 'o microfone está em uso por outro programa'
  return 'o microfone não abriu'
}

/**
 * Abre o microfone e grava. `segundos` é o relógio da gravação (para quando cada parte começa) e `aoTerParte` recebe cada
 * parte pronta. Pausar (cofre do gov.br, G9) para o gravador e desliga o som também do texto ao vivo.
 */
export async function abrirMicrofone(segundos: () => number, aoTerParte: (parte: ParteDoAudio) => void): Promise<Microfone | { erro: string }> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return { erro: 'este navegador não grava áudio' }
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (falha) {
    return { erro: motivoSemMicrofone(falha) }
  }
  const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported(t))
  let atual: MediaRecorder
  let desde = 0
  let terminou = Promise.resolve()
  function comecar() {
    const pedacos: Blob[] = []
    const inicio = segundos()
    const gravador = new MediaRecorder(stream, { ...(tipo && { mimeType: tipo }), audioBitsPerSecond: 32_000 })
    gravador.ondataavailable = (e) => {
      if (e.data.size > 0) pedacos.push(e.data)
    }
    terminou = new Promise((pronto) => {
      gravador.onstop = () => {
        if (pedacos.length > 0) aoTerParte({ audio: new Blob(pedacos, { type: gravador.mimeType || tipo || 'audio/webm' }), inicio })
        pronto()
      }
    })
    gravador.start()
    atual = gravador
    desde = inicio
  }
  comecar()
  const virar = setInterval(() => {
    if (atual.state === 'recording' && segundos() - desde >= SEGUNDOS_POR_PARTE) {
      atual.stop()
      comecar()
    }
  }, 1000)
  const som = (ligado: boolean) => stream.getAudioTracks().forEach((t) => (t.enabled = ligado))
  return {
    stream,
    pausar() {
      if (atual.state === 'recording') atual.pause()
      som(false)
    },
    retomar() {
      som(true)
      if (atual.state === 'paused') atual.resume()
    },
    async parar() {
      clearInterval(virar)
      if (atual.state !== 'inactive') atual.stop()
      await terminou
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}

/** Uma fala do texto ao vivo: vai crescendo enquanto a pessoa fala e fica `final` quando ela para. */
export type FalaAoVivo = { id: string; texto: string; final: boolean }

/**
 * CA4: o texto ao vivo pela OpenAI, por WebRTC, com a chave temporária. Devolve como parar, ou nulo se não deu (a
 * gravação continua e o texto final sai depois). Nada daqui vale no caso: vale o texto final, com quem fala.
 */
export async function ouvirAoVivo(stream: MediaStream, chave: string, aoMudar: (falas: FalaAoVivo[]) => void): Promise<(() => void) | null> {
  if (typeof RTCPeerConnection === 'undefined') return null
  const conexao = new RTCPeerConnection()
  try {
    stream.getAudioTracks().forEach((t) => conexao.addTrack(t, stream))
    const canal = conexao.createDataChannel('oai-events')
    const falas = new Map<string, FalaAoVivo>()
    canal.onmessage = (e) => {
      const ev = JSON.parse(String(e.data)) as { type?: string; item_id?: string; delta?: string; transcript?: string }
      if (!ev.item_id) return
      if (ev.type === 'conversation.item.input_audio_transcription.delta') {
        const f = falas.get(ev.item_id) ?? { id: ev.item_id, texto: '', final: false }
        falas.set(ev.item_id, { ...f, texto: f.texto + (ev.delta ?? '') })
      } else if (ev.type === 'conversation.item.input_audio_transcription.completed') {
        falas.set(ev.item_id, { id: ev.item_id, texto: ev.transcript ?? '', final: true })
      } else return
      aoMudar([...falas.values()])
    }
    const oferta = await conexao.createOffer()
    await conexao.setLocalDescription(oferta)
    const r = await fetch(OPENAI_AO_VIVO, { method: 'POST', body: oferta.sdp, headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/sdp' } })
    if (!r.ok) throw new Error(`OpenAI respondeu ${r.status}`)
    await conexao.setRemoteDescription({ type: 'answer', sdp: await r.text() })
    return () => conexao.close()
  } catch {
    conexao.close()
    return null
  }
}
