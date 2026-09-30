import { somenteDigitos } from './numero.ts';

/** "+55 (11) 96920-5041" → "11969205041". Tira o 55 do país quando vem com ele. */
export function normalizarTelefone(valor: unknown): string {
  let d = somenteDigitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
}

/** Fixo com 10 dígitos ou celular com 11 (terceiro dígito 9), DDD de 11 a 99, não repetido. */
export function validarTelefone(valor: unknown): boolean {
  const d = normalizarTelefone(valor);
  if (d.length !== 10 && d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  if (/^(\d)\1+$/.test(d)) return false;
  return true;
}

/** "11969205041" → "(11) 96920-5041"; "1132345678" → "(11) 3234-5678". */
export function formatarTelefone(valor: unknown): string {
  const d = normalizarTelefone(valor);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
