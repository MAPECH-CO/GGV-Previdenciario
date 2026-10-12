import { useEffect, useRef, useState } from 'react'
import { PedidoDeMensagem } from '@ggv/contratos'
import { enviarMensagem, prepararMensagem, STATUS_DA_MENSAGEM, type MensagemAoCliente, type MensagemPronta } from '../dados/mensagens.ts'
import { problemaDaOrientacao } from '../regras/pericia.ts'
import { problemasDaMensagem } from '../regras/mensagens.ts'
import { ConversaNoChatwoot } from './ConversaNoChatwoot.tsx'
import styles from './ConviteChatwoot.module.css'
import campos from '../paginas/Passo.module.css'

type Props = { fichaId: string; processoId: string; texto: string; aoRegistrar: () => Promise<void>; aoFechar: () => void }

/** O texto é exatamente o revisado pelo Jurídico na tela. A resposta do envio precede a conclusão da tarefa. */
export function EnvioDaOrientacao({ fichaId, processoId, texto, aoRegistrar, aoFechar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const ocupado = useRef(false)
  const [pronta, setPronta] = useState<MensagemPronta | null>(null)
  const [conversa, setConversa] = useState<number>()
  const [envio, setEnvio] = useState<MensagemAoCliente | null>(null)
  const [registrada, setRegistrada] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => {
    const dialogo = janela.current
    if (typeof dialogo?.showModal === 'function') { if (!dialogo.open) dialogo.showModal() }
    else dialogo?.setAttribute('open', '')
    let atual = true
    void prepararMensagem(fichaId, 'pericia-orientacao', processoId).then(p => {
      if (!atual) return
      setPronta(p)
      setConversa(p.conversas[0]?.id)
    }).catch(() => atual && setErro('A orientação não saiu: não foi possível consultar a conversa.'))
    return () => { atual = false }
  }, [fichaId, processoId])

  const pedido = { modelo: 'pericia-orientacao' as const, processoId, texto, conversa: conversa ?? 0 }
  const valido = PedidoDeMensagem.safeParse(pedido).success
  const bloqueio = problemaDaOrientacao(texto) ?? problemasDaMensagem(texto).bloqueia[0]
  const saiu = envio !== null && envio.status !== 'falhou'
  const pode = pronta && pronta.simulado === false && !pronta.consulta && !pronta.trava && !pronta.foraDaLista && valido && !bloqueio

  async function enviar() {
    if (ocupado.current || !pode || registrada) return
    ocupado.current = true
    setEnviando(true)
    setErro('')
    let resposta = envio
    try {
      if (!saiu) {
        resposta = await enviarMensagem(fichaId, pedido)
        setEnvio(resposta)
      }
      if (resposta?.status === 'falhou') return
      await aoRegistrar()
      setRegistrada(true)
    } catch {
      setErro(resposta && resposta.status !== 'falhou'
        ? 'A orientação saiu, mas não foi possível registrar a conclusão no caso. Tente registrar novamente; a mensagem não será reenviada.'
        : 'A orientação não saiu ou o envio não foi confirmado. Consulte o histórico antes de tentar novamente.')
    } finally {
      ocupado.current = false
      setEnviando(false)
    }
  }

  return <dialog ref={janela} className={styles.janela} aria-label="Enviar orientação pelo Chatwoot" onClose={aoFechar}>
    <h2 className={styles.titulo}>Enviar orientação pelo Chatwoot</h2>
    <p>Texto revisado pelo Jurídico:</p>
    <p className={campos.dica}>{texto}</p>
    {bloqueio && <p role="alert">A orientação não saiu: {bloqueio}</p>}
    {!valido && <p role="alert">O envio aceita até 1.000 caracteres. Volte e ajuste o texto antes de revisar de novo.</p>}
    {!pronta && !erro && <p>Consultando a conversa…</p>}
    {pronta && <>
      <ConversaNoChatwoot {...pronta} escolhida={conversa} aoEscolher={setConversa} texto={texto} />
      {pronta.simulado !== false && <p role="alert">A orientação não saiu: o envio real ainda não está disponível.</p>}
      {pronta.trava && <p role="alert">A orientação não saiu: {pronta.trava}</p>}
      {pronta.consulta && <p role="alert">A orientação não saiu: o Chatwoot não respondeu à consulta.</p>}
      {pronta.foraDaLista && <p role="alert">A orientação não saiu: telefone fora da lista autorizada para este ambiente.</p>}
    </>}
    {envio?.status === 'falhou' && <p role="alert">A orientação não saiu pelo Chatwoot: {envio.erro ?? 'falha no envio'}. A tarefa continua aberta.</p>}
    {saiu && <p role="status">Orientação {STATUS_DA_MENSAGEM[envio.status]} pelo Chatwoot.{registrada ? ' Conclusão registrada no caso.' : ' Falta registrar a conclusão no caso.'}</p>}
    {erro && <p role="alert">{erro}</p>}
    <div className={styles.pe}>
      <button type="button" className={styles.cancelar} disabled={enviando} onClick={aoFechar}>Fechar</button>
      <button type="button" className={styles.enviar} disabled={!pode || enviando || registrada} onClick={() => void enviar()}>
        {enviando ? 'Aguarde…' : saiu ? 'Registrar conclusão no caso' : envio?.status === 'falhou' ? 'Tentar de novo' : 'Enviar pelo Chatwoot'}
      </button>
    </div>
  </dialog>
}
