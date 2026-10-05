import { useEffect, useRef, useState } from 'react'
import { formatarTelefone } from '../campos.ts'
import { prepararConvite, registrarConvite } from '../dados/agenda.ts'
import { obterConfirmacao, registrarMensagemDeConfirmacao } from '../dados/confirmacao.ts'
import styles from './ConviteChatwoot.module.css'

/** O convite da entrevista (GGVP-123) ou a confirmação dela (GGVP-21). */
type Assunto = 'convite' | 'confirmacao'

type Props = { agendamentoId: string; assunto?: Assunto; aoEnviado: () => void; aoFechar: () => void }

const CONVERSA: Record<Assunto, { rotulo: string; carregar: (id: string) => Promise<{ nome: string; telefone: string; mensagem: string }>; enviar: (id: string, mensagem: string) => Promise<unknown> }> = {
  convite: { rotulo: 'Mensagem do convite (confira antes de enviar)', carregar: prepararConvite, enviar: registrarConvite },
  confirmacao: {
    rotulo: 'Mensagem de confirmação (confira antes de enviar)',
    carregar: async (id) => {
      const dados = await obterConfirmacao(id)
      if (!dados) throw new Error('Compromisso não encontrado')
      return { nome: dados.ficha.nome, telefone: dados.ficha.telefone, mensagem: dados.mensagem }
    },
    enviar: registrarMensagemDeConfirmacao,
  },
}

/**
 * A conversa do cliente no Chatwoot com a mensagem pronta, para conferir e enviar (GGVP-123, CA4; GGVP-21, CA1).
 * Simulada: o Chatwoot de verdade, com o modelo da mensagem, é da GGVP-102.
 */
export function ConviteChatwoot({ agendamentoId, assunto = 'convite', aoEnviado, aoFechar }: Props) {
  const conversaDe = CONVERSA[assunto]
  const janela = useRef<HTMLDialogElement>(null)
  const [conversa, setConversa] = useState<{ nome: string; telefone: string } | null>(null)
  const [mensagem, setMensagem] = useState('')
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
    let valendo = true
    conversaDe.carregar(agendamentoId).then((c) => {
      if (!valendo) return
      setConversa(c)
      setMensagem(c.mensagem)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId, conversaDe])

  async function enviar() {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      await conversaDe.enviar(agendamentoId, mensagem)
      aoEnviado()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  const semTelefone = conversa !== null && !conversa.telefone
  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="chatwoot-titulo" onClose={aoFechar}>
      <div className={styles.cabeca}>
        <div>
          <h2 id="chatwoot-titulo" className={styles.titulo}>
            Chatwoot · conversa com {conversa?.nome ?? '…'}
          </h2>
          <p className={styles.sub}>
            {semTelefone ? 'Sem telefone: complete na ficha antes de enviar.' : conversa ? `WhatsApp ${formatarTelefone(conversa.telefone)} · simulado` : 'abrindo…'}
          </p>
        </div>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <label className={styles.campo}>
        <span className={styles.rotulo}>{conversaDe.rotulo}</span>
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
        <button type="button" className={styles.enviar} disabled={!conversa || semTelefone || mensagem.trim() === '' || enviando} onClick={enviar}>
          {enviando ? 'enviando…' : 'Enviar'}
        </button>
      </div>
    </dialog>
  )
}
