import { useEffect, useRef, useState } from 'react'
import { formatarTelefone } from '../campos.ts'
import styles from './ConviteChatwoot.module.css'

type Props = {
  nome: string
  telefone: string
  rotulo: string
  mensagemInicial: string
  aoEnviar: (mensagem: string) => Promise<void>
  aoFechar: () => void
}

/**
 * A conversa do cliente no Chatwoot com a mensagem pronta, para conferir e enviar pelo WhatsApp (GGVP-72, CA12). Simulada,
 * com o mesmo desenho da janela do convite (GGVP-123): o Chatwoot de verdade é da GGVP-102.
 */
export function MensagemWhatsApp({ nome, telefone, rotulo, mensagemInicial, aoEnviar, aoFechar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const [mensagem, setMensagem] = useState(mensagemInicial)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  async function enviar() {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      await aoEnviar(mensagem)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="whatsapp-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div>
          <h2 id="whatsapp-titulo" className={styles.titulo}>
            Chatwoot · conversa com {nome}
          </h2>
          <p className={styles.sub}>{telefone ? `WhatsApp ${formatarTelefone(telefone)} · simulado` : 'Sem telefone: complete na ficha antes de enviar.'}</p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <label className={styles.campo}>
        <span className={styles.rotulo}>{rotulo}</span>
        <textarea className={styles.texto} rows={6} maxLength={1000} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
      </label>
      {erro && (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
      <div className={styles.pe}>
        <button type="button" className={styles.cancelar} onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className={styles.enviar} disabled={!telefone || mensagem.trim() === '' || enviando} onClick={enviar}>
          {enviando ? 'enviando…' : 'Enviar'}
        </button>
      </div>
    </dialog>
  )
}
