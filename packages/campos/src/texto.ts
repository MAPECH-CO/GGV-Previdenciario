// Nome de pessoa: letra, espaço, apóstrofo e hífen. Número não entra.

/** Tira espaço duplo e das pontas. "  Ana   Lima " → "Ana Lima". */
export function normalizarNome(valor: unknown): string {
  return String(valor ?? '').replace(/\s+/g, ' ').trim();
}

/** Pelo menos duas letras; só letras (com acento), espaço, apóstrofo e hífen. "Jo4o" → false. */
export function validarNome(valor: unknown): boolean {
  const s = normalizarNome(valor);
  if (s.length < 2) return false;
  return /^[\p{L}][\p{L}' -]*$/u.test(s) && /\p{L}.*\p{L}/u.test(s);
}

/** E-mail simples: algo@algo.algo, sem espaço. */
export function validarEmail(valor: unknown): boolean {
  const s = String(valor ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}
