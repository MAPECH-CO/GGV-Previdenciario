export type TokensFigma = {
  origem: {
    arquivo: string
    nome: string
    colecoes: { cores: string; fontes: string }
    extraidoEm: string
  }
  cores: Record<string, { claro: string; escuro: string }>
  fontes: Record<string, { padrao: number; grande: number }>
}

export function gerarCss(tokens: TokensFigma): string
