import { nomeTipo } from '../dados/catalogos.ts'
import type { LoteDigitalizado } from '../dados/tipos.ts'
import styles from './ResultadoLote.module.css'

const TITULO: Record<LoteDigitalizado['status'], string> = {
  arquivado: '✓ Arquivado na pasta do cliente',
  'pasta-criada': '✓ Pasta criada e arquivado',
  revisao: 'Foi para A REVISAR',
  falhou: 'O lote falhou: escaneie de novo',
}

/** O que a automação do scanner respondeu (GGVP-17, CA2, CA4 e CA10). Quem decide a pasta é ela, não o portal. */
export function ResultadoLote({ lote, fichaId }: { lote: LoteDigitalizado; fichaId: string }) {
  const revisao = lote.status === 'revisao'
  return (
    <div className={styles.resultado}>
      <p className={revisao || lote.status === 'falhou' ? styles.alerta : styles.ok}>
        <strong>{TITULO[lote.status]}</strong> · motivo na planilha «Painel da digitalização»: {lote.motivo}
      </p>
      {revisao && (
        <p className={styles.texto}>
          A automação não teve certeza de quem é o papel. Abra a pasta A REVISAR no Drive e arraste o arquivo para a pasta
          certa. Documento nunca vai para a pasta de outro cliente.
        </p>
      )}
      <ul className={styles.lista} aria-label="Documentos do lote">
        {lote.arquivos.map((a) => (
          <li key={a.nome} className={styles.arquivo}>
            <span className={styles.nome}>{a.nome}</span>
            <span className={styles.detalhe}>
              {nomeTipo(a.tipo)} · {a.paginas === 1 ? '1 página' : `${a.paginas} páginas`}
            </span>
          </li>
        ))}
      </ul>
      {lote.conferirPapel && (
        <p role="alert" className={styles.conferir}>
          <strong>CONFERIR O PAPEL</strong> · uma página saiu em branco. Antes de devolver o original, confira se todas as
          folhas passaram.
        </p>
      )}
      {!revisao && lote.status !== 'falhou' && (
        <div className={styles.acervo}>
          <span aria-hidden="true">▤</span>
          <span className={styles.acervoTextos}>
            <span>Documentos digitalizados</span>
            <span className={styles.detalhe}>abrir no acervo do cliente</span>
          </span>
          <a className={styles.abrir} href={`/clientes/${fichaId}`}>
            Abrir
          </a>
        </div>
      )}
    </div>
  )
}
