// EXEMPLO. O acervo de casos da casa e a "IA" que sugere o benefício por ele (GGVP-51). Casos falsos de propósito; a
// "IA" só conta os sinais de cada caso que aparecem na entrevista e na ficha. Ligar no servidor: o RAG de verdade sobre o
// acervo (carga do Raio-X de 979 processos, serviço de implantação da MAPECH).
import { semAcento } from '../regras/busca.ts'
import { nomeBeneficio } from './catalogos.ts'
import type { CasoDoAcervo } from './tipos.ts'

type Sinal = { chave: string; rotulo: string }

const SINAIS = {
  parou: { chave: 'parei', rotulo: 'parou de trabalhar' },
  laudo: { chave: 'laudo', rotulo: 'laudos' },
  ortopedista: { chave: 'ortopedista', rotulo: 'laudo do ortopedista' },
  negado: { chave: 'nega', rotulo: 'pedido negado no INSS' },
  bracal: { chave: 'limpeza', rotulo: 'trabalho braçal' },
  tratamento: { chave: 'fisioterapia', rotulo: 'tratamento em curso' },
  carteira: { chave: 'carteira', rotulo: 'trabalho com carteira' },
  coluna: { chave: 'coluna', rotulo: 'problema na coluna' },
  crise: { chave: 'crise', rotulo: 'crises' },
  loas: { chave: 'loas', rotulo: 'procura o LOAS' },
  idoso: { chave: 'idoso', rotulo: 'idade' },
  familia: { chave: 'casa', rotulo: 'renda da família' },
} satisfies Record<string, Sinal>

type CasoComSinais = CasoDoAcervo & { sinais: Sinal[] }

function caso(numero: string, beneficio: string, resultado: CasoDoAcervo['resultado'], resumo: string, sinais: Sinal[]): CasoComSinais {
  return { id: `acervo-${numero}`, titulo: `Caso ${numero} (exemplo)`, beneficio, resultado, resumo, sinais }
}

export const ACERVO: CasoComSinais[] = [
  caso('0118', 'incapacidade-temporaria', 'deferido', 'Auxiliar de limpeza afastada depois de cirurgia; 2 laudos do ortopedista; pedido negado e revertido.', [
    SINAIS.parou,
    SINAIS.laudo,
    SINAIS.ortopedista,
    SINAIS.negado,
    SINAIS.bracal,
    SINAIS.tratamento,
  ]),
  caso('0342', 'incapacidade-temporaria', 'deferido', 'Auxiliar de produção em fisioterapia; laudo recente; carteira assinada.', [
    SINAIS.tratamento,
    SINAIS.laudo,
    SINAIS.carteira,
    SINAIS.parou,
  ]),
  caso('0207', 'incapacidade-permanente', 'deferido', 'Porteiro com crises na coluna; três laudos; perícia judicial favorável.', [
    SINAIS.coluna,
    SINAIS.laudo,
    SINAIS.ortopedista,
    SINAIS.crise,
  ]),
  caso('0455', 'loas-idoso', 'deferido', 'Idosa sem renda, família de três pessoas, CadÚnico em dia.', [SINAIS.loas, SINAIS.idoso, SINAIS.familia]),
  caso('0510', 'aposentadoria-idade', 'deferido', 'Trabalhadora urbana com 15 anos de carteira e a idade mínima.', [SINAIS.carteira]),
  caso('0601', 'incapacidade-temporaria', 'indeferido', 'Laudo antigo, sem afastamento comprovado.', [SINAIS.laudo]),
]

function semSinais(c: CasoComSinais): CasoDoAcervo {
  return { id: c.id, titulo: c.titulo, beneficio: c.beneficio, resultado: c.resultado, resumo: c.resumo }
}

/**
 * A sugestão pelo acervo (CA2): cada caso deferido ganha um ponto por sinal que aparece no texto; o benefício com mais
 * pontos é o sugerido, o segundo é a alternativa; a base são os três casos mais parecidos. Nulo se nada bate.
 */
export function sugerirPeloAcervo(texto: string): { sugerido: string; alternativa?: string; base: CasoDoAcervo[]; porque: string } | null {
  const t = semAcento(texto)
  const pontuados = ACERVO.filter((c) => c.resultado === 'deferido')
    .map((c) => ({ caso: c, achados: c.sinais.filter((s) => t.includes(s.chave)) }))
    .filter((p) => p.achados.length > 0)
    .sort((a, b) => b.achados.length - a.achados.length)
  if (pontuados.length === 0) return null
  const porBeneficio = new Map<string, number>()
  for (const p of pontuados) porBeneficio.set(p.caso.beneficio, (porBeneficio.get(p.caso.beneficio) ?? 0) + p.achados.length)
  const [sugerido, alternativa] = [...porBeneficio.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b)
  const doSugerido = pontuados.filter((p) => p.caso.beneficio === sugerido)
  const rotulos = [...new Set(doSugerido.flatMap((p) => p.achados.map((s) => s.rotulo)))]
  const n = doSugerido.length
  return {
    sugerido,
    alternativa,
    base: pontuados.slice(0, 3).map((p) => semSinais(p.caso)),
    porque: `Parecido com ${n} ${n === 1 ? 'caso deferido' : 'casos deferidos'} de ${nomeBeneficio(sugerido)} na casa: ${rotulos.join(', ')}.`,
  }
}
