import { useEffect, useId, useRef, useState } from 'react'
import { formatarTelefone, isoParaData } from '../campos.ts'
import { transcrever } from '../dados/entrevista.ts'
import { agora } from '../dados/servidor.ts'
import { conversaDaGravacao } from '../dados/conversa.ts'
import { conferirDocumentos, conferirInformacoes, marcarProva, obterGravacoes } from '../dados/transcricao.ts'
import type { Ficha, Gravacao, InformacaoExtraida } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { minutos, relogio } from '../regras/entrevista.ts'
import { buscarTrechos, contagemDoTopo, marcarBusca, situacaoDaGravacao } from '../regras/transcricao.ts'
import { RegistrarConversa } from './RegistrarConversa.tsx'
import styles from './Transcricoes.module.css'

type Props = {
  ficha: Ficha
  /** O Atendimento não abre o texto nem o áudio da entrevista com a advogada: dado de saúde. */
  perfil: 'juridico' | 'atendimento'
  /** A gravação que abre selecionada. */
  inicial?: string
  aoFechar: () => void
  /** A lista mudou (conversa nova, ficha atualizada): quem abriu relê a ficha. */
  aoMudar?: () => void
}

const DESTINO: Record<InformacaoExtraida['destino'], string> = {
  ficha: 'ficha',
  documentacao: 'pendência → Documentação',
  cofre: 'cofre',
  processo: 'processo',
}

/** Figma: "Overlay · Transcrições do processo" (1626:2). Áudio e texto ficam guardados para sempre (CA5). */
export function Transcricoes({ ficha, perfil, inicial, aoFechar, aoMudar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const idBusca = useId()
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [selecionada, setSelecionada] = useState<string | undefined>(inicial)
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [documentosConferidos, setDocumentosConferidos] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  // GGVP-133: o valor que a advogada corrigiu em cada item, no lugar do que a IA ouviu.
  const [corrigidos, setCorrigidos] = useState<Record<string, string>>({})
  // "Registrar nova conversa" abre a janela da conversa com o cliente (GGVP-76).
  const [registrando, setRegistrando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    const dialogo = janela.current
    // O jsdom dos testes não tem showModal: abre sem o fundo escuro.
    if (typeof dialogo?.showModal === 'function') {
      if (!dialogo.open) dialogo.showModal()
    } else dialogo?.setAttribute('open', '')
  }, [])

  useEffect(() => {
    let valendo = true
    obterGravacoes(ficha.id).then((lista) => {
      if (!valendo) return
      setGravacoes(lista)
      setSelecionada((s) => s ?? lista[0]?.id)
    })
    return () => {
      valendo = false
    }
  }, [ficha.id])

  const g = gravacoes.find((x) => x.id === selecionada)
  const fechada = g?.soJuridico && perfil === 'atendimento'
  const daConversa = g && conversaDaGravacao(g)
  const trechos = g ? buscarTrechos(g.trechos, busca) : []
  const provas = g?.trechos.filter((t) => t.prova).length ?? 0
  const numero = ficha.processos[0]?.numero

  function trocar(id: string) {
    setSelecionada(id)
    setBusca('')
    setMarcadas(new Set())
    setDocumentosConferidos(false)
    setOuvindo(false)
    setCorrigidos({})
    setErro('')
  }

  async function fazer(acao: () => Promise<Gravacao>, mudou = false) {
    if (travado.current) return
    travado.current = true
    setOcupado(true)
    setErro('')
    try {
      const nova = await acao()
      setGravacoes((lista) => (lista.some((x) => x.id === nova.id) ? lista.map((x) => (x.id === nova.id ? nova : x)) : [nova, ...lista]))
      if (mudou) aoMudar?.()
      return nova
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setOcupado(false)
    }
  }

  const valorFalado = (e: InformacaoExtraida) => (e.campo === 'telefone' ? formatarTelefone(e.valor) : e.valor)
  /** Só o que ela mudou vai como correção; o resto vale como a IA ouviu. */
  const correcoes = (x: Gravacao) =>
    x.extraidas.flatMap((e) => (marcadas.has(e.id) && corrigidos[e.id] !== undefined && corrigidos[e.id].trim() !== valorFalado(e) ? [{ id: e.id, valor: corrigidos[e.id] }] : []))
  /** GGVP-133: o áudio e o texto de verdade, pela gravação, com a permissão dela. */
  const arquivo = (x: Gravacao, documento: string) => `/api/gravacoes/${x.id}/arquivos/${documento}`

  return (
    <dialog ref={janela} className={styles.janela} aria-labelledby="transcricoes-titulo" onClose={aoFechar}>
      <header className={styles.cabeca}>
        <div className={styles.textos}>
          <div className={styles.tituloLinha}>
            <span className={styles.play} aria-hidden="true">
              ▶
            </span>
            <h2 id="transcricoes-titulo" className={styles.titulo}>
              Transcrições do caso
            </h2>
            <span className={styles.contagem}>{contagemDoTopo(gravacoes)}</span>
          </div>
          <p className={styles.sub}>
            {[ficha.nome, numero].filter(Boolean).join(' · ')} · toda conversa gravada começa com o aviso (G10); a senha do gov.br nunca
            entra na transcrição (G9)
          </p>
        </div>
        <button type="button" className={styles.botao} onClick={() => setRegistrando(true)}>
          Registrar nova conversa
        </button>
        <button type="button" className={styles.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </header>

      <div className={styles.corpo}>
        <nav className={styles.lista} aria-labelledby="gravacoes-titulo">
          <h3 id="gravacoes-titulo" className={styles.listaTitulo}>
            Gravações e registros
          </h3>
          <ul>
            {gravacoes.map((x) => (
              <li key={x.id}>
                <button type="button" className={styles.item} aria-pressed={x.id === selecionada} onClick={() => trocar(x.id)}>
                  <span className={styles.itemQuando}>
                    {dataCurta(x.data, hoje)} · {x.audio ? minutos(x.duracao) : 'sem áudio'}
                  </span>
                  <span className={styles.itemTitulo}>{x.titulo}</span>
                  <span className={styles.itemDetalhe}>
                    {x.canal} · {x.participantes.join(' + ')}
                  </span>
                  <span className={styles.selo} data-situacao={x.transcricao}>
                    {situacaoDaGravacao(x)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.nota}>
            Cada gravação tem resumo, informações extraídas e transcrição. O que a IA extrai vai para a ficha só depois de conferido
            (G14).
          </p>
        </nav>

        <section className={styles.detalhe} aria-label="Conversa selecionada">
          {erro && (
            <p role="alert" className={styles.erro}>
              {erro}
            </p>
          )}

          {!g ? (
            <p className={styles.nota}>Nenhuma conversa registrada ainda.</p>
          ) : (
            <>
              <div className={styles.detalheCabeca}>
                <h3 className={styles.detalheTitulo}>
                  {g.titulo} · {isoParaData(g.data)}
                  {g.audio ? ` · ${minutos(g.duracao)}` : ''}
                </h3>
                <button
                  type="button"
                  className={styles.botao}
                  disabled={!g.audio || fechada}
                  title={fechada ? 'O áudio da entrevista só o Jurídico ouve' : undefined}
                  onClick={() => setOuvindo(true)}
                >
                  Abrir áudio
                </button>
                {g.transcricaoDocumentoId && !fechada && (
                  <a className={styles.botao} href={arquivo(g, g.transcricaoDocumentoId)} target="_blank" rel="noreferrer">
                    Abrir o texto final
                  </a>
                )}
                <button type="button" className={styles.botao} disabled={fechada} onClick={() => window.print()}>
                  Exportar PDF
                </button>
              </div>
              <p className={styles.nota}>Participantes: {g.participantes.join(', ')}.</p>

              {fechada ? (
                <p className={styles.aviso}>
                  Só o Jurídico abre o resumo, a transcrição e o áudio desta entrevista: ela tem dado de saúde.
                </p>
              ) : g.transcricao === 'falhou' ? (
                <div className={styles.falha} role="alert">
                  <p>A transcrição falhou: {g.motivoDaFalha}. O áudio está guardado; nada se perdeu.</p>
                  <button type="button" className={styles.primario} disabled={ocupado} onClick={() => fazer(() => transcrever(g.id))}>
                    Tentar de novo
                  </button>
                </div>
              ) : g.transcricao === 'transcrevendo' || g.transcricao === 'aguardando-internet' ? (
                <p className={styles.aviso} role="status">
                  {g.transcricao === 'transcrevendo' ? 'Transcrevendo…' : 'Aguardando a internet para transcrever.'}
                  {g.audio && g.audio.partes > 1 ? ` O áudio foi dividido em ${g.audio.partes} partes.` : ''}
                </p>
              ) : g.transcricao === 'sem-audio' ? (
                <div className={styles.secao}>
                  <h4 className={styles.secaoTitulo}>Conversa sem áudio, registrada por quem participou</h4>
                  <p>{g.registro}</p>
                </div>
              ) : (
                <>
                  <nav className={styles.abas} aria-label="Seções">
                    <a href="#resumo">Resumo</a>
                    <a href="#extraidas">Informações extraídas</a>
                    <a href="#transcricao">Transcrição</a>
                    <span className={styles.nota}>(as três seções abaixo)</span>
                  </nav>

                  <section id="resumo" className={styles.resumo} aria-labelledby="resumo-titulo">
                    <h4 id="resumo-titulo" className={styles.secaoTitulo}>
                      <span aria-hidden="true">✦ </span>Resumo pela IA
                    </h4>
                    {g.semIa ? (
                      <p role="status">A IA não leu esta gravação: {g.semIa}. Leia a transcrição e preencha a ficha à mão.</p>
                    ) : (
                      <p>{g.resumo}</p>
                    )}
                  </section>

                  <section id="extraidas" className={styles.secao} aria-labelledby="extraidas-titulo">
                    <h4 id="extraidas-titulo" className={styles.secaoTitulo}>
                      Informações extraídas · o que foi para a ficha
                    </h4>
                    {g.extraidas.length === 0 ? (
                      <p className={styles.nota}>A IA não tirou nenhuma informação desta conversa.</p>
                    ) : (
                      <ul className={styles.extraidas}>
                        {g.extraidas.map((e) => (
                          <li key={e.id} className={styles.extraida}>
                            <span className={styles.rotuloExtraida}>{e.rotulo}</span>
                            <span>{valorFalado(e)}</span>
                            <span className={styles.destino} data-destino={e.destino}>
                              {DESTINO[e.destino]}
                            </span>
                            {e.trecho && (
                              <span className={styles.deOnde}>
                                dito aos {relogio(e.aos ?? 0).slice(3)}: «{e.trecho}»
                              </span>
                            )}
                            {!e.conferidaEm && !daConversa && e.destino !== 'cofre' && (
                              <label className={styles.corrigir}>
                                Corrigir: {e.rotulo.toLowerCase()}
                                <input
                                  type="text"
                                  maxLength={200}
                                  value={corrigidos[e.id] ?? valorFalado(e)}
                                  onChange={(x) => setCorrigidos((c) => ({ ...c, [e.id]: x.target.value }))}
                                />
                              </label>
                            )}
                            {e.conferidaEm ? (
                              <span className={styles.conferida}>✓ conferida</span>
                            ) : daConversa ? (
                              <span className={styles.conferir}>a conferir na conversa</span>
                            ) : (
                              <label className={styles.conferir}>
                                <input
                                  type="checkbox"
                                  checked={marcadas.has(e.id)}
                                  onChange={(x) =>
                                    setMarcadas((m) => {
                                      const nova = new Set(m)
                                      if (x.target.checked) nova.add(e.id)
                                      else nova.delete(e.id)
                                      return nova
                                    })
                                  }
                                />
                                Conferi: {e.rotulo.toLowerCase()}
                              </label>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* A conversa com o cliente se confere na tela dela, por quem conversou (GGVP-84): um caminho só. */}
                    {daConversa && g.extraidas.some((e) => !e.conferidaEm) && (
                      <a className={styles.primario} href={`/conversas/${daConversa}/conferir`}>
                        Conferir na conversa (D5.04)
                      </a>
                    )}
                    {!daConversa && g.extraidas.some((e) => !e.conferidaEm) && (
                      <button
                        type="button"
                        className={styles.primario}
                        disabled={marcadas.size === 0 || ocupado}
                        onClick={async () => {
                          await fazer(async () => (await conferirInformacoes(g.id, [...marcadas], correcoes(g))).gravacao, true)
                          setMarcadas(new Set())
                          setCorrigidos({})
                        }}
                      >
                        Conferir e levar
                      </button>
                    )}
                  </section>

                  {g.documentos.length > 0 && (
                    <section className={styles.secao} aria-labelledby="documentos-titulo">
                      <h4 id="documentos-titulo" className={styles.secaoTitulo}>
                        Documentos que o cliente precisa trazer
                      </h4>
                      <ul className={styles.documentos}>
                        {g.documentos.map((d) => (
                          <li key={d}>• {d}</li>
                        ))}
                      </ul>
                      {g.documentosConferidosEm ? (
                        <p className={styles.conferida}>✓ Conferida e enviada ao checklist do benefício em {dataCurta(g.documentosConferidosEm.slice(0, 10), hoje)}.</p>
                      ) : (
                        <>
                          <label className={styles.conferir}>
                            <input type="checkbox" checked={documentosConferidos} onChange={(e) => setDocumentosConferidos(e.target.checked)} />
                            Conferi a lista com a entrevista
                          </label>
                          <button
                            type="button"
                            className={styles.primario}
                            disabled={!documentosConferidos || ocupado}
                            onClick={() => fazer(() => conferirDocumentos(g.id, g.documentos), true)}
                          >
                            Enviar ao checklist do benefício
                          </button>
                        </>
                      )}
                    </section>
                  )}

                  <section id="transcricao" className={styles.secao} aria-labelledby="transcricao-titulo">
                    <div className={styles.buscaLinha}>
                      <h4 id="transcricao-titulo" className={styles.secaoTitulo}>
                        Transcrição
                      </h4>
                      <label className="so-leitor" htmlFor={idBusca}>
                        Buscar na transcrição
                      </label>
                      <input
                        id={idBusca}
                        className={styles.busca}
                        type="search"
                        placeholder="⌕ Buscar na transcrição… (ex.: “rural”)"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                      />
                      {provas > 0 && (
                        <span className={styles.provas}>
                          {provas} {provas === 1 ? 'trecho marcado' : 'trechos marcados'} como prova
                        </span>
                      )}
                    </div>
                    {ouvindo && g.audio && (
                      <div className={styles.player} role="group" aria-label={`Áudio: ${g.audio.nome}`}>
                        {/* GGVP-133: o áudio guardado de verdade, parte por parte; o da semente de exemplo não tem arquivo. */}
                        {g.audio.documentos?.length ? (
                          g.audio.documentos.map((d, i, partes) => (
                            <audio
                              key={d.id}
                              controls
                              preload="none"
                              src={arquivo(g, d.id)}
                              aria-label={partes.length > 1 ? `Parte ${i + 1} do áudio, desde ${relogio(d.inicio).slice(3)}` : 'Áudio da gravação'}
                            />
                          ))
                        ) : (
                          <span className={styles.nota}>{g.audio.nome}: gravação de exemplo, sem arquivo guardado no portal para tocar.</span>
                        )}
                      </div>
                    )}
                    {trechos.length === 0 ? (
                      <p className={styles.nota}>Nenhum trecho com «{busca}».</p>
                    ) : (
                      <ol className={styles.trechos} aria-label="Trechos">
                        {trechos.map((t) => (
                          <li key={t.aos} className={styles.trecho}>
                            <span className={styles.quando}>{relogio(t.aos).slice(3)}</span>
                            <span className={styles.quem} data-papel={t.papel}>
                              {t.quem}
                            </span>
                            <span>
                              {marcarBusca(t.texto, busca).map((p, i) => (p.marca ? <mark key={i}>{p.texto}</mark> : <span key={i}>{p.texto}</span>))}
                            </span>
                            <button
                              type="button"
                              className={t.prova ? styles.prova : styles.marcarProva}
                              aria-pressed={t.prova === true}
                              aria-label={`${t.prova ? 'Tirar a prova' : 'Marcar como prova'} do trecho de ${relogio(t.aos).slice(3)}`}
                              disabled={ocupado}
                              onClick={() => fazer(() => marcarProva(g.id, t.aos, !t.prova))}
                            >
                              {t.prova ? 'prova' : '+ prova'}
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </>
              )}
              <p className={styles.nota}>
                A IA transcreve e extrai; só muda na ficha o que foi dito, o valor antigo fica no histórico e o Jurídico pode desfazer
                (G14). Áudio e transcrição ficam guardados para sempre no caso.
              </p>
            </>
          )}
        </section>
      </div>
      {registrando && (
        <RegistrarConversa
          ficha={ficha}
          funcao={perfil === 'juridico' ? 'Advogada' : 'Atendimento'}
          aoFechar={() => setRegistrando(false)}
          aoAbrir={async (c) => {
            // Com gravação, a conversa acontece na tela do passo; só escrita, aparece aqui mesmo, como "só registro".
            if (c.modo !== 'escrito') return window.location.assign(`/conversas/${c.id}`)
            setRegistrando(false)
            setGravacoes(await obterGravacoes(ficha.id))
            trocar(c.gravacaoId!)
            aoMudar?.()
          }}
        />
      )}
    </dialog>
  )
}
