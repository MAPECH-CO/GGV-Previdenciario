import { useEffect, useId, useState } from 'react'
import { ConcluirIdaAoBanco, type LevarAoBancoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

/**
 * Levar ao banco (GGVP-98, Atendimento; P3 do roteiro de 09/10): a visita que o Financeiro marcou, com o cliente, a data, a
 * hora, o local e o que levar, sem nenhum valor. "Levei o cliente ao banco" fecha a tarefa; "Não deu", com o motivo, volta
 * ao Financeiro remarcar.
 */
export function LevarAoBanco({ casoId }: { casoId: string }) {
  const idMotivo = useId()
  const [v, setV] = useState<LevarAoBancoDoCaso | null>(null)
  const [naoDeu, setNaoDeu] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<LevarAoBancoDoCaso>(`/casos/${casoId}/banco/levar`).then((r) => (r.ok ? setV(r.dados) : setErro(r.erro)))
  }, [casoId])

  async function concluir(corpo: object) {
    const entrada = ConcluirIdaAoBanco.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/casos/${casoId}/banco/levar`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(
      entrada.data.resultado === 'levado'
        ? 'Registrado. O Financeiro recebeu a tarefa de confirmar o recebimento.'
        : 'Registrado. A ida ao banco voltou para o Financeiro remarcar.',
    )
  }

  if (!v)
    return (
      <main className={styles.pagina}>
        <title>Levar ao banco · GGV Previdenciário</title>
        <a className={styles.voltar} href="/">
          ← Voltar ao início
        </a>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Levar ao banco · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Levar ao banco</h1>
      <p className={styles.subtitulo}>{v.cliente}</p>

      <section className={styles.cartao} aria-label="Ida ao banco">
        <h2 className={styles.cartaoTitulo}>Marcada pelo Financeiro</h2>
        <ul className={styles.lista}>
          <li>
            {v.data} às {v.hora}
          </li>
          <li>{v.local}</li>
          <li>Quem leva: {v.acompanhante ?? '—'}</li>
        </ul>
      </section>

      <section className={styles.cartao} aria-label="O que levar">
        <h2 className={styles.cartaoTitulo}>O que o cliente leva</h2>
        <ul className={styles.lista}>
          {v.oQueLevar.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

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

      {!feito && (
        <section className={styles.cartao} aria-label="Registrar">
          {naoDeu && (
            <>
              <label className={styles.rotulo} htmlFor={idMotivo}>
                Por que não deu
              </label>
              <textarea id={idMotivo} className={styles.campo} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </>
          )}
          <div className={styles.acoes}>
            {!naoDeu && (
              <button type="button" className={styles.botao} onClick={() => void concluir({ resultado: 'levado' })}>
                Levei o cliente ao banco
              </button>
            )}
            <button type="button" className={styles.botaoSecundario} onClick={() => (naoDeu ? void concluir({ resultado: 'nao_deu', motivo }) : setNaoDeu(true))}>
              {naoDeu ? 'Confirmar: não deu' : 'Não deu'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
