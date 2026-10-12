import { useEffect, useRef, useState } from 'react'

/** A fala do chat para sozinha em 2 minutos (12/10). */
export const LIMITE_DA_FALA_S = 120
export const MSG_SEM_MICROFONE = 'Não deu para usar o microfone: libere o acesso no navegador ou digite a pergunta.'
const BARRAS = 32

type Gravacao = { gravador: MediaRecorder; fluxo: MediaStream; contexto?: AudioContext; relogio: number; descartar: boolean }

function soltar(g: Gravacao) {
  clearInterval(g.relogio)
  g.fluxo.getTracks().forEach((t) => t.stop())
  void g.contexto?.close()
}

/**
 * O microfone do chat (12/10): grava com o MediaRecorder, mede o volume para a onda (AnalyserNode, quando há) e conta o
 * tempo. "Pronto" entrega o áudio a `aoTerminar`; "Descartar" joga fora. Sair da tela solta o microfone.
 */
export function useGravador(aoTerminar: (audio: Blob) => Promise<void>, aoFalhar: (aviso: string) => void) {
  const [estado, setEstado] = useState<'parado' | 'gravando' | 'transcrevendo'>('parado')
  const [segundos, setSegundos] = useState(0)
  const [niveis, setNiveis] = useState<number[]>(() => Array<number>(BARRAS).fill(0))
  const atual = useRef<Gravacao | null>(null)

  useEffect(
    () => () => {
      if (atual.current) soltar(atual.current)
    },
    [],
  )

  function parar(descartar: boolean) {
    const g = atual.current
    if (!g || g.gravador.state === 'inactive') return
    g.descartar = descartar
    g.gravador.stop()
  }

  async function iniciar() {
    if (atual.current) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return aoFalhar(MSG_SEM_MICROFONE)
    let fluxo: MediaStream
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return aoFalhar(MSG_SEM_MICROFONE)
    }
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
    const inicio = Date.now()
    const g: Gravacao = { gravador, fluxo, contexto, descartar: false, relogio: 0 }
    g.relogio = window.setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000)
      setSegundos(s)
      setNiveis((n) => [...n.slice(1), medir()])
      if (s >= LIMITE_DA_FALA_S) parar(false)
    }, 100)
    gravador.onstop = () => {
      soltar(g)
      atual.current = null
      if (g.descartar) return setEstado('parado')
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
