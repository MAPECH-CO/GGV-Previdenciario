import { useState } from 'react'
import { periciasParaMarcar, type ItemDoChat } from '../dados/pericia.ts'
import { ChatIA } from './ChatIA.tsx'
import conversa from './LaudoPeloChat.module.css'
import styles from './ChatDaPericia.module.css'

type Resposta = { texto: string; itens?: ItemDoChat[] }
type Mensagem = { id: number; de: 'voce' | 'ia'; texto: string; resposta?: Resposta }

let proximoId = 0

const PERICIAS_PARA_MARCAR = /per[ií]cias?\b.*\bmarcar|\bpara marcar\b/i

const EXTENSO = ['Nenhuma', 'Uma', 'Duas', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove']
const quantas = (n: number) => (n < EXTENSO.length ? EXTENSO[n] : String(n))

/** O que a IA responde no chat da Central do Jurídico administrativo. IA simulada: só responde e orienta. */
function responder(texto: string): Resposta {
  if (PERICIAS_PARA_MARCAR.test(texto)) {
    const itens = periciasParaMarcar()
    if (itens.length === 0) return { texto: 'Nenhuma perícia espera marcação agora.' }
    return {
      texto: `${quantas(itens.length)} ${itens.length === 1 ? 'perícia espera' : 'perícias esperam'} você. Marque no portal do INSS e suba o comprovante: eu leio data, hora, local e tipo.`,
      itens,
    }
  }
  return { texto: 'Aqui eu respondo sobre as perícias: use os atalhos abaixo. O resto do chat entra com a GGVP-82.' }
}

/**
 * "Pergunte ou peça" da Central do Jurídico administrativo (Figma 2051:173): as perícias para marcar (2107:892). Cada
 * item abre a tarefa. O chat só responde e orienta; para executar algo, mostra um card para a pessoa confirmar.
 */
export function ChatDaPericia({ exemplo, sugestoes }: { exemplo: string; sugestoes: string[] }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])

  function aoEnviar(texto: string) {
    setMensagens((m) => [...m, { id: ++proximoId, de: 'voce', texto }, { id: ++proximoId, de: 'ia', texto: '', resposta: responder(texto) }])
  }

  return (
    <ChatIA exemplo={exemplo} sugestoes={sugestoes} onEnviar={aoEnviar}>
      {mensagens.length > 0 && (
        <ol className={conversa.conversa} aria-label="Conversa">
          {mensagens.map((m) => (
            <li key={m.id} className={m.de === 'voce' ? conversa.voce : conversa.ia}>
              {m.texto && <p>{m.texto}</p>}
              {m.resposta && (
                <>
                  <p>{m.resposta.texto}</p>
                  {m.resposta.itens && (
                    <ul className={styles.itens} aria-label="Tarefas sugeridas">
                      {m.resposta.itens.map((item) => (
                        <li key={item.href}>
                          <a className={styles.item} href={item.href}>
                            <span>
                              <strong>{item.cliente}</strong> · {item.acao} <span aria-hidden="true">›</span>
                            </span>
                            <span className={styles.sub}>{item.sub}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={styles.nota}>Só respondo e oriento. Para executar algo, peça e eu mostro um card para você confirmar.</p>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </ChatIA>
  )
}
