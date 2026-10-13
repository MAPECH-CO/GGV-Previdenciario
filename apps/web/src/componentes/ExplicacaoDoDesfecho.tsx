import { useEffect, useState } from 'react'
import { ResultadoParaExplicar } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from '../paginas/ProcessoPericia.module.css'

/** Só abre o texto do cliente após o desfecho e a aprovação humana retornados pelo servidor. */
export function ExplicacaoDoDesfecho({ casoId, desfecho }: { casoId: string; desfecho: string | null }) {
  const [aprovado, setAprovado] = useState(false)
  const [aviso, setAviso] = useState('Consultando a explicação aprovada…')
  useEffect(() => {
    if (!desfecho) return
    let atual = true
    void chamarApi<unknown>(`/casos/${casoId}/resultado`).then(r => {
      if (!atual) return
      const resultado = r.ok ? ResultadoParaExplicar.safeParse(r.dados) : null
      if (!resultado?.success) { setAviso('A explicação do resultado ainda não está disponível.'); return }
      setAprovado(resultado.data.resumo !== null)
      setAviso('A explicação aguarda o texto aprovado pelo Jurídico.')
    }).catch(() => { if (atual) setAviso('Não foi possível consultar a explicação do resultado. Tente novamente mais tarde.') })
    return () => { atual = false }
  }, [casoId, desfecho])
  if (!desfecho) return null
  return <section className={styles.cartao} aria-label="Explicação do desfecho">
    <h2 className={styles.cartaoTitulo}>Explicar o resultado ao cliente</h2>
    {aprovado ? <a href={`/casos/${casoId}/resultado`}>Abrir o texto aprovado para o cliente</a> : <p>{aviso}</p>}
  </section>
}
