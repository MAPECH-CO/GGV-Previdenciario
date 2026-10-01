import { useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import styles from './ChatIA.module.css'

type Props = {
  /** Exemplo que aparece no campo vazio. */
  exemplo: string
  /** Atalhos do perfil: clicar preenche o campo, não envia. */
  sugestoes: string[]
  /** Sem ligação com o servidor ainda (GGVP-82). Sem isto, o envio só avisa. */
  onEnviar?: (texto: string) => void
}

/** "Pergunte ou peça": a IA só responde e orienta; para executar algo, mostra um card para a pessoa confirmar. */
export function ChatIA({ exemplo, sugestoes, onEnviar }: Props) {
  const idCampo = useId()
  const campo = useRef<HTMLTextAreaElement>(null)
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (!limpo) return
    if (!onEnviar) {
      setAviso('O chat ainda não está ligado ao servidor.')
      return
    }
    setAviso('')
    onEnviar(limpo)
    setTexto('')
  }

  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault()
      evento.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <section className={styles.chat} aria-label="Chat com a IA">
      <div className={styles.cabecalho}>
        <label className={styles.titulo} htmlFor={idCampo}>
          ✦ Pergunte ou peça
        </label>
        <p className={styles.dica}>só responde e orienta; para executar algo, mostra um card para você confirmar</p>
      </div>

      <form className={styles.form} onSubmit={enviar}>
        <textarea
          ref={campo}
          id={idCampo}
          className={styles.entrada}
          rows={1}
          placeholder={exemplo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
        />
        <div className={styles.acoes}>
          <button type="button" className={styles.chip}>
            + Anexar arquivo
          </button>
          <button type="button" className={styles.chip}>
            <span className={styles.gravar} aria-hidden="true">
              ●
            </span>
            Gravar áudio
          </button>
          <span className={styles.espaco} />
          <button type="submit" className={styles.enviar}>
            Enviar
          </button>
        </div>
      </form>

      <ul className={styles.sugestoes} aria-label="Sugestões">
        {sugestoes.map((sugestao) => (
          <li key={sugestao}>
            <button
              type="button"
              className={styles.sugestao}
              onClick={() => {
                setTexto(sugestao)
                campo.current?.focus()
              }}
            >
              {sugestao}
            </button>
          </li>
        ))}
      </ul>

      {aviso && (
        <p className={styles.aviso} role="status">
          {aviso}
        </p>
      )}
    </section>
  )
}
