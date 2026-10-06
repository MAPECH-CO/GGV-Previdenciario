import { useEffect, useId, useRef, useState } from 'react'
import { formatarTelefone, isoParaData } from '../campos.ts'
import { transcrever } from '../dados/entrevista.ts'
import { agora } from '../dados/servidor.ts'
import { CANAIS_DA_CONVERSA, conferirDocumentos, conferirInformacoes, marcarProva, obterGravacoes, registrarConversa } from '../dados/transcricao.ts'
import type { ConversaSemAudio, Ficha, Gravacao, InformacaoExtraida } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { minutos, relogio } from '../regras/entrevista.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import { buscarTrechos, contagemDoTopo, marcarBusca, situacaoDaGravacao } from '../regras/transcricao.ts'
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

const CONVERSA_VAZIA: ConversaSemAudio = { data: '', canal: 'WhatsApp', titulo: '', participantes: '', texto: '' }

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
  const [tocando, setTocando] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [conversa, setConversa] = useState(CONVERSA_VAZIA)
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
  const trechos = g ? buscarTrechos(g.trechos, busca) : []
  const provas = g?.trechos.filter((t) => t.prova).length ?? 0
  const numero = ficha.processos[0]?.numero

  function trocar(id: string) {
    setSelecionada(id)
    setRegistrando(false)
    setBusca('')
    setMarcadas(new Set())
    setDocumentosConferidos(false)
    setOuvindo(false)
    setTocando(false)
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

  async function registrar() {
    const nova = await fazer(() => registrarConversa(ficha.id, conversa, perfil), true)
    if (nova) {
      setConversa(CONVERSA_VAZIA)
      trocar(nova.id)
    }
  }

  const valorFalado = (e: InformacaoExtraida) => (e.campo === 'telefone' ? formatarTelefone(e.valor) : e.valor)

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
                <button type="button" className={styles.item} aria-pressed={x.id === selecionada && !registrando} onClick={() => trocar(x.id)}>
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

          {registrando ? (
            <div className={styles.formulario}>
              <h3 className={styles.detalheTitulo}>Registrar nova conversa (sem áudio)</h3>
              <label className={styles.rotulo}>
                Data *
                <input
                  className={styles.entrada}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="dd/mm/aaaa"
                  value={conversa.data}
                  onChange={(e) => setConversa((c) => ({ ...c, data: soNumeroEMascara(e.target.value) }))}
                />
              </label>
              <label className={styles.rotulo}>
                Por onde *
                <select className={styles.entrada} value={conversa.canal} onChange={(e) => setConversa((c) => ({ ...c, canal: e.target.value as ConversaSemAudio['canal'] }))}>
                  {CANAIS_DA_CONVERSA.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className={styles.rotulo}>
                Assunto *
                <input className={styles.entrada} maxLength={120} value={conversa.titulo} onChange={(e) => setConversa((c) => ({ ...c, titulo: e.target.value }))} />
              </label>
              <label className={styles.rotulo}>
                Quem participou *
                <input className={styles.entrada} maxLength={120} value={conversa.participantes} onChange={(e) => setConversa((c) => ({ ...c, participantes: e.target.value }))} />
              </label>
              <label className={styles.rotulo}>
                O que foi conversado *
                <textarea className={styles.entrada} rows={4} maxLength={4000} value={conversa.texto} onChange={(e) => setConversa((c) => ({ ...c, texto: e.target.value }))} />
              </label>
              <div className={styles.acoes}>
                <button type="button" className={styles.primario} disabled={ocupado} onClick={registrar}>
                  Registrar conversa
                </button>
                <button type="button" className={styles.botao} onClick={() => setRegistrando(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : !g ? (
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
                    <p>{g.resumo}</p>
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
                            {e.conferidaEm ? (
                              <span className={styles.conferida}>✓ conferida</span>
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
                    {g.extraidas.some((e) => !e.conferidaEm) && (
                      <button
                        type="button"
                        className={styles.primario}
                        disabled={marcadas.size === 0 || ocupado}
                        onClick={async () => {
                          await fazer(async () => (await conferirInformacoes(g.id, [...marcadas])).gravacao, true)
                          setMarcadas(new Set())
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
                        <button type="button" className={styles.tocar} aria-label={tocando ? 'Pausar o áudio' : 'Tocar o áudio'} onClick={() => setTocando((t) => !t)}>
                          {tocando ? '❚❚' : '▶'}
                        </button>
                        <span className={styles.barra} />
                        <span className={styles.nota}>
                          00:00 / {relogio(g.duracao).slice(3)} · {g.audio.nome} (áudio simulado)
                        </span>
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
    </dialog>
  )
}
