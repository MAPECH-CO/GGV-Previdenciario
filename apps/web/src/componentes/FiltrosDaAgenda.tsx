import { CATEGORIAS_DA_AGENDA } from '../dados/catalogos.ts'
import type { CategoriaDaAgenda, EventoDaAgenda } from '../dados/tipos.ts'
import cat from './Categorias.module.css'
import styles from './FiltrosDaAgenda.module.css'

type Props = { eventos: EventoDaAgenda[]; ativas: Set<CategoriaDaAgenda>; aoMudar: (ativas: Set<CategoriaDaAgenda>) => void }

/** Os filtros por categoria com a contagem do que está na tela (Figma 1941:2). */
export function FiltrosDaAgenda({ eventos, ativas, aoMudar }: Props) {
  function alternar(id: CategoriaDaAgenda) {
    const novas = new Set(ativas)
    if (novas.has(id)) novas.delete(id)
    else novas.add(id)
    aoMudar(novas)
  }
  return (
    <div className={styles.filtros} role="group" aria-label="Categorias">
      {CATEGORIAS_DA_AGENDA.map((c) => (
        <button key={c.id} type="button" className={`${styles.filtro} ${cat[c.id]}`} aria-pressed={ativas.has(c.id)} onClick={() => alternar(c.id)}>
          <span className={styles.ponto} aria-hidden="true" />
          {c.nome}
          <strong>{eventos.filter((e) => e.categoria === c.id).length}</strong>
        </button>
      ))}
    </div>
  )
}
