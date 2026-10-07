import { useEffect, useRef, useState } from 'react'
import { formatarTelefone } from '../campos.ts'
import { prepararConvite, registrarConvite } from '../dados/agenda.ts'
import { obterCobranca, registrarTentativa } from '../dados/cobranca.ts'
import { obterConfirmacao, registrarMensagemDeConfirmacao } from '../dados/confirmacao.ts'
import { obterComplemento, registrarTentativaDoComplemento } from '../dados/complemento.ts'
import { obterCobrancaDaPericia, obterLembrete, registrarCobrancaDaPericia, registrarLembrete } from '../dados/pericia.ts'
import { usePerfilEscolhido } from '../dados/perfis.ts'
import styles from './ConviteChatwoot.module.css'

/** O convite da entrevista (GGVP-123), a confirmação dela (GGVP-21), a cobrança dos documentos pendentes (GGVP-101) ou o pedido de complemento ao médico (GGVP-29). */
type Assunto = 'convite' | 'confirmacao' | 'cobranca' | 'complemento' | 'pericia-lembrete' | 'pericia-cobranca'

type Props = { agendamentoId: string; assunto?: Assunto; aoEnviado: () => void; aoFechar: () => void }

const CONVERSA: Record<Assunto, { rotulo: string; carregar: (id: string) => Promise<{ nome: string; telefone: string; mensagem: string }>; enviar: (id: string, mensagem: string, quem?: string) => Promise<unknown> }> = {
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
  // O id é o do processo; o envio conta como tentativa, ainda sem resposta (GGVP-101, CA6 e CA11).
  cobranca: {
    rotulo: 'Mensagem de cobrança (confira antes de enviar)',
    carregar: async (id) => {
      const dados = await obterCobranca(id)
      if (!dados) throw new Error('Cobrança não encontrada')
      return { nome: dados.ficha.nome, telefone: dados.ficha.telefone, mensagem: dados.mensagem }
    },
    enviar: (id) => registrarTentativa(id, { canal: 'chatwoot', resultado: 'sem-resposta' }),
  },
  // O id é o do processo; o envio da orientação conta como tentativa, ainda sem resposta (GGVP-29, CA3).
  complemento: {
    rotulo: 'Mensagem com a orientação ao médico (confira antes de enviar)',
    carregar: async (id) => {
      const dados = await obterComplemento(id)
      if (!dados) throw new Error('Complemento não encontrado')
      return { nome: dados.ficha.nome, telefone: dados.ficha.telefone, mensagem: dados.mensagem }
    },
    enviar: (id) => registrarTentativaDoComplemento(id, { canal: 'chatwoot', resultado: 'sem-resposta' }),
  },
  // O id é o do processo; o lembrete da véspera da perícia, revisado pelo Jurídico antes de sair (GGVP-53, CA7; Q5).
  'pericia-lembrete': {
    rotulo: 'Lembrete da véspera da perícia (confira antes de enviar)',
    carregar: obterLembrete,
    enviar: (id, mensagem, quem) => registrarLembrete(id, mensagem, quem),
  },
  // O id é o do processo; a cobrança diária do que a perícia pede, pela Documentação (GGVP-56; Lucas, 02/10).
  'pericia-cobranca': {
    rotulo: 'Cobrança dos documentos da perícia (confira antes de enviar)',
    carregar: obterCobrancaDaPericia,
    enviar: (id, mensagem, quem) => registrarCobrancaDaPericia(id, mensagem, quem),
  },
}

/**
 * A conversa do cliente no Chatwoot com a mensagem pronta, para conferir e enviar (GGVP-123, CA4; GGVP-21, CA1).
 * Simulada: o Chatwoot de verdade, com o modelo da mensagem, é da GGVP-102.
 */
export function ConviteChatwoot({ agendamentoId, assunto = 'convite', aoEnviado, aoFechar }: Props) {
  const conversaDe = CONVERSA[assunto]
  // Quem está na tela assina o envio (GGVP-53, GGVP-56).
  const perfil = usePerfilEscolhido()
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
      await conversaDe.enviar(agendamentoId, mensagem, perfil?.usuario)
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
