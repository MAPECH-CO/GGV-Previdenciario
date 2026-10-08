import { useState } from 'react'
import { usePerfil } from '../dados/perfis.ts'
import { grupoDoPerfil, SUGESTOES_DO_PERFIL } from '../regras/chat.ts'
import { ChatDoPortal } from './ChatDoPortal.tsx'
import styles from './AbaSuporte.module.css'

/**
 * Aba "✦ Suporte" na borda direita (GGVP-82, CA6; Figma "Overlay · Chat de suporte" 60:2 e 60:193): nas telas que não são a
 * Central, o mesmo chat do portal, com o perfil de quem está agindo e as sugestões dele. Aberto de dentro de um caso, a
 * pergunta sem nome de cliente é sobre ele.
 */
export function AbaSuporte() {
  const [aberto, setAberto] = useState(false)
  const perfil = usePerfil()
  const processoId = /^\/casos\/([^/]+)/.exec(typeof window === 'undefined' ? '' : window.location.pathname)?.[1]
  return (
    <>
      <button type="button" className={styles.aba} aria-expanded={aberto} aria-controls="suporte" onClick={() => setAberto(!aberto)}>
        <span className={styles.texto}>✦ Suporte</span>
      </button>
      {aberto && (
        <aside id="suporte" className={styles.painel} role="dialog" aria-modal="false" aria-labelledby="suporte-titulo">
          <div className={styles.cabeca}>
            <span aria-hidden="true">✦</span>
            <div>
              <h2 id="suporte-titulo" className={styles.titulo}>
                Suporte interno
              </h2>
              <p className={styles.sub}>o assistente do portal: um caso, um passo, um portão (G1 a G22) ou uma tarefa</p>
            </div>
            <button type="button" className={styles.fechar} aria-label="Fechar o Suporte" onClick={() => setAberto(false)}>
              ×
            </button>
          </div>
          <div className={styles.corpo}>
            <ChatDoPortal
              exemplo="Escreva sua dúvida…"
              sugestoes={SUGESTOES_DO_PERFIL[grupoDoPerfil(perfil?.id)]}
              funcao={perfil?.rotulo ?? 'Atendimento'}
              processoId={processoId ? decodeURIComponent(processoId) : undefined}
            />
          </div>
          <p className={styles.pe}>O chat herda o seu perfil e não contorna nenhum portão.</p>
        </aside>
      )}
    </>
  )
}
