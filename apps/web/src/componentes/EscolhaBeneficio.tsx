import { useId } from 'react'
import { BENEFICIOS } from '../dados/catalogos.ts'
import styles from './EscolhaBeneficio.module.css'

/** "Benefício de interesse (opcional)" (Figma 73:415): o catálogo único do portal, um só marcado. */
export function EscolhaBeneficio({ valor, aoMudar }: { valor: string; aoMudar: (id: string) => void }) {
  const id = useId()
  return (
    <div className={styles.bloco}>
      <p id={id} className={styles.rotulo}>
        Benefício de interesse (opcional)
      </p>
      <div className={styles.opcoes} role="radiogroup" aria-labelledby={id}>
        {BENEFICIOS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={valor === b.id}
            className={styles.opcao}
            onClick={() => aoMudar(b.id)}
          >
            {b.nome}
          </button>
        ))}
      </div>
    </div>
  )
}
