import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { MSG_FALA_VAZIA, recusaImediata, transcreverFala } from '../dados/chat.ts'
import { usePerfil } from '../dados/perfis.ts'
import { useGravador } from './useGravador.ts'
import styles from './ChatIA.module.css'

type Props = {
  /** Exemplo que aparece no campo vazio. */
  exemplo: string
  /** Atalhos do perfil: clicar preenche o campo, não envia. */
  sugestoes: string[]
  /** Sem ligação com o servidor ainda (GGVP-82). Sem isto, ou com `false` (não tratou), o envio só avisa e mantém o texto. */
  onEnviar?: (texto: string) => boolean | void
  /** Mensagem com arquivos anexados (GGVP-17 e GGVP-82, CA12). Sem isto, "Anexar arquivo" fica indisponível. */
  onAnexo?: (texto: string, anexos: File[]) => void
  /** A conversa, acima do campo. */
  children?: ReactNode
}

/** "Pergunte ou peça": a IA só responde e orienta; para executar algo, mostra um card para a pessoa confirmar. */
export function ChatIA({ exemplo, sugestoes, onEnviar, onAnexo, children }: Props) {
  const idCampo = useId()
  const campo = useRef<HTMLTextAreaElement>(null)
  const [texto, setTexto] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])
  const [aviso, setAviso] = useState('')
  // Quem está na sessão (sem sessão, ninguém).
  const perfil = usePerfil()
  const pronto = useRef<HTMLButtonElement>(null)

  // "Gravar áudio" (GGVP-82 CA6, refeito em 12/10): a fala vira texto na caixa, para a pessoa conferir antes de enviar.
  const gravador = useGravador(async (audio) => {
    try {
      const fala = await transcreverFala(audio)
      if (!fala) return setAviso(MSG_FALA_VAZIA)
      setAviso('')
      setTexto((t) => (t.trim() ? `${t.trim()} ${fala}` : fala))
    } catch (e) {
      setAviso(e instanceof Error ? e.message : MSG_FALA_VAZIA)
    } finally {
      campo.current?.focus()
    }
  }, setAviso)
  useEffect(() => {
    if (gravador.estado === 'gravando') pronto.current?.focus()
  }, [gravador.estado])
  const tempo = `${Math.floor(gravador.segundos / 60)}:${String(gravador.segundos % 60).padStart(2, '0')}`

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (anexos.length && onAnexo) {
      setAviso('')
      onAnexo(limpo, anexos)
      setTexto('')
      setAnexos([])
      return
    }
    if (!limpo) return
    // Pular o parecer médico (GGVP-33, CA3) e orientar a esconder ou mudar a situação real (GGVP-61, CA11, G11, registrado):
    // as recusas do motor do chat (GGVP-82), na hora e sem card.
    const recusa = recusaImediata(limpo, perfil?.usuario ?? 'Você')
    if (recusa) {
      setAviso(recusa)
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
        {anexos.map((anexo) => (
          <p key={anexo.name} className={styles.anexo}>
            <span aria-hidden="true">▤ </span>
            {anexo.name}
            <button type="button" className={styles.tirar} aria-label={`Tirar o anexo ${anexo.name}`} onClick={() => setAnexos((a) => a.filter((x) => x !== anexo))}>
              ×
            </button>
          </p>
        ))}
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
        {gravador.estado === 'parado' ? (
          <div className={styles.acoes}>
            {onAnexo ? (
              <label className={styles.chip}>
                + Anexar arquivo
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  multiple
                  className="so-leitor"
                  onChange={(e) => {
                    const novos = Array.from(e.target.files ?? [])
                    setAnexos((a) => [...a, ...novos.filter((n) => !a.some((x) => x.name === n.name))])
                    e.target.value = ''
                  }}
                />
              </label>
            ) : (
              <button type="button" className={styles.chip} aria-disabled="true">
                + Anexar arquivo
              </button>
            )}
            <button type="button" className={styles.chip} onClick={() => void gravador.iniciar()}>
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
        ) : (
          <div
            className={styles.gravando}
            role="group"
            aria-label="Gravação"
            onKeyDown={(e) => {
              if (e.key === 'Escape') gravador.descartar()
            }}
          >
            <span className={`${styles.ponto} ${gravador.estado === 'transcrevendo' ? styles.pontoParado : ''}`} aria-hidden="true" />
            <span className={styles.estado}>{gravador.estado === 'gravando' ? 'Gravando' : 'Transcrevendo…'}</span>
            <span className={styles.onda} aria-hidden="true">
              {gravador.niveis.map((n, i) => (
                <span key={i} style={{ height: `${Math.round(4 + n * 22)}px` }} />
              ))}
            </span>
            <span className={styles.tempo}>{tempo}</span>
            <button type="button" className={styles.descartar} aria-label="Descartar a gravação" disabled={gravador.estado !== 'gravando'} onClick={gravador.descartar}>
              ✕
            </button>
            <button ref={pronto} type="button" className={styles.pronto} disabled={gravador.estado !== 'gravando'} onClick={gravador.pronto}>
              <span aria-hidden="true">✓ </span>
              Pronto
            </button>
          </div>
        )}
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
