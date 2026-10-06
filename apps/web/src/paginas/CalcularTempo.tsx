import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterCalculo, registrarCalculo, type DadosDoCalculo } from '../dados/calculo.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import { agora } from '../dados/servidor.ts'
import type { Calculo, Cnis } from '../dados/tipos.ts'
import { REGRAS_DE_APOSENTADORIA, errosDoCalculo, motivoParaConcluir, paraRegistro, pontosFalados, tempoFalado, type ValoresDoCalculo } from '../regras/calculo.ts'
import { dataCurta, dataHora, hojeIso, idadeEm } from '../regras/datas.ts'
import { soNumeroEMascara } from '../regras/formularios.ts'
import styles from './Balcao.module.css'
import proprio from './CalcularTempo.module.css'

// Figma: step_D1.13 "Calcular tempo e pontos" (14:159). Feito por pessoa: o advogado do setor de atendimento calcula sobre
// o CNIS e registra; nenhum número vem da IA (G19). A decisão "Já pode se aposentar?" fica no painel, como no desenho.

const VAZIO: ValoresDoCalculo = { anos: '', meses: '', dias: '', pontos: '', regra: '', podeAposentar: '', dataPrevista: '', conferi: false }
const REGRAS = REGRAS_DE_APOSENTADORIA.map((r) => ({ id: r, nome: r }))

const mesAno = (aaaaMm: string) => `${aaaaMm.slice(5, 7)}/${aaaaMm.slice(0, 4)}`
const deOnde = (cnis: Cnis, hoje: string) =>
  `CNIS ${cnis.origem === 'meu-inss' ? 'baixado do Meu INSS' : 'trazido impresso pelo cliente'} · extraído em ${dataCurta(cnis.extraidoEm, hoje)}`

function resultado(c: Calculo, hoje: string): string {
  return c.podeAposentar ? 'já pode se aposentar' : `ainda não: previsto para ${dataCurta(c.dataPrevista!, hoje)}`
}

export function CalcularTempo({ agendamentoId }: { agendamentoId: string }) {
  const [dados, setDados] = useState<DadosDoCalculo | null | undefined>(undefined)
  const [v, setV] = useState<ValoresDoCalculo>(VAZIO)
  const [tocados, setTocados] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState<Calculo | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterCalculo(agendamentoId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Calcular tempo e pontos · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo o cálculo…'}</h1>
        {dados === null && <a href="/">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, cnis, exige } = dados
  const beneficio = ficha.beneficioDefinido?.beneficio
  const erros = errosDoCalculo(v, hoje)
  const parado = !cnis ? 'Sem CNIS no caso.' : motivoParaConcluir(v, hoje)
  const idade = ficha.nascimento ? `${idadeEm(ficha.nascimento, hoje)} anos (pela data de nascimento, calculada por código)` : 'sem data de nascimento na ficha'
  const anteriores = [...(ficha.calculos ?? [])].reverse()

  const mudar = (campo: keyof ValoresDoCalculo, valor: string | boolean) => setV((x) => ({ ...x, [campo]: valor }))
  const sair = (campo: string) => setTocados((t) => new Set(t).add(campo))
  const erroDe = (campo: keyof ValoresDoCalculo) => (tocados.has(campo) ? erros[campo] : undefined)

  async function concluir() {
    const registro = paraRegistro(v, hoje)
    if (travado.current || !registro || !cnis) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const r = await registrarCalculo(agendamentoId, registro)
      setDados((d) => d && { ...d, ficha: r.ficha })
      setFeito(r.ficha.calculos!.at(-1)!)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  function refazer() {
    setFeito(null)
    setV(VAZIO)
    setTocados(new Set())
  }

  return (
    <>
      <title>{`${ficha.nome} · Calcular tempo e pontos · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Advogado do atendimento" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.13 · Calcular tempo e pontos (passo do BPMN)">
                D1.13
              </span>
              <span className={proprio.perfil}>Advogado do atendimento</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Calcular tempo e pontos
            </h1>
            <p className={styles.subtitulo}>{cnis ? deOnde(cnis, hoje) : 'sem CNIS no caso'}</p>
          </div>

          {!exige ? (
            <section className={styles.cartao} aria-labelledby="nao-se-aplica">
              <h2 id="nao-se-aplica" className={styles.cartaoTitulo}>
                Este passo não se aplica
              </h2>
              <p className={proprio.texto}>
                {beneficio
                  ? `${nomeBeneficio(beneficio)} não exige cálculo: o caso segue para «O cliente fechou com o escritório?» (D1.14).`
                  : 'O benefício do caso ainda não foi definido pela advogada (D1.12).'}
              </p>
              {!beneficio && (
                <a className={styles.atalho} href={`/entrevista/${agendamentoId}/beneficio`}>
                  Definir o benefício (D1.12)
                </a>
              )}
            </section>
          ) : (
            <>
              {!cnis && (
                <p className={proprio.alerta} role="alert">
                  Sem CNIS no caso: peça o impresso ao cliente ou baixe do Meu INSS (a senha fica no cofre, G9).
                </p>
              )}
              {cnis && (
                <section className={styles.cartao} aria-labelledby="cnis">
                  <h2 id="cnis" className={styles.cartaoTitulo}>
                    CNIS do caso · {nomeBeneficio(beneficio)}
                  </h2>
                  <ul className={proprio.vinculos} aria-label="Vínculos do CNIS">
                    {cnis.vinculos.map((x) => (
                      <li key={`${x.empresa}-${x.inicio}`}>
                        <span>{x.empresa}</span>
                        <span className={proprio.periodo}>
                          {mesAno(x.inicio)} a {x.fim ? mesAno(x.fim) : 'em aberto'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.nota}>A base do cálculo: confira cada vínculo antes de concluir.</p>
                </section>
              )}

              {feito ? (
                <section className={styles.feito} aria-labelledby="calculo-registrado">
                  <h2 id="calculo-registrado" className={styles.feitoTitulo}>
                    ✓ Cálculo registrado: {tempoFalado(feito.tempo)}, {pontosFalados(feito.pontos)} pontos
                  </h2>
                  <p>
                    {feito.podeAposentar
                      ? 'Já pode se aposentar. O caso segue para «O cliente fechou com o escritório?» (D1.14).'
                      : `Ainda não pode se aposentar: previsto para ${dataCurta(feito.dataPrevista!, hoje)}. O caso segue para «Registrar o motivo» (D1.14), com a data prevista.`}
                  </p>
                  <p>Ficou registrado o tempo, os pontos, a regra e quem conferiu, com o CNIS usado.</p>
                  <div className={styles.atalhos}>
                    <button type="button" className={styles.atalho} onClick={refazer}>
                      Refazer o cálculo
                    </button>
                    <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                      Abrir a ficha do cliente
                    </a>
                    <a className={styles.atalho} href="/">
                      Voltar ao início
                    </a>
                  </div>
                </section>
              ) : (
                <>
                  <section className={styles.cartao} aria-labelledby="calculo">
                    <h2 id="calculo" className={styles.cartaoTitulo}>
                      O cálculo sobre o CNIS
                    </h2>
                    <fieldset className={proprio.grupo}>
                      <legend className={proprio.legenda}>Tempo de contribuição *</legend>
                      <div className={proprio.linha}>
                        {(['anos', 'meses', 'dias'] as const).map((c) => (
                          <Campo
                            key={c}
                            id={`calculo-${c}`}
                            rotulo={c.charAt(0).toUpperCase() + c.slice(1)}
                            valor={v[c]}
                            aoMudar={(x) => mudar(c, soNumeroEMascara(x).replace(/\D/g, ''))}
                            aoSair={() => sair(c)}
                            erro={erroDe(c)}
                            inputMode="numeric"
                            maxLength={2}
                          />
                        ))}
                      </div>
                    </fieldset>
                    <div className={proprio.linha}>
                      <Campo
                        id="calculo-pontos"
                        rotulo="Pontos *"
                        valor={v.pontos}
                        aoMudar={(x) => mudar('pontos', x.replace(/[^\d,]/g, ''))}
                        aoSair={() => sair('pontos')}
                        erro={erroDe('pontos')}
                        inputMode="decimal"
                        maxLength={6}
                        placeholder="ex.: 92,5"
                      />
                      <Campo id="calculo-regra" rotulo="Regra aplicada *" valor={v.regra} aoMudar={(x) => mudar('regra', x)} opcoes={REGRAS} largo />
                    </div>
                    <dl className={proprio.linhas}>
                      <div className={proprio.item}>
                        <dt>Idade</dt>
                        <dd>{idade}</dd>
                      </div>
                      <div className={proprio.item}>
                        <dt>Regra</dt>
                        <dd>informada pelo advogado, conferida com o CNIS; nunca pela IA (G19)</dd>
                      </div>
                    </dl>
                    {v.podeAposentar === 'nao' && (
                      <Campo
                        id="calculo-data-prevista"
                        rotulo="Data prevista em que poderá se aposentar *"
                        valor={v.dataPrevista}
                        aoMudar={(x) => mudar('dataPrevista', soNumeroEMascara(x))}
                        aoSair={() => sair('dataPrevista')}
                        erro={erroDe('dataPrevista')}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="dd/mm/aaaa"
                      />
                    )}
                    <label className={proprio.conferencia}>
                      <input type="checkbox" checked={v.conferi} onChange={(e) => mudar('conferi', e.target.checked)} />
                      Conferi o cálculo com o CNIS
                    </label>
                  </section>

                  <div className={styles.rodape}>
                    <button type="button" className={styles.principalBotao} disabled={parado !== null || salvando} onClick={concluir}>
                      {salvando ? 'registrando…' : 'Concluir'}
                    </button>
                    {parado && <p className={styles.motivo}>{parado}</p>}
                    {erro && (
                      <p role="alert" className={styles.motivo}>
                        {erro}
                      </p>
                    )}
                  </div>
                </>
              )}

              {anteriores.length > (feito ? 1 : 0) && (
                <section className={styles.cartao} aria-labelledby="anteriores">
                  <h2 id="anteriores" className={styles.cartaoTitulo}>
                    Cálculos anteriores
                  </h2>
                  <ul className={proprio.anteriores}>
                    {anteriores.slice(feito ? 1 : 0).map((c) => (
                      <li key={c.quando}>
                        <span className={proprio.periodo}>
                          {dataHora(c.quando)} · {c.quem}
                        </span>
                        <span>
                          {tempoFalado(c.tempo)}, {pontosFalados(c.pontos)} pontos, {c.regra}; {resultado(c, hoje)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.nota}>Refazer não apaga o cálculo anterior: ele fica aqui e no histórico.</p>
                </section>
              )}
            </>
          )}
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.13.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <div className={styles.decisao}>
            <p id="ja-pode">Já pode se aposentar?</p>
            <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="ja-pode">
              <button
                type="button"
                role="radio"
                className={styles.chip}
                aria-checked={v.podeAposentar === 'sim'}
                disabled={!exige || feito !== null}
                onClick={() => mudar('podeAposentar', 'sim')}
              >
                Sim
              </button>
              <button
                type="button"
                role="radio"
                className={styles.chip}
                aria-checked={v.podeAposentar === 'nao'}
                disabled={!exige || feito !== null}
                onClick={() => mudar('podeAposentar', 'nao')}
              >
                Ainda não
              </button>
            </div>
          </div>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p>Conferir: Conferi o cálculo com o CNIS</p>
          <p className={styles.ladoSub}>«Concluir» só habilita com as decisões respondidas e as conferências marcadas.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>«Ainda não»: o caso vai para «Registrar o motivo» (D1.14) com a data prevista. «Sim»: segue para o fechamento.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
