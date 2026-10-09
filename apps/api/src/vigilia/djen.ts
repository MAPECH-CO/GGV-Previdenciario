// Fonte DJEN (GGVP-26, GGVP-30; design, grupo 4, decisões 44 e 47): a consulta pública do CNJ, sem chave.
// Uma consulta por OAB e tribunal da vigília, com os dias da janela no horário de Brasília, 50 por página até o `count`.
import { diaEmBrasilia, redeDeVerdade, textoDoHtml, type Fonte, type PublicacaoBruta, type Rede } from './fontes.ts'

export const URL_DJEN = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
const POR_PAGINA = 50
/** O DJEN não publica limite de taxa e responde 500 sob rajada: meio segundo entre as chamadas. */
const INTERVALO_MS = 500
const NOVA_TENTATIVA_MS = 2_000
/** Duas tentativas cabem nos 60 s da rodada: 25 + 2 + 25. */
const TEMPO_POR_CHAMADA_MS = 25_000

export type Oab = { numero: string; uf: string }

/** O que a fonte usa de cada comunicação (a resposta traz mais campos). */
type Comunicacao = {
  id: number
  data_disponibilizacao: string
  numero_processo: string | null
  texto: string | null
  ativo?: boolean
  data_cancelamento?: string | null
  destinatarios?: { nome?: string }[]
}

export function fonteDjen(oabs: Oab[], tribunais: string[], { buscar, esperar }: Rede = redeDeVerdade): Fonte {
  /** Sem resposta (rede fora ou tempo esgotado), devolve nulo. */
  async function chamar(url: string): Promise<Response | null> {
    try {
      return await buscar(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TEMPO_POR_CHAMADA_MS) })
    } catch {
      return null
    }
  }

  // Sem resposta ou 5xx tenta de novo uma vez, depois de 2 s. O resto vira falha da API, que também avisa o suporte
  // (GGVP-30 CA8; ajuste de 07/10: um soluço da rede na rodada real virou alarme).
  async function pagina(params: Record<string, string>): Promise<{ count: number; items: Comunicacao[] }> {
    const url = `${URL_DJEN}?${new URLSearchParams(params)}`
    let resposta = await chamar(url)
    if (!resposta || resposta.status >= 500) {
      await esperar(NOVA_TENTATIVA_MS)
      resposta = await chamar(url)
    }
    if (!resposta) throw new Error('api: o DJEN não respondeu')
    if (!resposta.ok) throw new Error(`api: o DJEN respondeu ${resposta.status}`)
    return resposta.json()
  }

  return {
    nome: 'djen',
    async buscar(de, ate) {
      const vistas = new Set<number>()
      const publicacoes: PublicacaoBruta[] = []
      let primeira = true
      for (const oab of oabs) {
        for (const tribunal of tribunais) {
          for (let n = 1, lidas = 0, total = Infinity; lidas < total; n++) {
            if (!primeira) await esperar(INTERVALO_MS)
            primeira = false
            const { count, items } = await pagina({
              // Só dígitos: com o ponto (123.456), o DJEN não acha nada.
              numeroOab: oab.numero.replace(/\D/g, ''),
              ufOab: oab.uf.toUpperCase(),
              siglaTribunal: tribunal,
              dataDisponibilizacaoInicio: diaEmBrasilia(de),
              dataDisponibilizacaoFim: diaEmBrasilia(ate),
              pagina: String(n),
              itensPorPagina: String(POR_PAGINA),
            })
            if (!items.length) break
            total = count
            lidas += items.length
            for (const c of items) {
              // A mesma comunicação achada por outra OAB conta uma vez; a cancelada fica de fora.
              if (vistas.has(c.id) || c.ativo === false || c.data_cancelamento) continue
              vistas.add(c.id)
              publicacoes.push({
                fonte: 'djen',
                numeroCnj: c.numero_processo?.replace(/\D/g, '') || null,
                disponibilizadaEm: c.data_disponibilizacao,
                texto: textoDoHtml(c.texto ?? ''),
                partes: (c.destinatarios ?? []).map((d) => d.nome).filter(Boolean).join(', ') || null,
              })
            }
          }
        }
      }
      return publicacoes
    },
  }
}
