import { diaLocal } from '@ggv/campos'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ROTULO_DESFECHO_DA_LISTA, type PrestacaoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { AbrirDocumento } from '../componentes/AbrirDocumento.tsx'
import { ComplementosDoProcesso } from '../componentes/ComplementosDoProcesso.tsx'
import { CustasDoProcesso } from '../componentes/CustasDoProcesso.tsx'
import { JusticaDoCaso } from '../componentes/JusticaDoCaso.tsx'
import { ExplicacaoDoDesfecho } from '../componentes/ExplicacaoDoDesfecho.tsx'
import { JurimetriaDoCaso } from '../componentes/JurimetriaDoCaso.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { formatarCpf } from '../campos.ts'
import { descreverDocumento, identificarPerito, NOMES_DE_FORA, nomeDoDocumento, obterCaso, type CasoNaTela, type DocumentoDoCaso, type TipoDeAutor } from '../dados/caso.ts'
import { pendenciasDeDocumento } from '../dados/cobranca.ts'
import { obterContrato } from '../dados/contrato.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora, doServidor, obterFicha } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { usePode, usePodeAbrir } from '../sessao.ts'
import { desfechoDaLista } from '../regras/bases.ts'
import { SEM_NUMERO, type IdEtapa } from '../regras/caso.ts'
import { semCodigo } from '../regras/texto.ts'
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
  { id: 'inicio', rotulo: 'Início', href: '/' },
  { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
]

const AUTOR: Record<TipoDeAutor, string> = { pessoa: 'pessoa', sistema: 'sistema', ia: 'IA' }
const ESTADO: Record<string, string> = { feita: 'feita', atual: 'agora', futura: 'ainda não chegou', 'nao-se-aplica': 'não se aplica' }
// O passo que o caso ainda não tem: a tela diz isso uma vez só, no "Onde o caso está".
const SEM_PASSO = 'ainda não há próximo passo'


type Janela = { tipo: 'perito' | 'juizo'; id: string } | { tipo: 'historico' } | { tipo: 'documento'; doc: DocumentoDoCaso } | null

export function PaginaDoCaso({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const [c, setC] = useState<CasoNaTela | null | undefined>(undefined)
  const [etapaAberta, setEtapaAberta] = useState<IdEtapa | null>(null)
  const [janela, setJanela] = useState<Janela>(null)
  const [aviso, setAviso] = useState('')
  const travado = useRef(false)
  // A prestação de contas do caso (GGVP-44): o atalho aparece para quem pode ver e quando ela já existe; a tarefa fecha e o
  // caminho até ela continua aqui.
  const veJurimetria = usePode('estudo.ver')
  const vePrestacao = usePode('prestacao.ver')
  // As custas do processo (GGVP-157): a Sênior e os sócios; o Financeiro vê na visão dele, sem abrir o processo.
  const veCustas = usePode('custas.ver')
  const [temPrestacao, setTemPrestacao] = useState(false)
  useEffect(() => {
    if (!vePrestacao || !doServidor(processoId)) return
    let valendo = true
    void chamarApi<PrestacaoDoCaso>(`/casos/${processoId}/prestacao`).then((r) => valendo && setTemPrestacao(r.ok && r.dados.versoes.length > 0))
    return () => {
      valendo = false
    }
  }, [processoId, vePrestacao])
  // O que as histórias prometem no processo: "Marcar entrevista" (GGVP-123, CA1), "Imprimir cópia para o cliente" com o
  // contrato verificado (GGVP-89, CA1) e a janela das transcrições (GGVP-46). Cada um só para quem pode usar a tela.
  const marcaEntrevista = usePode('ficha.editar')
  const conduzContrato = usePode('contrato.conduzir')
  const [contratoVerificado, setContratoVerificado] = useState(false)
  useEffect(() => {
    if (!conduzContrato) return
    let valendo = true
    void obterContrato(processoId).then((x) => valendo && setContratoVerificado(x?.contrato.etapa === 'copia' || x?.contrato.etapa === 'entregue'))
    return () => {
      valendo = false
    }
  }, [processoId, conduzContrato])
  const [fichaDasTranscricoes, setFichaDasTranscricoes] = useState<Ficha | null>(null)

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
  const curta = (iso: string) => dataCurta(diaLocal(iso), hoje)
  const aberta = c.etapas.find((e) => e.id === etapaAberta)
  const urgente = c.prazos.find((p) => p.urgente)
  const passoDito = c.passoAtual === SEM_PASSO ? null : c.passoAtual
  const semNumero = c.identificacao.valor === SEM_NUMERO
  // O desfecho com a mesma palavra da lista de Processos: Êxito e Acordo em verde; Perdido e Extinto em vermelho.
  const desfecho = desfechoDaLista(c.desfecho ?? null, null)
  const resultado = desfecho === 'em_andamento' ? null : { rotulo: ROTULO_DESFECHO_DA_LISTA[desfecho], tom: desfecho === 'exito' || desfecho === 'acordo' ? 'ok' : 'erro' }
  const abrirTranscricoes = async () => setFichaDasTranscricoes(await obterFicha(c.ficha.id))

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
  // As tarefas, os prazos e os documentos: quando os três estão vazios, uma linha só (no lugar deles).
  const semApoio = setores.length === 0 && c.prazos.length === 0 && c.documentos.length === 0
  // As pendências de documento do caso (GGVP-130, Lucas 07/10), com o caminho para o checklist.
  const pendentes = pendenciasDeDocumento(processoId)
  const eventos = c.linha.length === 0 ? 'nenhum evento ainda' : c.linha.length === 1 ? '1 evento' : `${c.linha.length} eventos`

  return (
    <>
      <title>{`${c.ficha.nome} · Processo · GGV Previdenciário`}</title>
      <Topbar itens={navegacao} ativo="" funcao={perfil?.rotulo ?? 'Advogada'} />
      <main className={`${base.pagina} ${styles.caso}`}>
        <header className={base.cabecalho}>
          <div className={base.linha}>
            <h1 className={base.numero}>{`${c.ficha.nome} · ${c.beneficio}`}</h1>
            <span className={proprio.selo}>
              {c.fase === 'judicial' ? 'Judicial' : 'Administrativo'}
              {passoDito && ` · ${passoDito}`}
            </span>
            {resultado && <strong className={`${styles.desfecho} ${resultado.tom === 'ok' ? styles.desfechoOk : styles.desfechoErro}`}>Desfecho · {resultado.rotulo}</strong>}
            {/* Laudo novo não conferido (CA5): leva à análise do laudo; quem não é do Jurídico vê lá só que ele existe. */}
            {c.laudoNovo && (
              <LinkSePode href={c.laudoNovo.href} className={styles.laudoNovo}>
                Laudo novo · {curta(c.laudoNovo.data)}
              </LinkSePode>
            )}
            {temPrestacao && (
              <a className={styles.prestacao} href={`/casos/${processoId}/prestacao`}>
                Prestação de contas
              </a>
            )}
            {marcaEntrevista && (
              <a className={styles.prestacao} href={`/agenda/marcar/${c.ficha.id}`}>
                Marcar entrevista
              </a>
            )}
            {conduzContrato && contratoVerificado && (
              <a className={styles.prestacao} href={`/contrato/${processoId}/copia`}>
                Imprimir cópia para o cliente
              </a>
            )}
            {c.ficha.transcricoes > 0 ? (
              <button type="button" className={`${base.transcricoes} ${styles.transcricoes}`} onClick={abrirTranscricoes}>
                ▶ Transcrições ({c.ficha.transcricoes})
              </button>
            ) : (
              <span className={styles.semTranscricoes}>Sem transcrições</span>
            )}
          </div>
          {/* O nome já está no título: aqui, o número, a ficha e o que mais identifica o caso. */}
          <p className={base.cliente}>
            <span className={styles.identificacao}>{semNumero ? 'Sem número ainda' : `${c.identificacao.rotulo} ${c.identificacao.valor}`}</span>
            <LinkSePode href={`/clientes/${c.ficha.id}`} antes=" · ">
              Ficha do cliente
            </LinkSePode>
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
            <span aria-hidden="true">⌄</span> Histórico · <span className={styles.contagem}>{eventos}</span>
            <span className={base.nota}>linha do tempo completa abaixo · clique para ver em detalhe</span>
          </button>
        </header>
        {doServidor(processoId) && <JusticaDoCaso key={processoId + c.fase + String(veJurimetria)} processoId={processoId} veJurimetria={veJurimetria} judicial={c.fase === 'judicial'} />}
        {doServidor(processoId) && <ExplicacaoDoDesfecho key={`${processoId}-${c.desfecho}`} casoId={processoId} desfecho={c.desfecho ?? null} />}

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
                    {e.estado === 'atual' && passoDito && <small className={styles.subEtapa}>{passoDito}</small>}
                    {e.estado === 'nao-se-aplica' && <small className={styles.subEtapa}>não se aplica</small>}
                  </span>
                )}
                <span className="so-leitor">{` (${ESTADO[e.estado]})`}</span>
                {c.emPericia?.etapa === e.id && (
                  <LinkSePode href={c.emPericia.href} className={styles.emPericia}>
                    <strong>Em perícia</strong>
                    <span>{c.emPericia.situacao}</span>
                  </LinkSePode>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Um passo concluído: quem fez, quando e os documentos (CA4). */}
        {aberta && (
          <section className={`${base.cartao} ${styles.detalhe} ${styles.realce}`} aria-labelledby="etapa-aberta">
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
                      <strong>{ev.quem}</strong> ({AUTOR[ev.tipo]}): {semCodigo(ev.oQue)}
                    </span>
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

        <section className={`${base.resumo} ${styles.resumo}`} aria-labelledby="onde-esta">
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
            <LinkSePode href={c.emPericia.href} className={passo.principalBotao}>
              Ver a perícia
            </LinkSePode>
          )}
        </section>

        {aviso && (
          <p role="status" className={passo.aviso}>
            {aviso}
          </p>
        )}

        {doServidor(processoId) && veCustas && <CustasDoProcesso key={processoId} casoId={processoId} />}

        <div className={base.grade}>
          <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="linha">
            <h2 id="linha" className={base.cartaoTitulo}>
              Linha do processo · completa
            </h2>
            <p className={base.nota}>Do lead ao momento atual. Quando, quem fez (pessoa, sistema ou IA), e o que foi feito.</p>
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
                        <span className={styles[`autor-${ev.tipo}`]}>{AUTOR[ev.tipo]}</span> <strong>{ev.quem}</strong>: {semCodigo(ev.oQue)}
                        {ev.peloChat && <em className={styles.peloChat}> · feito pelo chat</em>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>

          <div className={base.coluna}>
            {c.pendentes && (
              <section className={`${base.cartao} ${c.pendentes.setores.length ? `${base.destaque} ${styles.realce}` : styles.cartao}`} aria-labelledby="setores">
                <h2 id="setores" className={base.cartaoTitulo}>
                  Esperando os setores
                </h2>
                <p className={base.nota}>
                  {c.pendentes.motivo} · desde {curta(c.pendentes.desde)}
                </p>
                <ul className={styles.lista}>
                  {c.pendentes.itens.map((l, i) => (
                    <li key={i} className={base.pericia}>
                      <span>
                        <strong>{l.setor}</strong>
                        <span className={base.nota}>{semCodigo(l.oQue)}</span>
                      </span>
                      <span className={`${base.situacao} ${l.subiu ? base.ok : base.alerta}`}>{l.subiu ? `subiu o card ${curta(l.subiu.quando)}` : 'ainda não subiu o card'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {c.esperas.length > 0 && (
              <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="de-fora">
                <h2 id="de-fora" className={base.cartaoTitulo}>
                  Esperando alguém de fora
                </h2>
                <ul className={styles.lista}>
                  {c.esperas.map((e, i) => (
                    <li key={i} className={base.pericia}>
                      <span>
                        <strong>{NOMES_DE_FORA[e.quem]}</strong>
                        <span>{semCodigo(e.oQue)}</span>
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

            {pendentes.length > 0 && (
              <section className={`${base.cartao} ${base.destaque} ${styles.realce}`} aria-labelledby="pendentes">
                <h2 id="pendentes" className={base.cartaoTitulo}>
                  Documentos pendentes
                </h2>
                <p className={base.nota}>O que a cobrança ainda espera do cliente; o checklist só fecha com tudo.</p>
                <ul className={styles.lista}>
                  {pendentes.map((d) => (
                    <li key={d} className={base.pericia}>
                      {d}
                    </li>
                  ))}
                </ul>
                <LinkSePode href={`/casos/${processoId}/checklist`}>Ver o checklist</LinkSePode>
              </section>
            )}

            {setores.length > 0 && (
              <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="tarefas">
                <h2 id="tarefas" className={base.cartaoTitulo}>
                  Tarefas em andamento
                </h2>
                {setores.map((s) => (
                  <div key={s}>
                    <h3 className={base.grupo}>{s}</h3>
                    <ul className={styles.lista}>
                      {c.tarefas
                        .filter((t) => t.setor === s)
                        .map((t) => (
                          <li key={t.titulo} className={base.pericia}>
                            <span>
                              {t.href ? (
                                <LinkSePode href={t.href} texto={<strong>{semCodigo(t.titulo)}</strong>}>
                                  {semCodigo(t.titulo)}
                                </LinkSePode>
                              ) : (
                                <strong>{semCodigo(t.titulo)}</strong>
                              )}
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
            )}

            {/* GGVP-158 P12.3 (GGVP-86 CA9): as perícias abertas do caso do servidor, cada uma com o responsável e o prazo. */}
            {c.periciasAbertas && c.periciasAbertas.length > 0 && (
              <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="pericias-abertas">
                <h2 id="pericias-abertas" className={base.cartaoTitulo}>
                  Perícias abertas
                </h2>
                <ul className={styles.lista}>
                  {c.periciasAbertas.map((x, i) => (
                    <li key={`${x.rotulo}-${i}`} className={base.pericia}>
                      <span>
                        <LinkSePode href={x.href} texto={<strong>{x.rotulo}</strong>}>
                          {x.rotulo}
                        </LinkSePode>
                        <span className={base.nota}>
                          {x.situacao} · responsável: {x.responsavel}
                        </span>
                      </span>
                      {x.prazo && <span className={`${base.situacao} ${base.neutro}`}>{curta(x.prazo)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {semApoio && <p className={base.nota}>Sem tarefas, prazos ou documentos neste caso por enquanto.</p>}

            {c.peritoParaIdentificar && juridico && (
              <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="quem-e-o-perito">
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

            {doServidor(processoId) && <ComplementosDoProcesso key={`${processoId}-${perfil?.id}`} casoId={processoId} />}

            <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="dados">
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
                <dd>{c.juizo ? `${c.juizo.nome} · ${c.juizo.juiz}` : c.fase === 'administrativa' ? '— (fase administrativa)' : <span className={styles.naoInformado}>Não informado</span>}</dd>
                <dt>Perito</dt>
                <dd>
                  {c.perito ? (
                    // No servidor, o perfil é consultado pelo caso; a semente mantém a janela existente.
                    juridico && c.perito.id ? (
                      <button type="button" className={base.link} onClick={() => setJanela({ tipo: 'perito', id: c.perito!.id })}>
                        {c.perito.nome}
                      </button>
                    ) : (
                      doServidor(processoId) && veJurimetria ? <a href="#juizo-do-processo">{c.perito.nome}</a> : c.perito.nome
                    )
                  ) : (
                    <span className={styles.naoInformado}>Não informado</span>
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
                <dd>{c.ficha.senhaGov.situacao === 'no-cofre' ? 'senha no cofre' : 'sem senha no cofre'}</dd>
              </dl>
            </section>
          </div>

          <div className={base.coluna}>
            {c.prazos.length > 0 && (
              <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="prazos">
                <h2 id="prazos" className={base.cartaoTitulo}>
                  Prazos
                </h2>
                <dl className={base.prazos}>
                  {c.prazos.map((p) => (
                    <div key={p.oQue} className={styles.par}>
                      <dt className={p.urgente ? base.urgente : undefined}>{/^\d{4}-/.test(p.quando) ? dataCurta(p.quando, hoje) : p.quando}</dt>
                      <dd>{semCodigo(p.oQue)}</dd>
                    </div>
                  ))}
                </dl>
                <p className={base.nota}>{c.fase === 'judicial' ? 'Com processo judicial, a vigília lê as publicações.' : 'Na fase administrativa, a vigília confere o Meu INSS.'}</p>
              </section>
            )}

            {c.documentos.length > 0 && (
              <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="documentos">
                <h2 id="documentos" className={base.cartaoTitulo}>
                  Documentos (abrir cada um)
                </h2>
                <ul className={base.documentos}>
                  {c.documentos.map((d) => (
                    <li key={d.href ?? d.nome}>
                      <span className={base.pdf} aria-hidden="true">
                        PDF
                      </span>
                      <span className={styles.docTexto}>
                        {nomeDoDocumento(d)}
                        <span className={base.nota}>
                          {d.origem} · {curta(d.data)}
                        </span>
                      </span>
                      <button type="button" className={`${base.link} ${styles.abrir}`} aria-label={`Abrir ${nomeDoDocumento(d)}`} onClick={() => setJanela({ tipo: 'documento', doc: d })}>
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={`${base.cartao} ${styles.cartao}`} aria-labelledby="acoes">
              <h2 id="acoes" className={base.cartaoTitulo}>
                Ações
              </h2>
              {c.emPericia && (
                <LinkSePode href={c.emPericia.href} className={proprio.secundario}>
                  Ver a perícia
                </LinkSePode>
              )}
              {juridico && c.laudoNovo && (
                <LinkSePode href={c.laudoNovo.href} className={proprio.secundario}>
                  Analisar o laudo novo
                </LinkSePode>
              )}
              <LinkSePode href={`/clientes/${c.ficha.id}`} className={proprio.secundario}>
                Abrir a ficha do cliente
              </LinkSePode>
              <p className={base.nota}>A IA preenche; você confere e assina.</p>
            </section>
          </div>
        </div>
      </main>
      <AbaSuporte />
      {janela && (janela.tipo === 'perito' || janela.tipo === 'juizo') && <JurimetriaDoCaso tipo={janela.tipo} id={janela.id} aoFechar={() => setJanela(null)} />}
      {janela?.tipo === 'historico' && <Historico caso={c} hoje={hoje} aoFechar={() => setJanela(null)} />}
      {fichaDasTranscricoes && (
        <Transcricoes
          ficha={fichaDasTranscricoes}
          perfil={juridico ? 'juridico' : 'atendimento'}
          aoFechar={() => setFichaDasTranscricoes(null)}
          aoMudar={async () => setFichaDasTranscricoes(await obterFicha(c.ficha.id))}
        />
      )}
      {janela?.tipo === 'documento' && <Documento doc={janela.doc} caso={c} hoje={hoje} aoFechar={() => setJanela(null)} />}
    </>
  )
}

/** Link para outra tela só se o perfil abre essa tela: sem permissão, o link some; o texto, se houver, fica. */
function LinkSePode({ href, className, texto = null, antes, children }: { href: string; className?: string; texto?: ReactNode; antes?: string; children: ReactNode }) {
  return usePodeAbrir(href) ? (
    <>
      {antes}
      <a className={className} href={href}>
        {children}
      </a>
    </>
  ) : (
    <>{texto}</>
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
              {dataCurta(diaLocal(ev.quando), hoje)} · {ev.quem} ({AUTOR[ev.tipo]})
              {ev.peloChat && ' · feito pelo chat'}
            </span>
            <span>{semCodigo(ev.oQue)}</span>
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
      {!doc.href ? (
        <p className={base.nota}>O arquivo abre no Drive do cliente (simulado).</p>
      ) : (
        !d.aviso && (
          <AbrirDocumento href={doc.href} nome="o arquivo" className={proprio.secundario}>
            Abrir o arquivo
          </AbrirDocumento>
        )
      )}
    </dialog>
  )
}
