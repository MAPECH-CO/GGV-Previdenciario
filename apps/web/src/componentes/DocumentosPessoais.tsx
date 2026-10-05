import type { DragEvent } from 'react'
import type { DocumentoPessoal } from '../dados/tipos.ts'
import { Cartao } from './Cartao.tsx'
import styles from './DocumentosPessoais.module.css'

type Props = {
  documentos: DocumentoPessoal[]
  /** Arquivos soltos ou clique na área: abre "Conferir e enviar" (GGVP-17, CA12). */
  aoSoltar: (arquivos: File[]) => void
  aviso?: string
}

/** "Documentos pessoais" (Figma 73:298): uma miniatura por documento e a área de soltar arquivos. */
export function DocumentosPessoais({ documentos, aoSoltar, aviso }: Props) {
  function soltar(evento: DragEvent) {
    evento.preventDefault()
    aoSoltar([...evento.dataTransfer.files])
  }

  return (
    <Cartao titulo="Documentos pessoais">
      {documentos.length > 0 ? (
        <ul className={styles.grade} aria-label="Documentos pessoais">
          {documentos.map((d, i) => (
            <li key={`${d.nome}-${i}`} className={styles.documento}>
              <span className={styles.miniatura} aria-hidden="true">
                ▤
              </span>
              <span className={styles.nome}>{d.nome}</span>
              <span className={styles.detalhe}>{d.detalhe}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.vazio}>Nenhum documento recebido ainda.</p>
      )}
      <button type="button" className={styles.soltar} onClick={() => aoSoltar([])} onDragOver={(e) => e.preventDefault()} onDrop={soltar}>
        <svg className={styles.icone} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-5 5m5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        <span className={styles.textos}>
          <span className={styles.soltarTitulo}>Solte os documentos do cliente aqui</span>
          <span className={styles.soltarSub}>ou clique para escolher · PDF, JPG ou PNG · a IA identifica o tipo</span>
        </span>
      </button>
      {aviso && (
        <p role="status" className={styles.aviso}>
          {aviso}
        </p>
      )}
    </Cartao>
  )
}
