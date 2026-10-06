import { somenteDigitos } from './numero.ts';

export type Endereco = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ibge: string;
};

/** "01001-000" → "01001000". */
export function normalizarCep(valor: unknown): string {
  return somenteDigitos(valor).slice(0, 8);
}

/** Oito dígitos, não todos zero. */
export function validarCep(valor: unknown): boolean {
  const d = somenteDigitos(valor);
  return d.length === 8 && !/^0{8}$/.test(d);
}

/** "01001000" → "01001-000". */
export function formatarCep(valor: unknown): string {
  const d = normalizarCep(valor);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

type FuncaoFetch = typeof globalThis.fetch;

/**
 * Consulta o ViaCEP e devolve o endereço para preencher os campos sozinho.
 * Devolve null se o CEP é inválido, não existe ou o serviço falhou.
 * `fetchFn` existe para o teste passar um fetch falso.
 */
export async function buscarCep(valor: unknown, fetchFn: FuncaoFetch = globalThis.fetch): Promise<Endereco | null> {
  if (!validarCep(valor)) return null;
  const d = normalizarCep(valor);
  let resposta: Response;
  try {
    resposta = await fetchFn(`https://viacep.com.br/ws/${d}/json/`);
  } catch {
    return null;
  }
  if (!resposta.ok) return null;
  const j = (await resposta.json()) as Record<string, unknown>;
  if (j.erro) return null;
  return {
    cep: d,
    logradouro: String(j.logradouro ?? ''),
    complemento: String(j.complemento ?? ''),
    bairro: String(j.bairro ?? ''),
    cidade: String(j.localidade ?? ''),
    uf: String(j.uf ?? ''),
    ibge: String(j.ibge ?? ''),
  };
}
