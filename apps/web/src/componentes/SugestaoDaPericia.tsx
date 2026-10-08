import type { SugestaoDaIa } from '@ggv/contratos'
import styles from '../paginas/Passo.module.css'

/**
 * A marca da sugestão da IA nas telas da Perícia (GGVP-139 CA5, CA6), no molde das outras telas com IA (guia do motor,
 * 2.3): o selo, o alerta antes de usar e as fontes; sem sugestão, o motivo, e a pessoa preenche.
 */
export function SugestaoDaPericia({ ia, selo }: { ia: { sugestao: SugestaoDaIa | null; motivo: string | null } | undefined; selo: string }) {
  if (!ia) return null
  if (!ia.sugestao) return ia.motivo ? <p className={styles.dica}>{ia.motivo}</p> : null
  const { alerta, fontes, modelo } = ia.sugestao
  return (
    <>
      <span className={`${styles.selo} ${styles.seloAlerta}`}>{selo}</span>
      {alerta && (
        <p className={styles.erroCampo} role="alert">
          Atenção: {alerta}.
        </p>
      )}
      <p className={styles.dica}>
        Fontes: {fontes.map((f) => f.trecho ?? f.referencia).join(' · ')} ({modelo})
      </p>
    </>
  )
}
