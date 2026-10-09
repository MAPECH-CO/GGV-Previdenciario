import styles from '../paginas/Balcao.module.css'

/** "O que você deve fazer" da tela de receber documento (Figma 1571:137), no visual das telas de passo do balcão. */
export function InstrucoesRecebimento({ fichaId, beneficio }: { fichaId: string; beneficio: string }) {
  return (
    <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
      <div className={styles.instrucoesTopo}>
        <span className={styles.estrela} aria-hidden="true">
          ✦
        </span>
        <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
          O que você deve fazer
        </h2>
        <span className={styles.beneficio}>◆ {beneficio || 'a definir'}</span>
        <span className={styles.instrucoesDe}>· Balcão</span>
      </div>
      <p className={styles.instrucoesTexto}>
        Receba o documento e identifique de quem é (nome ou CPF). Em papel: digitalize no scanner, que lê e classifica;
        confira o resultado (D1.18). Digital: anexe ao card do cliente. Devolva o original se o cliente quiser levar.
        Documento sem dono identificado não entra no sistema. Vale em qualquer fase do processo. Laudo novo: o Atendimento
        sobe, a IA lê e resume para o Jurídico e a documentação médica é reanalisada (D1.21M).
      </p>
      <div className={styles.atalhos}>
        <a className={styles.atalho} href={`/clientes/${fichaId}`}>
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
  )
}
