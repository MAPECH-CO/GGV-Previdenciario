// Fontes de publicação da vigília (GGVP-26, GGVP-30). Cada fonte busca as publicações de uma janela de tempo.
// AASP e DJEN entram como outras implementações desta interface, lendo as credenciais do ambiente (`.env` local e
// Coolify), nunca do código nem do banco (GGVP-30 CA10). Até lá, roda a fonte de exemplo.

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

/** Processos dos casos de exemplo (TRF3, JEF de São Paulo) e um CNJ válido que não é de nenhum caso. */
export const CNJ_EXEMPLO = {
  exigencia: '00012349620264036301',
  merito: '00056787520264036301',
  desconhecido: '00099995620264036301',
} as const

const diaEmBrasilia = (d: Date) => new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

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
      { fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: dia, texto: exigencia, partes: 'Sebastião Cruz x INSS' },
      { fonte: 'djen', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: dia, texto: `  ${exigencia.toUpperCase()} `, partes: 'Sebastião Cruz x INSS' },
      {
        fonte: 'djen',
        numeroCnj: CNJ_EXEMPLO.merito,
        disponibilizadaEm: dia,
        texto: 'Ante o exposto, JULGO PROCEDENTE o pedido para condenar o INSS a conceder o benefício. (exemplo)',
        partes: 'Rosa Amaral x INSS',
      },
      { fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: dia, texto: 'Autos conclusos para despacho. (exemplo)', partes: 'Sebastião Cruz x INSS' },
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

/** Fonte ainda sem integração: a rodada falha com o motivo, e o alarme mostra (nunca parece dia sem publicação, G13). */
const naoLigada = (nome: string): Fonte => ({
  nome,
  async buscar() {
    throw new Error(`credencial ausente: a integração com ${nome.toUpperCase()} ainda não foi ligada`)
  },
})

/** `FONTES_PUBLICACAO=exemplo` (padrão) ou uma lista, como `aasp,djen`. */
export function fontesAtivas(ambiente: Record<string, string | undefined> = process.env): Fonte[] {
  const nomes = (ambiente.FONTES_PUBLICACAO ?? 'exemplo').split(',').map((n) => n.trim()).filter(Boolean)
  return nomes.map((n) => (n === 'exemplo' ? fonteDeExemplo : naoLigada(n)))
}
