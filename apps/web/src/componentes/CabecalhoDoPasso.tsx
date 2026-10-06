import styles from '../paginas/Balcao.module.css'
import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Ficha } from '../dados/tipos.ts'

type Props = {
  /** Código do passo do BPMN, como D1.14. */
  passo: string
  /** O nome do passo, para quem passa o mouse no chip. */
  nomeDoPasso: string
  /** O setor do chip: Atendimento, Jurídico. */
  setor: string
  /** A ação da lista fixa: "Registrar fechamento", "Recontatar lead"... */
  tarefa: string
  subtitulo: string
  ficha: Ficha
  beneficio: string | undefined
  /** O texto de "O que você deve fazer". */
  instrucoes: string
}

/** Topo das telas de passo (Figma step_*): chips, "nome · tarefa", a linha de apoio e "O que você deve fazer". */
export function CabecalhoDoPasso({ passo, nomeDoPasso, setor, tarefa, subtitulo, ficha, beneficio, instrucoes }: Props) {
  return (
    <>
      <div className={styles.cabecalho}>
        <div className={styles.chips}>
          <span className={styles.codigo} title={`${passo} · ${nomeDoPasso} (passo do BPMN)`}>
            {passo}
          </span>
          <span className={styles.codigo}>{setor}</span>
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
          <span className={styles.beneficio}>◆ {nomeBeneficio(beneficio) || 'a definir'}</span>
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
