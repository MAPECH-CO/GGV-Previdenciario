import { type FormEvent, useEffect, useId, useState } from 'react'
import { formatarDecimal, isoParaData, normalizarData, validarData } from '@ggv/campos'
import { RAIO_X, RECORTES, ROTULO_RECORTE, type Indicador, type PainelDeResultados } from '@ggv/contratos'
import { chamarApi, type Resposta } from '../api.ts'
import styles from './Passo.module.css'

const casos = (n: number) => `${n} ${n === 1 ? 'caso' : 'casos'}`
type Base = Extract<PainelDeResultados['baseDoAcervo'], { situacao: 'com_dados' }>
/** GGVP-55 CA3: os totais e a data da base em uso; os que aguardam conferência ficam fora das contas. */
const textoDaBase = (b: Base) =>
  `${b.processos} processos · ${b.conferidos} conferidos, nas contas · ${b.aguardandoConferencia} aguardando conferência, fora das contas · base de ${isoParaData(b.dataDaBase)}`
const reais = (valor: string) => `R$ ${formatarDecimal(Number(valor))}`

/** O número com os casos e a data da base (CA1, CA8, G22 de 07/10); sem nenhum caso, "sem dados ainda" (CA5). */
function texto(i: Indicador, base: string) {
  if (i.unidade === 'casos') return `${i.rotulo}: ${casos(i.casos)}`
  if (i.situacao === 'sem_dados' || i.valor === null) return `${i.rotulo}: sem dados ainda`
  return `${i.rotulo}: ${i.unidade === 'taxa' ? `${Math.round(i.valor * 100)}%` : `${Math.round(i.valor)} dias`} em ${casos(i.casos)} · base de ${base}`
}

/**
 * Painel de resultado para os sócios (GGVP-75): o servidor calcula tudo a partir dos desfechos gravados (CA7) e só manda
 * os totais em dinheiro a quem pode ver (CA4). A tela não esconde nada sozinha. Só a gestão vê.
 */
export function Resultados() {
  const ids = { de: useId(), ate: useId(), recorte: useId() }
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [recorte, setRecorte] = useState('')
  const [painel, setPainel] = useState<PainelDeResultados | null>(null)
  const [erro, setErro] = useState('')

  function mostrar(r: Resposta<PainelDeResultados>) {
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setPainel(r.dados)
    setDe(isoParaData(r.dados.periodo.de) ?? '')
    setAte(isoParaData(r.dados.periodo.ate) ?? '')
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

  return (
    <main className={styles.pagina}>
      <title>Resultados · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Resultados do escritório</h1>
      <p className={styles.subtitulo}>
        Cada número vem dos desfechos gravados no portal, com o número de casos e a data da base. Não há amostra mínima: toda amostra conta (G22).
      </p>

      <form className={styles.cartao} onSubmit={aplicar} noValidate aria-label="Período e recorte">
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
        <label className={styles.rotulo} htmlFor={ids.recorte}>
          Recorte
        </label>
        <select id={ids.recorte} className={styles.campo} value={recorte} onChange={(e) => setRecorte(e.target.value)}>
          <option value="">Escritório inteiro</option>
          {RECORTES.map((r) => (
            <option key={r} value={r}>
              {ROTULO_RECORTE[r]}
            </option>
          ))}
        </select>
        <div className={styles.acoes}>
          <button type="submit" className={styles.botao}>
            Ver resultados
          </button>
        </div>
      </form>

      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      {painel && (
        <>
          <section className={styles.cartao}>
            <h2 className={styles.cartaoTitulo}>
              Operação · {isoParaData(painel.periodo.de)} a {isoParaData(painel.periodo.ate)}
            </h2>
            {painel.operacao === 'sem_dados' ? (
              <p className={styles.dica}>Sem dados ainda: nenhum caso decidido no período.</p>
            ) : (
              <ul className={styles.lista} aria-label="Indicadores do escritório">
                {painel.indicadores.map((i) => (
                  <li key={i.chave}>{texto(i, base)}</li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.cartao}>
            <h2 className={styles.cartaoTitulo}>Extinções sem mérito · a meta é zero</h2>
            {painel.extincoes.casos === 0 ? (
              <p className={styles.dica}>Nenhuma extinção sem mérito no período.</p>
            ) : (
              <>
                <span className={styles.seloAlerta}>
                  {painel.extincoes.casos} de {painel.extincoes.decididos} decididos no período
                </span>
                <ul className={styles.lista} aria-label="Extinções por causa">
                  {painel.extincoes.porCausa.map((c) => (
                    <li key={c.causa}>
                      {c.causa} · {casos(c.casos)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={styles.cartao}>
            <h2 className={styles.cartaoTitulo}>Pareceres médicos dispensados</h2>
            <ul className={styles.lista} aria-label="Pareceres dispensados">
              <li>Dispensados pela Sênior no período: {painel.pareceres.dispensados}</li>
              <li>{texto(painel.pareceres.exitoComDispensa, base)}</li>
              <li>{texto(painel.pareceres.exitoComSuficiente, base)}</li>
              {diferenca !== null && <li>Diferença: {diferenca > 0 ? `+${diferenca}` : diferenca} pontos</li>}
            </ul>
          </section>

          {painel.totais && (
            <section className={styles.cartao}>
              <h2 className={styles.cartaoTitulo}>Valores do escritório</h2>
              <ul className={styles.lista} aria-label="Valores do escritório">
                <li>
                  Honorários recebidos: {reais(painel.totais.honorariosRecebidos)} · {painel.totais.recebimentos}{' '}
                  {painel.totais.recebimentos === 1 ? 'recebimento' : 'recebimentos'}
                </li>
                <li>{texto(painel.totais.diasAteReceber, base)}</li>
              </ul>
            </section>
          )}

          {painel.recorte && (
            <section className={styles.cartao}>
              <h2 className={styles.cartaoTitulo}>Por {ROTULO_RECORTE[painel.recorte.por].toLowerCase()}</h2>
              {painel.recorte.grupos.length === 0 && <p className={styles.dica}>Nenhum caso com esse dado no período.</p>}
              {painel.recorte.grupos.map((g) => (
                <ul key={g.nome} className={styles.lista} aria-label={g.nome}>
                  <li>
                    <strong>{g.nome}</strong>
                  </li>
                  {g.indicadores.map((i) => (
                    <li key={i.chave}>{texto(i, base)}</li>
                  ))}
                </ul>
              ))}
            </section>
          )}
        </>
      )}

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Raio-X Previdenciário · referência</h2>
        <p className={styles.dica}>
          {RAIO_X.processos} processos lidos, gerado em {isoParaData(RAIO_X.geradoEm)}. Só os agregados.
        </p>
        <ul className={styles.lista} aria-label="Raio-X Previdenciário">
          {RAIO_X.indicadores.map((i) => (
            <li key={i.rotulo}>
              {i.rotulo}: {i.valor}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>O que o cartório mais cobra na inicial · Raio-X</h2>
        <p className={styles.dica}>
          Certidões de irregularidade em {RAIO_X.cartorioCobra.processos} processos. Cada item vira checklist de distribuição.
        </p>
        <ul className={styles.lista} aria-label="O que o cartório mais cobra na inicial">
          {RAIO_X.cartorioCobra.itens.map((i) => (
            <li key={i.item}>
              {i.item}: {i.vezes}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Onde julgam · Raio-X</h2>
        <p className={styles.dica}>Foro pelo código de origem do CNJ. Êxito sobre o total do foro.</p>
        <ul className={styles.lista} aria-label="Onde julgam">
          {RAIO_X.ondeJulgam.map((f) => (
            <li key={f.foro}>
              {f.foro}: {f.processos} processos · êxito {f.exito}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Base do acervo</h2>
        <p className={styles.dica}>{painel?.baseDoAcervo.situacao === 'com_dados' ? textoDaBase(painel.baseDoAcervo) : 'Sem dados ainda.'}</p>
      </section>
    </main>
  )
}
