import { TIPOS_DE_DOCUMENTO } from '../dados/catalogos.ts'
import styles from './ConferirEnviar.module.css'

export type Linha = { id: number; nome: string; tamanho: number; tipo: string; problema?: string; hash?: string; arquivo?: File }

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** 1258291 → "1,2 MB"; 655360 → "640 KB". */
function tamanhoLegivel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${numero.format(bytes / (1024 * 1024))} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Um arquivo da janela "Conferir e enviar" (Figma 2224:15): nome, tamanho e o tipo que a IA disse, que a pessoa troca. */
export function LinhaArquivo({ linha, aoMudarTipo }: { linha: Linha; aoMudarTipo: (tipo: string) => void }) {
  return (
    <li className={styles.arquivo} data-problema={linha.problema ? true : undefined}>
      <svg className={styles.iconeArquivo} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h8l4 4v14H6z M14 3v4h4" />
      </svg>
      <span className={styles.info}>
        <span className={styles.nome}>{linha.nome}</span>
        <span className={linha.problema ? styles.problema : styles.detalhe}>
          {linha.problema ? `Não segue: ${linha.problema}` : `${tamanhoLegivel(linha.tamanho)} · ${linha.hash ? 'lido pela IA' : 'lendo…'}`}
        </span>
      </span>
      {!linha.problema && (
        <select
          className={linha.tipo === 'laudo' ? styles.tipoLaudo : styles.tipo}
          aria-label={`Tipo de ${linha.nome}`}
          value={linha.tipo}
          onChange={(e) => aoMudarTipo(e.target.value)}
        >
          {TIPOS_DE_DOCUMENTO.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      )}
    </li>
  )
}
