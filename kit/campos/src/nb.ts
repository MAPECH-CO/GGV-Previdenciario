import { somenteDigitos } from './numero.ts';

// NB: número do benefício do INSS, 10 dígitos, formato 000.000.000-0.
// O dígito verificador NÃO é conferido aqui: o algoritmo precisa ser confirmado com o escritório
// na história GGVP-108. Até lá, só formato.

/** "123.456.789-0" → "1234567890". */
export function normalizarNb(valor: unknown): string {
  return somenteDigitos(valor).slice(0, 10);
}

/** Dez dígitos, não repetidos. */
export function validarNb(valor: unknown): boolean {
  const d = somenteDigitos(valor);
  return d.length === 10 && !/^(\d)\1{9}$/.test(d);
}

/** "1234567890" → "123.456.789-0". */
export function formatarNb(valor: unknown): string {
  const d = normalizarNb(valor);
  if (d.length !== 10) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
