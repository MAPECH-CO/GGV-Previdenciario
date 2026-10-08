import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { dataParaIso, normalizarData } from '../campos.ts'
import { decidirCobranca, obterCobranca, type CobrancaDoCaso } from '../dados/cobranca.ts'
import { agora } from '../dados/servidor.ts'
import { juntar } from '../regras/checklist.ts'
import { CANAIS, DIAS_ENTRE_COBRANCAS, OPCOES_DA_SENIOR, RESULTADOS, TENTATIVAS_DE_COBRANCA, motivoParaNaoDecidir, type OpcaoDaSenior } from '../regras/cobranca.ts'
import { dataCurta, hojeIso, hora } from '../regras/datas.ts'
import styles from './Balcao.module.css'
import proprio from './Cobranca.module.css'

// Figma: step_D1.23 "Cobrança estourou o limite: decidir" (1818:440), tela da advogada sênior (GGVP-101).

export function DecidirCobranca({ processoId }: { processoId: string }) {
  const [c, setC] = useState<CobrancaDoCaso | null | undefined>(undefined)
  const [opcao, setOpcao] = useState<OpcaoDaSenior>()
  const [prazo, setPrazo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [feito, setFeito] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterCobranca(processoId).then((x) => {
      if (valendo) setC(x)
    })
    return () => {
      valendo = false
    }
  }, [processoId])

  if (!c) {
    return (
      <main className={proprio.vazia}>
        <title>Decidir cobrança · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{c === null ? 'Este caso não tem cobrança' : 'Abrindo a cobrança…'}</h1>
        {c === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, beneficio, faltam, cobranca } = c
  const hoje = hojeIso(agora())
  const semResposta = cobranca.tentativas.filter((t) => t.resultado === 'sem-resposta').length
  const isoPrazo = dataParaIso(prazo)
  const motivo = motivoParaNaoDecidir({ opcao, justificativa, prazo: isoPrazo }, hoje)

  async function registrar() {
    if (travado.current || motivo || !opcao) return
    travado.current = true
    setErro('')
    try {
      const depois = await decidirCobranca(processoId, { opcao, justificativa, prazo: opcao === 'nova-tentativa' ? (isoPrazo ?? undefined) : undefined })
      setC(depois)
      setFeito(depois.cobranca.decisoes.at(-1)!.quando)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar a decisão.')
    } finally {
      travado.current = false
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Decidir cobrança · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Sênior" inicio="/advogada" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.23 · Cobrança de pendentes (passo do BPMN)">
                D1.23
              </span>
              <span className={proprio.senior}>Sênior</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Decidir cobrança
            </h1>
            <p className={styles.subtitulo}>
              {beneficio} · {semResposta === 1 ? '1 tentativa' : `${semResposta} tentativas`} sem resposta · limite (G15)
            </p>
          </div>

          <InstrucoesPasso beneficio={beneficio} de={ficha.nome} fichaId={ficha.id}>
            O laço de cobrança atingiu o limite. Registre a decisão; ela volta para o Atendimento.
          </InstrucoesPasso>

          <section className={styles.cartao} aria-label="Laço e pendências">
            <dl className={proprio.linhas}>
              <dt>Laço</dt>
              <dd>Cobrar documentos pendentes (D1.23) · Atendimento</dd>
              <dt>Pendências</dt>
              <dd>{faltam.length > 0 ? juntar(faltam) : 'nada falta'}</dd>
              {cobranca.prazo && (
                <>
                  <dt>Prazo externo</dt>
                  <dd>
                    do {cobranca.prazo.de}, {dataCurta(cobranca.prazo.data, hoje)}
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className={styles.cartao} aria-labelledby="tentativas">
            <h2 id="tentativas" className={styles.cartaoTitulo}>
              Tentativas
            </h2>
            <ul className={proprio.lista} aria-label="Tentativas de cobrança">
              {cobranca.tentativas.map((t, i) => (
                <li key={i}>
                  {dataCurta(t.dia, hoje)} · {CANAIS[t.canal]} · {RESULTADOS[t.resultado]}
                </li>
              ))}
            </ul>
          </section>

          {feito ? (
            <section className={styles.feito} aria-labelledby="decidido">
              <h2 id="decidido" className={styles.feitoTitulo}>
                ✓ Decisão registrada às {hora(feito)}
              </h2>
              <p>
                {OPCOES_DA_SENIOR[cobranca.decisoes.at(-1)!.opcao]}: a decisão voltou para o Atendimento e ficou no histórico da ficha. Entre em contato com o
                cliente.
              </p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href="/advogada">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : c.situacao !== 'na-senior' ? (
            <p className={styles.trava}>Esta cobrança não está esperando a decisão da sênior.</p>
          ) : (
            <>
              <section className={styles.cartao} aria-labelledby="decisao">
                <h2 id="decisao" className={styles.cartaoTitulo}>
                  Decisão
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-labelledby="decisao">
                  {(Object.keys(OPCOES_DA_SENIOR) as OpcaoDaSenior[]).map((o) => (
                    <button key={o} type="button" role="radio" aria-checked={opcao === o} className={styles.opcao} onClick={() => setOpcao(o)}>
                      {OPCOES_DA_SENIOR[o]}
                    </button>
                  ))}
                </div>
                {opcao === 'nova-tentativa' && (
                  <div className={proprio.formulario}>
                    <label>
                      Novo prazo da tentativa
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="dd/mm/aaaa"
                        value={prazo}
                        onChange={(e) => setPrazo(e.target.value)}
                        onBlur={() => setPrazo(normalizarData(prazo))}
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className={styles.cartao}>
                <label className={proprio.formulario} htmlFor="justificativa">
                  Justificativa *
                </label>
                <textarea id="justificativa" className={proprio.justificativa} rows={3} maxLength={500} placeholder="—" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              </section>

              <p className={proprio.nota}>
                Limite: {TENTATIVAS_DE_COBRANCA} tentativas, com {DIAS_ENTRE_COBRANCAS} dias entre elas. Depois da segunda, a sênior resolve e entra em contato com o
                cliente (Lucas, 05/10).
              </p>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivo !== null} onClick={registrar}>
                  Registrar decisão
                </button>
                {motivo && <p className={styles.motivo}>{motivo}</p>}
              </div>
            </>
          )}
          {erro && (
            <p role="alert" className={styles.motivo}>
              {erro}
            </p>
          )}
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
