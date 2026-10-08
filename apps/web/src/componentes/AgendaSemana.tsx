import type { EventoDaAgenda } from '../dados/tipos.ts'
import { diaCurto } from '../regras/agenda.ts'
import styles from './AgendaSemana.module.css'
import { CartaoEvento } from './CartaoEvento.tsx'

type Props = { dias: string[]; eventos: EventoDaAgenda[]; hoje: string; aoAbrir: (e: EventoDaAgenda) => void }

/** A semana da agenda (Figma 1941:2): de segunda a domingo, uma coluna por dia. */
export function AgendaSemana({ dias, eventos, hoje, aoAbrir }: Props) {
  return (
    <div className={styles.semana}>
      {dias.map((dia) => {
        const doDia = eventos.filter((e) => e.data === dia)
        const [nome, numero] = diaCurto(dia).split(' ')
        return (
          <section key={dia} className={styles.dia} data-hoje={dia === hoje} aria-label={`${diaCurto(dia)}${dia === hoje ? ', hoje' : ''}`}>
            <h3 className={styles.cabeca}>
              <span className={styles.nome}>{nome}</span> <span className={styles.numero}>{numero}</span>
              {dia === hoje && <span className={styles.hoje}> hoje</span>}
            </h3>
            {doDia.length === 0 ? (
              <p className={styles.vazio}>—</p>
            ) : (
              doDia.map((e) => <CartaoEvento key={e.id} evento={e} aoAbrir={() => aoAbrir(e)} />)
            )}
          </section>
        )
      })}
    </div>
  )
}
