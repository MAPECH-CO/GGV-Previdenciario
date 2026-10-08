import styles from '../paginas/Balcao.module.css'

type Props = { forma: 'papel' | 'digital' | null; conferirPapel: boolean }

/** Painel "Antes de concluir" do passo de receber documento (Figma 1805:248). */
export function AntesDeConcluirRecebimento({ forma, conferirPapel }: Props) {
  const opcoes = ['Papel — vai ao scanner', 'Digital — anexar ao card']
  const resposta = forma === 'papel' ? 0 : forma === 'digital' ? 1 : null
  return (
    <aside className={styles.lado} aria-labelledby="antes-de-concluir">
      <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
        Antes de concluir
      </h2>
      <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.02.</p>
      <h3 className={styles.ladoSecao}>Decisões</h3>
      <div className={styles.decisao}>
        <p>Chegou em papel ou digital?</p>
        <p className={styles.ladoOpcoes}>
          {opcoes.map((texto, i) => (
            <span key={texto} className={styles.chip} data-ativa={resposta === i} aria-hidden="true">
              {texto}
            </span>
          ))}
          <span className="so-leitor">{resposta === null ? 'Sem resposta ainda.' : `Resposta: ${opcoes[resposta]}.`}</span>
        </p>
      </div>
      <h3 className={styles.ladoSecao}>Travas</h3>
      <ul className={styles.ladoLista}>
        <li>• Conferir: Conferi o tipo de cada documento</li>
        {conferirPapel && <li>• Conferir o papel antes de devolver o original (CONFERIR O PAPEL)</li>}
      </ul>
      <p className={styles.ladoSub}>«Registrar» só habilita com as decisões respondidas e as conferências marcadas.</p>
    </aside>
  )
}
