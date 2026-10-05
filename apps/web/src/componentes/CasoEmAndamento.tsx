import { nomeBeneficio } from '../dados/catalogos.ts'
import type { Ficha } from '../dados/tipos.ts'
import { Cartao } from './Cartao.tsx'
import styles from './CasoEmAndamento.module.css'

/** "Caso em andamento" (Figma 73:351): um cartão por processo. A visão do Atendimento nunca traz petição nem valores. */
export function CasoEmAndamento({ ficha }: { ficha: Ficha }) {
  const { processos } = ficha
  return (
    <Cartao titulo={processos.length > 1 ? 'Casos em andamento' : 'Caso em andamento'}>
      {processos.length === 0 && (
        <p className={styles.vazio}>
          Nenhum caso aberto ainda.
          {ficha.beneficioInteresse && ` Interesse: ${nomeBeneficio(ficha.beneficioInteresse)}.`}
        </p>
      )}
      {processos.map((p) => (
        <a key={p.id} className={styles.caso} href={`/processos/${p.id}`}>
          <span className={styles.numero}>{p.numero ?? 'Processo ainda sem número'}</span>
          <span className={styles.selos}>
            <span className={styles.beneficio}>◆ {nomeBeneficio(p.beneficio)}</span>
            <span className={styles.etapa}>{p.etapa}</span>
          </span>
          {p.proximaAcao && <span className={styles.acao}>O que o Atendimento faz agora: {p.proximaAcao}.</span>}
          {p.prazo && <span className={p.urgente ? styles.urgente : styles.prazo}>{p.prazo}</span>}
        </a>
      ))}
      <p className={styles.nota}>Petição, estratégia e valores não aparecem para o Atendimento.</p>
    </Cartao>
  )
}
