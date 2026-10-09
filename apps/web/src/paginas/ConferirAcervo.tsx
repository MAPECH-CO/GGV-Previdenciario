import { useEffect, useId, useState } from 'react'
import { formatarCnj } from '@ggv/campos'
import { ConferirDesfecho, DESFECHOS_DO_ACERVO, ROTULO_BENEFICIO, ROTULO_DESFECHO_DO_ACERVO, type Beneficio, type ConferenciaDoAcervo, type DesfechoDoAcervo } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

type Pendente = ConferenciaDoAcervo['pendentes'][number]
const rotulo = (d: string) => ROTULO_DESFECHO_DO_ACERVO[d as DesfechoDoAcervo] ?? d

/** Um processo do lote: confere o desfecho lido, ou corrige (GGVP-55 CA7). */
function ProcessoDoLote({ p, aoConferir }: { p: Pendente; aoConferir: (conferencia: ConferenciaDoAcervo, texto: string) => void }) {
  const idCorrecao = useId()
  const [corrigindo, setCorrigindo] = useState(false)
  const [correcao, setCorrecao] = useState('')
  const [erro, setErro] = useState('')

  async function conferir(desfecho: string) {
    const entrada = ConferirDesfecho.safeParse({ desfecho })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escolha o desfecho')
    const r = await chamarApi<ConferenciaDoAcervo>(`/acervo/processos/${p.id}/conferencia`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoConferir(r.dados, desfecho === p.desfechoLido ? 'Desfecho conferido.' : `Desfecho corrigido para ${rotulo(desfecho)}.`)
  }

  return (
    <li className={styles.cartao}>
      <strong>{p.numeroCnj ? formatarCnj(p.numeroCnj) : 'sem número'}</strong>
      {p.beneficio && <span> · {ROTULO_BENEFICIO[p.beneficio as Beneficio] ?? p.beneficio}</span>}
      <p>Desfecho lido: {rotulo(p.desfechoLido)}</p>
      {corrigindo && (
        <>
          <label className={styles.rotulo} htmlFor={idCorrecao}>
            Desfecho correto
          </label>
          <select id={idCorrecao} className={styles.campo} value={correcao} onChange={(e) => setCorrecao(e.target.value)}>
            <option value="">Escolha</option>
            {DESFECHOS_DO_ACERVO.filter((d) => d !== p.desfechoLido).map((d) => (
              <option key={d} value={d}>
                {ROTULO_DESFECHO_DO_ACERVO[d]}
              </option>
            ))}
          </select>
        </>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        {corrigindo ? (
          <button type="button" className={styles.botao} onClick={() => void conferir(correcao)}>
            Salvar a correção
          </button>
        ) : (
          <>
            <button type="button" className={styles.botao} onClick={() => void conferir(p.desfechoLido)}>
              Confere
            </button>
            <button type="button" className={styles.botaoSecundario} onClick={() => setCorrigindo(true)}>
              Corrigir
            </button>
          </>
        )}
      </div>
    </li>
  )
}

/**
 * Conferir desfechos do lote (GGVP-55 CA7): a Sênior confere ou corrige o desfecho lido de cada processo do acervo.
 * Só o conferido entra nas contas da jurimetria; os outros ficam no acervo para consulta, e nada trava.
 */
export function ConferirAcervo() {
  const [c, setC] = useState<ConferenciaDoAcervo | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<ConferenciaDoAcervo>('/acervo/conferencia').then((r) => (r.ok ? setC(r.dados) : setErro(r.erro)))
  }, [])

  function aoConferir(nova: ConferenciaDoAcervo, texto: string) {
    setC(nova)
    setFeito(texto)
  }

  return (
    <main className={styles.pagina}>
      <title>Conferir desfechos do lote · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Conferir desfechos do lote</h1>
      {c && (
        <p className={styles.subtitulo}>
          Esperando conferência: {c.pendentes.length} · Já conferidos: {c.conferidos}. Só os conferidos entram nas contas da jurimetria.
        </p>
      )}
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
      {c && c.pendentes.length === 0 && <p className={styles.dica}>Nenhum desfecho esperando conferência.</p>}
      {c && c.pendentes.length > 0 && (
        <ul className={styles.lista} aria-label="Desfechos para conferir">
          {c.pendentes.map((p) => (
            <ProcessoDoLote key={p.id} p={p} aoConferir={aoConferir} />
          ))}
        </ul>
      )}
      <p className={styles.dica}>Os não conferidos ficam no acervo para consulta, fora das contas. Nada trava.</p>
    </main>
  )
}
