import { Cartao } from './Cartao.tsx'
import styles from './OQueAconteceDepois.module.css'

const PASSOS = [
  'Marcar a entrevista com a advogada: presencial, vídeo ou telefone. Convite pelo Chatwoot com modelo (GGVP-102).',
  'Iniciar com gravação e transcrição. O aviso de gravação é a primeira coisa (G10).',
  'A cliente preenche a ficha pelo link (D1.05). Na entrevista, a IA aponta o que faltou.',
  'Se não virar cliente, o motivo fica registrado (G16).',
]

/** "O que acontece depois" (Figma 73:438). */
export function OQueAconteceDepois() {
  return (
    <Cartao titulo="O que acontece depois">
      <ol className={styles.passos}>
        {PASSOS.map((texto, i) => (
          <li key={texto} className={styles.passo}>
            <span className={styles.numero} aria-hidden="true">
              {i + 1}
            </span>
            {texto}
          </li>
        ))}
      </ol>
    </Cartao>
  )
}
