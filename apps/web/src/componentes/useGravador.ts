import { useEffect, useRef, useState } from 'react'
import { MSG_FALA_VAZIA } from '../dados/chat.ts'

/** A fala do chat para sozinha em 2 minutos (12/10). */
export const LIMITE_DA_FALA_S = 120
/** Fala com menos de 1 segundo não vai à IA: não há o que transcrever, e a chamada seria paga à toa. */
export const FALA_MINIMA_MS = 1000
export const MSG_SEM_MICROFONE = 'Não deu para usar o microfone: libere o acesso no navegador ou digite a pergunta.'
const BARRAS = 32

type Gravacao = { gravador: MediaRecorder; fluxo: MediaStream; contexto?: AudioContext; relogio: number; inicio: number; descartar: boolean; solta: boolean }

/** Solta o microfone uma vez só: para o relógio, as faixas e o áudio da onda. */
function soltar(g: Gravacao) {
  if (g.solta) return
  g.solta = true
  clearInterval(g.relogio)
  g.fluxo.getTracks().forEach((t) => t.stop())
  if (g.contexto && g.contexto.state !== 'closed') void g.contexto.close().catch(() => undefined)
}

/**
 * O microfone do chat (12/10): grava com o MediaRecorder, mede o volume para a onda (AnalyserNode, quando há) e conta o
 * tempo. "Pronto" entrega o áudio a `aoTerminar`; "Descartar" joga fora. Sair da tela joga fora e solta o microfone.
 */
export function useGravador(aoTerminar: (audio: Blob) => Promise<void>, aoFalhar: (aviso: string) => void) {
  const [estado, setEstado] = useState<'parado' | 'gravando' | 'transcrevendo'>('parado')
  const [segundos, setSegundos] = useState(0)
  const [niveis, setNiveis] = useState<number[]>(() => Array<number>(BARRAS).fill(0))
  const atual = useRef<Gravacao | null>(null)
  const iniciando = useRef(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      const g = atual.current
      if (!g) return
      // O navegador para o gravador quando as faixas param, e o onstop mandaria o áudio: aqui ele é descartado antes.
      g.descartar = true
      if (g.gravador.state !== 'inactive') g.gravador.stop()
      soltar(g)
    }
  }, [])

  function parar(descartar: boolean) {
    const g = atual.current
    if (!g || g.gravador.state === 'inactive') return
    g.descartar = descartar
    g.gravador.stop()
  }

  async function iniciar() {
    if (atual.current || iniciando.current) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return aoFalhar(MSG_SEM_MICROFONE)
    iniciando.current = true
    let fluxo: MediaStream
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return aoFalhar(MSG_SEM_MICROFONE)
    } finally {
      iniciando.current = false
    }
    // A tela fechou enquanto o navegador pedia o microfone: solta e não grava.
    if (!montado.current) return fluxo.getTracks().forEach((t) => t.stop())
    const gravador = new MediaRecorder(fluxo)
    const pedacos: Blob[] = []
    gravador.ondataavailable = (e) => {
      if (e.data.size) pedacos.push(e.data)
    }
    let medir = () => 0
    let contexto: AudioContext | undefined
    if (typeof AudioContext !== 'undefined') {
      contexto = new AudioContext()
      const analisador = contexto.createAnalyser()
      analisador.fftSize = 512
      contexto.createMediaStreamSource(fluxo).connect(analisador)
      const amostra = new Uint8Array(analisador.fftSize)
      medir = () => {
        analisador.getByteTimeDomainData(amostra)
        let soma = 0
        for (const v of amostra) soma += ((v - 128) / 128) ** 2
        return Math.min(1, Math.sqrt(soma / amostra.length) * 4)
      }
    }
    const g: Gravacao = { gravador, fluxo, contexto, relogio: 0, inicio: Date.now(), descartar: false, solta: false }
    g.relogio = window.setInterval(() => {
      const s = Math.floor((Date.now() - g.inicio) / 1000)
      setSegundos(s)
      setNiveis((n) => [...n.slice(1), medir()])
      if (s >= LIMITE_DA_FALA_S) parar(false)
    }, 100)
    gravador.onstop = () => {
      soltar(g)
      atual.current = null
      if (g.descartar) return setEstado('parado')
      if (Date.now() - g.inicio < FALA_MINIMA_MS) {
        setEstado('parado')
        return aoFalhar(MSG_FALA_VAZIA)
      }
      setEstado('transcrevendo')
      void aoTerminar(new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' })).finally(() => setEstado('parado'))
    }
    atual.current = g
    setSegundos(0)
    setNiveis(Array<number>(BARRAS).fill(0))
    setEstado('gravando')
    gravador.start()
  }

  return { estado, segundos, niveis, iniciar, pronto: () => parar(false), descartar: () => parar(true) }
}
