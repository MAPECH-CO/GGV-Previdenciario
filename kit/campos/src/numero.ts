// Número: só dígitos entram. Letra em campo numérico não passa.

/** Remove tudo que não é dígito. "12a3" → "123". */
export function somenteDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D+/g, '');
}

/** "1.234" → 1234; "-12" → -12; "12a" → null; "1,5" → null. Ponto é separador de milhar. */
export function normalizarInteiro(valor: unknown): number | null {
  const s = String(valor ?? '').trim().replace(/\./g, '');
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function validarInteiro(valor: unknown): boolean {
  return normalizarInteiro(valor) !== null;
}

/** Decimal em pt-BR: "1.234,56" → 1234.56; "R$ 1.234,56" → 1234.56; "12,5" → 12.5; "12a" → null. */
export function normalizarDecimal(valor: unknown): number | null {
  let s = String(valor ?? '').trim().replace(/\s+/g, '').replace(/^R\$/, '');
  if (s === '' || s === '-' || !/^-?[\d.]*(,\d+)?$/.test(s)) return null;
  s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function validarDecimal(valor: unknown): boolean {
  return normalizarDecimal(valor) !== null;
}

/** 1234.5 → "1.234,50". */
export function formatarDecimal(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
