import { useEffect, useRef, useState } from 'react'
import { enviarBoasVindas, obterBoasVindas, type BoasVindas } from '../dados/boasVindas.ts'
import { agora, doServidor } from '../dados/servidor.ts'
import styles from '../paginas/Balcao.module.css'
import { juntar } from '../regras/checklist.ts'
import { dataCurta, hojeIso, hora } from '../regras/datas.ts'
import proprio from './CartaoBoasVindas.module.css'

type Props = { processoId: string; nome: string; /** Muda quando o checklist é conferido: a mensagem sai das pendências dele. */ versao: number }

/** "Boas-vindas (D1.22)" na tela do checklist (Figma 1818:2). O rótulo do Figma diz WhatsApp; o canal é o Chatwoot (GGVP-97). */
export function CartaoBoasVindas({ processoId, nome, versao }: Props) {
  const [bv, setBv] = useState<BoasVindas | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [conferi, setConferi] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique: as boas-vindas vão uma única vez (CA4).
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterBoasVindas(processoId).then((b) => {
      if (!valendo) return
      setBv(b)
      setMensagem(b?.mensagem ?? '')
    })
    return () => {
      valendo = false
    }
  }, [processoId, versao])

  if (!bv) return null
  // Bloco 5c (decisão do Mateus, 09/10): no caso do servidor, o portal ainda não manda; a Atendimento manda por fora e marca.
  const porFora = doServidor(processoId)
  const canal = porFora ? 'A Atendimento manda por fora: o portal ainda não envia' : 'Chatwoot · conversa do cliente'
  const hoje = hojeIso(agora())
  const conteudo = [
    'mensagem padrão',
    bv.copias.length > 0 && 'cópias do kit',
    bv.faltam.length > 0 ? `pendências: ${juntar(bv.faltam)}` : 'sem pendências',
  ]
    .filter(Boolean)
    .join(' + ')

  async function enviar() {
    if (travado.current || (!conferi && !porFora)) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      await enviarBoasVindas(processoId, { conferi: true, mensagem })
      setConferi(false)
      setBv(await obterBoasVindas(processoId))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para enviar.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  return (
    <section className={styles.cartao} aria-labelledby="boas-vindas">
      <h2 id="boas-vindas" className={styles.cartaoTitulo}>
        Boas-vindas (D1.22)
      </h2>
      {bv.situacao === 'ja-era-cliente' ? (
        <dl className={proprio.linhas}>
          <dt>Não vai</dt>
          <dd>{nome} já era cliente do escritório: as boas-vindas só vão ao cliente novo.</dd>
          <dd />
        </dl>
      ) : bv.situacao === 'aguardando-checklist' ? (
        <dl className={proprio.linhas}>
          <dt>Quando</dt>
          <dd>Depois de concluir a conferência do checklist, com as pendências dele.</dd>
          <dd />
          <dt>Vai por</dt>
          <dd>{canal}</dd>
          <dd />
        </dl>
      ) : bv.situacao === 'enviada' && bv.registro ? (
        <dl className={proprio.linhas}>
          <dt>Enviada</dt>
          <dd>
            {hojeIso(new Date(bv.registro.quando)) === hoje ? 'hoje' : dataCurta(hojeIso(new Date(bv.registro.quando)), hoje)} às {hora(bv.registro.quando)} ·{' '}
            {porFora ? 'mandada por fora do portal' : 'Chatwoot'}
          </dd>
          <dd className={proprio.ok}>ok</dd>
          <dt>Conteúdo</dt>
          <dd>{conteudo}</dd>
          <dd />
        </dl>
      ) : (
        <>
          <dl className={proprio.linhas}>
            {bv.situacao === 'falhou' && bv.registro && (
              <>
                <dt>Não saiu</dt>
                <dd>Tentativa de {hora(bv.registro.quando)}: {bv.registro.motivo}. Complete a ficha e tente de novo.</dd>
                <dd className={proprio.falta}>falhou</dd>
              </>
            )}
            <dt>Vai por</dt>
            <dd>{canal}</dd>
            <dd />
            <dt>Conteúdo</dt>
            <dd>{conteudo}</dd>
            <dd />
          </dl>
          <label className={proprio.campo}>
            {porFora ? 'Mensagem para copiar' : 'Mensagem (confira antes de enviar)'}
            <textarea rows={6} maxLength={2000} value={mensagem} readOnly={porFora} onChange={(e) => setMensagem(e.target.value)} />
          </label>
          {!porFora && (
            <label className={proprio.conferi}>
              <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
              Conferi a mensagem
            </label>
          )}
          <div className={proprio.acoes}>
            <button
              type="button"
              className={proprio.enviar}
              disabled={(!conferi && !porFora) || mensagem.trim() === '' || enviando}
              onClick={enviar}
            >
              {enviando ? 'enviando…' : porFora ? 'Já enviei' : bv.situacao === 'falhou' ? 'Tentar de novo pelo Chatwoot' : 'Enviar pelo Chatwoot'}
            </button>
            <span className={styles.motivo}>
              {porFora ? 'Marque depois de mandar a mensagem ao cliente: vale uma única vez.' : 'Vai uma única vez, na conversa do cliente.'}
            </span>
          </div>
          {erro && (
            <p role="alert" className={proprio.erro}>
              {erro}
            </p>
          )}
        </>
      )}
    </section>
  )
}
