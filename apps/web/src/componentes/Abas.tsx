import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import styles from './Abas.module.css'

export type Aba = { id: string; rotulo: string }

type Props = {
  abas: Aba[]
  ativa: string
  onMudar: (id: string) => void
  /** Nome da lista de abas para leitor de tela. */
  rotulo: string
}

/** Cada aba tem id `aba-<id>` e controla o painel `painel-<id>`, que a tela monta com role="tabpanel". */
export function Abas({ abas, ativa, onMudar, rotulo }: Props) {
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({})

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = abas.length - 1
    const destinos: Record<string, number> = {
      ArrowRight: indice === ultimo ? 0 : indice + 1,
      ArrowLeft: indice === 0 ? ultimo : indice - 1,
      Home: 0,
      End: ultimo,
    }
    const destino = destinos[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    const id = abas[destino].id
    onMudar(id)
    botoes.current[id]?.focus()
  }

  return (
    <div className={styles.lista} role="tablist" aria-label={rotulo}>
      {abas.map((aba, indice) => (
        <button
          key={aba.id}
          ref={(el) => {
            botoes.current[aba.id] = el
          }}
          type="button"
          role="tab"
          id={`aba-${aba.id}`}
          className={styles.aba}
          aria-selected={aba.id === ativa}
          aria-controls={`painel-${aba.id}`}
          tabIndex={aba.id === ativa ? 0 : -1}
          onClick={() => onMudar(aba.id)}
          onKeyDown={(e) => aoTeclar(e, indice)}
        >
          {aba.rotulo}
        </button>
      ))}
    </div>
  )
}
