import { Fragment, type ReactNode } from 'react'
import { lerFormatacao, type Trecho } from '../regras/formatacao.ts'
import styles from './TextoFormatado.module.css'

function trechos(lista: Trecho[]): ReactNode {
  return lista.map((t, i) => {
    if (t.tipo === 'texto') return <Fragment key={i}>{t.texto}</Fragment>
    if (t.tipo === 'codigo') return <code key={i}>{t.texto}</code>
    if (t.tipo === 'negrito') return <strong key={i}>{trechos(t.filhos)}</strong>
    if (t.tipo === 'italico') return <em key={i}>{trechos(t.filhos)}</em>
    return (
      <a key={i} href={t.href}>
        {trechos(t.filhos)}
      </a>
    )
  })
}

/** O texto da IA com negrito, listas, tabelas e títulos curtos (12/10). Nunca HTML: tudo vira elemento do React. */
export function TextoFormatado({ texto }: { texto: string }) {
  return (
    <div className={styles.texto}>
      {lerFormatacao(texto).map((b, i) => {
        if (b.tipo === 'paragrafo')
          return (
            <p key={i}>
              {b.linhas.map((l, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {trechos(l)}
                </Fragment>
              ))}
            </p>
          )
        if (b.tipo === 'titulo') return b.nivel === 3 ? <h3 key={i}>{trechos(b.trechos)}</h3> : <h4 key={i}>{trechos(b.trechos)}</h4>
        if (b.tipo === 'lista') {
          const Lista = b.ordenada ? 'ol' : 'ul'
          return (
            <Lista key={i}>
              {b.itens.map((item, j) => (
                <li key={j}>
                  {trechos(item.trechos)}
                  {item.filhos.length > 0 && (
                    <ul>
                      {item.filhos.map((f, k) => (
                        <li key={k}>{trechos(f)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </Lista>
          )
        }
        return (
          <div key={i} className={styles.tabela}>
            <table>
              <thead>
                <tr>
                  {b.cabeca.map((c, j) => (
                    <th key={j} scope="col">
                      {trechos(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.linhas.map((l, j) => (
                  <tr key={j}>
                    {l.map((c, k) => (
                      <td key={k}>{trechos(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
