import type { EventoDaAgenda } from '../dados/tipos.ts'
import styles from './AgendaMes.module.css'
import cat from './Categorias.module.css'

type Props = { semanas: string[][]; mes: string; eventos: EventoDaAgenda[]; hoje: string; aoAbrir: (e: EventoDaAgenda) => void }

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const POR_DIA = 3

/** O mês da agenda (Figma 1941:198): até três eventos por dia e "+N eventos". */
export function AgendaMes({ semanas, mes, eventos, hoje, aoAbrir }: Props) {
  return (
    <div className={styles.mes}>
      {DIAS.map((d) => (
        <p key={d} className={styles.diaDaSemana} aria-hidden="true">
          {d}
        </p>
      ))}
      {semanas.flat().map((dia) => {
        const doDia = eventos.filter((e) => e.data === dia)
        const resto = doDia.length - POR_DIA
        return (
          <section
            key={dia}
            className={styles.dia}
            data-fora={dia.slice(0, 7) !== mes}
            data-hoje={dia === hoje}
            aria-label={`${Number(dia.slice(8))}/${dia.slice(5, 7)}${dia === hoje ? ', hoje' : ''}`}
          >
            <span className={styles.numero}>
              {Number(dia.slice(8))}
              {dia === hoje && ' · hoje'}
            </span>
            {doDia.slice(0, POR_DIA).map((e) => (
              <button
                key={e.id}
                type="button"
                className={`${styles.evento} ${cat[e.estado === 'confirmar' ? 'confirmar' : e.categoria]}`}
                onClick={() => aoAbrir(e)}
              >
                {e.hora} {e.titulo.split(' ')[0]}
              </button>
            ))}
            {resto > 0 && <span className={styles.mais}>+{resto === 1 ? '1 evento' : `${resto} eventos`}</span>}
          </section>
        )
      })}
    </div>
  )
}
