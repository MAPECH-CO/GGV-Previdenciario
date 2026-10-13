import { ESCALA, mudarPreferencias, usePreferencias } from '../design/preferencias.ts'
import { Icone } from './Icone.tsx'
import styles from './BotoesPreferencias.module.css'

const acima = (e: number) => Math.min(ESCALA.maxima, (Math.floor(e / ESCALA.passo) + 1) * ESCALA.passo)
const abaixo = (e: number) => Math.max(ESCALA.minima, (Math.ceil(e / ESCALA.passo) - 1) * ESCALA.passo)

/**
 * Tema claro/escuro e o tamanho do portal, de 70% a 200%, de 10 em 10 (11/10: antes eram só "padrão" e "grande").
 * O número no meio volta a 100%. `empilhado`: no menu do celular, cada controle numa linha, com o nome escrito.
 */
export function BotoesPreferencias({ empilhado = false }: { empilhado?: boolean }) {
  const { tema, escala } = usePreferencias()
  const escuro = tema === 'escuro'
  const temaRotulo = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'

  return (
    <div className={empilhado ? styles.empilhado : styles.grupo}>
      <button type="button" className={styles.tema} aria-label={temaRotulo} title={temaRotulo} onClick={() => mudarPreferencias({ tema: escuro ? 'claro' : 'escuro' })}>
        <Icone nome={escuro ? 'claro' : 'escuro'} />
        {empilhado && <span>{escuro ? 'Tema claro' : 'Tema escuro'}</span>}
      </button>
      <div className={styles.tamanho} role="group" aria-label="Tamanho do portal">
        {empilhado && <span className={styles.tamanhoNome}>Tamanho</span>}
        <button type="button" aria-label="Diminuir o tamanho" title="Diminuir o tamanho" disabled={escala <= ESCALA.minima} onClick={() => mudarPreferencias({ escala: abaixo(escala) })}>
          <Icone nome="menor" />
        </button>
        <button
          type="button"
          className={styles.valor}
          aria-label={`Tamanho em ${escala}%${escala === ESCALA.padrao ? '' : '. Voltar a 100%'}`}
          title={escala === ESCALA.padrao ? 'Tamanho padrão' : 'Voltar a 100%'}
          onClick={() => mudarPreferencias({ escala: ESCALA.padrao })}
        >
          {escala}%
        </button>
        <button type="button" aria-label="Aumentar o tamanho" title="Aumentar o tamanho" disabled={escala >= ESCALA.maxima} onClick={() => mudarPreferencias({ escala: acima(escala) })}>
          <Icone nome="maior" />
        </button>
      </div>
    </div>
  )
}
