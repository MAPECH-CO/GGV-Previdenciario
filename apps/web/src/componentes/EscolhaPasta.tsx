import { useState } from 'react'
import type { PastaDrive } from '../dados/tipos.ts'
import styles from './EscolhaPasta.module.css'

/** Mais de uma pasta do Drive pode ser desta pessoa: pergunta qual usar, ou cria uma (CA14). Drive simulado. */
export function EscolhaPasta({ pastas, aoEscolher }: { pastas: PastaDrive[]; aoEscolher: (pasta: string) => void }) {
  const [escolhida, setEscolhida] = useState('')
  const opcoes = [...pastas.map((p) => ({ id: p.id, texto: `${p.caminho}/${p.nome}` })), { id: 'nova', texto: 'Nenhuma: criar uma nova' }]
  return (
    <fieldset className={styles.escolha}>
      <legend className={styles.pergunta}>
        A ficha foi salva. Há {pastas.length} pastas no Drive que podem ser desta pessoa: qual usar?
      </legend>
      {opcoes.map((o) => (
        <label key={o.id} className={styles.opcao}>
          <input type="radio" name="pasta" value={o.id} checked={escolhida === o.id} onChange={() => setEscolhida(o.id)} />
          {o.texto}
        </label>
      ))}
      <button type="button" className={styles.botao} disabled={!escolhida} onClick={() => aoEscolher(escolhida)}>
        Usar esta pasta
      </button>
    </fieldset>
  )
}
