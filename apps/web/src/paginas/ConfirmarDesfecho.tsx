import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { formatarCnj, isoParaData } from '@ggv/campos'
import {
  ConfirmarDesfecho as Entrada,
  DESFECHOS_DE_MERITO,
  FORMAS_DE_PAGAMENTO_JUDICIAL,
  ROTULO_DESFECHO_DE_MERITO,
  ROTULO_BENEFICIO,
  ROTULO_FORMA_DE_PAGAMENTO_JUDICIAL,
  ehProcedente,
  type Beneficio,
  type DesfechoParaConfirmar,
} from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { InstrucoesPasso } from '../componentes/InstrucoesPasso.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { usePerfil } from '../dados/perfis.ts'
import passo from './Balcao.module.css'
import proprio from './Parecer.module.css'
import styles from './Passo.module.css'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const ROTULO_LEITURA: Record<string, string> = { merito: 'decisão de mérito', exigencia: 'exigência do juiz', andamento: 'andamento' }

/**
 * Confirmar o desfecho de mérito (GGVP-90, CA3 e CA4; passo D4.02). A advogada lê o trecho da decisão e a leitura da IA
 * e confirma; a IA só sugere. Procedente segue para "Acompanhar pagamento"; improcedente e extinção, para "Decidir recurso", da Sênior.
 */
export function ConfirmarDesfecho({ casoId }: { casoId: string }) {
  const ids = { causa: useId(), pergunta: useId(), forma: useId() }
  const perfil = usePerfil('Advogada')
  const [d, setD] = useState<DesfechoParaConfirmar | null>(null)
  const [versao, setVersao] = useState(0)
  const [desfecho, setDesfecho] = useState('')
  const [causa, setCausa] = useState('')
  const [forma, setForma] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<DesfechoParaConfirmar>(`/casos/${casoId}/desfecho`).then((x) => (x.ok ? setD(x.dados) : setErro(x.erro)))
  }, [casoId, versao])

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = Entrada.safeParse({
      desfecho: desfecho || undefined,
      ...(desfecho === 'extinto_sem_merito' && { causa }),
      ...(ehProcedente(desfecho) && forma && { forma }),
    })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o desfecho.')
    const x = await chamarApi(`/casos/${casoId}/desfecho`, { method: 'POST', corpo: entrada.data })
    if (!x.ok) return setErro(x.erro)
    setErro('')
    setFeito(ehProcedente(entrada.data.desfecho) ? 'Desfecho confirmado. Nasceu "Acompanhar pagamento".' : 'Desfecho confirmado. Nasceu "Decidir recurso" para a Sênior, com o prazo do recurso.')
    setVersao((v) => v + 1)
  }

  if (!d)
    return (
      <main className={styles.pagina}>
        <title>Confirmar desfecho · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const beneficio = d.beneficio ? (ROTULO_BENEFICIO[d.beneficio as Beneficio] ?? d.beneficio) : 'a definir'
  const publicadaEm = isoParaData(d.decisao?.disponibilizadaEm)?.slice(0, 5)
  return (
    <>
      <title>{`${d.cliente} · Confirmar desfecho · GGV Previdenciário`}</title>
      <TopoPasso contexto={d.cliente.split(' ')[0]} inicio={perfil?.inicio ?? '/advogada'} />
      <main className={passo.pagina}>
        <div className={passo.principal}>
          <div className={passo.cabecalho}>
            <div className={passo.chips}>
              <span className={passo.codigo} title="D4.02 · Confirmar o desfecho de mérito (passo do BPMN)">
                D4.02
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={passo.titulo}>
              <strong>{d.cliente}</strong> · Confirmar desfecho
            </h1>
            <p className={passo.subtitulo}>{publicadaEm ? `sentença publicada ${publicadaEm} · mérito` : 'a decisão de mérito não está no sistema'}</p>
          </div>
          <InstrucoesPasso beneficio={beneficio} de={d.cliente} fichaId={d.fichaId} processoId={casoId} funcao="Jurídico">
            Confirme o resultado da sentença. A leitura da IA não avança o fluxo sem a sua confirmação.
          </InstrucoesPasso>

          {feito && (
            <p className={styles.sucesso} role="status">
              {feito}
            </p>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}

          {d.decisao ? (
            <section className={styles.cartao} aria-label="Decisão de mérito">
              <dl className={styles.linhas}>
                <dt>Processo</dt>
                <dd>{d.decisao.numeroCnj ? formatarCnj(d.decisao.numeroCnj) : 'sem o número no sistema'}</dd>
                <dt>Trecho</dt>
                <dd>"…{d.decisao.texto}…"</dd>
                {d.decisao.classeSugeridaIa && (
                  <>
                    <dt>Leitura da IA</dt>
                    <dd>
                      {ROTULO_LEITURA[d.decisao.classeSugeridaIa] ?? d.decisao.classeSugeridaIa}
                      {d.decisao.confiancaIa !== null && ` · confiança de ${Math.round(d.decisao.confiancaIa * 100)}%`}
                    </dd>
                  </>
                )}
                {d.prazoRecurso && (
                  <>
                    <dt>Prazo do recurso</dt>
                    <dd>{isoParaData(d.prazoRecurso)}</dd>
                  </>
                )}
              </dl>
            </section>
          ) : (
            <p className={styles.dica}>A decisão de mérito não está no sistema. Confira no processo antes de confirmar.</p>
          )}

          {d.confirmado ? (
            <section className={styles.cartao} aria-label="Desfecho confirmado">
              <h2 className={styles.cartaoTitulo}>✓ {ROTULO_DESFECHO_DE_MERITO[d.confirmado.desfecho]}</h2>
              {d.confirmado.forma && <p className={styles.dica}>Pagamento por {ROTULO_FORMA_DE_PAGAMENTO_JUDICIAL[d.confirmado.forma]}</p>}
              {d.confirmado.causa && <p className={styles.dica}>Causa: {d.confirmado.causa}</p>}
              <p className={styles.dica}>
                Confirmado por {d.confirmado.por} em {quando(d.confirmado.em)}
              </p>
            </section>
          ) : d.podeConfirmar ? (
            <form onSubmit={confirmar} noValidate>
              <section className={styles.cartao} aria-labelledby={ids.pergunta}>
                <h2 className={styles.cartaoTitulo} id={ids.pergunta}>
                  A ação foi procedente?
                </h2>
                <div className={passo.opcoes} role="radiogroup" aria-labelledby={ids.pergunta}>
                  {DESFECHOS_DE_MERITO.map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={desfecho === x} className={passo.chip} onClick={() => setDesfecho(x)}>
                      {ROTULO_DESFECHO_DE_MERITO[x]}
                    </button>
                  ))}
                </div>
                {ehProcedente(desfecho) && (
                  <>
                    <p className={styles.rotulo} id={ids.forma}>
                      Forma de pagamento (se já se sabe)
                    </p>
                    <div className={passo.opcoes} role="radiogroup" aria-labelledby={ids.forma}>
                      {FORMAS_DE_PAGAMENTO_JUDICIAL.map((x) => (
                        <button key={x} type="button" role="radio" aria-checked={forma === x} className={passo.chip} onClick={() => setForma(x)}>
                          {ROTULO_FORMA_DE_PAGAMENTO_JUDICIAL[x]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {desfecho === 'extinto_sem_merito' && (
                  <>
                    <label className={styles.rotulo} htmlFor={ids.causa}>
                      Causa da extinção
                    </label>
                    <textarea id={ids.causa} className={styles.campo} rows={2} value={causa} onChange={(e) => setCausa(e.target.value)} />
                  </>
                )}
              </section>
              <div className={styles.acoes}>
                <button type="submit" className={passo.principalBotao}>
                  Confirmar
                </button>
              </div>
            </form>
          ) : (
            <p className={styles.dica}>O desfecho espera a confirmação da advogada.</p>
          )}
        </div>
        <aside className={passo.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={passo.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={passo.ladoSub}>Desfecho de mérito (D4.02): a vigília traz a decisão, a IA lê, e a advogada confirma.</p>
          <h3 className={passo.ladoSecao}>O que a IA fez</h3>
          <ul className={passo.ladoLista}>
            <li>• Leu a decisão e sugeriu a classe, com a confiança</li>
            <li>• Não escolhe o resultado: quem confirma é você</li>
          </ul>
          <h3 className={passo.ladoSecao}>O que vem depois</h3>
          <p className={passo.ladoSub}>
            Procedente: nasce "Acompanhar pagamento". Improcedente ou extinto sem mérito: a Sênior recebe "Decidir recurso", com o prazo do
            recurso.
          </p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
