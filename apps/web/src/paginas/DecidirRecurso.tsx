import { useEffect, useRef, useState } from 'react'
import { DECISOES_DO_RECURSO, DecidirRecurso as Decisao, ROTULO_DECISAO_DO_RECURSO, type RecursoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import styles from './Balcao.module.css'
import proprio from './Cobranca.module.css'

// Figma: step_D3b.04 "Improcedente: vale recorrer?" (1815:246). Quem decide é a Sênior (Lucas, 07/10); a advogada
// responsável e o Sócio só leem (GGVP-100).

type Escolha = (typeof DECISOES_DO_RECURSO)[number]
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function DecidirRecurso({ casoId }: { casoId: string }) {
  const [r, setR] = useState<RecursoDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [escolha, setEscolha] = useState<Escolha>()
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    void chamarApi<RecursoDoCaso>(`/casos/${casoId}/recurso`).then((x) => (x.ok ? setR(x.dados) : setErro(x.erro)))
  }, [casoId, versao])

  // CA3: o mesmo contrato do servidor diz por que "Registrar" ainda não habilita.
  const entrada = Decisao.safeParse({ decisao: escolha, justificativa })
  const motivo = entrada.success ? null : (entrada.error.issues[0]?.message ?? 'Confira a decisão.')

  async function registrar() {
    if (travado.current || !entrada.success) return
    travado.current = true
    const x = await chamarApi(`/casos/${casoId}/recurso`, { method: 'POST', corpo: entrada.data })
    travado.current = false
    if (!x.ok) return setErro(x.erro)
    setErro('')
    setVersao((v) => v + 1)
  }

  if (!r)
    return (
      <main className={proprio.vazia}>
        <title>Decidir recurso · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{erro || 'Abrindo a decisão…'}</h1>
      </main>
    )

  return (
    <>
      <title>{`${r.cliente} · Decidir recurso · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Sênior" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D3b.04 · Vale recorrer? (passo do BPMN)">
                D3b.04
              </span>
              <span className={proprio.senior}>Sênior</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{r.cliente}</strong> · Decidir recurso
            </h1>
            <p className={styles.subtitulo}>{r.sentenca ? `sentença improcedente ${dataBr(r.sentenca.disponibilizadaEm).slice(0, 5)}` : 'a sentença não está no sistema'}</p>
          </div>

          <InstrucoesPasso beneficio={r.beneficio ?? ''} de={r.cliente} fichaId={r.pessoaId} processoId={r.casoId} funcao="Sênior">
            Decida com justificativa. Sem recurso, a IA gera o estudo de caso, a sênior é avisada e o Atendimento explica o resultado.
          </InstrucoesPasso>

          <section className={styles.cartao} aria-label="Prazo, sentença e chance">
            <dl className={proprio.linhas}>
              <dt>Prazo recursal</dt>
              <dd>
                {r.prazo ? (
                  <>
                    <strong>{dataBr(r.prazo.fim)}</strong> · contado pelo sistema (G12)
                  </>
                ) : (
                  'Sem a sentença no sistema, o prazo não foi contado: confira no processo.'
                )}
              </dd>
              <dt>Sentença</dt>
              <dd>{r.sentenca ? `${dataBr(r.sentenca.disponibilizadaEm)} · ${r.sentenca.texto}` : 'não está no sistema'}</dd>
              <dt>Chance pela jurimetria</dt>
              <dd>{r.chance ? `${r.chance.porcentagem}% em ${r.chance.casos} casos (${r.chance.regra})` : 'A chance pela jurimetria ainda não está disponível para este juízo.'}</dd>
            </dl>
            {r.prazo && <p className={proprio.detalhe}>{r.prazo.regra}</p>}
          </section>

          {r.decisao ? (
            <section className={styles.feito} aria-labelledby="decidido">
              <h2 id="decidido" className={styles.feitoTitulo}>
                ✓ {ROTULO_DECISAO_DO_RECURSO[r.decisao.decisao]}
              </h2>
              <p>
                Decidido por {r.decisao.por} em {quando(r.decisao.em)}. Justificativa: {r.decisao.justificativa}
              </p>
              <p>
                {r.decisao.decisao === 'recorrer'
                  ? 'O processo segue na vigília. A advogada responsável elabora e protocola o recurso até o prazo.'
                  : 'O caso vai ao estudo de caso, feito pela IA, e o resumo para o cliente espera a aprovação do Jurídico.'}
              </p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href="/">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : !r.podeDecidir ? (
            <p className={styles.trava}>A decisão é da Sênior e ainda não foi registrada.</p>
          ) : (
            <>
              <section className={styles.cartao} aria-labelledby="vale-recorrer">
                <h2 id="vale-recorrer" className={styles.cartaoTitulo}>
                  Vale recorrer?
                </h2>
                <div className={styles.opcoes} role="radiogroup" aria-labelledby="vale-recorrer">
                  {DECISOES_DO_RECURSO.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={escolha === d} className={styles.opcao} onClick={() => setEscolha(d)}>
                      {ROTULO_DECISAO_DO_RECURSO[d]}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.cartao}>
                <label className={proprio.formulario} htmlFor="justificativa">
                  Justificativa *
                </label>
                <textarea
                  id="justificativa"
                  className={proprio.justificativa}
                  rows={3}
                  maxLength={2000}
                  placeholder="—"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </section>

              <p className={proprio.nota}>Em aberto: quem elabora e protocola o recurso. Até a resposta, a tarefa vai para a advogada responsável do caso.</p>

              <div className={styles.rodape}>
                <button type="button" className={styles.principalBotao} disabled={motivo !== null} onClick={registrar}>
                  Registrar
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

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D3b.04.</p>
          <h3 className={styles.ladoSecao}>Decisões</h3>
          <ul className={styles.ladoLista}>
            <li>• Sim, recorrer: o processo segue na vigília e a advogada responsável elabora e protocola o recurso</li>
            <li>• Não: a IA faz o estudo de caso e o Atendimento explica o resultado ao cliente</li>
          </ul>
          <h3 className={styles.ladoSecao}>Travas</h3>
          <p className={styles.ladoSub}>
            «Registrar» só habilita com a escolha e a justificativa. O prazo é contado pelo sistema, pelo lado seguro (G12). A porcentagem da chance vem da
            jurimetria, calculada por código: a IA não dá número.
          </p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
