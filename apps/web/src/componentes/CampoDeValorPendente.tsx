import { useId } from 'react'
import { useSessao } from '../sessao.ts'
import styles from '../paginas/Passo.module.css'

/** Sem contrato de leitura/gravação na main: não recebe valores, não grava e não simula uma conta. */
export function CampoDeValorPendente({ tipo }: { tipo: 'causa' | 'loas' }) {
  const id = useId()
  const sessao = useSessao()
  if (!sessao || !['advogada', 'financeiro', 'socio'].includes(sessao.perfilAtivo ?? '')) return null
  const rotulo = tipo === 'causa' ? 'Valor da causa' : 'Renda por pessoa do LOAS'
  return <section className={styles.cartao} aria-label={rotulo}>
    <label className={styles.rotulo} htmlFor={id}>{rotulo}</label>
    <input id={id} className={styles.campo} disabled value="" placeholder="Ainda indisponível" aria-describedby={id + '-aviso'} />
    <p id={id + '-aviso'} className={styles.dica}>Consulta e edição ainda indisponíveis. Nenhum valor foi calculado ou salvo.</p>
  </section>
}
