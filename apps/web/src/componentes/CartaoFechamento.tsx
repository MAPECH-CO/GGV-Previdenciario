import { nomeMotivo } from '../dados/catalogos.ts'
import type { Fechamento } from '../dados/tipos.ts'
import { dataCurta, dataHora } from '../regras/datas.ts'
import { Cartao } from './Cartao.tsx'
import styles from './CartaoFechamento.module.css'

const SITUACOES: Record<Fechamento['situacao'], string> = {
  fechou: 'Fechou com o escritório',
  recontatar: 'Não fechou · recontatar',
  arquivado: 'Não fechou · lead arquivado',
  recalcular: 'Recontatado · voltou ao cálculo',
}

/** As linhas do que ficou registrado no fechamento: situação, motivo, detalhe, recontato, quem e quando (GGVP-60, CA4). */
export function ResumoDoFechamento({ fechamento: f, hoje }: { fechamento: Fechamento; hoje: string }) {
  const linhas: [string, string][] = [
    ['Situação', SITUACOES[f.situacao]],
    ...(f.motivo ? ([['Motivo', nomeMotivo(f.motivo)]] as [string, string][]) : []),
    ...(f.detalhe ? ([['Detalhe', f.detalhe]] as [string, string][]) : []),
    ...(f.situacao === 'recontatar' && f.recontatarEm ? ([['Recontatar em', dataCurta(f.recontatarEm, hoje)]] as [string, string][]) : []),
    ['Registrado', `${dataHora(f.quando)} · ${f.quem}`],
  ]
  return (
    <dl className={styles.linhas}>
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "Fechamento" na ficha do cliente: o lead arquivado mostra o motivo e a data (GGVP-60, CA4). */
export function CartaoFechamento({ fechamento, hoje, fichaId }: { fechamento: Fechamento | undefined; hoje: string; fichaId: string }) {
  if (!fechamento) return null
  return (
    <Cartao titulo="Fechamento">
      <ResumoDoFechamento fechamento={fechamento} hoje={hoje} />
      {fechamento.situacao === 'recontatar' && (
        <a className={styles.link} href={`/clientes/${fichaId}/recontato`}>
          Abrir o recontato
        </a>
      )}
    </Cartao>
  )
}
