import styles from '../paginas/Balcao.module.css'
import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Ficha } from '../dados/tipos.ts'

type Props = {
  /** Código do passo do BPMN: D1.16, D1.17, D1.19, D1.20. */
  passo: string
  /** O nome do passo, para quem passa o mouse no chip. */
  nomeDoPasso: string
  /** A ação da lista fixa: "Preparar contrato", "Colher assinatura"... */
  tarefa: string
  subtitulo: string
  ficha: Ficha
  beneficio: string
  /** O texto de "O que você deve fazer". */
  instrucoes: string
  /** Figma step_D1.19: o benefício também vai nos chips do topo. */
  beneficioNosChips?: boolean
}

/** Topo das telas do contrato (Figma step_D1.16 a step_D1.20): chips, "nome · tarefa", a linha de apoio e "O que você deve fazer". */
export function CabecalhoDoContrato({ passo, nomeDoPasso, tarefa, subtitulo, ficha, beneficio, instrucoes, beneficioNosChips }: Props) {
  const nome = nomeBeneficio(beneficio) || 'a definir'
  return (
    <>
      <div className={styles.cabecalho}>
        <div className={styles.chips}>
          <span className={styles.codigo} title={`${passo} · ${nomeDoPasso} (passo do BPMN)`}>
            {passo}
          </span>
          <span className={styles.codigo}>Atendimento</span>
          {beneficioNosChips && <span className={styles.beneficio}>◆ {nome}</span>}
        </div>
        <h1 className={styles.titulo}>
          <strong>{ficha.nome}</strong> · {tarefa}
        </h1>
        <p className={styles.subtitulo}>{subtitulo}</p>
      </div>

      <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
        <div className={styles.instrucoesTopo}>
          <span className={styles.estrela} aria-hidden="true">
            ✦
          </span>
          <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
            O que você deve fazer
          </h2>
          <span className={styles.beneficio}>◆ {nome}</span>
          <span className={styles.instrucoesDe}>· {ficha.nome}</span>
        </div>
        <p className={styles.instrucoesTexto}>{instrucoes}</p>
        <div className={styles.atalhos}>
          <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
            Abrir a ficha do cliente
          </a>
          <button type="button" className={styles.atalho} aria-disabled="true">
            ▶ Entrevista e transcrições
          </button>
          <button type="button" className={styles.atalho} aria-disabled="true">
            Parecer médico
          </button>
        </div>
        <p className={styles.nota}>Montado pela IA a partir da entrevista, do benefício e do caso. Confira antes de agir.</p>
      </section>
    </>
  )
}
