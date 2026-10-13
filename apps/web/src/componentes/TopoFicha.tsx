import type { ReactNode } from 'react'
import { Topbar } from './Topbar.tsx'
import styles from './TopoFicha.module.css'

type Props = {
  titulo: string
  chips: { texto: string; tom: 'acento' | 'neutro' }[]
  /** Botão à direita do título. */
  acao?: ReactNode
  /** Mostra o "Voltar" para a tela de onde a pessoa veio (Figma 73:465). */
  voltar?: boolean
}

const ITENS = [
  { id: 'inicio', rotulo: 'Início', href: '/' },
  { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
]

/**
 * O topo das telas de cliente (Figma 73:371 e 73:199). Desde 11/10 é o topo de toda tela, e o título com os chips e a
 * ação da tela vêm logo abaixo, numa faixa própria. O "‹ Central" virou o Início do topo; o "Você · Atendimento", a
 * pessoa no topo.
 */
export function TopoFicha({ titulo, chips, acao, voltar }: Props) {
  return (
    <>
      <Topbar itens={ITENS} ativo="" funcao="Atendimento" voltar={voltar} />
      <div className={styles.faixa}>
        <div className={styles.titulos}>
          <h1 className={styles.titulo}>{titulo}</h1>
          <p className={styles.chips}>
            {chips.map((c) => (
              <span key={c.texto} className={c.tom === 'acento' ? styles.chipAcento : styles.chipNeutro}>
                {c.texto}
              </span>
            ))}
          </p>
        </div>
        {acao}
      </div>
    </>
  )
}
