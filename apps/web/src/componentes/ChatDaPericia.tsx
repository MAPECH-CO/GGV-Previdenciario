import { useRef, useState } from 'react'
import { identificarCliente } from '../dados/documentos.ts'
import { dicaParaAPericia, lerComprovante, periciaParaMarcarDaFicha, periciasParaMarcar, registrarMarcacao, type ItemDoChat } from '../dados/pericia.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { formatoDoArquivo, hashDoConteudo, problemaDoArquivo } from '../regras/arquivos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { NOMES_DO_TIPO, prazosDaPericia, type LidoDoComprovante } from '../regras/pericia.ts'
import { ChatIA } from './ChatIA.tsx'
import cartao from './CartaoConfirmacao.module.css'
import conversa from './LaudoPeloChat.module.css'
import styles from './ChatDaPericia.module.css'

type Resposta = { texto: string; itens?: ItemDoChat[] }
/** "Ação para confirmar" do comprovante (Figma 2085:2): nada acontece antes de "Confirmar e marcar" (GGVP-53, CA5). */
type Acao = {
  processoId: string
  cliente: { id: string; nome: string }
  comprovante: { nome: string; hash: string }
  lido: LidoDoComprovante
  pedeDocumentoNovo?: boolean
  estado: 'esperando' | 'feito' | 'cancelado'
  erro?: string
}
type Mensagem = { id: number; de: 'voce' | 'ia'; texto: string; anexo?: string; resposta?: Resposta; acao?: Acao }

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
  if (/comprovante/i.test(texto)) return { texto: 'Anexe o PDF do comprovante do INSS e diga de quem é: eu leio e mostro um card para você conferir.' }
  return { texto: 'Aqui eu respondo sobre as perícias: use os atalhos abaixo. O resto do chat entra com a GGVP-82.' }
}

/**
 * "Pergunte ou peça" da Central do Jurídico administrativo (Figma 2051:173): as perícias para marcar (2107:892) e o
 * comprovante do INSS anexado (2085:2). O chat só responde e orienta; para executar algo, mostra um card para confirmar.
 */
export function ChatDaPericia({ exemplo, sugestoes }: { exemplo: string; sugestoes: string[] }) {
  const perfil = usePerfil('Jurídico administrativo')
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const travado = useRef(false)
  const ia = (m: Omit<Mensagem, 'id' | 'de'>) => setMensagens((x) => [...x, { id: ++proximoId, de: 'ia', ...m }])
  const mudarAcao = (id: number, mudanca: Partial<Acao>) => setMensagens((x) => x.map((m) => (m.id === id && m.acao ? { ...m, acao: { ...m.acao, ...mudanca } } : m)))

  async function aoEnviar(texto: string) {
    setMensagens((m) => [...m, { id: ++proximoId, de: 'voce', texto }])
    // "Dica para a perícia" (Figma 2186:857): a orientação do cliente citado, o perito e a tarefa (GGVP-61).
    if (!PERICIAS_PARA_MARCAR.test(texto) && /dica|orienta[cç][aã]o/i.test(texto)) {
      const dica = await dicaParaAPericia(texto)
      return ia({ texto: '', resposta: dica ?? { texto: 'Não achei a orientação: diga o nome do cliente da perícia marcada.' } })
    }
    ia({ texto: '', resposta: responder(texto) })
  }

  async function aoAnexo(texto: string, anexo: File) {
    setMensagens((m) => [...m, { id: ++proximoId, de: 'voce', texto, anexo: anexo.name }])
    const problema = problemaDoArquivo({ nome: anexo.name, tamanho: anexo.size })
    if (problema || formatoDoArquivo(anexo.name) !== 'pdf') return ia({ texto: `Esse arquivo não segue: ${problema ?? 'o comprovante do INSS é um PDF.'}` })
    const achados = await identificarCliente(`${texto} ${anexo.name}`)
    if (achados.length !== 1) {
      return ia({
        texto:
          achados.length === 0
            ? 'Não identifiquei de quem é o comprovante. Escreva o nome completo do cliente e envie de novo com o arquivo.'
            : `O nome bate com mais de um cliente (${achados.map((a) => a.nome).join(', ')}). Escreva o nome completo e envie de novo.`,
      })
    }
    const [cliente] = achados
    const pericia = periciaParaMarcarDaFicha(cliente.id)
    if (!pericia) return ia({ texto: `${cliente.nome} não tem perícia esperando marcação. Confira o cliente e envie de novo.` })
    const lido = await lerComprovante(pericia.processoId, anexo.name)
    const hash = await hashDoConteudo(await anexo.arrayBuffer())
    ia({
      texto:
        `Li o comprovante do INSS e identifiquei o cliente: ${cliente.nome} (${pericia.beneficio.toLowerCase()}). ` +
        'O PDF traz data, hora, local e tipo da perícia; o perito não vem no comprovante.',
      acao: { processoId: pericia.processoId, cliente: { id: cliente.id, nome: cliente.nome }, comprovante: { nome: anexo.name, hash }, lido, estado: 'esperando' },
    })
  }

  async function confirmar(m: Mensagem) {
    const acao = m.acao!
    if (travado.current || acao.pedeDocumentoNovo === undefined) return
    travado.current = true
    try {
      await registrarMarcacao(acao.processoId, { comprovante: acao.comprovante, lido: acao.lido, pedeDocumentoNovo: acao.pedeDocumentoNovo }, perfil?.usuario ?? 'Jurídico administrativo')
      mudarAcao(m.id, { estado: 'feito', erro: undefined })
    } catch (e) {
      mudarAcao(m.id, { erro: e instanceof Error ? e.message : 'Não deu para marcar.' })
    } finally {
      travado.current = false
    }
  }

  const hoje = hojeIso(agora())
  return (
    <ChatIA exemplo={exemplo} sugestoes={sugestoes} onEnviar={(texto) => void aoEnviar(texto)} onAnexo={aoAnexo}>
      {mensagens.length > 0 && (
        <ol className={conversa.conversa} aria-label="Conversa">
          {mensagens.map((m) => (
            <li key={m.id} className={m.de === 'voce' ? conversa.voce : conversa.ia}>
              {m.anexo && <span className={conversa.anexo}>▤ {m.anexo}</span>}
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
              {m.acao && m.acao.estado === 'feito' && (
                <p className={cartao.feito} role="status">
                  ✓ Feito: a perícia de {m.acao.cliente.nome} está na agenda e na ficha; o lembrete da véspera sai em{' '}
                  {dataCurta(prazosDaPericia(m.acao.lido.data).vespera, hoje)}. <a href={`/casos/${m.acao.processoId}/pericia`}>Abrir a perícia</a>
                </p>
              )}
              {m.acao && m.acao.estado === 'cancelado' && <p className={cartao.nota}>Cancelado: nada foi feito.</p>}
              {m.acao && m.acao.estado === 'esperando' && (
                <div className={cartao.cartao} role="group" aria-label={`Ação para confirmar · Marcar a perícia · ${m.acao.cliente.nome}`}>
                  <span className={cartao.selo}>Ação para confirmar</span>
                  <p className={cartao.titulo}>Marcar a perícia · {m.acao.cliente.nome}</p>
                  <ol className={cartao.passos}>
                    <li>1 Subir {m.acao.comprovante.nome} na pasta do cliente</li>
                    <li>
                      2 Agendar: {NOMES_DO_TIPO[m.acao.lido.tipo]} em {dataCurta(m.acao.lido.data, hoje)}, {m.acao.lido.hora}, {m.acao.lido.local}
                    </li>
                    <li>3 Dar baixa no DP.02; o próximo passo é ligar e orientar (DP.06)</li>
                  </ol>
                  <div className={styles.decisao} role="radiogroup" aria-label="A perícia pede documento novo?">
                    <span>A perícia pede documento novo? *</span>
                    {([true, false] as const).map((v) => (
                      <button key={String(v)} type="button" role="radio" aria-checked={m.acao!.pedeDocumentoNovo === v} className={styles.opcao} onClick={() => mudarAcao(m.id, { pedeDocumentoNovo: v })}>
                        {v ? 'Sim: atribuir à Documentação' : 'Não'}
                      </button>
                    ))}
                  </div>
                  <p className={cartao.nota}>Você confere data, hora e local antes de confirmar. A IA não escolhe nem sugere o perito.</p>
                  <div className={cartao.botoes}>
                    <button type="button" className={cartao.confirmar} disabled={m.acao.pedeDocumentoNovo === undefined} onClick={() => void confirmar(m)}>
                      Confirmar e marcar
                    </button>
                    <button type="button" className={cartao.cancelar} onClick={() => mudarAcao(m.id, { estado: 'cancelado' })}>
                      Cancelar
                    </button>
                  </div>
                  {m.acao.erro && (
                    <p role="alert" className={cartao.nota}>
                      {m.acao.erro}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </ChatIA>
  )
}
