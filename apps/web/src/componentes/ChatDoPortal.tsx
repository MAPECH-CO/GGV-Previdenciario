import { useRef, useState } from 'react'
import type { CartaoDeAcao, RespostaDoChat } from '@ggv/contratos'
import { cancelarAcao, confirmarAcao, perguntar, type ResultadoDaAcao } from '../dados/chat.ts'
import { pessoasDoEscritorio } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import { CartaoConfirmacao, type EstadoAcao } from './CartaoConfirmacao.tsx'
import { ChatIA } from './ChatIA.tsx'
import cartao from './CartaoConfirmacao.module.css'
import itens from './ChatDaPericia.module.css'
import conversa from './LaudoPeloChat.module.css'
import styles from './ChatDoPortal.module.css'

type EstadoDoCartao = { estado: EstadoAcao; escolha?: string; responsavel?: string; trocando?: boolean; resultado?: ResultadoDaAcao; erro?: string }
type Mensagem = { id: number; de: 'voce' | 'ia'; texto: string; anexos?: string[]; arquivos?: File[]; resposta?: RespostaDoChat; cartao?: EstadoDoCartao; pensando?: boolean }

let proximoId = 0

const FONTE: Record<string, string> = { documento: 'documento', publicacao: 'publicação', acervo: 'acervo', regra: 'regra do sistema', caso: 'caso' }

type Props = {
  /** Exemplo que aparece no campo vazio. */
  exemplo: string
  /** Atalhos do perfil (clicar preenche, não envia). */
  sugestoes: string[]
  /** O perfil da tela, quando ninguém escolheu outro (o rótulo de PERFIS). */
  funcao: string
  /** O chat aberto de dentro de um caso: a pergunta sem nome de cliente é sobre ele. */
  processoId?: string
}

/**
 * O chat do portal (GGVP-82; Figma: Centrais 11:2, 59:449, 59:609, 59:863, 2051:173, e as respostas e cards de cada perfil).
 * Uma casca só para toda Central e para a aba Suporte, sobre o motor único (`perguntar` e `confirmarAcao` de dados/chat.ts).
 * Só responde e orienta; para executar algo, mostra um cartão, e nada acontece sem o clique.
 */
export function ChatDoPortal({ exemplo, sugestoes, funcao, processoId }: Props) {
  const perfil = usePerfil(funcao)
  const quem = { id: perfil?.id ?? 'atendimento', usuario: perfil?.usuario ?? funcao }
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const travado = useRef(false)

  const mudar = (id: number, m: Partial<Mensagem>) => setMensagens((x) => x.map((y) => (y.id === id ? { ...y, ...m } : y)))
  const mudarCartao = (id: number, c: Partial<EstadoDoCartao>) => setMensagens((x) => x.map((y) => (y.id === id && y.cartao ? { ...y, cartao: { ...y.cartao, ...c } } : y)))

  async function enviar(texto: string, arquivos: File[] = []) {
    const pedido = { id: ++proximoId, de: 'voce' as const, texto, anexos: arquivos.map((a) => a.name) }
    const id = ++proximoId
    setMensagens((m) => [...m, pedido, { id, de: 'ia', texto: '', pensando: true, arquivos }])
    try {
      const resposta = await perguntar({ texto, anexos: arquivos.map((a) => ({ nome: a.name, tamanho: a.size })), processoId }, quem)
      mudar(id, { pensando: false, resposta, cartao: resposta.acao ? { estado: 'esperando' } : undefined })
    } catch (e) {
      mudar(id, { pensando: false, texto: e instanceof Error ? e.message : 'Não deu para responder agora. Tente de novo.' })
    }
  }

  async function confirmar(m: Mensagem) {
    if (travado.current || !m.resposta?.acao) return
    travado.current = true
    try {
      const arquivos = await Promise.all((m.arquivos ?? []).map(async (a) => ({ nome: a.name, tamanho: a.size, conteudo: await a.arrayBuffer() })))
      const resultado = await confirmarAcao(m.resposta.acao.id, quem, { responsavel: m.cartao?.responsavel, escolha: m.cartao?.escolha, arquivos })
      mudarCartao(m.id, { estado: resultado.estado, resultado, erro: undefined })
    } catch (e) {
      mudarCartao(m.id, { erro: e instanceof Error ? e.message : 'Não deu para fazer.' })
    } finally {
      travado.current = false
    }
  }

  function cancelar(m: Mensagem) {
    if (m.resposta?.acao) cancelarAcao(m.resposta.acao.id)
    mudarCartao(m.id, { estado: 'cancelado' })
  }

  /** A pergunta de volta (quem do setor, qual ação): um clique manda o pedido de novo com a escolha. */
  function escolher(m: Mensagem, opcao: string) {
    const pedido = mensagens[mensagens.indexOf(m) - 1]
    void enviar(`${pedido?.texto ?? ''} · ${opcao}`)
  }

  return (
    <ChatIA exemplo={exemplo} sugestoes={sugestoes} onEnviar={(texto) => void enviar(texto)} onAnexo={(texto, arquivos) => void enviar(texto, arquivos)}>
      {mensagens.length > 0 && (
        <ol className={conversa.conversa} aria-label="Conversa">
          {mensagens.map((m) => (
            <li key={m.id} className={m.de === 'voce' ? conversa.voce : conversa.ia}>
              {m.anexos?.map((a) => (
                <span key={a} className={conversa.anexo}>
                  ▤ {a}
                </span>
              ))}
              {m.texto && <p>{m.texto}</p>}
              {m.pensando && <p className={itens.nota}>Lendo…</p>}
              {m.resposta && <Resposta m={m} aoConfirmar={() => confirmar(m)} aoCancelar={() => cancelar(m)} aoMudar={(c) => mudarCartao(m.id, c)} aoEscolher={(o) => escolher(m, o)} />}
            </li>
          ))}
        </ol>
      )}
    </ChatIA>
  )
}

function Resposta({
  m,
  aoConfirmar,
  aoCancelar,
  aoMudar,
  aoEscolher,
}: {
  m: Mensagem
  aoConfirmar: () => Promise<void>
  aoCancelar: () => void
  aoMudar: (c: Partial<EstadoDoCartao>) => void
  aoEscolher: (opcao: string) => void
}) {
  const r = m.resposta!
  const fontes = r.sugestao.fontes.filter((f) => f.tipo !== 'caso')
  return (
    <>
      <p>{r.sugestao.texto}</p>
      {r.portao && <span className={styles.portao}>Portão {r.portao}</span>}
      {r.links.length > 0 && (
        <ul className={itens.itens} aria-label="Tarefas sugeridas">
          {r.links.map((l) => {
            const [cliente, ...resto] = l.rotulo.split(' · ')
            return (
              <li key={l.href + l.rotulo}>
                <a className={itens.item} href={l.href}>
                  <span>
                    <strong>{cliente}</strong>
                    {resto.length > 0 && ` · ${resto.join(' · ')}`} <span aria-hidden="true">›</span>
                  </span>
                  {l.sub && <span className={itens.sub}>{l.sub}</span>}
                </a>
              </li>
            )
          })}
        </ul>
      )}
      {r.opcoes && (
        <div className={styles.opcoes} role="group" aria-label="Escolha">
          {r.opcoes.map((o) => (
            <button key={o} type="button" className={itens.opcao} onClick={() => aoEscolher(o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      {r.acao && m.cartao && <Cartao acao={r.acao} c={m.cartao} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar} aoMudar={aoMudar} />}
      {fontes.length > 0 && (
        <p className={itens.nota}>
          Fontes: {fontes.map((f) => `${FONTE[f.tipo]} ${f.referencia}${f.trecho ? ` (${f.trecho})` : ''}`).join('; ')}
        </p>
      )}
      <p className={itens.nota}>Só respondo e oriento. Para executar algo, peça e eu mostro um card para você confirmar.</p>
    </>
  )
}

/** O cartão de ação (Figma 2176:388, 2186:405, 2186:211, 2085:2): o resumo em passos, o que conferir, as travas, o responsável com "Trocar". */
function Cartao({ acao, c, aoConfirmar, aoCancelar, aoMudar }: { acao: CartaoDeAcao; c: EstadoDoCartao; aoConfirmar: () => Promise<void>; aoCancelar: () => void; aoMudar: (c: Partial<EstadoDoCartao>) => void }) {
  // O laudo novo do Atendimento segue o card da GGVP-17 (Figma 2052:2).
  if (acao.tipo === 'anexar-laudo') {
    return <CartaoConfirmacao cliente={acao.cliente!} arquivo={acao.passos[0].replace(/^Subir (.+) na pasta do cliente$/, '$1')} estado={c.estado} nota={acao.travas[0]} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar} />
  }
  if (c.estado === 'feito') {
    return (
      <p className={cartao.feito} role="status">
        {c.resultado?.texto}{' '}
        {c.resultado?.links.map((l) => (
          <a key={l.href} href={l.href}>
            {l.rotulo}
          </a>
        ))}
      </p>
    )
  }
  if (c.estado === 'cancelado') return <p className={cartao.nota}>Cancelado: nada foi feito.</p>
  if (c.estado === 'sem-pasta') {
    return (
      <p className={cartao.nota} role="alert">
        Não subi: {acao.cliente?.nome} ainda não tem pasta no Drive, e pasta nova só nasce com o CPF. Complete o CPF na ficha.
      </p>
    )
  }
  const responsavel = c.responsavel ?? acao.responsavel?.nome
  const selo = acao.foraDoPerfil ? 'Fora do seu perfil' : 'Ação para confirmar'
  const [cliente, ...oQue] = acao.titulo.split(' · ')
  return (
    <div className={`${cartao.cartao} ${acao.foraDoPerfil ? styles.fora : ''}`} role="group" aria-label={`${selo} · ${acao.titulo}`}>
      <span className={acao.foraDoPerfil ? styles.seloFora : cartao.selo}>{selo}</span>
      <div className={styles.caixa}>
        {acao.tipo === 'criar-tarefa' && <span className={styles.nova}>nova</span>}
        {acao.tipo === 'pedir-peca' && <span className={styles.nova}>IA</span>}
        <div>
          <p className={cartao.titulo}>
            <strong>{cliente}</strong> · {oQue.join(' · ')}
          </p>
          {acao.responsavel && (
            <p className={cartao.nota}>
              Responsável: <strong>{responsavel}</strong>
              {!c.trocando && (
                <>
                  {' · '}
                  <button type="button" className={styles.trocar} onClick={() => aoMudar({ trocando: true })}>
                    Trocar
                  </button>
                </>
              )}
            </p>
          )}
          {c.trocando && (
            <label className={styles.troca}>
              Quem fica com a tarefa
              <select
                value={responsavel}
                onChange={(e) => aoMudar({ responsavel: e.target.value, trocando: false })}
              >
                {[...new Set(pessoasDoEscritorio().map((p) => `${p.nome}|${p.setor}`))].map((x) => {
                  const [nome, setor] = x.split('|')
                  return (
                    <option key={nome} value={nome}>
                      {nome} · {setor}
                    </option>
                  )
                })}
              </select>
            </label>
          )}
        </div>
      </div>
      <ol className={`${cartao.passos} ${styles.passos}`} aria-label="O que vou fazer">
        {acao.passos.map((p, i) => (
          <li key={p}>
            {i + 1} {p}
          </li>
        ))}
      </ol>
      {acao.conferir.length > 0 && <p className={cartao.nota}>Confira: {acao.conferir.join('; ')}.</p>}
      {acao.escolha && (
        <div className={itens.decisao} role="radiogroup" aria-label={acao.escolha.pergunta}>
          <span>{acao.escolha.pergunta} *</span>
          {acao.escolha.opcoes.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={c.escolha === o} className={itens.opcao} onClick={() => aoMudar({ escolha: o })}>
              {o}
            </button>
          ))}
        </div>
      )}
      {acao.travas.map((t) => (
        <p key={t} className={cartao.nota}>
          {t}
        </p>
      ))}
      <div className={cartao.botoes}>
        <button type="button" className={cartao.confirmar} disabled={Boolean(acao.escolha && !c.escolha)} onClick={() => void aoConfirmar()}>
          {acao.rotuloConfirmar}
        </button>
        <button type="button" className={cartao.cancelar} onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
      {c.erro && (
        <p role="alert" className={cartao.nota}>
          {c.erro}
        </p>
      )}
    </div>
  )
}
