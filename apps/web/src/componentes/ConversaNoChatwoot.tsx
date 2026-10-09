import { useId, useState } from 'react'
import { formatarTelefone } from '../campos.ts'
import { linkDaConversa, type ContatoChatwoot, type ConversaChatwoot } from '../dados/chatwoot.ts'
import styles from './ConversaNoChatwoot.module.css'

type Props = {
  contato: ContatoChatwoot | null
  conversas: ConversaChatwoot[]
  escolhida: number | undefined
  aoEscolher: (id: number) => void
  /** O texto que "Copiar a mensagem" leva para colar na conversa. */
  texto: string
}

/**
 * O cliente na central do Chatwoot (GGVP-102, CA6; Pedro 07/10): o contato do telefone da ficha, as conversas dele com a
 * de mais mensagens primeiro, "Copiar a mensagem" e "Abrir a conversa".
 */
export function ConversaNoChatwoot({ contato, conversas, escolhida, aoEscolher, texto }: Props) {
  const idTitulo = useId()
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiada(true)
    } catch {
      setCopiada(false)
    }
  }

  return (
    <section className={styles.chatwoot} aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className={styles.titulo}>
        Na central do Chatwoot
      </h3>
      {!contato ? (
        <p className={styles.aviso} role="note">
          O Chatwoot não achou o contato deste telefone: confira o telefone na ficha.
        </p>
      ) : (
        <>
          <p className={styles.contato}>
            Contato: <strong>{contato.nome}</strong> · {formatarTelefone(contato.telefone)}
          </p>
          {conversas.length > 1 && <p className={styles.nota}>{conversas.length} conversas: a de mais mensagens vem primeiro.</p>}
          <ul className={styles.conversas} role="radiogroup" aria-label="Conversas do cliente">
            {conversas.map((c) => (
              <li key={c.id}>
                <button type="button" role="radio" className={styles.conversa} aria-checked={escolhida === c.id} onClick={() => aoEscolher(c.id)}>
                  Conversa #{c.id} · {c.mensagens} mensagens · {c.situacao} · {c.caixa}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} disabled={!texto.trim()} onClick={copiar}>
              {copiada ? '✓ Mensagem copiada' : 'Copiar a mensagem'}
            </button>
            {escolhida !== undefined && (
              <a className={styles.botao} href={linkDaConversa(escolhida)} target="_blank" rel="noreferrer">
                Abrir a conversa
              </a>
            )}
          </div>
        </>
      )}
    </section>
  )
}
