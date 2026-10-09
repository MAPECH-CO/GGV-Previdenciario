import { CATEGORIAS_DA_AGENDA } from '../dados/catalogos.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import cat from './Categorias.module.css'
import styles from './CartaoEvento.module.css'

const RODAPE: Record<EventoDaAgenda['estado'], string> = { agendado: '', realizado: '✓ realizado', faltou: 'faltou', confirmar: 'confirmar se aconteceu' }

/** Um evento na coluna da semana (Figma 1941:2): hora e categoria, quem, o quê e o estado. */
export function CartaoEvento({ evento, aoAbrir }: { evento: EventoDaAgenda; aoAbrir: () => void }) {
  const categoria = CATEGORIAS_DA_AGENDA.find((c) => c.id === evento.categoria)?.nome.split(' ')[0]
  return (
    <button
      type="button"
      className={`${styles.cartao} ${cat[evento.estado === 'confirmar' ? 'confirmar' : evento.categoria]}`}
      data-estado={evento.estado}
      onClick={aoAbrir}
    >
      <span className={styles.topo}>
        {evento.hora} · {categoria}
      </span>
      <span className={styles.titulo}>{evento.titulo}</span>
      <span className={styles.oQue}>{evento.oQue}</span>
      {RODAPE[evento.estado] && <span className={styles.estado}>{RODAPE[evento.estado]}</span>}
    </button>
  )
}
