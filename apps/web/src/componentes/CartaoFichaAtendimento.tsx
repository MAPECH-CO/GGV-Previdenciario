import type { Ficha } from '../dados/tipos.ts'
import { isoParaData } from '../campos.ts'
import { situacaoDaSenha } from '../regras/fichaAtendimento.ts'
import { Cartao } from './Cartao.tsx'
import styles from './CartaoFichaAtendimento.module.css'

/**
 * "Ficha de atendimento" na ficha do cliente (GGVP-24, CA4 e CA6): as respostas da triagem, o que ficou em branco e a
 * situação da senha do gov.br, nunca a senha. A preparação da conversa (GGVP-32) mostra o mesmo ao Jurídico.
 */
export function CartaoFichaAtendimento({ ficha, hoje }: { ficha: Ficha; hoje: string }) {
  const f = ficha.fichaAtendimento
  const link = `/clientes/${ficha.id}/ficha-de-atendimento`
  const respostas = f && [
    ['Quantas pessoas moram na casa', f.pessoasNaCasa?.toString()],
    ['Última atividade', f.ultimaAtividade],
    ['Desde quando está sem trabalhar', f.semTrabalharDesde],
    ['O que já pediu ao INSS', f.pedidosAoInss],
  ].filter((r): r is [string, string] => Boolean(r[1]))
  return (
    <Cartao titulo="Ficha de atendimento">
      <p className={styles.texto}>
        {f
          ? `Preenchida em ${isoParaData(f.data)} · ${f.origem === 'tablet' ? 'tablet' : `papel ${f.modelo ?? 'GGV'}`}`
          : ficha.fichaAtendimentoPreenchida
            ? 'Preenchida antes do portal.'
            : 'Ainda não preenchida.'}
      </p>
      {respostas && respostas.length > 0 && (
        <dl className={styles.respostas}>
          {respostas.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      )}
      {f && f.emBranco.length > 0 && <p className={styles.branco}>Em branco: {f.emBranco.join(', ')}.</p>}
      <p className={styles.senha}>gov.br: {situacaoDaSenha(ficha.senhaGov, hoje)} (G9)</p>
      <a className={styles.link} href={link}>
        {f || ficha.fichaAtendimentoPreenchida ? 'Abrir a ficha de atendimento' : 'Preencher a ficha'}
      </a>
    </Cartao>
  )
}
