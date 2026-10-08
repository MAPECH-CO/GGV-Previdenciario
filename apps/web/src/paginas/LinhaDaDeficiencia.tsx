import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { isoParaData, normalizarData } from '../campos.ts'
import { nomeTipo } from '../dados/catalogos.ts'
import { obterLinhaDoTempo, salvarDeficiencia, textoDoEnquadramento, type LinhaDoTempo } from '../dados/deficiencia.ts'
import { doJuridico } from '../dados/parecer.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { tempoFalado } from '../regras/calculo.ts'
import { dataHora, hojeIso } from '../regras/datas.ts'
import { GRAUS, MINIMO_COM_DEFICIENCIA, SEXOS, motivoParaNaoSalvar, paraDados, tempo, type Grau, type Periodo, type Sexo, type ValoresDaDeficiencia } from '../regras/deficiencia.ts'
import styles from './Balcao.module.css'
import proprio from './Deficiencia.module.css'
import parecer from './Parecer.module.css'

// Sem quadro da linha do tempo no Figma: o mais próximo é a exigência do INSS da Aposentadoria PCD (1581:764 e 1581:418,
// "grau moderado · 20 anos · calculado por código (G19)") e o step_D1.13 (14:159). Tela da advogada (GGVP-42).

const FAIXAS: Record<string, string> = { ...GRAUS, sem: 'sem deficiência' }
const mesAno = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const duracao = (dias: number) => tempoFalado(tempo(dias))

function valoresDe(l: LinhaDoTempo): ValoresDaDeficiencia {
  const d = l.dados
  return {
    inicio: d ? (isoParaData(d.inicio) ?? '') : '',
    grau: d?.grau ?? '',
    sexo: d?.sexo ?? '',
    agravamentos: d?.agravamentos.map((g) => ({ data: isoParaData(g.data) ?? '', grau: g.grau })) ?? [],
  }
}

/** Os períodos agrupados por vínculo, na ordem do CNIS: cada vínculo vem partido em sequência. */
function porVinculo(ps: Periodo[]): Periodo[][] {
  const grupos: Periodo[][] = []
  for (const p of ps) {
    const ultimo = grupos.at(-1)
    if (ultimo?.[0].empresa === p.empresa) ultimo.push(p)
    else grupos.push([p])
  }
  return grupos
}

export function LinhaDaDeficiencia({ processoId }: { processoId: string }) {
  const perfil = usePerfil('Advogada')
  const juridico = doJuridico(perfil?.id)
  const [l, setL] = useState<LinhaDoTempo | null | undefined>(undefined)
  const [valores, setValores] = useState<ValoresDaDeficiencia | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterLinhaDoTempo(processoId).then((x) => {
      if (!valendo) return
      setL(x)
      if (x) setValores(valoresDe(x))
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!l || !valores) {
    return (
      <main className={parecer.vazia}>
        <title>Linha do tempo da deficiência · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{l === null ? 'Caso não encontrado' : 'Abrindo a linha do tempo…'}</h1>
        {l === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, processo, beneficio, cnis, dados, periodos, enquadramento: e } = l
  const motivo = motivoParaNaoSalvar(valores, hoje)
  const mudar = (parte: Partial<ValoresDaDeficiencia>) => setValores({ ...valores, ...parte })
  const mudarAgravamento = (i: number, parte: Partial<ValoresDaDeficiencia['agravamentos'][number]>) =>
    mudar({ agravamentos: valores.agravamentos.map((g, j) => (j === i ? { ...g, ...parte } : g)) })
  const insalubres = periodos.filter((p) => p.grau && p.insalubre)
  const semProva = periodos.filter((p) => p.semProva)

  async function salvar() {
    const novos = paraDados(valores!, hoje)
    if (travado.current || !novos) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const depois = await salvarDeficiencia(processoId, novos, { perfil: perfil?.id, nome: perfil?.usuario ?? 'Advogada' })
      setL(depois)
      setValores(valoresDe(depois))
      setAviso('Dados da deficiência salvos: a linha do tempo e o enquadramento foram recalculados.')
    } catch (x) {
      setErro(x instanceof Error ? x.message : 'Não deu para salvar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Linha do tempo da deficiência · GGV Previdenciário`}</title>
      <TopoPasso contexto={`${processo.numero ? `Processo ${processo.numero} · ` : ''}${ficha.nome.split(' ')[0]}`} inicio={perfil?.inicio ?? '/advogada'} />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.13 · Calcular tempo e pontos (passo do BPMN)">
                D1.13
              </span>
              <span className={styles.codigo} title="D1.21M · Analisar a documentação médica (passo do BPMN)">
                D1.21M
              </span>
              <span className={parecer.advogada}>Advogada</span>
              <span className={styles.beneficio}>◆ {beneficio}</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Linha do tempo da deficiência
            </h1>
            <p className={styles.subtitulo}>
              {cnis ? `CNIS ${cnis.origem === 'meu-inss' ? 'baixado do Meu INSS' : 'trazido impresso'} · extraído em ${isoParaData(cnis.extraidoEm)}` : 'sem CNIS no caso'}
              {dados && ` · deficiência desde ${isoParaData(dados.inicio)}`}
            </p>
          </div>

          {!juridico ? (
            <p className={styles.aviso} role="status">
              A linha do tempo da deficiência é do Jurídico: dado de saúde só aparece para a advogada. Você está como {perfil?.rotulo ?? 'outro perfil'}.
            </p>
          ) : (
            <>
              <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
                <div className={styles.instrucoesTopo}>
                  <span className={styles.estrela} aria-hidden="true">
                    ✦
                  </span>
                  <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
                    O que você deve fazer
                  </h2>
                  <span className={styles.beneficio}>◆ {beneficio}</span>
                  <span className={styles.instrucoesDe}>· {ficha.nome}</span>
                </div>
                <p className={styles.instrucoesTexto}>
                  Confira se a deficiência de {ficha.nome.split(' ')[0]} está provada em cada período de contribuição e no grau certo. Registre o início, o grau e os
                  agravamentos com a data: cada vínculo do CNIS se parte sozinho. Período com deficiência sem documento da época aparece em laranja: é o que pedir.
                </p>
                <p className={styles.nota}>O tempo e o enquadramento são calculados por código, nunca pela IA (G19).</p>
              </section>

              {aviso && (
                <p role="status" className={styles.aviso}>
                  {aviso}
                </p>
              )}

              <section className={styles.cartao} aria-labelledby="dados">
                <h2 id="dados" className={styles.cartaoTitulo}>
                  Dados da deficiência
                </h2>
                <div className={proprio.campos}>
                  <label className={proprio.campo}>
                    Início da deficiência *
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="dd/mm/aaaa"
                      value={valores.inicio}
                      onChange={(x) => mudar({ inicio: x.target.value })}
                      onBlur={() => mudar({ inicio: normalizarData(valores.inicio) })}
                    />
                  </label>
                  <label className={proprio.campo}>
                    Grau no início *
                    <select value={valores.grau} onChange={(x) => mudar({ grau: x.target.value as Grau | '' })}>
                      <option value="">Escolha…</option>
                      {(Object.keys(GRAUS) as Grau[]).map((g) => (
                        <option key={g} value={g}>
                          {GRAUS[g]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={proprio.campo}>
                    Sexo para a contagem (LC 142) *
                    <select value={valores.sexo} onChange={(x) => mudar({ sexo: x.target.value as Sexo | '' })}>
                      <option value="">Escolha…</option>
                      {(Object.keys(SEXOS) as Sexo[]).map((s) => (
                        <option key={s} value={s}>
                          {SEXOS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <h3 className={parecer.secao}>Agravamentos</h3>
                {valores.agravamentos.length === 0 && <p className={parecer.detalhe}>Nenhum agravamento registrado.</p>}
                <ol className={proprio.agravamentos} aria-label="Agravamentos">
                  {valores.agravamentos.map((g, i) => (
                    <li key={i} className={proprio.campos}>
                      <label className={proprio.campo}>
                        Data do agravamento
                        <input
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="dd/mm/aaaa"
                          value={g.data}
                          onChange={(x) => mudarAgravamento(i, { data: x.target.value })}
                          onBlur={() => mudarAgravamento(i, { data: normalizarData(g.data) })}
                        />
                      </label>
                      <label className={proprio.campo}>
                        Novo grau
                        <select value={g.grau} onChange={(x) => mudarAgravamento(i, { grau: x.target.value as Grau | '' })}>
                          <option value="">Escolha…</option>
                          {(Object.keys(GRAUS) as Grau[]).map((grau) => (
                            <option key={grau} value={grau}>
                              {GRAUS[grau]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className={proprio.tirar} onClick={() => mudar({ agravamentos: valores.agravamentos.filter((_, j) => j !== i) })}>
                        Tirar
                      </button>
                    </li>
                  ))}
                </ol>
                <button type="button" className={styles.atalho} onClick={() => mudar({ agravamentos: [...valores.agravamentos, { data: '', grau: '' }] })}>
                  + Agravamento
                </button>
                <div className={styles.rodape}>
                  <button type="button" className={styles.principalBotao} disabled={motivo !== null || salvando} onClick={salvar}>
                    {salvando ? 'salvando…' : 'Salvar os dados da deficiência'}
                  </button>
                  {motivo && <p className={styles.motivo}>{motivo}</p>}
                </div>
                {dados && (
                  <p className={parecer.detalhe}>
                    Registrado por {dados.quem} em {dataHora(dados.quando)}.
                  </p>
                )}
                {erro && (
                  <p role="alert" className={styles.motivo}>
                    {erro}
                  </p>
                )}
              </section>

              <section className={styles.cartao} aria-labelledby="linha">
                <h2 id="linha" className={styles.cartaoTitulo}>
                  Linha do tempo · vínculos do CNIS
                </h2>
                <p className={proprio.legenda} aria-label="Legenda">
                  <span className={proprio.amostra} data-faixa="sem" /> sem deficiência
                  <span className={proprio.amostra} data-faixa="leve" /> leve
                  <span className={proprio.amostra} data-faixa="moderada" /> moderada
                  <span className={proprio.amostra} data-faixa="grave" /> grave
                  <span className={proprio.amostra} data-sem-prova="true" /> sem prova da época
                </p>
                {!cnis ? (
                  <p className={parecer.detalhe}>O caso ainda não tem CNIS: baixe do Meu INSS ou peça o impresso ao cliente.</p>
                ) : !dados ? (
                  <p className={parecer.detalhe}>Registre o início e o grau da deficiência para partir os vínculos.</p>
                ) : (
                  <ol className={proprio.vinculos} aria-label="Vínculos do CNIS">
                    {porVinculo(periodos).map((grupo) => (
                      <li key={`${grupo[0].empresa}-${grupo[0].inicio}`} className={proprio.vinculo}>
                        <p className={proprio.vinculoTopo}>
                          <strong>{grupo[0].empresa}</strong> · {mesAno(grupo[0].inicio)} a {mesAno(grupo.at(-1)!.fim)}
                          {grupo[0].indicadorPcd && <span className={proprio.selo}>indicador PCD no CNIS</span>}
                          {grupo[0].insalubre && <span className={proprio.selo}>atividade insalubre</span>}
                        </p>
                        <div className={proprio.barra} aria-hidden="true">
                          {grupo.map((p) => (
                            <span key={p.inicio} className={proprio.trecho} data-faixa={p.grau ?? 'sem'} data-sem-prova={p.semProva || undefined} style={{ flexGrow: p.dias }} />
                          ))}
                        </div>
                        <ul className={proprio.periodos} aria-label={`Períodos em ${grupo[0].empresa}`}>
                          {grupo.map((p) => (
                            <li key={p.inicio} className={proprio.periodo} data-sem-prova={p.semProva || undefined}>
                              <span>
                                {isoParaData(p.inicio)} a {isoParaData(p.fim)} · {duracao(p.dias)} ·{' '}
                                <strong>{p.grau ? `com deficiência · ${GRAUS[p.grau]}` : 'sem deficiência'}</strong>
                              </span>
                              {p.semProva ? (
                                <span className={proprio.semProva}>sem prova da época</span>
                              ) : (
                                p.provas.length > 0 && (
                                  <span className={parecer.detalhe}>
                                    Da época: {p.provas.map((x) => `${x.descricao || nomeTipo(x.tipo)} (${isoParaData(x.data)})`).join(' · ')}
                                  </span>
                                )
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                )}
                {semProva.length > 0 && (
                  <p className={styles.trava}>
                    {semProva.length === 1 ? '1 período' : `${semProva.length} períodos`} com deficiência sem prova da época: peça laudo, atestado, ASO ou a
                    contratação por cota daquele tempo.
                  </p>
                )}
                {insalubres.length > 0 && (
                  <p className={parecer.detalhe}>
                    {insalubres.length === 1 ? '1 período' : `${insalubres.length} períodos`} com deficiência em atividade insalubre: informativo importante para o
                    processo.
                  </p>
                )}
              </section>

              <section className={styles.cartao} aria-labelledby="enquadramento">
                <h2 id="enquadramento" className={styles.cartaoTitulo}>
                  Enquadramento dos períodos PCD (G19)
                </h2>
                {!e ? (
                  <p className={parecer.detalhe}>Sem período com deficiência nos vínculos: não há enquadramento.</p>
                ) : (
                  <>
                    <p className={proprio.resumo}>{textoDoEnquadramento(e)}</p>
                    <table className={parecer.comparacao} aria-labelledby="enquadramento">
                      <thead>
                        <tr>
                          <th scope="col">Período</th>
                          <th scope="col">Tempo</th>
                          <th scope="col">Fator para {GRAUS[e.preponderante]}</th>
                          <th scope="col">Convertido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {e.faixas.map((f) => (
                          <tr key={f.faixa}>
                            <th scope="row">{FAIXAS[f.faixa]}</th>
                            <td>{duracao(f.dias)}</td>
                            <td>{f.fator.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td>{duracao(f.convertidos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <dl className={proprio.totais}>
                      <dt>Grau preponderante</dt>
                      <dd>{GRAUS[e.preponderante]} (o de mais tempo com deficiência)</dd>
                      <dt>Tempo convertido</dt>
                      <dd>{duracao(e.convertido)}</dd>
                      <dt>Mínimo da LC 142 para {SEXOS[dados!.sexo]}</dt>
                      <dd>{e.minimo} anos</dd>
                      <dt>Falta</dt>
                      <dd>{e.falta === 0 ? 'nada: já tem o tempo' : duracao(e.falta)}</dd>
                      <dt>Tempo como pessoa com deficiência (mínimo de {MINIMO_COM_DEFICIENCIA} anos)</dt>
                      <dd>
                        {duracao(e.comDeficiencia)}
                        {e.faltaComDeficiencia === 0 ? ': já tem o mínimo' : `: faltam ${duracao(e.faltaComDeficiencia)}`}
                      </dd>
                    </dl>
                    {l.cenarios.length > 0 && (
                      <>
                        <h3 id="cenarios" className={styles.cartaoTitulo}>
                          Todos os cenários
                        </h3>
                        <p className={parecer.detalhe}>
                          Na entrevista o escritório calcula os três graus: trabalha com qualquer grau que tenha chance de ser comprovado, e o grau efetivo
                          é definido na perícia.
                        </p>
                        <table className={parecer.comparacao} aria-labelledby="cenarios">
                          <thead>
                            <tr>
                              <th scope="col">Se o grau for</th>
                              <th scope="col">Convertido</th>
                              <th scope="col">Mínimo</th>
                              <th scope="col">Falta</th>
                            </tr>
                          </thead>
                          <tbody>
                            {l.cenarios.map((c) => (
                              <tr key={c.grau}>
                                <th scope="row">{GRAUS[c.grau]}</th>
                                <td>{duracao(c.enquadramento.convertido)}</td>
                                <td>{c.enquadramento.minimo} anos</td>
                                <td>{c.enquadramento.falta === 0 ? 'nada: já tem o tempo' : duracao(c.enquadramento.falta)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    <p className={parecer.detalhe}>
                      Calculado por código (LC 142, art. 3º; Decreto 3.048, art. 70-E), nunca pela IA (G19). A mesma conta aparece no parecer e na resposta à
                      exigência do INSS.
                    </p>
                  </>
                )}
              </section>
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede nos passos D1.13 e D1.21M, na Aposentadoria PCD.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Início da deficiência*</li>
            <li>• Grau no início* e agravamentos com a data</li>
            <li>• Sexo para a contagem (LC 142)*</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>Datas em dd/mm/aaaa, nunca futuras; cada agravamento leva a um grau mais grave que o anterior.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>O que estiver sem prova da época vira pedido ao cliente. O enquadramento segue para o parecer e para a exigência do INSS.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
