// GGVP-133: a gravação de verdade numa tela (a entrevista e a conversa do Relacionamento). Abre o microfone, manda cada
// parte do áudio ao servidor assim que fica pronta, abre o texto ao vivo com a chave temporária e, ao fechar, devolve o
// que não subiu: sem internet, as partes esperam neste computador. Sem microfone, `semMicrofone` diz o motivo: a tela
// avisa e oferece subir o áudio gravado fora ou registrar sem áudio, sem falas de exemplo.
import { useEffect, useRef, useState } from 'react'
import type { ChaveAoVivo } from '@ggv/contratos'
import { abrirMicrofone, ouvirAoVivo, type FalaAoVivo, type Microfone } from './audio.ts'
import type { ParteDoAudio } from './entrevista.ts'

type Opcoes = {
  /** A gravação de verdade pode começar: gravando, numa gravação do servidor. O microfone abre uma vez só. */
  ligar: boolean
  /** Pausada (inclusive no cofre, G9): o microfone não grava nem manda som ao texto ao vivo. */
  pausada: boolean
  segundos: number
  enviarParte: (parte: ParteDoAudio) => Promise<unknown>
  /** Sem texto ao vivo (a ligação): nulo. */
  pedirChave: (() => Promise<ChaveAoVivo | { erro: string }>) | null
}

export function useGravacaoDeVerdade({ ligar, pausada, segundos, enviarParte, pedirChave }: Opcoes) {
  const microfone = useRef<Microfone | null>(null)
  const tentou = useRef(false)
  const pararAoVivo = useRef<(() => void) | null>(null)
  const pendentes = useRef<ParteDoAudio[]>([])
  const enviando = useRef<Promise<void> | null>(null)
  const segundosAgora = useRef(0)
  const funcoes = useRef({ enviarParte, pedirChave })
  const [aoVivo, setAoVivo] = useState<FalaAoVivo[] | null>(null)
  const [semAoVivo, setSemAoVivo] = useState('')
  const [semMicrofone, setSemMicrofone] = useState('')

  useEffect(() => {
    segundosAgora.current = segundos
  }, [segundos])
  useEffect(() => {
    funcoes.current = { enviarParte, pedirChave }
  })

  /** As partes sobem uma de cada vez; a que falhou fica e sobe na próxima vez. */
  function enviarPendentes(): Promise<void> {
    enviando.current ??= (async () => {
      try {
        while (pendentes.current.length > 0 && navigator.onLine) {
          await funcoes.current.enviarParte(pendentes.current[0])
          pendentes.current.shift()
        }
      } catch {
        // A parte fica guardada neste computador.
      } finally {
        enviando.current = null
      }
    })()
    return enviando.current
  }

  useEffect(() => {
    if (!ligar || tentou.current) return
    tentou.current = true
    void (async () => {
      const m = await abrirMicrofone(
        () => segundosAgora.current,
        (parte) => {
          pendentes.current.push(parte)
          void enviarPendentes()
        },
      )
      if ('erro' in m) return setSemMicrofone(m.erro)
      microfone.current = m
      setAoVivo([])
      const pedir = funcoes.current.pedirChave
      if (!pedir) return
      const chave = await pedir()
      if ('erro' in chave) return setSemAoVivo(chave.erro)
      pararAoVivo.current = await ouvirAoVivo(m.stream, chave.chave, setAoVivo)
      if (!pararAoVivo.current) setSemAoVivo('O texto ao vivo não abriu: a transcrição sai quando a gravação terminar.')
    })()
  }, [ligar])

  useEffect(() => {
    if (pausada) microfone.current?.pausar()
    else microfone.current?.retomar()
  }, [pausada])

  useEffect(
    () => () => {
      void microfone.current?.parar()
      pararAoVivo.current?.()
    },
    [],
  )

  // As ações só leem refs: a mesma função em todo render, para a tela pôr nas dependências dos efeitos.
  const [acoes] = useState(() => ({
    /** Pausa já, no clique, antes de o servidor responder (cofre, G9). */
    pausar: () => microfone.current?.pausar(),
    /** Fecha o microfone, manda o que falta e devolve as partes que não subiram (sem internet). */
    async fechar(): Promise<ParteDoAudio[]> {
      const m = microfone.current
      microfone.current = null
      pararAoVivo.current?.()
      pararAoVivo.current = null
      if (m) {
        await m.parar()
        await enviarPendentes()
        if (pendentes.current.length > 0) await enviarPendentes()
      }
      return [...pendentes.current]
    },
    /** As partes que ficaram neste computador, para subir quando a internet voltar; a lista fica vazia. */
    tirarPendentes(): ParteDoAudio[] {
      const partes = [...pendentes.current]
      pendentes.current = []
      return partes
    },
  }))

  /**
   * `aoVivo`: o texto ao vivo, nulo sem microfone de verdade; `semAoVivo`: por que não há texto ao vivo; `semMicrofone`:
   * por que o microfone não abriu (vazio enquanto abre ou quando abriu).
   */
  return { aoVivo, semAoVivo, semMicrofone, ...acoes }
}
