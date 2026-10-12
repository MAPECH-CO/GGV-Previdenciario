import type { LaudoDoPerfil } from '../dados/peritos.ts'

/** Casos distintos dos laudos da API; a base é a data do último laudo, nunca a data do navegador. */
export function amostraPerito(laudos: Pick<LaudoDoPerfil, 'caso' | 'data'>[]) {
  return { casos: new Set(laudos.map(l => l.caso)).size, base: laudos.map(l => l.data).sort().at(-1) ?? null }
}
