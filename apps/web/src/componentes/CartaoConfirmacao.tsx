import { useRef, useState } from 'react'
import styles from './CartaoConfirmacao.module.css'

export type EstadoAcao = 'esperando' | 'feito' | 'cancelado' | 'sem-pasta'

type Props = {
  cliente: { id: string; nome: string }
  arquivo: string
  estado: EstadoAcao
  aoConfirmar: () => Promise<void>
  aoCancelar: () => void
}

/** Card "Ação para confirmar" do chat (Figma 2052:2): nada acontece antes de "Confirmar" (GGVP-17, CA8). */
export function CartaoConfirmacao({ cliente, arquivo, estado, aoConfirmar, aoCancelar }: Props) {
  const [enviando, setEnviando] = useState(false)
  // Trava no mesmo clique, antes de o React redesenhar o botão.
  const travado = useRef(false)

  async function confirmar() {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    try {
      await aoConfirmar()
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  if (estado === 'feito') {
    return (
      <p className={styles.feito} role="status">
        ✓ Feito: o laudo está na pasta de {cliente.nome}, a ficha mostra «Laudo novo» e a advogada recebeu a tarefa.{' '}
        <a href={`/clientes/${cliente.id}`}>Abrir a ficha</a>
      </p>
    )
  }
  if (estado === 'cancelado') return <p className={styles.nota}>Cancelado: nada foi feito.</p>
  if (estado === 'sem-pasta') {
    return (
      <p className={styles.nota} role="alert">
        Não subi: {cliente.nome} ainda não tem pasta no Drive, e pasta nova só nasce com o CPF. Complete o CPF na ficha.
      </p>
    )
  }
  return (
    <section className={styles.cartao} aria-labelledby={`acao-${cliente.id}`}>
      <span className={styles.selo}>Ação para confirmar</span>
      <h3 id={`acao-${cliente.id}`} className={styles.titulo}>
        Atualizar o laudo · {cliente.nome}
      </h3>
      <ol className={styles.passos}>
        <li>Subir {arquivo} na pasta do cliente</li>
        <li>Marcar «Laudo novo» na ficha e no processo</li>
        <li>Avisar a advogada responsável (D1.21M), com o resumo e a comparação da IA</li>
      </ol>
      <p className={styles.nota}>Você não vê o conteúdo do laudo (G17); só a advogada vê o resumo.</p>
      <div className={styles.botoes}>
        <button type="button" className={styles.confirmar} disabled={enviando} onClick={confirmar}>
          {enviando ? 'enviando…' : 'Confirmar e enviar ao Jurídico'}
        </button>
        <button type="button" className={styles.cancelar} disabled={enviando} onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </section>
  )
}
