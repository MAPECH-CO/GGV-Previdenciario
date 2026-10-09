import { useEffect, useRef, useState } from 'react'
import { formatarTelefone } from '../campos.ts'
import { prepararConvite, registrarConvite } from '../dados/agenda.ts'
import { obterCobranca, registrarTentativa } from '../dados/cobranca.ts'
import { obterConfirmacao, registrarMensagemDeConfirmacao } from '../dados/confirmacao.ts'
import { obterComplemento, registrarTentativaDoComplemento } from '../dados/complemento.ts'
import { obterCobrancaDaPericia, obterLembrete, registrarCobrancaDaPericia, registrarLembrete } from '../dados/pericia.ts'
import { buscarContatos, conversasDoContato, enviarNaConversa } from '../dados/chatwoot.ts'
import { clienteNoChatwoot, enviarMensagem, type MensagemPronta } from '../dados/mensagens.ts'
import { usePerfil } from '../dados/perfis.ts'
import { doServidor } from '../dados/servidor.ts'
import { comAvisoDaSenha, ordenarConversas, problemasDaMensagem, type IdDoModelo } from '../regras/mensagens.ts'
import { ConversaNoChatwoot } from './ConversaNoChatwoot.tsx'
import styles from './ConviteChatwoot.module.css'

/** O convite da entrevista (GGVP-123), a confirmação dela (GGVP-21), a cobrança dos documentos pendentes (GGVP-101) ou o pedido de complemento ao médico (GGVP-29). */
type Assunto = 'convite' | 'confirmacao' | 'cobranca' | 'complemento' | 'pericia-lembrete' | 'pericia-cobranca'

type Props = { agendamentoId: string; assunto?: Assunto; aoEnviado: () => void; aoFechar: () => void }

type Carregada = { nome: string; telefone: string; mensagem: string; fichaId: string }

/**
 * O cliente que só existe na semente de exemplo (as áreas desta janela ainda não estão no servidor): o Chatwoot simulado
 * direto na tela, com os mesmos portões (G9, G11, G20) e sem registro no servidor (GGVP-138, Pedro 08/10). O cliente do
 * banco vai pela API, com o registro do envio.
 */
const daSemente = {
  async cliente(c: Carregada): Promise<Pick<MensagemPronta, 'contato' | 'conversas'>> {
    const contatos = c.telefone ? await buscarContatos(c.telefone) : []
    const contato = contatos.find((x) => x.nome === c.nome) ?? contatos[0] ?? null
    return { contato, conversas: contato ? ordenarConversas(await conversasDoContato(contato)) : [] }
  },
  async enviar(conversa: number | undefined, texto: string): Promise<{ status: 'entregue' | 'falhou'; erro?: string }> {
    const problema = problemasDaMensagem(texto).bloqueia[0]
    if (problema) throw new Error(problema)
    if (!conversa) return { status: 'falhou', erro: 'o Chatwoot não achou o contato deste telefone' }
    const r = await enviarNaConversa(conversa, texto)
    return r.status === 'failed' ? { status: 'falhou', erro: r.erro } : { status: 'entregue' }
  },
}

/** Os assuntos em que o id é o do processo: o envio fica ligado a ele (GGVP-102). */
const DO_PROCESSO: Assunto[] = ['cobranca', 'complemento', 'pericia-lembrete', 'pericia-cobranca']

/** Cada assunto usa um modelo do catálogo da GGVP-102 (CA10) e sai pela conversa do cliente no Chatwoot (CA6). */
const CONVERSA: Record<Assunto, { rotulo: string; modelo: IdDoModelo; carregar: (id: string) => Promise<Carregada>; enviar: (id: string, mensagem: string, quem?: string) => Promise<unknown> }> = {
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
  // O id é o do processo; o lembrete da véspera da perícia, revisado pelo Jurídico antes de sair (GGVP-53, CA7; Q5).
  'pericia-lembrete': {
    rotulo: 'Lembrete da véspera da perícia (confira antes de enviar)',
    modelo: 'pericia-presenca',
    carregar: obterLembrete,
    enviar: (id, mensagem, quem) => registrarLembrete(id, mensagem, quem),
  },
  // O id é o do processo; a cobrança diária do que a perícia pede, pela Documentação (GGVP-56; Lucas, 02/10).
  'pericia-cobranca': {
    rotulo: 'Cobrança dos documentos da perícia (confira antes de enviar)',
    modelo: 'cobranca',
    carregar: obterCobrancaDaPericia,
    enviar: (id, mensagem, quem) => registrarCobrancaDaPericia(id, mensagem, quem),
  },
}

/**
 * A conversa do cliente no Chatwoot com a mensagem pronta, para conferir e enviar (GGVP-123, CA4; GGVP-21, CA1).
 * Sai pela conversa do cliente no Chatwoot (GGVP-102, CA6), com o registro do envio e a falha na tela (CA4, CA5).
 * O cliente de exemplo usa o Chatwoot simulado (dados/chatwoot.ts); o do banco, o do servidor (de verdade, quando ligado).
 */
export function ConviteChatwoot({ agendamentoId, assunto = 'convite', aoEnviado, aoFechar }: Props) {
  const conversaDe = CONVERSA[assunto]
  // Quem está na tela assina o envio (GGVP-53, GGVP-56); sem escolha, quem costuma mandar o modelo (GGVP-102, CA9).
  // Quem está na sessão (sem sessão, ninguém).
  const escolhido = usePerfil()
  const janela = useRef<HTMLDialogElement>(null)
  const [conversa, setConversa] = useState<Carregada | null>(null)
  const [cliente, setCliente] = useState<Pick<MensagemPronta, 'contato' | 'conversas' | 'simulado' | 'consulta'> | null>(null)
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
      const noChatwoot = doServidor(c.fichaId) ? await clienteNoChatwoot(c.fichaId) : await daSemente.cliente(c)
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
      const envio = doServidor(conversa!.fichaId)
        ? await enviarMensagem(conversa!.fichaId, {
            modelo: conversaDe.modelo,
            texto: mensagem,
            conversa: escolhida ?? 0,
            processoId: DO_PROCESSO.includes(assunto) ? agendamentoId : undefined,
            noCard: false,
          })
        : await daSemente.enviar(escolhida, mensagem)
      // A falha do cliente do banco fica no histórico dele, no servidor; a do cliente de exemplo, só na tela.
      const depois = doServidor(conversa!.fichaId) ? 'Ficou no histórico; nada foi reenviado sozinho.' : 'Nada foi reenviado sozinho.'
      if (envio.status === 'falhou') return setErro(`A mensagem não saiu pelo Chatwoot: ${envio.erro}. ${depois}`)
      await conversaDe.enviar(agendamentoId, mensagem, escolhido?.usuario)
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
            {semTelefone
              ? 'Sem telefone: complete na ficha antes de enviar.'
              : conversa
                ? `WhatsApp ${formatarTelefone(conversa.telefone)}${cliente?.simulado === false ? '' : ' · simulado'}`
                : 'abrindo…'}
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
      {cliente && (
        <ConversaNoChatwoot
          contato={cliente.contato}
          conversas={cliente.conversas}
          escolhida={escolhida}
          aoEscolher={setEscolhida}
          texto={mensagem}
          simulado={cliente.simulado !== false}
          consulta={cliente.consulta}
        />
      )}
      {erro && (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
      <div className={styles.pe}>
        <button type="button" className={styles.cancelar} onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className={styles.enviar} disabled={!conversa || semTelefone || cliente?.consulta === 'falhou' || mensagem.trim() === '' || enviando} onClick={enviar}>
          {enviando ? 'enviando…' : 'Enviar'}
        </button>
      </div>
    </dialog>
  )
}
