import { useSyncExternalStore } from 'react'

/** Até 760 px de largura o portal vira a versão do celular: topo enxuto e a barra de baixo (Topbar.tsx). */
export const CONSULTA_DO_CELULAR = '(max-width: 760px)'

const consulta = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_DO_CELULAR) : null)

/** true no celular (ou numa janela estreita); acompanha quando a pessoa gira a tela ou muda a janela. */
export function useCelular(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const c = consulta()
      c?.addEventListener('change', avisar)
      return () => c?.removeEventListener('change', avisar)
    },
    () => consulta()?.matches ?? false,
    () => false,
  )
}
