import type { ReactNode } from 'react'
import type { WidgetDoChat } from '@ggv/contratos'
import styles from './WidgetsDoChat.module.css'

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaDaSemana = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay()
const maisDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Os 5 dias úteis a partir de `inicio` (ele incluído, se for útil). */
function diasUteis(inicio: string) {
  const dias: string[] = []
  for (let d = inicio; dias.length < 5; d = maisDias(d, 1)) if (diaDaSemana(d) % 6 !== 0) dias.push(d)
  return dias
}

/** A linha inteira é o link quando há link; sem link, só a linha. */
const Linha = ({ href, children }: { href?: string; children: ReactNode }) =>
  href ? (
    <a className={styles.linha} href={href}>
      {children}
    </a>
  ) : (
    <div className={styles.linha}>{children}</div>
  )

/** Um widget do chat (12/10). Os dados vêm prontos do servidor; aqui só a forma. */
export function WidgetNoChat({ widget: w }: { widget: WidgetDoChat }) {
  if (w.tipo === 'numeros')
    return (
      <ul className={styles.numeros} aria-label={w.titulo ?? 'Números'}>
        {w.itens.map((i) => (
          <li key={i.rotulo} className={styles.numero}>
            <span className={styles.rotulo}>{i.rotulo}</span>
            <span className={`${styles.valor} ${i.tom ? styles[`tom-${i.tom}`] : ''}`}>{i.valor}</span>
            {i.nota && <span className={styles.nota}>{i.nota}</span>}
          </li>
        ))}
      </ul>
    )
  if (w.tipo === 'lista')
    return (
      <section className={styles.quadro} aria-label={w.titulo}>
        <h3 className={styles.titulo}>{w.titulo}</h3>
        <ul className={styles.linhas} aria-label={w.titulo}>
          {w.itens.map((i) => {
            const [antes, ...depois] = i.titulo.split(' · ')
            return (
              <li key={i.titulo}>
                <Linha href={i.href}>
                  <span className={styles.textos}>
                    <span>
                      <strong>{antes}</strong>
                      {depois.length > 0 && ` · ${depois.join(' · ')}`}
                    </span>
                    {i.sub && <span className={styles.sub}>{i.sub}</span>}
                  </span>
                  {i.selo && <span className={`${styles.selo} ${styles[`selo-${i.selo.tom}`]}`}>{i.selo.texto}</span>}
                  {i.href && (
                    <span className={styles.seta} aria-hidden="true">
                      ›
                    </span>
                  )}
                </Linha>
              </li>
            )
          })}
        </ul>
      </section>
    )
  if (w.tipo === 'prazos') {
    const dias = diasUteis(w.inicio)
    return (
      <section className={styles.quadro} aria-label={w.titulo}>
        <h3 className={styles.titulo}>{w.titulo}</h3>
        <div className={styles.semana} aria-hidden="true">
          {dias.map((d) => {
            const doDia = w.itens.filter((i) => i.data === d)
            const cor = doDia.length ? (doDia.some((i) => i.urgente) ? styles['fundo-erro'] : styles['fundo-acento']) : ''
            return (
              <div key={d} className={styles.dia}>
                <span className={styles.diaNome}>
                  {DIAS[diaDaSemana(d)]} {d.slice(8, 10)}
                </span>
                <span className={`${styles.diaConta} ${cor}`}>{doDia.length || '–'}</span>
              </div>
            )
          })}
        </div>
        <ul className={styles.linhas} aria-label={w.titulo}>
          {w.itens.map((i) => (
            <li key={`${i.data}-${i.oQue}`}>
              <Linha href={i.href}>
                <span className={`${styles.data} ${i.urgente ? styles['tom-erro'] : ''}`}>{ddmm(i.data)}</span>
                <span className={styles.textos}>{i.oQue}</span>
              </Linha>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (w.tipo === 'etapas')
    return (
      <ol className={styles.etapas} aria-label={w.titulo ?? 'Etapas do processo'}>
        {w.itens.map((e) => (
          <li key={e.rotulo} className={styles[`etapa-${e.estado}`]} aria-current={e.estado === 'atual' ? 'step' : undefined}>
            {e.estado === 'feita' && <span aria-hidden="true">✓ </span>}
            {e.rotulo}
          </li>
        ))}
      </ol>
    )
  if (w.tipo === 'linha-do-tempo')
    return (
      <section className={styles.quadro} aria-label={w.titulo}>
        <h3 className={styles.titulo}>{w.titulo}</h3>
        <ol className={styles.tempo} aria-label={w.titulo}>
          {w.itens.map((e, i) => (
            <li key={i}>
              <span className={styles.data}>{ddmm(e.quando)}</span>
              <span className={styles.textos}>
                <span>{e.texto}</span>
                {e.quem && <span className={styles.sub}>{e.quem}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    )
  const maior = Math.max(1, ...w.itens.map((i) => i.valor))
  return (
    <section className={styles.quadro} aria-label={w.titulo}>
      <h3 className={styles.titulo}>{w.titulo}</h3>
      <ul className={styles.barras} aria-label={w.titulo}>
        {w.itens.map((i) => (
          <li key={i.rotulo}>
            <span className={styles.barraRotulo}>{i.rotulo}</span>
            <span className={styles.trilho} aria-hidden="true">
              <span style={{ width: `${(i.valor / maior) * 100}%` }} />
            </span>
            <span className={styles.barraValor}>{i.valor}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
