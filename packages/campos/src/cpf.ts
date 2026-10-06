import { somenteDigitos } from './numero.ts';

/** "111.444.777-35" → "11144477735". */
export function normalizarCpf(valor: unknown): string {
  return somenteDigitos(valor).slice(0, 11);
}

/** "11144477735" → "111.444.777-35". Incompleto volta como está. */
export function formatarCpf(valor: unknown): string {
  const d = normalizarCpf(valor);
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function digitoVerificador(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Onze dígitos, não repetidos, com os dois dígitos verificadores certos. */
export function validarCpf(valor: unknown): boolean {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const d1 = digitoVerificador(d.slice(0, 9), 10);
  const d2 = digitoVerificador(d.slice(0, 10), 11);
  return d1 === Number(d[9]) && d2 === Number(d[10]);
}
