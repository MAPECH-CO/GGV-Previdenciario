import { useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ReactNode } from 'react'
import { recusaImediata } from '../dados/chat.ts'
import { usePerfilEscolhido } from '../dados/perfis.ts'
import styles from './ChatIA.module.css'

/** O reconhecimento de fala do navegador (Chrome e Edge). Sem ele, "Gravar áudio" avisa e a pessoa digita. */
type Reconhecimento = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
function novoReconhecimento(): Reconhecimento | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento }
  const Classe = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Classe ? new Classe() : null
}

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
  const [gravando, setGravando] = useState(false)
  const reconhecimento = useRef<Reconhecimento | null>(null)
  const perfil = usePerfilEscolhido()

  /** "Gravar áudio" (GGVP-82, CA6): a fala vira texto no campo, para a pessoa conferir antes de enviar. */
  function gravar() {
    if (gravando) {
      reconhecimento.current?.stop()
      return
    }
    const r = novoReconhecimento()
    if (!r) {
      setAviso('Este navegador não transforma a fala em texto: use o Chrome ou o Edge, ou digite a pergunta.')
      return
    }
    r.lang = 'pt-BR'
    r.interimResults = false
    r.onresult = (e) => {
      const fala = Array.from(e.results, (x) => x[0].transcript).join(' ').trim()
      if (fala) setTexto((t) => (t ? `${t} ${fala}` : fala))
    }
    r.onend = () => setGravando(false)
    r.onerror = () => {
      setGravando(false)
      setAviso('Não deu para ouvir: confira o microfone e tente de novo, ou digite a pergunta.')
    }
    reconhecimento.current = r
    setAviso('')
    setGravando(true)
    r.start()
  }

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
          <button type="button" className={styles.chip} aria-pressed={gravando} onClick={gravar}>
            <span className={styles.gravar} aria-hidden="true">
              ●
            </span>
            {gravando ? 'Parar de gravar' : 'Gravar áudio'}
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
