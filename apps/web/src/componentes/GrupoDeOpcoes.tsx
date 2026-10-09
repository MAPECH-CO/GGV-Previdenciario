import { useId } from 'react'
import styles from './GrupoDeOpcoes.module.css'

export type Opcao = { id: string; rotulo: string; sub?: string; alerta?: boolean }

type Props = {
  rotulo: string
  opcoes: Opcao[]
  valor: string | null
  aoMudar: (id: string) => void
  /** 'dia': o botão de duas linhas da data (Figma 73:486). */
  forma?: 'pilula' | 'dia'
}

/** Escolha de uma opção só, em botões (Figma 73:477, 73:485 e 73:502): tipo, dia e horário da entrevista. */
export function GrupoDeOpcoes({ rotulo, opcoes, valor, aoMudar, forma = 'pilula' }: Props) {
  const id = useId()
  return (
    <div className={styles.grupo}>
      <p id={id} className={styles.rotulo}>
        {rotulo}
      </p>
      <div className={styles.opcoes} role="radiogroup" aria-labelledby={id}>
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={valor === o.id}
            className={forma === 'dia' ? styles.dia : styles.pilula}
            onClick={() => aoMudar(o.id)}
          >
            <span>{o.rotulo}</span>
            {o.sub && <span className={o.alerta ? styles.subAlerta : styles.sub}>{o.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
