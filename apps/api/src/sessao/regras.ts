// Regras numéricas do login (GGVP-117). Número é código com teste, nunca resposta de modelo.

export const MAX_TENTATIVAS = 5
export const TRAVA_MINUTOS = 15
export const SESSAO_HORAS = 8

const MINUTO = 60_000

export function estaTravado(travadoAte: Date | null, agora: Date): boolean {
  return travadoAte !== null && travadoAte > agora
}

/** Depois de uma senha errada: na 5ª seguida, trava por 15 minutos e zera a contagem. */
export function aposErro(tentativasErradas: number, agora: Date): { tentativasErradas: number; travadoAte: Date | null } {
  const tentativas = tentativasErradas + 1
  if (tentativas >= MAX_TENTATIVAS) return { tentativasErradas: 0, travadoAte: new Date(agora.getTime() + TRAVA_MINUTOS * MINUTO) }
  return { tentativasErradas: tentativas, travadoAte: null }
}

export function expiraEm(agora: Date): Date {
  return new Date(agora.getTime() + SESSAO_HORAS * 60 * MINUTO)
}
