import { CATEGORIAS_DA_AGENDA } from '../dados/catalogos.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import { detalheDoEvento, diaCurto } from '../regras/agenda.ts'
import styles from './AgendaLista.module.css'
import cat from './Categorias.module.css'

type Props = { desde: string; eventos: EventoDaAgenda[]; hoje: string; aoAbrir: (e: EventoDaAgenda) => void }

const ESTADO: Record<EventoDaAgenda['estado'], string> = {
  agendado: 'agendado',
  realizado: 'realizado',
  faltou: 'faltou',
  confirmar: 'confirmar se aconteceu',
}

/** A lista da agenda (Figma 1941:401): o que passou sem registro no topo, depois tudo dali em diante, por dia. */
export function AgendaLista({ desde, eventos, hoje, aoAbrir }: Props) {
  const grupos: { titulo: string; itens: EventoDaAgenda[] }[] = []
  const pendentes = eventos.filter((e) => e.estado === 'confirmar')
  if (pendentes.length > 0) grupos.push({ titulo: 'Para confirmar se aconteceu', itens: pendentes })
  for (const e of eventos.filter((x) => x.data >= desde && x.estado !== 'confirmar')) {
    const titulo = `${diaCurto(e.data)}/${e.data.slice(5, 7)}${e.data === hoje ? ' · hoje' : ''}`
    if (grupos.at(-1)?.titulo !== titulo) grupos.push({ titulo, itens: [] })
    grupos.at(-1)!.itens.push(e)
  }
  if (grupos.length === 0) return <p className={styles.vazio}>Nada marcado daqui em diante.</p>
  return (
    <div className={styles.lista}>
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo}>
          <h3 className={styles.dia} data-hoje={g.titulo.endsWith('hoje')}>
            {g.titulo}
          </h3>
          <ul className={styles.cartao}>
            {g.itens.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={`${styles.linha} ${cat[e.estado === 'confirmar' ? 'confirmar' : e.categoria]}`}
                  data-estado={e.estado}
                  onClick={() => aoAbrir(e)}
                >
                  <span className={styles.hora}>{e.estado === 'confirmar' ? `${diaCurto(e.data)} ${e.hora}` : e.hora}</span>
                  <span className={styles.categoria}>● {CATEGORIAS_DA_AGENDA.find((c) => c.id === e.categoria)?.nome}</span>
                  <span className={styles.textos}>
                    <span>
                      <strong>{e.titulo}</strong> · {e.oQue}
                    </span>
                    <span className={styles.detalhe}>{detalheDoEvento(e)}</span>
                  </span>
                  {e.passo && <span className={styles.passo}>{e.passo.split(' ')[0]}</span>}
                  <span className={styles.estado}>{ESTADO[e.estado]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
