import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { dataParaIso, isoParaData, normalizarData, validarData } from '../campos.ts'
import { TIPOS_DE_DOCUMENTO, nomeBeneficio, nomeTipo } from '../dados/catalogos.ts'
import {
  arquivarDocumentos,
  documentosLidos,
  liberarDaQuarentena,
  moverDocumento,
  usarNoCadastro,
  type Conferencia,
  type DocumentoLido,
  type RespostaArquivamento,
} from '../dados/leitura.ts'
import { hora } from '../regras/datas.ts'
import {
  ROTULOS_DOS_CAMPOS,
  baixaConfianca,
  compararComCadastro,
  ehMedico,
  motivoParaNaoArquivar,
  valorLegivel,
  type CampoLido,
} from '../regras/leitura.ts'
import styles from './Balcao.module.css'
import proprio from './ConferirDocumentos.module.css'

// Figma: step_D1.18 "Conferir documento" (10:466), no visual das telas de passo. A Documentação abre pela Central do
// Atendimento (GGVP-81).

type Escolha = { tipo: string; /** dd/mm/aaaa */ data: string }
type Movendo = { id: string; processoId: string; motivo: string; erro?: string }

const DECISOES = [
  { id: 'manter', texto: 'Manter os dois' },
  { id: 'descartar', texto: 'Descartar a cópia menos legível' },
] as const

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

export function ConferirDocumentos({ fichaId }: { fichaId: string }) {
  // undefined: abrindo; null: a ficha não existe.
  const [conferencia, setConferencia] = useState<Conferencia | null | undefined>(undefined)
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({})
  const [reclassificar, setReclassificar] = useState(false)
  const [decisao, setDecisao] = useState<'manter' | 'descartar'>()
  const [conferi, setConferi] = useState(false)
  const [movendo, setMovendo] = useState<Movendo | null>(null)
  const [aviso, setAviso] = useState('')
  const [arquivando, setArquivando] = useState(false)
  const [feito, setFeito] = useState<RespostaArquivamento | null>(null)
  const [erro, setErro] = useState('')
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  function aplicar(c: Conferencia | null) {
    setConferencia(c)
    if (c) setEscolhas((atual) => Object.fromEntries(c.documentos.map((d) => [d.id, atual[d.id] ?? { tipo: d.tipo, data: isoParaData(d.data) ?? '' }])))
  }

  useEffect(() => {
    let valendo = true
    documentosLidos(fichaId).then((c) => {
      if (valendo) aplicar(c)
    })
    return () => {
      valendo = false
    }
  }, [fichaId])

  if (!conferencia) {
    return (
      <main className={proprio.vazia}>
        <title>Conferir documento · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{conferencia === null ? 'Ficha não encontrada' : 'Abrindo a conferência…'}</h1>
        {conferencia === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, documentos, destinos } = conferencia
  const recarregar = async () => aplicar(await documentosLidos(fichaId))
  const aConferir = documentos.filter((d) => d.situacao === 'a-conferir')
  const emQuarentena = documentos.filter((d) => d.situacao === 'quarentena')
  const copias = aConferir.filter((d) => d.duplicadoDe)
  const baixas = aConferir.filter((d) => baixaConfianca(d.confianca))
  const escolha = (d: DocumentoLido) => escolhas[d.id] ?? { tipo: d.tipo, data: isoParaData(d.data) ?? '' }
  const datasValidas = aConferir.every((d) => validarData(escolha(d).data))
  const motivoParado = motivoParaNaoArquivar({ aConferir: aConferir.length, duplicados: copias.length, decisao, conferi, datasValidas })
  const beneficio = processo ? nomeBeneficio(processo.beneficio) : ''
  const digital = documentos.length > 0 && documentos.every((d) => d.origem !== 'scanner')
  const loas = processo?.beneficio.startsWith('loas') ?? false
  // A cópia duplicada lê o mesmo que o original: não repete linha na tabela.
  const comparacoes = aConferir.filter((d) => !d.duplicadoDe).flatMap((d) => compararComCadastro(d.lidos, ficha).map((c) => ({ ...c, doc: d })))
  const tipos = [...new Set(aConferir.map((d) => nomeTipo(escolha(d).tipo)))].join(', ')

  function escolher(id: string, mudanca: Partial<Escolha>) {
    setEscolhas((atual) => ({ ...atual, [id]: { ...atual[id], ...mudanca } }))
  }

  async function arquivar() {
    if (travado.current || motivoParado) return
    travado.current = true
    setArquivando(true)
    setErro('')
    try {
      const resposta = await arquivarDocumentos(ficha.id, {
        conferi: true,
        documentos: aConferir.map((d) => ({ id: d.id, tipo: escolha(d).tipo, data: dataParaIso(escolha(d).data) ?? '' })),
        duplicados: copias.length > 0 ? decisao : undefined,
      })
      setFeito(resposta)
      await recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para arquivar.')
    } finally {
      travado.current = false
      setArquivando(false)
    }
  }

  async function usar(id: string, campo: CampoLido) {
    setErro('')
    try {
      const atualizada = await usarNoCadastro(id, campo)
      setConferencia((c) => c && { ...c, ficha: atualizada })
      setAviso(`${ROTULOS_DOS_CAMPOS[campo]} atualizado no cadastro com o que a IA leu.`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para atualizar o cadastro.')
    }
  }

  async function liberar(id: string) {
    setErro('')
    try {
      await liberarDaQuarentena(id)
      setAviso('O documento é deste cliente: voltou para a conferência.')
      await recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para liberar.')
    }
  }

  async function mover() {
    if (!movendo) return
    try {
      const { evento } = await moverDocumento(movendo.id, { processoId: movendo.processoId, motivo: movendo.motivo })
      setMovendo(null)
      setAviso(`${evento.oQue}.`)
      await recarregar()
    } catch (e) {
      setMovendo({ ...movendo, erro: e instanceof Error ? e.message : 'Não deu para mover.' })
    }
  }

  const quarentena = emQuarentena.length > 0 && (
    <section className={styles.cartao} aria-labelledby="quarentena">
      <h2 id="quarentena" className={styles.cartaoTitulo}>
        Em quarentena · não conta no checklist nem vai no protocolo
      </h2>
      <ul className={proprio.quarentena}>
        {emQuarentena.map((d) => (
          <li key={d.id}>
            <span>
              <strong>{nomeTipo(d.tipo)}</strong> · {d.arquivo}
            </span>
            <span className={proprio.motivoQuarentena}>A IA desconfia do dono: {d.quarentena}.</span>
            {movendo?.id === d.id ? (
              <div className={proprio.mover}>
                <label>
                  Para qual caso
                  <select value={movendo.processoId} onChange={(e) => setMovendo({ ...movendo, processoId: e.target.value })}>
                    {destinos.map((c) => (
                      <option key={c.processoId} value={c.processoId}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Motivo (obrigatório)
                  <textarea rows={2} maxLength={300} value={movendo.motivo} onChange={(e) => setMovendo({ ...movendo, motivo: e.target.value, erro: undefined })} />
                </label>
                {movendo.erro && (
                  <p role="alert" className={proprio.motivoQuarentena}>
                    {movendo.erro}
                  </p>
                )}
                <div className={styles.atalhos}>
                  <button type="button" className={styles.atalho} onClick={mover}>
                    Mover
                  </button>
                  <button type="button" className={styles.atalho} onClick={() => setMovendo(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.atalhos}>
                <button type="button" className={styles.atalho} onClick={() => liberar(d.id)}>
                  É deste cliente: liberar
                </button>
                <button
                  type="button"
                  className={styles.atalho}
                  onClick={() => setMovendo({ id: d.id, processoId: (destinos.find((c) => !c.processoId.startsWith(`${ficha.id}-`)) ?? destinos[0])?.processoId ?? '', motivo: '' })}
                >
                  Mover para outro caso
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <>
      <title>{`${ficha.nome} · Conferir documento · GGV Previdenciário`}</title>
      <TopoPasso contexto={`Cliente · ${ficha.nome}`} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.18 · Scanner e leitura dos documentos (passo do BPMN)">
                D1.18
              </span>
              <span className={styles.codigo}>Documentação</span>
              <span className={styles.codigo}>hoje</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Conferir documento
            </h1>
            <p className={styles.subtitulo}>{digital ? 'digitais' : 'digitalizados'} · ler e arquivar</p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id}>
            A IA leu os documentos {digital ? 'que chegaram pelo card' : 'digitalizados'} de {ficha.nome.split(' ')[0]} e sugeriu tipo e
            data de cada um. Abra cada um, confira a leitura e se a imagem está legível.
            {loas && ` Para ${beneficio} o kit precisa de RG e CPF de todos da casa, comprovante de renda e de residência e CadÚnico: o que faltar vai para a cobrança (D1.23).`}{' '}
            Documento médico: confirme que está ok; o conteúdo fica com o Jurídico.
          </InstrucoesPasso>

          {aviso && (
            <p role="status" className={styles.aviso}>
              {aviso}
            </p>
          )}

          {feito ? (
            <section className={styles.feito} aria-labelledby="arquivado">
              <h2 id="arquivado" className={styles.feitoTitulo}>
                ✓ Arquivado às {hora(feito.evento.quando)}
              </h2>
              <p>
                {plural(feito.arquivados, 'documento arquivado', 'documentos arquivados')} na pasta de {ficha.nome} no Drive
                {feito.descartados > 0 && `; ${plural(feito.descartados, 'cópia descartada', 'cópias descartadas')}, com o original guardado`}. A
                conferência ficou no histórico da ficha.
              </p>
              {feito.contrato && <p>O contrato assinado segue para a verificação do contrato.</p>}
              <p>O checklist {beneficio ? `do ${beneficio} ` : ''}foi recalculado com o que entrou.</p>
              {emQuarentena.length > 0 && <p>{plural(emQuarentena.length, 'documento continua', 'documentos continuam')} em quarentena: confira de quem é abaixo.</p>}
              <div className={styles.atalhos}>
                {feito.processoId && (
                  <a className={styles.atalho} href={`/casos/${feito.processoId}/checklist`}>
                    Abrir o checklist
                  </a>
                )}
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : documentos.length === 0 ? (
            <section className={styles.cartao} aria-labelledby="nada">
              <h2 id="nada" className={styles.cartaoTitulo}>
                Nada para conferir
              </h2>
              <p className={proprio.detalhe}>A IA não tem documento lido de {ficha.nome} esperando a Documentação.</p>
            </section>
          ) : (
            aConferir.length > 0 && (
              <>
                <section className={styles.cartao} aria-labelledby="ia-sugere">
                  <h2 id="ia-sugere" className={styles.cartaoTitulo}>
                    A IA sugere · você confere
                  </h2>
                  <p className={styles.aviso}>
                    {digital ? 'O documento chegou digital, pelo card, e a IA leu e classificou.' : 'O scanner digitalizou e a IA leu e classificou.'} Confira e
                    arquive.
                  </p>
                  <dl className={proprio.linhas}>
                    <div className={proprio.linha}>
                      <dt>Classificação</dt>
                      <dd>{tipos}</dd>
                    </div>
                    <div className={proprio.linha}>
                      <dt>Duplicados</dt>
                      <dd>
                        {copias.length === 0
                          ? 'nenhum'
                          : decisao
                            ? DECISOES.find((o) => o.id === decisao)!.texto.toLowerCase()
                            : `${plural(copias.length, 'a decidir', 'a decidir')} no painel ao lado`}
                      </dd>
                    </div>
                    <div className={proprio.linha}>
                      <dt>Baixa confiança</dt>
                      <dd>{baixas.length === 0 ? 'nenhuma' : `${plural(baixas.length, 'para conferir', 'para conferir')} com atenção`}</dd>
                    </div>
                    <div className={proprio.linha}>
                      <dt>Quarentena</dt>
                      <dd>{emQuarentena.length === 0 ? 'nenhum' : plural(emQuarentena.length, 'documento', 'documentos')}</dd>
                    </div>
                  </dl>
                </section>

                <section className={styles.cartao} aria-labelledby="documentos">
                  <h2 id="documentos" className={styles.cartaoTitulo}>
                    {digital ? 'Documentos recebidos' : 'Documentos digitalizados'} (abrir cada um)
                  </h2>
                  <ul className={proprio.documentos} aria-label="Documentos lidos pela IA">
                    {aConferir.map((d) => {
                      const e = escolha(d)
                      const original = d.duplicadoDe && documentos.find((o) => o.id === d.duplicadoDe)
                      const dataInvalida = !validarData(e.data)
                      return (
                        <li key={d.id} className={proprio.documento}>
                          <span className={proprio.icone} aria-hidden="true">
                            ▤
                          </span>
                          <span className={proprio.info}>
                            <span className={proprio.nome}>{nomeTipo(e.tipo)}</span>
                            <span className={proprio.detalhe}>
                              {d.origem === 'scanner' ? 'digitalizado' : 'anexado ao card'} · {e.data || 'sem data'} · confiança {d.confianca}%
                            </span>
                            <span className={proprio.selos}>
                              {baixaConfianca(d.confianca) && <span className={proprio.seloAlerta}>baixa confiança: confira com atenção</span>}
                              {d.duplicadoDe && (
                                <span className={proprio.seloAlerta}>possível duplicado de {original ? nomeTipo(original.tipo) : 'um documento já arquivado'}</span>
                              )}
                              {ehMedico(e.tipo) && <span className={proprio.selo}>documento médico</span>}
                            </span>
                          </span>
                          {reclassificar ? (
                            <span className={proprio.troca}>
                              <select aria-label={`Tipo de ${d.arquivo}`} value={e.tipo} onChange={(ev) => escolher(d.id, { tipo: ev.target.value })}>
                                {TIPOS_DE_DOCUMENTO.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nome}
                                  </option>
                                ))}
                              </select>
                              <input
                                aria-label={`Data de ${d.arquivo}`}
                                inputMode="numeric"
                                maxLength={10}
                                placeholder="dd/mm/aaaa"
                                value={e.data}
                                aria-invalid={dataInvalida || undefined}
                                onChange={(ev) => escolher(d.id, { data: ev.target.value })}
                                onBlur={() => escolher(d.id, { data: normalizarData(e.data) })}
                              />
                            </span>
                          ) : ehMedico(e.tipo) ? (
                            <span className={proprio.detalhe}>o conteúdo fica com o Jurídico</span>
                          ) : (
                            <a className={proprio.abrir} href={`/clientes/${ficha.id}`} aria-label={`Abrir ${nomeTipo(e.tipo)}`}>
                              Abrir
                            </a>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>

                {comparacoes.length > 0 && (
                  <section className={styles.cartao} aria-labelledby="dados-lidos">
                    <h2 id="dados-lidos" className={styles.cartaoTitulo}>
                      Dados lidos pela IA · confira com o cadastro
                    </h2>
                    <table className={proprio.tabela}>
                      <thead>
                        <tr>
                          <th scope="col">Dado</th>
                          <th scope="col">Lido pela IA</th>
                          <th scope="col">No cadastro</th>
                          <th scope="col">
                            <span className="so-leitor">Situação</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparacoes.map((c) => (
                          <tr key={`${c.doc.id}-${c.campo}`} data-situacao={c.situacao}>
                            <th scope="row">
                              {ROTULOS_DOS_CAMPOS[c.campo]} <span className={proprio.detalhe}>· {nomeTipo(c.doc.tipo)}</span>
                            </th>
                            <td>{valorLegivel(c.campo, c.lido)}</td>
                            <td>{c.cadastro ? valorLegivel(c.campo, c.cadastro) : <span className={proprio.vazio}>vazio</span>}</td>
                            <td>
                              {c.situacao === 'igual' ? (
                                <span className={proprio.ok}>✓ igual</span>
                              ) : (
                                <>
                                  {c.situacao === 'diverge' && <span className={proprio.diverge}>diferente do cadastro </span>}
                                  <button
                                    type="button"
                                    className={proprio.usar}
                                    onClick={() => usar(c.doc.id, c.campo)}
                                    aria-label={`Usar no cadastro: ${ROTULOS_DOS_CAMPOS[c.campo]} lido de ${nomeTipo(c.doc.tipo)}`}
                                  >
                                    Usar no cadastro
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className={proprio.detalhe}>O cadastro só muda campo a campo, com «Usar no cadastro». O que mudou fica no histórico.</p>
                  </section>
                )}
              </>
            )
          )}

          {quarentena}

          {!feito && aConferir.length > 0 && (
            <>
              <section className={styles.cartao} aria-labelledby="conferencias">
                <h2 id="conferencias" className={styles.cartaoTitulo}>
                  Conferências
                </h2>
                <label className={proprio.conferencia}>
                  <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
                  Conferi os documentos lidos pela IA
                </label>
              </section>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivoParado !== null || arquivando} onClick={arquivar}>
                  {arquivando ? 'arquivando…' : 'Arquivar'}
                </button>
                <button type="button" className={proprio.secundario} aria-pressed={reclassificar} onClick={() => setReclassificar((r) => !r)}>
                  Reclassificar
                </button>
                {motivoParado && <p className={styles.motivo}>{motivoParado}</p>}
              </div>
            </>
          )}
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.18.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="duplicado">Se a IA apontar documento duplicado: o que fazer?</p>
            {copias.length > 0 ? (
              <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="duplicado">
                {DECISOES.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={decisao === o.id} className={styles.chip} onClick={() => setDecisao(o.id)}>
                    {o.texto}
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.ladoSub}>A IA não apontou duplicado.</p>
            )}
          </div>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <ul className={styles.ladoLista}>
            <li>• Conferir: Conferi os documentos lidos pela IA</li>
            <li>• Documento em quarentena não conta no checklist</li>
          </ul>
          <p className={styles.ladoSub}>«Arquivar» só habilita com as decisões respondidas e as conferências marcadas.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
