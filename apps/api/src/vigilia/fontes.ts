// Fontes de publicação da vigília (GGVP-26, GGVP-30). Cada fonte busca as publicações de uma janela de tempo.
// O DJEN (`djen.ts`) e a AASP (`aasp.ts`) são as fontes reais, configuradas pelo ambiente (`.env` local e Coolify),
// nunca pelo código nem pelo banco (GGVP-30 CA10). Sem configuração, roda a fonte de exemplo.
import { fonteAasp, JTR_DO_TRIBUNAL } from './aasp.ts'
import { fonteDjen, type Oab } from './djen.ts'

export type PublicacaoBruta = {
  /** De onde veio, como a fonte informa (ex.: "aasp", "djen"). */
  fonte: string
  numeroCnj: string | null
  /** aaaa-mm-dd */
  disponibilizadaEm: string
  texto: string
  partes: string | null
}

export type Fonte = { nome: string; buscar: (de: Date, ate: Date) => Promise<PublicacaoBruta[]> }

/** A rede das fontes reais; o teste troca por respostas gravadas. */
export type Rede = { buscar: typeof fetch; esperar: (ms: number) => Promise<void> }
export const redeDeVerdade: Rede = { buscar: fetch, esperar: (ms) => new Promise((pronto) => setTimeout(pronto, ms)) }

/** Processos dos casos de exemplo (TRF3, JEF de São Paulo) e um CNJ válido que não é de nenhum caso. */
export const CNJ_EXEMPLO = {
  exigencia: '00012349620264036301',
  merito: '00056787520264036301',
  desconhecido: '00099995620264036301',
} as const

/** aaaa-mm-dd no horário de Brasília (UTC−3, sem horário de verão desde 2019). */
export const diaEmBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

const ENTIDADES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/** O DJEN manda o texto em HTML (45 de 50 em 07/10): vira texto simples, com as quebras de parágrafo (decisão 46). */
export function textoDoHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, nome: string) => {
      if (nome[0] !== '#') return ENTIDADES[nome.toLowerCase()] ?? inteira
      const codigo = nome[1].toLowerCase() === 'x' ? parseInt(nome.slice(2), 16) : Number(nome.slice(1))
      return codigo <= 0x10ffff ? String.fromCodePoint(codigo) : inteira
    })
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * DADOS DE EXEMPLO: publicações fixas do dia, para o portal rodar sem as credenciais. Uma exigência (que chega pelas
 * duas fontes, para testar o descarte), uma decisão de mérito, um andamento, uma sem CNJ e uma com CNJ desconhecido.
 */
export const fonteDeExemplo: Fonte = {
  nome: 'exemplo',
  async buscar(_de, ate) {
    const dia = diaEmBrasilia(ate)
    const exigencia =
      'Intime-se a parte autora para que, no prazo de 15 (quinze) dias, junte aos autos laudo médico atualizado, sob pena de extinção. (exemplo)'
    return [
      { fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: dia, texto: exigencia, partes: 'Otávio Lima x INSS' },
      { fonte: 'djen', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: dia, texto: `  ${exigencia.toUpperCase()} `, partes: 'Otávio Lima x INSS' },
      {
        fonte: 'djen',
        numeroCnj: CNJ_EXEMPLO.merito,
        disponibilizadaEm: dia,
        texto: 'Ante o exposto, JULGO PROCEDENTE o pedido para condenar o INSS a conceder o benefício. (exemplo)',
        partes: 'Rosa Amaral x INSS',
      },
      { fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: dia, texto: 'Autos conclusos para despacho. (exemplo)', partes: 'Otávio Lima x INSS' },
      {
        fonte: 'aasp',
        numeroCnj: null,
        disponibilizadaEm: dia,
        texto: 'Fica a parte autora intimada a se manifestar sobre o laudo pericial. (exemplo, sem número do processo)',
        partes: 'Joana Prado x Instituto Nacional do Seguro Social',
      },
      {
        fonte: 'djen',
        numeroCnj: CNJ_EXEMPLO.desconhecido,
        disponibilizadaEm: dia,
        texto: 'Designo audiência de conciliação. (exemplo, processo que não é do escritório)',
        partes: 'Fulano de Tal x INSS',
      },
    ]
  },
}

/** Fonte que não roda: a rodada falha com o motivo, e o alarme mostra (nunca parece dia sem publicação, G13). */
const falha = (nome: string, motivo: string): Fonte => ({
  nome,
  async buscar() {
    throw new Error(motivo)
  },
})
const naoLigada = (nome: string) => falha(nome, `credencial ausente: a integração com ${nome.toUpperCase()} ainda não foi ligada`)

const lista = (valor: string | undefined) => (valor ?? '').split(',').map((v) => v.trim()).filter(Boolean)

/** `DJEN_OABS=123456/SP,654321/RJ`: número (só os dígitos valem) e UF; uma fora do formato derruba a fonte, com alarme. */
function oabsDe(valor: string | undefined): Oab[] | null {
  const oabs = lista(valor).map((o) => {
    const [numero = '', uf = ''] = o.split('/')
    return { numero: numero.replace(/\D/g, ''), uf: uf.trim().toUpperCase() }
  })
  return oabs.every((o) => o.numero && /^[A-Z]{2}$/.test(o.uf)) ? oabs : null
}

/**
 * `FONTES_PUBLICACAO=exemplo` (padrão) ou uma lista, como `aasp,djen` (GGVP-30 CA10; grupo 4, decisão 48). O DJEN usa
 * `DJEN_OABS`, a AASP usa `AASP_CHAVES` (segredo), e as duas olham os tribunais de `VIGILIA_TRIBUNAIS` (padrão TRF3 e TJSP).
 */
export function fontesAtivas(ambiente: Record<string, string | undefined> = process.env, rede: Rede = redeDeVerdade): Fonte[] {
  const tribunais = lista(ambiente.VIGILIA_TRIBUNAIS ?? 'TRF3,TJSP').map((t) => t.toUpperCase())
  const desconhecido = tribunais.find((t) => !JTR_DO_TRIBUNAL[t])
  return lista(ambiente.FONTES_PUBLICACAO ?? 'exemplo').map((nome) => {
    if (nome === 'exemplo') return fonteDeExemplo
    if (nome !== 'djen' && nome !== 'aasp') return naoLigada(nome)
    if (desconhecido) return falha(nome, `api: tribunal que a vigília não conhece (${desconhecido}); use TRF1 a TRF6 ou TJSP`)
    if (nome === 'djen') {
      if (!ambiente.DJEN_OABS) return naoLigada(nome)
      const oabs = oabsDe(ambiente.DJEN_OABS)
      return oabs ? fonteDjen(oabs, tribunais, rede) : falha(nome, 'api: DJEN_OABS fora do formato número/UF, como 123456/SP')
    }
    const chaves = lista(ambiente.AASP_CHAVES)
    return chaves.length ? fonteAasp(chaves, tribunais, rede) : naoLigada(nome)
  })
}
