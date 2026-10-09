import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { isoParaData } from '@ggv/campos'
import {
  ConfirmarDesfecho as Entrada,
  DESFECHOS_DE_MERITO,
  FORMAS_DE_PAGAMENTO_JUDICIAL,
  ROTULO_DESFECHO_DE_MERITO,
  ROTULO_FORMA_DE_PAGAMENTO_JUDICIAL,
  ehProcedente,
  type DesfechoParaConfirmar,
} from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const ROTULO_LEITURA: Record<string, string> = { merito: 'decisão de mérito', exigencia: 'exigência do juiz', andamento: 'andamento' }

/**
 * Confirmar o desfecho de mérito (GGVP-90, CA3 e CA4; passo D4.02). A advogada lê o trecho da decisão e a leitura da IA
 * e confirma; a IA só sugere. Procedente segue para "Acompanhar pagamento"; improcedente e extinção, para "Vale recorrer?".
 */
export function ConfirmarDesfecho({ casoId }: { casoId: string }) {
  const ids = { causa: useId() }
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
    setFeito(ehProcedente(entrada.data.desfecho) ? 'Desfecho confirmado. Nasceu "Acompanhar pagamento".' : 'Desfecho confirmado. Nasceu "Vale recorrer?", com o prazo do recurso.')
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

  return (
    <main className={styles.pagina}>
      <title>Confirmar desfecho · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Confirmar o desfecho de mérito</h1>
      <p className={styles.subtitulo}>{d.cliente}</p>
      {d.prazoRecurso && <span className={`${styles.selo} ${styles.seloAlerta}`}>Prazo do recurso: {isoParaData(d.prazoRecurso)}</span>}

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
          <h2 className={styles.cartaoTitulo}>
            Decisão de {isoParaData(d.decisao.disponibilizadaEm)} · {d.decisao.fonte.toUpperCase()}
          </h2>
          <blockquote className={styles.cartao}>{d.decisao.texto}</blockquote>
          {d.decisao.classeSugeridaIa && (
            <p className={styles.dica}>
              Leitura da IA: {ROTULO_LEITURA[d.decisao.classeSugeridaIa] ?? d.decisao.classeSugeridaIa}
              {d.decisao.confiancaIa !== null && ` · confiança de ${Math.round(d.decisao.confiancaIa * 100)}%`}. A IA sugere; quem confirma é você.
            </p>
          )}
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
        <form className={styles.cartao} onSubmit={confirmar} noValidate>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>A ação foi procedente?</legend>
            {DESFECHOS_DE_MERITO.map((x) => (
              <label key={x} className={styles.escolha}>
                <input type="radio" name="desfecho" checked={desfecho === x} onChange={() => setDesfecho(x)} />
                {ROTULO_DESFECHO_DE_MERITO[x]}
              </label>
            ))}
          </fieldset>
          {ehProcedente(desfecho) && (
            <fieldset className={styles.cartao}>
              <legend className={styles.rotulo}>Forma de pagamento (se já se sabe)</legend>
              {FORMAS_DE_PAGAMENTO_JUDICIAL.map((x) => (
                <label key={x} className={styles.escolha}>
                  <input type="radio" name="forma" checked={forma === x} onChange={() => setForma(x)} />
                  {ROTULO_FORMA_DE_PAGAMENTO_JUDICIAL[x]}
                </label>
              ))}
            </fieldset>
          )}
          {desfecho === 'extinto_sem_merito' && (
            <>
              <label className={styles.rotulo} htmlFor={ids.causa}>
                Causa da extinção
              </label>
              <textarea id={ids.causa} className={styles.campo} rows={2} value={causa} onChange={(e) => setCausa(e.target.value)} />
            </>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao}>
              Confirmar desfecho
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.dica}>O desfecho espera a confirmação da advogada.</p>
      )}
    </main>
  )
}
