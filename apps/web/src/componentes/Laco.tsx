import { useId, useState, type FormEvent } from 'react'
import { isoParaData } from '@ggv/campos'
import { DecidirLaco, type Lembrete, type TentativaDoLaco } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { ROTULO_DO_CANAL, dataDe } from './rotulosDoLaco.ts'
import styles from '../paginas/Passo.module.css'

// O laço de cobrança (GGVP-94, G15) nas telas do setor e da Sênior: o lembrete, o histórico e a decisão da Sênior.

/** CA6, CA11: a data do próximo lembrete, para quem, por onde, o modelo e o gatilho. */
export function TextoDoLembrete({ data, lembrete }: { data: string | null; lembrete: Lembrete | null }) {
  if (!data || !lembrete) return null
  return (
    <>
      Próximo lembrete em {isoParaData(data)} · para {lembrete.destinatario} · pela {lembrete.canal} · “{lembrete.modelo}” · {lembrete.gatilho.toLowerCase()}
    </>
  )
}

/** CA3, CA8: cada tentativa e cada decisão, com data, canal, resultado e quem. */
export function HistoricoDoLaco({ historico, rotuloResultado = {} }: { historico: TentativaDoLaco[]; rotuloResultado?: Record<string, string> }) {
  if (!historico.length) return null
  return (
    <ol className={styles.lista} aria-label="Laço de cobrança">
      {historico.map((t, i) => (
        <li key={`${t.quando}-${i}`}>
          {dataDe(t.quando)} · {ROTULO_DO_CANAL[t.canal] ?? t.canal} · {rotuloResultado[t.resultado] ?? t.resultado} · {t.quem}
        </li>
      ))}
    </ol>
  )
}

/** CA9, CA10: a Sênior decide o item que passou do limite. As opções seguem em aberto (Q1): o texto é obrigatório. */
export function DecisaoDoLaco({ url, aoDecidir }: { url: string; aoDecidir: (aviso: string) => void }) {
  const id = useId()
  const [oQueFazer, setOQueFazer] = useState('')
  const [erro, setErro] = useState('')

  async function decidir(e: FormEvent) {
    e.preventDefault()
    const entrada = DecidirLaco.safeParse({ oQueFazer })
    if (!entrada.success) return setErro(entrada.error.issues[0].message)
    const r = await chamarApi<{ proximoLembrete: string | null }>(url, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    aoDecidir(
      r.dados.proximoLembrete
        ? `Decisão registrada. A tarefa voltou ao setor, com o próximo lembrete em ${isoParaData(r.dados.proximoLembrete)}.`
        : 'Decisão registrada. A tarefa voltou ao setor.',
    )
  }

  return (
    <form onSubmit={decidir} noValidate aria-label="Decidir o laço">
      <label className={styles.rotulo} htmlFor={id}>
        O que o setor deve fazer
      </label>
      <textarea id={id} className={styles.campo} rows={2} value={oQueFazer} onChange={(e) => setOQueFazer(e.target.value)} />
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao} disabled={!oQueFazer.trim()}>
          Devolver ao setor
        </button>
      </div>
    </form>
  )
}
