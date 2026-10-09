// Fonte AASP (GGVP-26, GGVP-30; design, grupo 4, decisões 45 e 47): a API de Intimações, com uma chave por associado.
// A chave vai na URL: nenhuma mensagem de erro, log ou registro leva a URL nem a chave.
import { diaEmBrasilia, redeDeVerdade, textoDoHtml, type Fonte, type PublicacaoBruta, type Rede } from './fontes.ts'

export const URL_AASP = 'https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json'
const INTERVALO_MS = 500
const UM_DIA_MS = 24 * 3_600_000

/** O `J.TR` do número CNJ de cada tribunal que a vigília pode olhar (decisão 47). */
export const JTR_DO_TRIBUNAL: Record<string, string> = { TRF1: '401', TRF2: '402', TRF3: '403', TRF4: '404', TRF5: '405', TRF6: '406', TJSP: '826' }

/** O que a fonte usa de cada intimação (a resposta traz mais campos; mapa da decisão 45). */
type Intimacao = {
  jornal?: { dataDisponibilizacao_Publicacao?: string }
  textoPublicacao?: string | null
  numeroUnicoProcesso?: string | null
}

/** Os dias (aaaa-mm-dd, Brasília) de `de` até `ate`. */
function diasDaJanela(de: Date, ate: Date): string[] {
  const dias: string[] = []
  for (let t = de.getTime(); diaEmBrasilia(new Date(t)) <= diaEmBrasilia(ate); t += UM_DIA_MS) dias.push(diaEmBrasilia(new Date(t)))
  return dias
}

export function fonteAasp(chaves: string[], tribunais: string[], { buscar, esperar }: Rede = redeDeVerdade): Fonte {
  const ramos = new Set(tribunais.map((t) => JTR_DO_TRIBUNAL[t]).filter(Boolean))
  const doTribunal = (cnj: string) => cnj.length === 20 && ramos.has(cnj.slice(13, 16))

  async function intimacoes(chave: string, posicao: string, dia: string): Promise<Intimacao[]> {
    const url = `${URL_AASP}?${new URLSearchParams({ chave, data: dia })}`
    let resposta: Response
    try {
      resposta = await buscar(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
    } catch {
      throw new Error('api: a AASP não respondeu')
    }
    if (resposta.status === 401 || resposta.status === 403) throw new Error(`credencial: a AASP recusou a chave ${posicao} (HTTP ${resposta.status})`)
    if (!resposta.ok) throw new Error(`api: a AASP respondeu ${resposta.status}`)
    const corpo = (await resposta.json().catch(() => null)) as { intimacoes?: Intimacao[]; erro?: boolean; status?: string } | null
    if (!corpo || corpo.erro) {
      const status = String(corpo?.status ?? 'resposta fora do formato').replaceAll(chave, '***').slice(0, 100)
      throw new Error(`api: a AASP respondeu com erro (${status})`)
    }
    return corpo.intimacoes ?? []
  }

  return {
    nome: 'aasp',
    async buscar(de, ate) {
      const publicacoes: PublicacaoBruta[] = []
      let primeira = true
      for (const [i, chave] of chaves.entries()) {
        for (const dia of diasDaJanela(de, ate)) {
          if (!primeira) await esperar(INTERVALO_MS)
          primeira = false
          for (const intimacao of await intimacoes(chave, `${i + 1} de ${chaves.length}`, dia)) {
            const cnj = (intimacao.numeroUnicoProcesso ?? '').replace(/\D/g, '')
            // De outro tribunal (a Justiça do Trabalho, por exemplo), fica de fora; sem CNJ, segue para a fila de revisão.
            if (cnj && !doTribunal(cnj)) continue
            publicacoes.push({
              fonte: 'aasp',
              numeroCnj: cnj || null,
              disponibilizadaEm: intimacao.jornal?.dataDisponibilizacao_Publicacao?.slice(0, 10) || dia,
              texto: textoDoHtml(intimacao.textoPublicacao ?? ''),
              partes: null,
            })
          }
        }
      }
      return publicacoes
    },
  }
}
