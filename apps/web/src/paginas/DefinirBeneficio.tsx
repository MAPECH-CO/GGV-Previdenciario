import { useEffect, useId, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Campo } from '../componentes/Campo.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { Transcricoes } from '../componentes/Transcricoes.tsx'
import { definirBeneficio, obterDefinicao, type Definicao } from '../dados/beneficio.ts'
import { BENEFICIOS, nomeBeneficio } from '../dados/catalogos.ts'
import { agora } from '../dados/servidor.ts'
import type { Ficha } from '../dados/tipos.ts'
import { requisitosDoBeneficio } from '../regras/beneficio.ts'
import { exigeCalculo } from '../regras/calculo.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './DefinirBeneficio.module.css'

// Figma: step_D1.12 "Definir benefício" (14:123), com a sugestão, a alternativa e a "Decisão da advogada" do Overlay ·
// Entrevista (1581:348). A IA sugere pelo acervo; o benefício que a advogada citou prevalece (G3). Só o Jurídico vê.

const OUTRO = 'outro'
const CATALOGO = BENEFICIOS.filter((b) => b.id !== 'nao-sei')

export function DefinirBeneficio({ agendamentoId }: { agendamentoId: string }) {
  const idMotivo = useId()
  const [dados, setDados] = useState<Definicao | null | undefined>(undefined)
  const [opcao, setOpcao] = useState<string | null>(null)
  const [outro, setOutro] = useState('')
  const [motivo, setMotivo] = useState('')
  const [conferi, setConferi] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [feito, setFeito] = useState<Ficha | null>(null)
  const [erro, setErro] = useState('')
  const [transcricoes, setTranscricoes] = useState(false)
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterDefinicao(agendamentoId).then((d) => {
      if (!valendo) return
      setDados(d)
      // O que a advogada citou já vem escolhido (G3).
      if (d?.sugestao?.citado) setOpcao(d.sugestao.citado)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Definir benefício · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo a definição do benefício…'}</h1>
        {dados === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, sugestao, transcrita } = dados
  const escolhido = opcao === OUTRO ? outro : (opcao ?? '')
  const requisitos = requisitosDoBeneficio(escolhido || sugestao?.sugerido || '', dados.dados, hoje)
  const recusa = sugestao !== undefined && escolhido !== '' && escolhido !== sugestao.sugerido
  const definido = feito?.beneficioDefinido ?? ficha.beneficioDefinido
  const parado = !escolhido ? 'Escolha o benefício.' : !conferi ? 'Confira a recomendação com a entrevista e marque a conferência.' : null

  // As opções da decisão (Figma 1581:348), sem repetir benefício: o citado, o sugerido e a alternativa.
  const opcoes = [
    sugestao?.citado && { id: sugestao.citado, rotulo: `O que você citou: ${nomeBeneficio(sugestao.citado)}` },
    sugestao && { id: sugestao.sugerido, rotulo: `Aceitar: ${nomeBeneficio(sugestao.sugerido)}` },
    sugestao?.alternativa && { id: sugestao.alternativa, rotulo: nomeBeneficio(sugestao.alternativa) },
  ]
    .filter((o): o is { id: string; rotulo: string } => Boolean(o))
    .filter((o, i, todas) => todas.findIndex((x) => x.id === o.id) === i)

  async function confirmar() {
    if (travado.current || parado) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      const r = await definirBeneficio(agendamentoId, { beneficio: escolhido, conferi: true, ...(recusa && motivo.trim() && { motivoDaRecusa: motivo }) })
      setFeito(r.ficha)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não deu para confirmar.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Definir benefício · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Advogada responsável" inicio="/advogada" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.12 · Definir o benefício (passo do BPMN)">
                D1.12
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Definir benefício
            </h1>
            <p className={styles.subtitulo}>com apoio do acervo</p>
          </div>

          <section className={styles.cartao} aria-labelledby="ia-sugere">
            <h2 id="ia-sugere" className={styles.cartaoTitulo}>
              A IA sugere · você confere
            </h2>
            <p className={styles.trava}>A IA sugere pelo acervo (RAG). Se você citar um benefício, o seu prevalece.</p>
            {!transcrita ? (
              <p className={proprio.texto}>
                A entrevista ainda não foi transcrita: a IA compara com o acervo depois da transcrição (D1.11). Você já pode definir o
                benefício pela lista do escritório.
              </p>
            ) : !sugestao ? (
              <p className={proprio.texto}>A IA não achou casos parecidos no acervo. Defina o benefício pela lista do escritório.</p>
            ) : (
              <dl className={proprio.linhas}>
                {sugestao.citado && (
                  <div className={proprio.linha}>
                    <dt>Citado por você</dt>
                    <dd>
                      <strong>{nomeBeneficio(sugestao.citado)}</strong> · prevalece (G3)
                    </dd>
                  </div>
                )}
                <div className={proprio.linha}>
                  <dt>Sugerido</dt>
                  <dd>
                    {nomeBeneficio(sugestao.sugerido)}
                    {sugestao.citado && sugestao.citado !== sugestao.sugerido ? ' · só como sugestão' : ''}
                  </dd>
                </div>
                <div className={proprio.linha}>
                  <dt>Base</dt>
                  <dd>
                    {sugestao.base.length === 0 ? (
                      'nenhum caso parecido no acervo'
                    ) : (
                      <ul className={proprio.base} aria-label="Casos parecidos do acervo">
                        {sugestao.base.map((c) => (
                          <li key={c.id}>
                            <span className={proprio.caso}>
                              {c.titulo} · {nomeBeneficio(c.beneficio)} · {c.resultado}
                            </span>
                            <span className={proprio.resumo}>{c.resumo}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dd>
                </div>
                <div className={proprio.linha}>
                  <dt>Por quê</dt>
                  <dd>{sugestao.porque}</dd>
                </div>
                {sugestao.alternativa && (
                  <div className={proprio.linha}>
                    <dt>Alternativa</dt>
                    <dd>{nomeBeneficio(sugestao.alternativa)}</dd>
                  </div>
                )}
                <div className={proprio.linha}>
                  <dt>Se você citar outro</dt>
                  <dd>prevalece o seu; a sugestão da IA fica só como sugestão (G3)</dd>
                </div>
              </dl>
            )}
            <button type="button" className={styles.atalho} onClick={() => setTranscricoes(true)}>
              ▶ Abrir a transcrição
            </button>
          </section>

          {(escolhido || sugestao) && (
            <section className={styles.cartao} aria-labelledby="requisitos">
              <h2 id="requisitos" className={styles.cartaoTitulo}>
                Requisitos de {nomeBeneficio(escolhido || sugestao?.sugerido)}
              </h2>
              {requisitos.length === 0 ? (
                <p className={proprio.texto}>Este benefício não tem requisito numérico para conferir aqui.</p>
              ) : (
                <ul className={proprio.requisitos}>
                  {requisitos.map((r) => (
                    <li key={r.texto} data-atende={String(r.atende)}>
                      <span aria-hidden="true">{r.atende === null ? '? ' : r.atende ? '✓ ' : '✗ '}</span>
                      {r.texto}
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.nota}>Os números vêm do código, com teste, nunca da IA (G19).</p>
            </section>
          )}

          <p className={styles.trava}>A IA sugere; se a advogada citou um, prevalece o dela (G3).</p>

          {feito ? (
            <section className={styles.feito} aria-labelledby="definido">
              <h2 id="definido" className={styles.feitoTitulo}>
                ✓ Benefício definido: {nomeBeneficio(feito.beneficioDefinido!.beneficio)}
              </h2>
              <p>Ficou registrado quem decidiu, a sugestão exibida e os casos do acervo consultados.</p>
              <p>
                {exigeCalculo(feito.beneficioDefinido!.beneficio)
                  ? 'Depois: «Calcular tempo e pontos» (D1.13), obrigatório antes do fechamento. A tarefa foi para o advogado do atendimento.'
                  : 'Depois: «O cliente fechou com o escritório?» (D1.14).'}
              </p>
              <div className={styles.atalhos}>
                {exigeCalculo(feito.beneficioDefinido!.beneficio) && (
                  <a className={styles.atalho} href={`/entrevista/${agendamentoId}/calculo`}>
                    Abrir o cálculo (D1.13)
                  </a>
                )}
                <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                  Abrir a ficha do cliente
                </a>
                <a className={styles.atalho} href="/advogada">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : (
            <>
              <section className={styles.cartao} aria-labelledby="decisao">
                <h2 id="decisao" className={styles.cartaoTitulo}>
                  Decisão da advogada
                </h2>
                {definido && (
                  <p className={proprio.texto}>
                    Já definido em {dataCurta(definido.quando.slice(0, 10), hoje)}: {nomeBeneficio(definido.beneficio)}. Confirmar de novo
                    troca o benefício, e o anterior fica no histórico. Outro benefício para o mesmo cliente é processo novo (Nova demanda).
                  </p>
                )}
                <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="decisao">
                  {opcoes.map((o) => (
                    <button key={o.id} type="button" role="radio" className={styles.chip} aria-checked={opcao === o.id} onClick={() => setOpcao(o.id)}>
                      {o.rotulo}
                    </button>
                  ))}
                  <button type="button" role="radio" className={styles.chip} aria-checked={opcao === OUTRO} onClick={() => setOpcao(OUTRO)}>
                    Outro benefício
                  </button>
                </div>
                {opcao === OUTRO && <Campo id="outro-beneficio" rotulo="Benefício definido *" valor={outro} aoMudar={setOutro} opcoes={CATALOGO} largo />}
                {recusa && (
                  <div className={proprio.campo}>
                    <label className={proprio.rotulo} htmlFor={idMotivo}>
                      Por que não a sugestão da IA? (fica no histórico)
                    </label>
                    <textarea id={idMotivo} className={proprio.entrada} rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </div>
                )}
                <label className={proprio.conferencia}>
                  <input type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
                  Conferi a recomendação com a entrevista
                </label>
                <p className={styles.nota}>O benefício definido por você segue para o contrato (D1.16), depois do fechamento.</p>
              </section>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={parado !== null || salvando} onClick={confirmar}>
                  {salvando ? 'confirmando…' : 'Confirmar benefício'}
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
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.12.</p>
          <h3 className={styles.ladoSecao}>Campos</h3>
          <ul className={styles.ladoLista}>
            <li>• Benefício definido* (a lista do escritório, a mesma de todo o portal, com LOAS Idoso e LOAS Deficiente separados)</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p>Conferir: Conferi a recomendação com a entrevista</p>
          <p className={styles.ladoSub}>«Confirmar benefício» só habilita com os campos com * preenchidos e as conferências marcadas.</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>
            Um caso, um benefício. Com cálculo: «Calcular tempo e pontos» (D1.13). Sem cálculo: «O cliente fechou com o escritório?»
            (D1.14).
          </p>
        </aside>
      </main>
      <AbaSuporte />
      {transcricoes && <Transcricoes ficha={ficha} perfil="juridico" aoFechar={() => setTranscricoes(false)} />}
    </>
  )
}
