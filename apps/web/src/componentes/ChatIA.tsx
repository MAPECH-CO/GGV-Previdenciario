import { useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { registrarRecusaDoChat } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { recusaDoChat } from '../regras/parecer.ts'
import { recusaDoChatNaPericia } from '../regras/pericia.ts'
import styles from './ChatIA.module.css'

type Props = {
  /** Exemplo que aparece no campo vazio. */
  exemplo: string
  /** Atalhos do perfil: clicar preenche o campo, não envia. */
  sugestoes: string[]
  /** Sem ligação com o servidor ainda (GGVP-82). Sem isto, ou com `false` (não tratou), o envio só avisa e mantém o texto. */
  onEnviar?: (texto: string) => boolean | void
  /** Mensagem com arquivo anexado (GGVP-17, "Subir laudo novo"). Sem isto, "Anexar arquivo" fica indisponível. */
  onAnexo?: (texto: string, anexo: File) => void
  /** A conversa, acima do campo. */
  children?: ReactNode
}

/** "Pergunte ou peça": a IA só responde e orienta; para executar algo, mostra um card para a pessoa confirmar. */
export function ChatIA({ exemplo, sugestoes, onEnviar, onAnexo, children }: Props) {
  const idCampo = useId()
  const campo = useRef<HTMLTextAreaElement>(null)
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState<File | null>(null)
  const [aviso, setAviso] = useState('')
  // Quem está na sessão (sem sessão, ninguém).
  const perfil = usePerfil()

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (anexo && onAnexo) {
      setAviso('')
      onAnexo(limpo, anexo)
      setTexto('')
      setAnexo(null)
      return
    }
    if (!limpo) return
    // Pular o parecer médico não vira ação: não há card para isso (GGVP-33, CA3).
    const recusa = recusaDoChat(limpo)
    if (recusa) {
      setAviso(recusa)
      setTexto('')
      return
    }
    // Orientação para esconder, mudar ou simular a situação real não vira ação, e o pedido fica registrado (GGVP-61, CA11, G11).
    const fraude = recusaDoChatNaPericia(limpo)
    if (fraude) {
      registrarRecusaDoChat(limpo, perfil?.usuario ?? 'Você')
      setAviso(fraude)
      setTexto('')
      return
    }
    if (!onEnviar || onEnviar(limpo) === false) {
      setAviso('O chat ainda não está ligado ao servidor.')
      return
    }
    setAviso('')
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

      {children}

      <form className={styles.form} onSubmit={enviar}>
        {anexo && (
          <p className={styles.anexo}>
            <span aria-hidden="true">▤ </span>
            {anexo.name}
            <button type="button" className={styles.tirar} aria-label={`Tirar o anexo ${anexo.name}`} onClick={() => setAnexo(null)}>
              ×
            </button>
          </p>
        )}
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
          {/* Gravar, e anexar fora do "Subir laudo novo", ainda não estão ligados (GGVP-82): avisam que estão indisponíveis. */}
          {onAnexo ? (
            <label className={styles.chip}>
              + Anexar arquivo
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="so-leitor"
                onChange={(e) => {
                  setAnexo(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
          ) : (
            <button type="button" className={styles.chip} aria-disabled="true">
              + Anexar arquivo
            </button>
          )}
          <button type="button" className={styles.chip} aria-disabled="true">
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
