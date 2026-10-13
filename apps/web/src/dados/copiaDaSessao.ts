import type { Banco } from './servidor.ts'

/** Estado separado da API para limpar a cópia sem importar o servidor de exemplo no login. */
export const copiaDaSessao: { banco: Banco | null; encerrada: boolean } = { banco: null, encerrada: false }

export function limparCopiaDaSessao() {
  copiaDaSessao.banco = null
  copiaDaSessao.encerrada = true
  // Inclui versões antigas. Preferências de aparência e dados de outros aplicativos permanecem.
  for (const nome of ['sessionStorage', 'localStorage'] as const) {
    try {
      const armazenamento = window[nome]
      for (let i = armazenamento.length - 1; i >= 0; i--) {
        const chave = armazenamento.key(i)
        if (chave?.startsWith('ggv.exemplo.')) armazenamento.removeItem(chave)
      }
    } catch {
      // Armazenamento bloqueado: a cópia em memória já foi removida.
    }
  }
}
