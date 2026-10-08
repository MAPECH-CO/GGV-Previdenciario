import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { JurimetriaDoCaso } from '../componentes/JurimetriaDoCaso.tsx'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { formatarCpf } from '../campos.ts'
import { descreverDocumento, identificarPerito, NOMES_DE_FORA, nomeDoDocumento, obterCaso, type CasoNaTela, type DocumentoDoCaso, type TipoDeAutor } from '../dados/caso.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import type { IdEtapa } from '../regras/caso.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import janelas from '../componentes/DetalheCompromisso.module.css'
import passo from './Balcao.module.css'
import proprio from './Pericia.module.css'
import base from './ProcessoPericia.module.css'
import styles from './PaginaDoCaso.module.css'

// Figma: "Advogada · Processo do cliente (completo)" (72:2), tema escuro (72:287), fonte grande (72:572) e as variantes
// (1578:2, 1579:117, 1581:2, 1581:418, 1582:2, 1582:421, 2179:2, 2179:333, 2179:664); "Overlay · Histórico do processo"
// (59:11); jurimetria (2184:2 a 2184:183). O caso numa linha só (GGVP-86), para o Jurídico e o Atendimento.

const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

const AUTOR: Record<TipoDeAutor, string> = { pessoa: 'pessoa', sistema: 'sistema', ia: 'IA' }
const ESTADO: Record<string, string> = { feita: 'feita', atual: 'agora', futura: 'ainda não chegou', 'nao-se-aplica': 'não se aplica' }

type Janela = { tipo: 'perito' | 'juizo'; id: string } | { tipo: 'historico' } | { tipo: 'documento'; doc: DocumentoDoCaso } | null

export function PaginaDoCaso({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const [c, setC] = useState<CasoNaTela | null | undefined>(undefined)
  const [etapaAberta, setEtapaAberta] = useState<IdEtapa | null>(null)
  const [janela, setJanela] = useState<Janela>(null)
  const [aviso, setAviso] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterCaso(processoId, perfil).then((x) => valendo && setC(x))
    return () => {
      valendo = false
    }
  }, [processoId, perfil])

  if (!c) {
    return (
      <main className={passo.pagina}>
        <title>Processo · GGV Previdenciário</title>
        <h1 className={passo.titulo}>{c === null ? 'Processo não encontrado' : 'Abrindo o processo…'}</h1>
        {c === null && <a href={perfil?.inicio ?? '/'}>Voltar ao início</a>}
      </main>
    )
  }

  const hoje = hojeIso(agora())
  const juridico = c.visao === 'juridico'
  const curta = (iso: string) => dataCurta(iso.slice(0, 10), hoje)
  const aberta = c.etapas.find((e) => e.id === etapaAberta)
  const urgente = c.prazos.find((p) => p.urgente)

  async function ligar(peritoId: string, nome: string) {
    if (travado.current) return
    travado.current = true
    try {
      setC(await identificarPerito(processoId, peritoId, perfil ?? { id: 'advogada', usuario: 'Advogada' }))
      setAviso(`Perito identificado: ${nome}. A orientação foi montada de novo pelo perfil dele.`)
    } finally {
      travado.current = false
    }
  }

  // A linha agrupada pela etapa, na ordem (CA10).
  const grupos = c.etapas.map((e) => ({ etapa: e, eventos: c.linha.filter((ev) => ev.etapa === e.id) })).filter((g) => g.eventos.length > 0)
  const setores = [...new Set(c.tarefas.map((t) => t.setor))]

  return (
    <>
      <title>{`${c.ficha.nome} · Processo · GGV Previdenciário`}</title>
      <Topbar itens={navegacao} ativo="" funcao={perfil?.rotulo ?? 'Advogada'} />
      <main className={base.pagina}>
        <header className={base.cabecalho}>
          <div className={base.linha}>
            <h1 className={base.numero}>
              <span className={styles.rotuloId}>{c.identificacao.rotulo} </span>
              {c.identificacao.valor}
            </h1>
            <span className={proprio.selo}>
              {c.fase === 'judicial' ? 'Judicial' : 'Administrativo'} · {c.passoAtual}
            </span>
            {/* Laudo novo não conferido (CA5): leva à análise do laudo; quem não é do Jurídico vê lá só que ele existe. */}
            {c.laudoNovo && (
              <a className={styles.laudoNovo} href={c.laudoNovo.href}>
                Laudo novo · {curta(c.laudoNovo.data)}
              </a>
            )}
            <span className={passo.beneficio}>◆ {c.beneficio}</span>
            <button type="button" className={base.transcricoes} aria-disabled="true" title="As transcrições abrem pela ficha (GGVP-102)">
              ▶ Transcrições ({c.ficha.transcricoes})
            </button>
          </div>
          <p className={base.cliente}>
            <a href={`/clientes/${c.ficha.id}`}>{c.ficha.nome}</a>
            {c.ficha.idade !== undefined && ` · ${c.ficha.idade} anos`}
            {c.juizo && (
              <>
                {' · '}
                {juridico ? (
                  <button type="button" className={base.link} onClick={() => setJanela({ tipo: 'juizo', id: c.juizo!.id })}>
                    {c.juizo.nome}
                  </button>
                ) : (
                  c.juizo.nome
                )}
                {` · ${c.juizo.juiz}`}
              </>
            )}
            {urgente && <strong className={base.urgente}>{` · ${urgente.oQue.split(' (')[0].toLowerCase()} ${dataCurta(urgente.quando, hoje)}`}</strong>}
          </p>
          <button type="button" className={styles.historico} onClick={() => setJanela({ tipo: 'historico' })}>
            <span aria-hidden="true">⌄</span> Histórico <span className={styles.contagem}>{c.linha.length} ocorridos</span>
            <span className={base.nota}>linha do tempo completa abaixo · clique para ver em detalhe</span>
          </button>
        </header>

        {/* As cinco etapas em sequência (CA1), com a perícia ligada à etapa que pediu (CA2). */}
        <nav className={base.acoes} aria-label="Etapas do processo">
          <p className={base.legenda}>
            <strong>Etapas do processo</strong> · em ordem · ✓ feita (clique para ver quem fez) · ▶ agora · cinza: ainda não chegou · apagada: não se aplica
          </p>
          <ol className={styles.etapas}>
            {c.etapas.map((e) => (
              <li key={e.id} className={styles[e.estado]}>
                {e.estado === 'feita' ? (
                  <button type="button" aria-expanded={etapaAberta === e.id} onClick={() => setEtapaAberta(etapaAberta === e.id ? null : e.id)}>
                    ✓ {e.rotulo}
                  </button>
                ) : (
                  <span aria-current={e.estado === 'atual' ? 'step' : undefined} aria-disabled={e.estado !== 'atual' ? 'true' : undefined}>
                    {e.estado === 'atual' ? '▶ ' : ''}
                    {e.rotulo}
                    {e.estado === 'atual' && <small className={styles.subEtapa}>{c.passoAtual}</small>}
                    {e.estado === 'nao-se-aplica' && <small className={styles.subEtapa}>não se aplica</small>}
                  </span>
                )}
                <span className="so-leitor">{` (${e.diagrama} · ${ESTADO[e.estado]})`}</span>
                {c.emPericia?.etapa === e.id && (
                  <a className={styles.emPericia} href={c.emPericia.href}>
                    <strong>Em perícia</strong>
                    <span>{c.emPericia.situacao}</span>
                  </a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Um passo concluído: quem fez, quando e os documentos (CA4). */}
        {aberta && (
          <section className={`${base.cartao} ${styles.detalhe}`} aria-labelledby="etapa-aberta">
            <div className={styles.detalheCabeca}>
              <h2 id="etapa-aberta" className={base.cartaoTitulo}>
                {aberta.rotulo} · feita · {aberta.descricao}
              </h2>
              <button type="button" className={janelas.fechar} aria-label="Fechar o detalhe da etapa" onClick={() => setEtapaAberta(null)}>
                ×
              </button>
            </div>
            {aberta.eventos.length === 0 ? (
              <p className={base.nota}>Nada registrado nesta etapa.</p>
            ) : (
              <ol className={`${proprio.historico} ${styles.linhaLista}`}>
                {aberta.eventos.map((ev, i) => (
                  <li key={i} className={base.evento}>
                    <span className={proprio.quando}>{curta(ev.quando)}</span>
                    <span>
                      <strong>{ev.quem}</strong> ({AUTOR[ev.tipo]}): {ev.oQue}
                    </span>
                    <span className={proprio.passo}>{ev.passo}</span>
                  </li>
                ))}
              </ol>
            )}
            <p>
              <strong>Documentos desta etapa: </strong>
              {aberta.documentos.length ? aberta.documentos.join(', ') : 'nenhum'}
            </p>
          </section>
        )}

        <section className={base.resumo} aria-labelledby="onde-esta">
          <div>
            <h2 id="onde-esta" className={proprio.iaTitulo}>
              Onde o caso está
            </h2>
            <p>
              {c.etapas.find((e) => e.estado === 'atual')?.rotulo} · {c.passoAtual}.
              {c.pendentes && c.pendentes.setores.length > 0 && ` Esperando ${c.pendentes.setores.join(' e ')} subir o card.`}
              {c.esperas.length > 0 && ` Esperando de fora: ${c.esperas.map((e) => NOMES_DE_FORA[e.quem]).join(', ')}.`}
            </p>
            {c.emPericia && (
              <p>
                <strong>
                  {c.emPericia.rotulo}
                  {c.emPericia.data && ` · ${c.emPericia.data}`}
                </strong>
              </p>
            )}
          </div>
          {c.emPericia && (
            <a className={passo.principalBotao} href={c.emPericia.href}>
              Ver a perícia
            </a>
          )}
        </section>

        {aviso && (
          <p role="status" className={passo.aviso}>
            {aviso}
          </p>
        )}

        <div className={base.grade}>
          <section className={base.cartao} aria-labelledby="linha">
            <h2 id="linha" className={base.cartaoTitulo}>
              Linha do processo · completa
            </h2>
            <p className={base.nota}>Do lead ao momento atual. Quando, quem fez (pessoa, sistema ou IA), o que foi feito e o passo do BPMN.</p>
            {grupos.map((g) => (
              <div key={g.etapa.id}>
                <h3 className={base.grupo}>
                  {g.etapa.rotulo} · {g.etapa.descricao}
                </h3>
                <ol className={`${proprio.historico} ${styles.linhaLista}`} aria-label={`Linha · ${g.etapa.rotulo}`}>
                  {g.eventos.map((ev, i) => (
                    <li key={i} className={base.evento}>
                      <span className={proprio.quando}>{curta(ev.quando)}</span>
                      <span>
                        <span className={styles[`autor-${ev.tipo}`]}>{AUTOR[ev.tipo]}</span> <strong>{ev.quem}</strong>: {ev.oQue}
                        {ev.peloChat && <em className={styles.peloChat}> · feito pelo chat</em>}
                      </span>
                      <span className={proprio.passo}>{ev.passo}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {!juridico && <p className={base.nota}>Petição, estratégia e valores não aparecem para o Atendimento.</p>}
            {juridico && c.valores.length === 0 && <p className={base.nota}>Valores: só o Financeiro e o Sócio; a advogada vê os do caso dela.</p>}
          </section>

          <div className={base.coluna}>
            {c.pendentes && (
              <section className={`${base.cartao} ${c.pendentes.setores.length ? base.destaque : ''}`} aria-labelledby="setores">
                <h2 id="setores" className={base.cartaoTitulo}>
                  Esperando os setores
                </h2>
                <p className={base.nota}>
                  {c.pendentes.motivo} · desde {curta(c.pendentes.desde)}
                </p>
                <ul className={styles.lista}>
                  {c.pendentes.itens.map((l) => (
                    <li key={l.setor} className={base.pericia}>
                      <span>
                        <strong>{l.setor}</strong>
                        <span className={base.nota}>{l.oQue}</span>
                      </span>
                      <span className={`${base.situacao} ${l.subiu ? base.ok : base.alerta}`}>{l.subiu ? `subiu o card ${curta(l.subiu.quando)}` : 'ainda não subiu o card'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {c.esperas.length > 0 && (
              <section className={base.cartao} aria-labelledby="de-fora">
                <h2 id="de-fora" className={base.cartaoTitulo}>
                  Esperando alguém de fora
                </h2>
                <ul className={styles.lista}>
                  {c.esperas.map((e, i) => (
                    <li key={i} className={base.pericia}>
                      <span>
                        <strong>{NOMES_DE_FORA[e.quem]}</strong>
                        <span>{e.oQue}</span>
                        <span className={base.nota}>
                          desde {curta(e.desde)}
                          {e.prazo && ` · prazo ${curta(e.prazo)}`}
                          {e.lembrete && ` · lembrete: ${e.lembrete}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={base.cartao} aria-labelledby="tarefas">
              <h2 id="tarefas" className={base.cartaoTitulo}>
                Tarefas em andamento
              </h2>
              {setores.length === 0 && <p className={base.nota}>Nenhuma tarefa aberta no caso.</p>}
              {setores.map((s) => (
                <div key={s}>
                  <h3 className={base.grupo}>{s}</h3>
                  <ul className={styles.lista}>
                    {c.tarefas
                      .filter((t) => t.setor === s)
                      .map((t) => (
                        <li key={t.titulo} className={base.pericia}>
                          <span>
                            {t.href ? <a href={t.href}>{t.titulo}</a> : <strong>{t.titulo}</strong>}
                            <span className={base.nota}>
                              responsável: {t.responsavel}
                              {t.paralela && ' · em paralelo'}
                              {t.peloChat && ' · criada pelo chat'}
                            </span>
                          </span>
                          {t.prazo && (
                            <span className={`${base.situacao} ${t.prazoFalado?.urgente ? base.alerta : base.neutro}`}>{t.prazoFalado?.texto ?? t.prazo}</span>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </section>

            {c.peritoParaIdentificar && juridico && (
              <section className={base.cartao} aria-labelledby="quem-e-o-perito">
                <h2 id="quem-e-o-perito" className={base.cartaoTitulo}>
                  Quem é o perito?
                </h2>
                <p>
                  {c.peritoParaIdentificar.lido ? `O sistema não reconheceu o perito ${c.peritoParaIdentificar.lido}.` : 'O perito ainda não é conhecido.'} Nada trava:
                  vale a orientação padrão. Se algum documento disser quem é, identifique em um clique.
                </p>
                <div className={passo.atalhos} role="group" aria-label="Identificar o perito">
                  {c.peritoParaIdentificar.opcoes.map((p) => (
                    <button key={p.id} type="button" className={passo.atalho} onClick={() => void ligar(p.id, p.nome)}>
                      {p.nome} · {p.especialidade}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className={base.cartao} aria-labelledby="dados">
              <h2 id="dados" className={base.cartaoTitulo}>
                Dados do processo
              </h2>
              <dl className={base.dados}>
                <dt>Cliente</dt>
                <dd>
                  {c.ficha.nome}
                  {c.ficha.cpf && ` · CPF ${formatarCpf(c.ficha.cpf)}`}
                </dd>
                <dt>Benefício</dt>
                <dd>{c.beneficio}</dd>
                <dt>{c.identificacao.rotulo}</dt>
                <dd>{c.identificacao.valor}</dd>
                <dt>Juízo</dt>
                <dd>{c.juizo ? `${c.juizo.nome} · ${c.juizo.juiz}` : c.fase === 'administrativa' ? '— (fase administrativa)' : 'ainda não identificado'}</dd>
                <dt>Perito</dt>
                <dd>
                  {c.perito ? (
                    juridico ? (
                      <button type="button" className={base.link} onClick={() => setJanela({ tipo: 'perito', id: c.perito!.id })}>
                        {c.perito.nome}
                      </button>
                    ) : (
                      c.perito.nome
                    )
                  ) : (
                    '—'
                  )}
                </dd>
                {c.valores.map((v) => (
                  <div key={v.tipo} className={styles.par}>
                    <dt>{v.rotulo}</dt>
                    <dd>{v.valor}</dd>
                  </div>
                ))}
                {c.saude && (
                  <>
                    <dt>Saúde (Jurídico)</dt>
                    <dd>{c.saude}</dd>
                  </>
                )}
                {c.estrategia && (
                  <>
                    <dt>Estratégia</dt>
                    <dd>{c.estrategia}</dd>
                  </>
                )}
                <dt>Gov.br</dt>
                <dd>{c.ficha.senhaGov.situacao === 'no-cofre' ? 'senha no cofre (G9)' : 'sem senha no cofre (G9)'}</dd>
              </dl>
            </section>
          </div>

          <div className={base.coluna}>
            <section className={base.cartao} aria-labelledby="prazos">
              <h2 id="prazos" className={base.cartaoTitulo}>
                Prazos
              </h2>
              {c.prazos.length === 0 ? (
                <p className={base.nota}>Nenhum prazo nesta fase.</p>
              ) : (
                <dl className={base.prazos}>
                  {c.prazos.map((p) => (
                    <div key={p.oQue} className={styles.par}>
                      <dt className={p.urgente ? base.urgente : undefined}>{/^\d{4}-/.test(p.quando) ? dataCurta(p.quando, hoje) : p.quando}</dt>
                      <dd>{p.oQue}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className={base.nota}>{c.fase === 'judicial' ? 'Com processo judicial, a vigília lê as publicações.' : 'Na fase administrativa, a vigília confere o Meu INSS.'}</p>
            </section>

            <section className={base.cartao} aria-labelledby="documentos">
              <h2 id="documentos" className={base.cartaoTitulo}>
                Documentos (abrir cada um)
              </h2>
              {c.documentos.length === 0 ? (
                <p className={base.nota}>Nenhum documento no processo ainda.</p>
              ) : (
                <ul className={base.documentos}>
                  {c.documentos.map((d) => (
                    <li key={d.nome}>
                      <span className={base.pdf} aria-hidden="true">
                        PDF
                      </span>
                      <span className={styles.docTexto}>
                        {nomeDoDocumento(d)}
                        <span className={base.nota}>
                          {d.origem} · {curta(d.data)}
                        </span>
                      </span>
                      <button type="button" className={base.link} aria-label={`Abrir ${nomeDoDocumento(d)}`} onClick={() => setJanela({ tipo: 'documento', doc: d })}>
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={base.cartao} aria-labelledby="acoes">
              <h2 id="acoes" className={base.cartaoTitulo}>
                Ações
              </h2>
              {c.emPericia && (
                <a className={passo.principalBotao} href={c.emPericia.href}>
                  Ver a perícia
                </a>
              )}
              {juridico && c.laudoNovo && (
                <a className={proprio.secundario} href={c.laudoNovo.href}>
                  Analisar o laudo novo
                </a>
              )}
              <a className={proprio.secundario} href={`/clientes/${c.ficha.id}`}>
                Abrir a ficha do cliente
              </a>
              <p className={base.nota}>A IA preenche; você confere e assina (G6). Prazos e regras numéricas são código, não modelo (G19).</p>
            </section>
          </div>
        </div>
      </main>
      <AbaSuporte />
      {janela && (janela.tipo === 'perito' || janela.tipo === 'juizo') && <JurimetriaDoCaso tipo={janela.tipo} id={janela.id} aoFechar={() => setJanela(null)} />}
      {janela?.tipo === 'historico' && <Historico caso={c} hoje={hoje} aoFechar={() => setJanela(null)} />}
      {janela?.tipo === 'documento' && <Documento doc={janela.doc} caso={c} hoje={hoje} aoFechar={() => setJanela(null)} />}
    </>
  )
}

/** Abre o `<dialog>` como janela; o jsdom dos testes não tem showModal. */
function useJanela() {
  const janela = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = janela.current
    if (typeof d?.showModal === 'function') {
      if (!d.open) d.showModal()
    } else d?.setAttribute('open', '')
  }, [])
  return janela
}

/** "Overlay · Histórico do processo" (59:11): do mais recente ao mais antigo, com quem fez e o passo. */
function Historico({ caso, hoje, aoFechar }: { caso: CasoNaTela; hoje: string; aoFechar: () => void }) {
  const janela = useJanela()
  return (
    <dialog ref={janela} className={janelas.janela} aria-labelledby="historico-titulo" onClose={aoFechar}>
      <div className={janelas.cabeca}>
        <div className={janelas.textos}>
          <h2 id="historico-titulo" className={janelas.titulo}>
            <strong>Histórico do processo</strong>
          </h2>
          <p className={base.nota}>
            {caso.identificacao.valor} · {caso.ficha.nome} · do mais recente ao mais antigo
          </p>
        </div>
        <button type="button" className={janelas.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <ol className={styles.historicoLista}>
        {[...caso.linha].reverse().map((ev, i) => (
          <li key={i}>
            <span className={base.nota}>
              {dataCurta(ev.quando.slice(0, 10), hoje)} · {ev.quem} ({AUTOR[ev.tipo]}) · {ev.passo}
              {ev.peloChat && ' · feito pelo chat'}
            </span>
            <span>{ev.oQue}</span>
          </li>
        ))}
      </ol>
    </dialog>
  )
}

/** Documento aberto pelo caso (CA11): a origem e a data; o conteúdo do laudo só para o Jurídico. */
function Documento({ doc, caso, hoje, aoFechar }: { doc: DocumentoDoCaso; caso: CasoNaTela; hoje: string; aoFechar: () => void }) {
  const janela = useJanela()
  const d = descreverDocumento(doc, caso.visao, hoje)
  return (
    <dialog ref={janela} className={janelas.janela} aria-labelledby="documento-titulo" onClose={aoFechar}>
      <div className={janelas.cabeca}>
        <div className={janelas.textos}>
          <h2 id="documento-titulo" className={janelas.titulo}>
            <strong>{d.titulo}</strong>
          </h2>
        </div>
        <button type="button" className={janelas.fechar} aria-label="Fechar" onClick={aoFechar}>
          ×
        </button>
      </div>
      <ul className={styles.lista}>
        {d.linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {d.aviso && <p className={passo.trava}>{d.aviso}</p>}
      <p className={base.nota}>O arquivo abre no Drive do cliente (simulado).</p>
    </dialog>
  )
}
