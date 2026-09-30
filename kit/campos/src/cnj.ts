import { somenteDigitos } from './numero.ts';

// Número CNJ (Resolução 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
// DD = 98 - ((NNNNNNN AAAA J TR OOOO 00) mod 97)

/** "0001234-71.2024.8.26.0100" → "00012347120248260100". */
export function normalizarCnj(valor: unknown): string {
  return somenteDigitos(valor);
}

function mod97(digitos: string): number {
  let r = 0;
  for (const ch of digitos) r = (r * 10 + Number(ch)) % 97;
  return r;
}

/** Dígitos verificadores para as partes do número (sem o DV). */
export function gerarDvCnj(sequencial: string, ano: string, justica: string, tribunal: string, origem: string): string {
  const base = sequencial.padStart(7, '0') + ano.padStart(4, '0') + justica + tribunal.padStart(2, '0') + origem.padStart(4, '0') + '00';
  return String(98 - mod97(base)).padStart(2, '0');
}

/** Vinte dígitos com o DV certo. */
export function validarCnj(valor: unknown): boolean {
  const d = normalizarCnj(valor);
  if (d.length !== 20) return false;
  const seq = d.slice(0, 7);
  const dv = d.slice(7, 9);
  const ano = d.slice(9, 13);
  const j = d.slice(13, 14);
  const tr = d.slice(14, 16);
  const o = d.slice(16, 20);
  return gerarDvCnj(seq, ano, j, tr, o) === dv;
}

/** "00012347120248260100" → "0001234-71.2024.8.26.0100". */
export function formatarCnj(valor: unknown): string {
  const d = normalizarCnj(valor);
  if (d.length !== 20) return d;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}
