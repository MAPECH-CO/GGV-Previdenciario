// Data em dd/mm/aaaa. Letra não entra. 31/02 não existe.

const FORMATO = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** "29/02/2024" → Date (UTC). "aa/bb/cccc", "31/02/2024", "2024-02-29" → null. */
export function analisarData(valor: unknown): Date | null {
  const s = String(valor ?? '').trim();
  const m = FORMATO.exec(s);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (ano < 1900 || ano > 2200 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

export function validarData(valor: unknown): boolean {
  return analisarData(valor) !== null;
}

/** Só dígitos "29022024" → "29/02/2024" (para máscara de digitação). Outra coisa volta como está. */
export function normalizarData(valor: unknown): string {
  const s = String(valor ?? '').trim();
  const d = s.replace(/\D+/g, '');
  if (d.length === 8 && /^\d{8}$/.test(d) && !/[a-zA-Z]/.test(s)) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  return s;
}

/** Date → "dd/mm/aaaa" (em UTC). */
export function formatarData(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

/** "29/02/2024" → "2024-02-29" (para o banco). Inválida → null. */
export function dataParaIso(valor: unknown): string | null {
  const d = analisarData(valor);
  return d ? d.toISOString().slice(0, 10) : null;
}

/** "2024-02-29" → "29/02/2024". Inválida → null. */
export function isoParaData(iso: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return null;
  const br = `${m[3]}/${m[2]}/${m[1]}`;
  return validarData(br) ? br : null;
}

/** Hoje no fuso local, em "aaaa-mm-dd": o formato do calendário do navegador (`<input type="date">`). */
export function hojeIso(agora: Date = new Date()): string {
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
