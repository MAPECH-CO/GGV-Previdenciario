import { somenteDigitos } from './numero.ts';

// Agência e conta bancária (GGVP-111 CA9, teste do Pedro de 14/10): a pessoa digita só os números e o traço entra sozinho.
// A conta tem de 3 a 12 números e o dígito no fim, que pode ser X (há banco que usa); a agência, 4 números e, às vezes, o
// dígito. O dígito NÃO é conferido: cada banco tem o seu cálculo.

/** Os números e o dígito da conta, sem traço: "12345-6" → "123456". O X só vale como o último. */
function daConta(valor: unknown): string {
  return String(valor ?? '').toUpperCase().replace(/[^\dX]/g, '').replace(/X(?=.)/g, '').slice(0, 13);
}

/** A cada tecla, o traço antes do último: "123456" → "12345-6"; "1234x" → "1234-X". */
export function formatarConta(valor: unknown): string {
  const s = daConta(valor);
  return s.length < 2 ? s : `${s.slice(0, -1)}-${s.slice(-1)}`;
}

/** De 3 a 12 números, o traço e o dígito (número ou X). */
export function validarConta(valor: unknown): boolean {
  return /^\d{3,12}-[\dXx]$/.test(String(valor ?? '').trim());
}

/** "0001" fica; com 5 números, o último é o dígito: "00019" → "0001-9". */
export function formatarAgencia(valor: unknown): string {
  const d = somenteDigitos(valor).slice(0, 5);
  return d.length === 5 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

/** 4 números e, se houver, o traço e o dígito. */
export function validarAgencia(valor: unknown): boolean {
  return /^\d{4}(-\d)?$/.test(String(valor ?? '').trim());
}
