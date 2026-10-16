import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react'
import { formatarDecimal, isoParaData, normalizarData, validarData } from '@ggv/campos'
import { RAIO_X, RECORTES, RECORTES_DA_JURIMETRIA, ROTULO_RECORTE, type Indicador, type PainelDeResultados } from '@ggv/contratos'
import { chamarApi, type Resposta } from '../api.ts'
import { usePode } from '../sessao.ts'
import { MolduraDaBase } from './Base.tsx'
import styles from './Passo.module.css'
import r from './Resultados.module.css'

const SUBTITULO =
  'Cada número vem dos desfechos gravados no portal, com o número de casos e a data da base. Não há amostra mínima: toda amostra conta.'

const casos = (n: number) => `${n} ${n === 1 ? 'caso' : 'casos'}`
type Base = Extract<PainelDeResultados['baseDoAcervo'], { situacao: 'com_dados' }>
/** GGVP-55 CA3: os totais e a data da base em uso; os que aguardam conferência ficam fora das contas. */
const textoDaBase = (b: Base) =>
  `${b.processos} processos · ${b.conferidos} conferidos, nas contas · ${b.aguardandoConferencia} aguardando conferência, fora das contas · base de ${isoParaData(b.dataDaBase)}`
const reais = (valor: string) => `R$ ${formatarDecimal(Number(valor))}`
const pct = (taxa: number) => `${Math.round(taxa * 100)}%`

/** O número com os casos e a data da base (CA1, CA8, G22 de 07/10); sem nenhum caso, "sem dados ainda" (CA5). */
function texto(i: Indicador, base: string) {
  if (i.unidade === 'casos') return `${i.rotulo}: ${casos(i.casos)}`
  if (i.situacao === 'sem_dados' || i.valor === null) return `${i.rotulo}: sem dados ainda`
  return `${i.rotulo}: ${i.unidade === 'taxa' ? pct(i.valor) : `${Math.round(i.valor)} dias`} em ${casos(i.casos)} · base de ${base}`
}

/** O mesmo texto de `texto`, em partes: o número grande e o resto embaixo. Quem lê a linha inteira ouve igual. */
function partes(i: Indicador, base: string): { valor: string; nota: string; vazio: boolean } {
  if (i.unidade === 'casos') return { valor: String(i.casos), nota: ` ${i.casos === 1 ? 'caso' : 'casos'}`, vazio: false }
  if (i.situacao === 'sem_dados' || i.valor === null) return { valor: 'sem dados ainda', nota: '', vazio: true }
  return { valor: i.unidade === 'taxa' ? pct(i.valor) : `${Math.round(i.valor)} dias`, nota: ` em ${casos(i.casos)} · base de ${base}`, vazio: false }
}

/** O " · " ou ": " entre as partes de uma linha: fica no texto lido, some da tela, onde quem separa é o desenho. */
const Sep = ({ t }: { t: string }) => <span className={r.sep}>{t}</span>

/** Um número do painel: o nome, o valor grande, os casos e a base; a taxa ganha a régua de 0 a 100%. */
function Numero({ i, base }: { i: Indicador; base: string }) {
  const p = partes(i, base)
  return (
    <li className={r.numero} data-vazio={p.vazio || undefined}>
      <span className={r.numeroNome}>{i.rotulo}</span>
      <Sep t=": " />
      <strong className={r.numeroValor}>{p.valor}</strong>
      {p.nota && <span className={r.numeroNota}>{p.nota}</span>}
      {i.unidade === 'taxa' && i.valor !== null && (
        <span className={r.regua} aria-hidden="true">
          <span style={{ width: pct(i.valor) }} />
        </span>
      )}
    </li>
  )
}

type Barra = { nome: string; sep: string; quanto: string; valor: number; depois?: ReactNode }

/** Uma lista em barras, cada uma do tamanho do seu número diante do maior da lista. */
function Barras({ rotulo, itens, tom = 'acento' }: { rotulo: string; itens: Barra[]; tom?: 'acento' | 'advogada' | 'erro' }) {
  const maior = Math.max(1, ...itens.map((b) => b.valor))
  return (
    <ul className={r.barras} aria-label={rotulo} data-tom={tom}>
      {itens.map((b) => (
        <li key={b.nome} className={r.barra}>
          <span className={r.barraNome}>{b.nome}</span>
          <Sep t={b.sep} />
          <span className={r.barraQuanto}>{b.quanto}</span>
          {b.depois}
          <span className={r.trilho} aria-hidden="true">
            <span style={{ width: `${Math.max(2, (b.valor / maior) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** "9% → 25% → 36%": a série do Raio-X em degraus, o último em destaque. */
function Serie({ valor }: { valor: string }) {
  const passos = valor.split(' → ')
  if (passos.length < 2) return <strong className={r.raioValor}>{valor}</strong>
  return (
    <span className={r.serie}>
      {passos.map((p, n) => (
        <span key={n}>
          {n > 0 && <span className={r.seta}> → </span>}
          <span className={n === passos.length - 1 ? r.serieUltimo : r.serieAntes}>{p}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * Painel de resultado para os sócios (GGVP-75): o servidor calcula tudo a partir dos desfechos gravados (CA7) e só manda
 * os totais em dinheiro a quem pode ver (CA4). A tela não esconde nada sozinha. Só a gestão vê. Como tela inicial do
 * Sócio (GGVP-78, perfis.md), `topo` traz a busca, o chat e a fila, no lugar do "Voltar ao início".
 * Refeito em 11/10 como painel: os números grandes, as barras dos motivos e do Raio-X e a comparação dos pareceres.
 */
export function Resultados({ topo }: { topo?: ReactNode }) {
  const ids = { de: useId(), ate: useId(), recorte: useId() }
  // GGVP-156 CA3: os recortes por perito, juízo, vara e tese são jurimetria: só o Jurídico e o Sócio. O servidor recusa também.
  const veJurimetria = usePode('estudo.ver')
  // Mateus (13/10): a taxa de êxito de cada advogada, só os sócios.
  const vePorAdvogada = usePode('resultados.ver_por_advogada')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [recorte, setRecorte] = useState('')
  const [painel, setPainel] = useState<PainelDeResultados | null>(null)
  const [erro, setErro] = useState('')

  function mostrar(resposta: Resposta<PainelDeResultados>) {
    if (!resposta.ok) return setErro(resposta.erro)
    setErro('')
    setPainel(resposta.dados)
    setDe(isoParaData(resposta.dados.periodo.de) ?? '')
    setAte(isoParaData(resposta.dados.periodo.ate) ?? '')
  }

  useEffect(() => {
    void chamarApi<PainelDeResultados>('/gestao/resultados').then(mostrar)
  }, [])

  function aplicar(e: FormEvent) {
    e.preventDefault()
    if (!validarData(de) || !validarData(ate)) return setErro('Informe as datas em dd/mm/aaaa.')
    void chamarApi<PainelDeResultados>(`/gestao/resultados?${new URLSearchParams({ de, ate, ...(recorte && { recorte }) })}`).then(mostrar)
  }

  const base = isoParaData(painel?.periodo.ate) ?? ''
  const [dispensa, suficiente] = [painel?.pareceres.exitoComDispensa.valor ?? null, painel?.pareceres.exitoComSuficiente.valor ?? null]
  const diferenca = dispensa !== null && suficiente !== null ? Math.round((dispensa - suficiente) * 100) : null

  const corpo = (
    <>
      <form className={r.periodo} onSubmit={aplicar} noValidate aria-label="Período e recorte">
        <div className={r.filtro}>
          <label className={styles.rotulo} htmlFor={ids.de}>
            De
          </label>
          <input
            id={ids.de}
            className={styles.campo}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={de}
            aria-invalid={de && !validarData(de) ? true : undefined}
            onChange={(e) => setDe(normalizarData(e.target.value))}
          />
        </div>
        <div className={r.filtro}>
          <label className={styles.rotulo} htmlFor={ids.ate}>
            Até
          </label>
          <input
            id={ids.ate}
            className={styles.campo}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={ate}
            aria-invalid={ate && !validarData(ate) ? true : undefined}
            onChange={(e) => setAte(normalizarData(e.target.value))}
          />
        </div>
        <div className={`${r.filtro} ${r.filtroLargo}`}>
          <label className={styles.rotulo} htmlFor={ids.recorte}>
            Recorte
          </label>
          <select id={ids.recorte} className={styles.campo} value={recorte} onChange={(e) => setRecorte(e.target.value)}>
            <option value="">Escritório inteiro</option>
            {RECORTES.filter((x) => (veJurimetria || !RECORTES_DA_JURIMETRIA.includes(x)) && (vePorAdvogada || x !== 'advogada')).map((x) => (
              <option key={x} value={x}>
                {ROTULO_RECORTE[x]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={styles.botao}>
          Ver resultados
        </button>
      </form>

      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      {painel && (
        <>
          <section className={r.bloco} aria-labelledby="operacao">
            <div className={r.blocoCabeca}>
              <h2 id="operacao" className={r.blocoTitulo}>
                Operação · {isoParaData(painel.periodo.de)} a {isoParaData(painel.periodo.ate)}
              </h2>
              <p className={r.blocoSub}>Os casos do portal decididos no período. Cada número diz em quantos casos se apoia.</p>
            </div>
            {painel.operacao === 'sem_dados' ? (
              <p className={r.vazio}>Sem dados ainda: nenhum caso decidido no período.</p>
            ) : (
              <ul className={r.numeros} aria-label="Indicadores do escritório">
                {painel.indicadores.map((i) => (
                  <Numero key={i.chave} i={i} base={base} />
                ))}
              </ul>
            )}
          </section>

          <div className={r.grade}>
            <section className={`${r.cartao} ${painel.extincoes.casos ? r.cartaoAlerta : ''}`}>
              <h2 className={r.cartaoTitulo}>Extinções sem mérito · a meta é zero</h2>
              {painel.extincoes.casos === 0 ? (
                <>
                  <p className={r.destaqueOk}>0</p>
                  <p className={styles.dica}>Nenhuma extinção sem mérito no período.</p>
                </>
              ) : (
                <>
                  <p className={r.destaque}>
                    <strong>{painel.extincoes.casos}</strong>
                    <span className={r.destaqueDe}>
                      {painel.extincoes.casos} de {painel.extincoes.decididos} decididos no período
                    </span>
                  </p>
                  <Barras
                    rotulo="Extinções por causa"
                    tom="erro"
                    itens={painel.extincoes.porCausa.map((c) => ({ nome: c.causa, sep: ' · ', quanto: casos(c.casos), valor: c.casos }))}
                  />
                </>
              )}
            </section>

            <section className={r.cartao}>
              <h2 className={r.cartaoTitulo}>Pareceres médicos dispensados</h2>
              <ul className={r.comparacao} aria-label="Pareceres dispensados">
                <li className={r.comparacaoTopo}>
                  Dispensados pela Sênior no período: <strong>{painel.pareceres.dispensados}</strong>
                </li>
                {[painel.pareceres.exitoComDispensa, painel.pareceres.exitoComSuficiente].map((i, n) => (
                  <li key={i.chave} className={r.comparacaoLinha} data-lado={n === 0 ? 'dispensa' : 'suficiente'}>
                    <span className={r.comparacaoTexto}>{texto(i, base)}</span>
                    <span className={r.trilho} aria-hidden="true">
                      <span style={{ width: i.valor === null ? '0%' : pct(i.valor) }} />
                    </span>
                  </li>
                ))}
                {diferenca !== null && (
                  <li className={r.diferenca} data-sinal={diferenca < 0 ? 'menos' : 'mais'}>
                    Diferença: {diferenca > 0 ? `+${diferenca}` : diferenca} pontos
                  </li>
                )}
              </ul>
            </section>

            {painel.totais && (
              <section className={r.cartao}>
                <h2 className={r.cartaoTitulo}>Valores do escritório</h2>
                <ul className={r.valores} aria-label="Valores do escritório">
                  <li>
                    <span className={r.valoresNome}>Honorários recebidos</span>
                    <Sep t=": " />
                    <strong className={r.valoresValor}>{reais(painel.totais.honorariosRecebidos)}</strong>
                    <span className={r.valoresNota}>
                      {' · '}
                      {painel.totais.recebimentos} {painel.totais.recebimentos === 1 ? 'recebimento' : 'recebimentos'}
                    </span>
                  </li>
                </ul>
              </section>
            )}

            <section className={`${r.cartao} ${r.cartaoLargo}`}>
              <h2 className={r.cartaoTitulo}>Motivos mais comuns</h2>
              <p className={styles.dica}>Indeferimento: o motivo que consta no sistema do INSS. Derrota: a causa registrada no caso improcedente ou extinto.</p>
              <div className={r.motivos}>
                {(
                  [
                    ['Motivos de indeferimento', 'Indeferimento', painel.motivos.indeferimento, 'Nenhum indeferimento no período.', 'advogada'],
                    ['Motivos de derrota', 'Derrota', painel.motivos.derrota, 'Nenhuma derrota no período.', 'erro'],
                  ] as const
                ).map(([nome, curto, lista, vazio, tom]) => (
                  <div key={nome} className={r.motivo}>
                    <h3 className={r.motivoTitulo}>{curto}</h3>
                    {lista.length === 0 ? (
                      <p className={styles.dica}>{vazio}</p>
                    ) : (
                      <Barras rotulo={nome} tom={tom} itens={lista.map((m) => ({ nome: m.motivo, sep: ' · ', quanto: casos(m.casos), valor: m.casos }))} />
                    )}
                  </div>
                ))}
              </div>
            </section>

            {painel.recorte && (
              <section className={`${r.cartao} ${r.cartaoLargo}`}>
                <h2 className={r.cartaoTitulo}>Por {ROTULO_RECORTE[painel.recorte.por].toLowerCase()}</h2>
                {painel.recorte.grupos.length === 0 && <p className={styles.dica}>Nenhum caso com esse dado no período.</p>}
                <div className={r.grupos}>
                  {painel.recorte.grupos.map((gr) => (
                    <ul key={gr.nome} className={r.grupo} aria-label={gr.nome}>
                      <li className={r.grupoNome}>
                        <strong>{gr.nome}</strong>
                      </li>
                      {gr.indicadores.map((i) => (
                        <li key={i.chave} className={r.grupoLinha}>
                          {texto(i, base)}
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}

      <section className={r.referencia} aria-labelledby="raio-x">
        <div className={r.blocoCabeca}>
          <h2 id="raio-x" className={r.blocoTitulo}>
            Raio-X Previdenciário · referência
          </h2>
          <p className={r.blocoSub}>
            {RAIO_X.processos} processos lidos, gerado em {isoParaData(RAIO_X.geradoEm)}. Só os agregados.
          </p>
        </div>
        <ul className={r.raio} aria-label="Raio-X Previdenciário">
          {RAIO_X.indicadores.map((i) => (
            <li key={i.rotulo} className={r.raioItem}>
              <span className={r.raioNome}>{i.rotulo}</span>
              <Sep t=": " />
              <Serie valor={i.valor} />
            </li>
          ))}
        </ul>

        <div className={r.dupla}>
          <section className={r.cartao}>
            <h2 className={r.cartaoTitulo}>O que o cartório mais cobra na inicial · Raio-X</h2>
            <p className={styles.dica}>
              Certidões de irregularidade em {RAIO_X.cartorioCobra.processos} processos. Cada item vira checklist de distribuição.
            </p>
            <Barras
              rotulo="O que o cartório mais cobra na inicial"
              tom="advogada"
              itens={RAIO_X.cartorioCobra.itens.map((i) => ({ nome: i.item, sep: ': ', quanto: String(i.vezes), valor: i.vezes }))}
            />
          </section>

          <section className={r.cartao}>
            <h2 className={r.cartaoTitulo}>Onde julgam · Raio-X</h2>
            <p className={styles.dica}>Foro pelo código de origem do CNJ. Êxito sobre o total do foro.</p>
            <Barras
              rotulo="Onde julgam"
              itens={RAIO_X.ondeJulgam.map((f) => ({
                nome: f.foro,
                sep: ': ',
                quanto: `${f.processos} processos`,
                valor: f.processos,
                depois: (
                  <span className={r.exito}>
                    <Sep t=" · " />
                    êxito {f.exito}
                  </span>
                ),
              }))}
            />
          </section>
        </div>

        <section className={r.base}>
          <h2 className={r.cartaoTitulo}>Base do acervo</h2>
          <p className={styles.dica}>{painel?.baseDoAcervo.situacao === 'com_dados' ? textoDaBase(painel.baseDoAcervo) : 'Sem dados ainda.'}</p>
        </section>
      </section>
    </>
  )

  // Pela Gestão, o topo de toda tela; como tela inicial do Sócio, quem traz o topo é o InicioDoSocio.
  if (!topo)
    return (
      <MolduraDaBase ativo="resultados" titulo="Resultados do escritório" subtitulo={SUBTITULO}>
        {corpo}
      </MolduraDaBase>
    )
  return (
    <main className={r.pagina}>
      <title>Resultados · GGV Previdenciário</title>
      <h1 className={styles.titulo}>Resultados do escritório</h1>
      <p className={styles.subtitulo}>{SUBTITULO}</p>
      {topo}
      {corpo}
    </main>
  )
}
