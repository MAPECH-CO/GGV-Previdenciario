import { useEffect, useId, useRef, useState } from 'react'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { enviarMensagem, prepararMensagem, STATUS_DA_MENSAGEM, type MensagemAoCliente as Envio, type MensagemPronta } from '../dados/mensagens.ts'
import { usePerfil } from '../dados/perfis.ts'
import type { Ficha } from '../dados/tipos.ts'
import { hora } from '../regras/datas.ts'
import { MODELOS_DE_MENSAGEM, problemasDaMensagem, type IdDoModelo } from '../regras/mensagens.ts'
import { LEMBRETE_DA_IDENTIDADE } from '../regras/seguranca.ts'
import { ConversaNoChatwoot } from './ConversaNoChatwoot.tsx'
import base from './ConviteChatwoot.module.css'
import styles from './MensagemAoCliente.module.css'

type Props = {
  ficha: Ficha
  /** A função da tela, até a pessoa escolher outro perfil. */
  funcao?: string
  modeloInicial?: IdDoModelo
  aoFechar: () => void
  /** Saiu (ou falhou): quem abriu relê a ficha. */
  aoEnviar?: () => void
}

/**
 * Mensagem ao cliente com modelo e registro (GGVP-102): o modelo preenchido com os dados do cliente e do caso, para revisar
 * (CA1); a IA aponta termo jurídico e frase longa (CA3) e o que não pode sair (G9, G11, G20); o envio pela conversa do
 * cliente no Chatwoot (CA6), com o status (CA4) e a falha na tela (CA5). No visual da janela do convite (Figma 73:459).
 */
export function MensagemAoCliente({ ficha, funcao = 'Atendimento', modeloInicial = 'boas-vindas', aoFechar, aoEnviar }: Props) {
  const perfil = usePerfil(funcao)
  const janela = useRef<HTMLDialogElement>(null)
  const idModelo = useId()
  const idTexto = useId()
  const [modelo, setModelo] = useState<IdDoModelo>(modeloInicial)
  const [processoId, setProcessoId] = useState(ficha.processos[0]?.id)
  const [pronta, setPronta] = useState<MensagemPronta | null>(null)
  const [texto, setTexto] = useState('')
  const [conversa, setConversa] = useState<number | undefined>()
  const [resultado, setResultado] = useState<Envio | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  useEffect(() => {
    let valendo = true
    prepararMensagem(ficha.id, modelo, processoId).then((p) => {
      if (!valendo) return
      setPronta(p)
      setTexto(p.texto)
      setConversa(p.conversas[0]?.id)
      setResultado(null)
      setErro('')
    })
    return () => {
      valendo = false
    }
  }, [ficha.id, modelo, processoId])

  const { bloqueia, avisa } = problemasDaMensagem(texto)
  const saiu = resultado !== null && resultado.status !== 'falhou'
  const pode = pronta !== null && !pronta.trava && texto.trim() !== '' && bloqueia.length === 0 && (!pronta.contato || conversa !== undefined) && !saiu

  async function enviar() {
    if (travado.current || !pode || !perfil) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      setResultado(await enviarMensagem(ficha.id, { modelo, texto, conversa: conversa ?? 0, processoId }))
      aoEnviar?.()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para enviar.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    <dialog ref={janela} className={`${base.janela} ${styles.janela}`} aria-labelledby="mensagem-ao-cliente-titulo" onClose={aoFechar}>
      <div className={base.cabeca}>
        <div>
          <h2 id="mensagem-ao-cliente-titulo" className={base.titulo}>
            Mensagem ao cliente · {ficha.nome}
          </h2>
          <p className={base.sub}>Sai pela central do Chatwoot, na conversa do cliente · simulado</p>
        </div>
        <button type="button" className={base.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>

      <div className={styles.linha}>
        <label className={base.campo} htmlFor={idModelo}>
          <span className={base.rotulo}>Modelo</span>
          <select id={idModelo} className={styles.lista} value={modelo} onChange={(e) => setModelo(e.target.value as IdDoModelo)}>
            {(Object.keys(MODELOS_DE_MENSAGEM) as IdDoModelo[]).map((m) => (
              <option key={m} value={m}>
                {MODELOS_DE_MENSAGEM[m].nome} · {MODELOS_DE_MENSAGEM[m].quem}
              </option>
            ))}
          </select>
        </label>
        {ficha.processos.length > 1 && (
          <label className={base.campo}>
            <span className={base.rotulo}>Processo</span>
            <select className={styles.lista} value={processoId} onChange={(e) => setProcessoId(e.target.value)}>
              {ficha.processos.map((p) => (
                <option key={p.id} value={p.id}>
                  {nomeBeneficio(p.beneficio)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {pronta?.trava ? (
        <p className={styles.bloqueio} role="alert">
          {pronta.trava}
        </p>
      ) : (
        <>
          <label className={base.campo} htmlFor={idTexto}>
            <span className={base.rotulo}>{pronta?.editavel === false ? 'Mensagem aprovada pelo Jurídico (não muda)' : 'Mensagem (confira antes de enviar)'}</span>
            <textarea
              id={idTexto}
              className={base.texto}
              rows={6}
              maxLength={1000}
              value={texto}
              readOnly={pronta?.editavel === false}
              onChange={(e) => {
                setTexto(e.target.value)
                setResultado(null)
              }}
            />
          </label>
          <p className={styles.ia}>
            <span aria-hidden="true">✦ </span>A IA preencheu com os dados do cliente e do caso, em frases curtas e sem termos jurídicos. Você confere e decide.
          </p>
          {modelo.startsWith('pericia') && <p className={styles.avisos}>Na ligação da perícia, a mesma verificação: {LEMBRETE_DA_IDENTIDADE}</p>}
          {avisa.length > 0 && (
            <ul className={styles.avisos} aria-label="A IA aponta">
              {avisa.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          )}
          {bloqueia.map((b) => (
            <p key={b} className={styles.bloqueio} role="alert">
              {b}
            </p>
          ))}
        </>
      )}

      {pronta && !pronta.trava && <ConversaNoChatwoot contato={pronta.contato} conversas={pronta.conversas} escolhida={conversa} aoEscolher={setConversa} texto={texto} />}

      {resultado?.status === 'falhou' && (
        <p className={styles.bloqueio} role="alert">
          A mensagem não saiu pelo Chatwoot: {resultado.erro}. Ficou no histórico do cliente; nada foi reenviado sozinho.
        </p>
      )}
      {saiu && (
        <p className={styles.ok} role="status">
          ✓ {STATUS_DA_MENSAGEM[resultado.status].replace(/^./, (l) => l.toUpperCase())} no Chatwoot às {hora(resultado.quando)}: está em "Últimos contatos" do card.
        </p>
      )}
      {erro && (
        <p role="alert" className={base.erro}>
          {erro}
        </p>
      )}

      <div className={base.pe}>
        <button type="button" className={base.cancelar} onClick={aoFechar}>
          {saiu ? 'Fechar' : 'Cancelar'}
        </button>
        <button type="button" className={base.enviar} disabled={!pode || enviando} onClick={enviar}>
          {enviando ? 'enviando…' : resultado?.status === 'falhou' ? 'Tentar de novo' : 'Enviar pelo Chatwoot'}
        </button>
      </div>
    </dialog>
  )
}
