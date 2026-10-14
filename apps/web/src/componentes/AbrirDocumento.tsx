import { doServidor } from '../dados/servidor.ts'

// GGVP-81 CA17 (Pedro, 14/10): "Abrir" mostra o próprio arquivo numa janela do navegador, que baixa e imprime sozinho.

/** O arquivo da pasta do cliente, pela pessoa e pelo conteúdo (SHA-256). A ficha de exemplo não tem arquivo de verdade. */
export const hrefDaPasta = (fichaId: string, arquivo?: { hash?: string }) =>
  doServidor(fichaId) && arquivo?.hash ? `/api/pessoas/${fichaId}/documentos/${arquivo.hash}` : undefined

/** O arquivo do caso, pelo id do registro do documento. */
export const hrefDoCaso = (casoId: string, documentoId: string) => `/api/casos/${casoId}/documentos/${documentoId}`

/** Uma janela só para os documentos: abrir outro troca o que ela mostra. Com a janela bloqueada, o link abre numa aba. */
const JANELA = 'documento'

export function AbrirDocumento({
  href,
  nome,
  className,
  classeDaNota,
  children = 'Abrir',
}: {
  href?: string
  nome: string
  className?: string
  classeDaNota?: string
  children?: string
}) {
  if (!href) return <span className={classeDaNota}>sem arquivo no portal</span>
  return (
    <a
      className={className}
      href={href}
      target={JANELA}
      aria-label={`Abrir ${nome}`}
      onClick={(e) => {
        if (window.open(href, JANELA, 'popup,width=900,height=1000')) e.preventDefault()
      }}
    >
      {children}
    </a>
  )
}
