import { useEffect, useRef, useState } from 'react'
import { formatarTelefone } from '../campos.ts'
import { prepararConvite, registrarConvite } from '../dados/agenda.ts'
import { obterCobranca, registrarTentativa } from '../dados/cobranca.ts'
import { obterConfirmacao, registrarMensagemDeConfirmacao } from '../dados/confirmacao.ts'
import { obterComplemento, registrarTentativaDoComplemento } from '../dados/complemento.ts'
import { clienteNoChatwoot, enviarMensagem, type MensagemPronta } from '../dados/mensagens.ts'
import { usePerfil } from '../dados/perfis.ts'
import { comAvisoDaSenha, type IdDoModelo } from '../regras/mensagens.ts'
import { ConversaNoChatwoot } from './ConversaNoChatwoot.tsx'
import styles from './ConviteChatwoot.module.css'

/** O convite da entrevista (GGVP-123), a confirmação dela (GGVP-21), a cobrança dos documentos pendentes (GGVP-101) ou o pedido de complemento ao médico (GGVP-29). */
type Assunto = 'convite' | 'confirmacao' | 'cobranca' | 'complemento'

type Props = { agendamentoId: string; assunto?: Assunto; aoEnviado: () => void; aoFechar: () => void }

type Carregada = { nome: string; telefone: string; mensagem: string; fichaId: string }

/** Cada assunto usa um modelo do catálogo da GGVP-102 (CA10) e sai pela conversa do cliente no Chatwoot (CA6). */
const CONVERSA: Record<Assunto, { rotulo: string; modelo: IdDoModelo; carregar: (id: string) => Promise<Carregada>; enviar: (id: string, mensagem: string) => Promise<unknown> }> = {
  convite: { rotulo: 'Mensagem do convite (confira antes de enviar)', modelo: 'convite', carregar: prepararConvite, enviar: registrarConvite },
  confirmacao: {
    rotulo: 'Mensagem de confirmação (confira antes de enviar)',
    modelo: 'confirmacao',
    carregar: async (id) => {
      const dados = await obterConfirmacao(id)
      if (!dados) throw new Error('Compromisso não encontrado')
      return { nome: dados.ficha.nome, telefone: dados.ficha.telefone, mensagem: dados.mensagem, fichaId: dados.ficha.id }
    },
    enviar: registrarMensagemDeConfirmacao,
  },
  // O id é o do processo; o envio conta como tentativa, ainda sem resposta (GGVP-101, CA6 e CA11).
  cobranca: {
    rotulo: 'Mensagem de cobrança (confira antes de enviar)',
    modelo: 'cobranca',
    carregar: async (id) => {
      const dados = await obterCobranca(id)
      if (!dados) throw new Error('Cobrança não encontrada')
      return { nome: dados.ficha.nome, telefone: dados.ficha.telefone, mensagem: dados.mensagem, fichaId: dados.ficha.id }
    },
    enviar: (id) => registrarTentativa(id, { canal: 'chatwoot', resultado: 'sem-resposta' }),
  },
  // O id é o do processo; o envio da orientação conta como tentativa, ainda sem resposta (GGVP-29, CA3).
  complemento: {
    rotulo: 'Mensagem com a orientação ao médico (confira antes de enviar)',
    modelo: 'complemento',
    carregar: async (id) => {
      const dados = await obterComplemento(id)
      if (!dados) throw new Error('Complemento não encontrado')
      return { nome: dados.ficha.nome, telefone: dados.ficha.telefone, mensagem: dados.mensagem, fichaId: dados.ficha.id }
    },
    enviar: (id) => registrarTentativaDoComplemento(id, { canal: 'chatwoot', resultado: 'sem-resposta' }),
  },
}

/**
 * A conversa do cliente no Chatwoot com a mensagem pronta, para conferir e enviar (GGVP-123, CA4; GGVP-21, CA1).
 * Sai pela conversa do cliente no Chatwoot (GGVP-102, CA6), com o registro do envio e a falha na tela (CA4, CA5).
 * O Chatwoot é simulado (dados/chatwoot.ts).
 */
export function ConviteChatwoot({ agendamentoId, assunto = 'convite', aoEnviado, aoFechar }: Props) {
  const conversaDe = CONVERSA[assunto]
  const janela = useRef<HTMLDialogElement>(null)
  const perfil = usePerfil('Atendimento')
  const [conversa, setConversa] = useState<Carregada | null>(null)
  const [cliente, setCliente] = useState<Pick<MensagemPronta, 'contato' | 'conversas'> | null>(null)
  const [escolhida, setEscolhida] = useState<number | undefined>()
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
    conversaDe.carregar(agendamentoId).then(async (c) => {
      if (!valendo) return
      setConversa(c)
      // Todo modelo diz que o escritório nunca pede a senha do gov.br por mensagem (GGVP-111, CA4).
      setMensagem(comAvisoDaSenha(c.mensagem))
      const noChatwoot = await clienteNoChatwoot(c.fichaId)
      if (!valendo) return
      setCliente(noChatwoot)
      setEscolhida(noChatwoot.conversas[0]?.id)
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
      // Primeiro o Chatwoot: se não sai, a falha fica na tela e no histórico, e nada mais é registrado (CA5).
      const envio = await enviarMensagem(
        conversa!.fichaId,
        { modelo: conversaDe.modelo, texto: mensagem, conversa: escolhida ?? 0, processoId: assunto === 'cobranca' || assunto === 'complemento' ? agendamentoId : undefined, noCard: false },
        { quem: perfil?.usuario ?? 'Atendimento', perfil: perfil?.id },
      )
      if (envio.status === 'falhou') return setErro(`A mensagem não saiu pelo Chatwoot: ${envio.erro}. Ficou no histórico; nada foi reenviado sozinho.`)
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
      {cliente && <ConversaNoChatwoot contato={cliente.contato} conversas={cliente.conversas} escolhida={escolhida} aoEscolher={setEscolhida} texto={mensagem} />}
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
