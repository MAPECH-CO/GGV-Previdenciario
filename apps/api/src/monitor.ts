// GGVP-158 P9.5 (ADR-018): o monitor do /saude da produção, num container à parte, com a mesma imagem. A cada minuto
// olha o /saude do endereço que recebe. Duas falhas seguidas avisam o suporte, pelo canal e pelo Jira do alarme da
// vigília (`suporte.ts`), e a primeira resposta boa depois avisa a volta. O aviso leva só o endereço, o motivo e o tempo.
// Uso: pnpm --filter @ggv/api monitor https://endereço-do-portal
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { criarSuporte, type Entrega, type Suporte } from './suporte.ts'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export const INTERVALO_MS = 60_000
export const TEMPO_LIMITE_MS = 10_000
export const MSG_USO = 'Uso: pnpm --filter @ggv/api monitor https://endereço-do-portal'

/** O motivo da falha do /saude, ou null quando ele respondeu bem: 200, com `ok: true`. */
export async function olharSaude(url: string, fetch: Fetch = globalThis.fetch): Promise<string | null> {
  try {
    const r = await fetch(`${url}/saude`, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) })
    const corpo = (await r.json().catch(() => null)) as { ok?: unknown; banco?: unknown } | null
    if (r.status === 200) return corpo?.ok === true ? null : 'respondeu sem "ok"'
    return corpo?.banco === 'fora-do-ar' ? `respondeu ${r.status}, com o banco fora do ar` : `respondeu ${r.status}`
  } catch {
    return `não respondeu em até ${TEMPO_LIMITE_MS / 1000} segundos`
  }
}

export type Olhada = { motivo: string | null; aviso: 'caiu' | 'voltou' | null; entregas?: { canal: Entrega; jira: Entrega } }

/**
 * Uma olhada por chamada; o estado fica entre as chamadas. Duas falhas seguidas avisam a queda (uma só não: o deploy
 * troca o container em segundos); a primeira resposta boa depois avisa a volta, com o tempo desde a primeira falha.
 */
export function criarMonitor({ url, suporte = criarSuporte(), fetch = globalThis.fetch, agora = () => new Date() }: { url: string; suporte?: Suporte; fetch?: Fetch; agora?: () => Date }) {
  let falhas = 0
  let desde: Date | null = null
  let caiu = false
  return async function olhar(): Promise<Olhada> {
    const motivo = await olharSaude(url, fetch)
    if (motivo) {
      falhas++
      desde ??= agora()
      if (falhas !== 2) return { motivo, aviso: null }
      caiu = true
      return { motivo, aviso: 'caiu', entregas: await suporte({ titulo: 'O portal caiu', texto: `${url}: o /saude ${motivo}.` }) }
    }
    const fora = caiu && desde ? Math.max(1, Math.round((agora().getTime() - desde.getTime()) / 60_000)) : null
    falhas = 0
    desde = null
    caiu = false
    if (fora === null) return { motivo: null, aviso: null }
    return { motivo: null, aviso: 'voltou', entregas: await suporte({ titulo: 'O portal voltou', texto: `${url} voltou a responder depois de ${fora} min fora do ar.` }) }
  }
}

const executadoDireto = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (executadoDireto) {
  const url = process.argv[2]?.replace(/\/+$/, '')
  if (!url || !/^https?:\/\//.test(url)) {
    console.error(MSG_USO)
    process.exit(2)
  }
  const olhar = criarMonitor({ url })
  const rodada = () =>
    void olhar()
      .then(({ motivo, aviso, entregas }) => {
        if (motivo) console.error(`[monitor] ${url}: o /saude ${motivo}`)
        if (aviso) console.error(`[monitor] aviso "${aviso}": canal ${entregas?.canal}, Jira ${entregas?.jira}`)
      })
      .catch((e: unknown) => console.error('[monitor] a olhada falhou', e instanceof Error ? e.name : e))
  console.log(`[monitor] olhando ${url}/saude a cada ${INTERVALO_MS / 1000} segundos`)
  rodada()
  setInterval(rodada, INTERVALO_MS)
}
