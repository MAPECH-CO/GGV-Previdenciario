import { BotoesPreferencias } from '../componentes/BotoesPreferencias.tsx'
import tokens from '../design/figma-tokens.json'
import styles from './Tokens.module.css'

const raios = [6, 7, 8, 10, 12, 14, 16]

/** Guia vivo dos tokens: o que está em tokens.css, desenhado com o próprio CSS. Rota: /tokens. */
export function Tokens() {
  const cores = Object.entries(tokens.cores)
  const fontes = Object.entries(tokens.fontes)

  return (
    <main className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Tokens do Figma</h1>
          <p className={styles.sub}>
            Arquivo “{tokens.origem.nome}”, coleções {tokens.origem.colecoes.cores} e {tokens.origem.colecoes.fontes},
            extraídas em {tokens.origem.extraidoEm}. Mude o tema e a fonte aqui e veja tudo reagir.
          </p>
        </div>
        <BotoesPreferencias />
      </header>

      <section aria-labelledby="t-cores">
        <h2 id="t-cores" className={styles.secao}>
          Cores <span className={styles.contagem}>{cores.length}</span>
        </h2>
        <ul className={styles.cores}>
          {cores.map(([nome, valores]) => (
            <li key={nome} className={styles.cor}>
              <span className={styles.amostra} style={{ background: `var(--cor-${nome})` }} />
              <code className={styles.nome}>cor/{nome}</code>
              <span className={styles.valor}>
                claro {valores.claro} · escuro {valores.escuro}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="t-fontes">
        <h2 id="t-fontes" className={styles.secao}>
          Tamanhos de fonte <span className={styles.contagem}>{fontes.length}</span>
        </h2>
        <ul className={styles.fontes}>
          {fontes.map(([nome, valores]) => (
            <li key={nome} className={styles.fonte}>
              <code className={styles.nome}>fonte/{nome}</code>
              <span className={styles.valor}>
                padrão {valores.padrao}px · grande {valores.grande}px
              </span>
              <span className={styles.exemplo} style={{ fontSize: `var(--fonte-${nome})` }}>
                Aposentadoria por idade
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="t-raios">
        <h2 id="t-raios" className={styles.secao}>
          Raios <span className={styles.contagem}>{raios.length + 1}</span>
        </h2>
        <ul className={styles.raios}>
          {raios.map((raio) => (
            <li key={raio} className={styles.raio}>
              <span className={styles.caixa} style={{ borderRadius: `var(--raio-${raio})` }} />
              <code className={styles.nome}>raio-{raio}</code>
            </li>
          ))}
          <li className={styles.raio}>
            <span className={styles.caixa} style={{ borderRadius: 'var(--raio-pilula)' }} />
            <code className={styles.nome}>raio-pilula</code>
          </li>
        </ul>
      </section>
    </main>
  )
}
