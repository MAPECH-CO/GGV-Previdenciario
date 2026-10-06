// O benefício do caso (GGVP-51): o que a advogada citou na entrevista e os requisitos numéricos da sugestão, por código
// com teste, nunca pela IA (G19).
import type { Requisito, Trecho, Vinculo } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'
import { idadeEm } from './datas.ts'

/** Carência do auxílio e da aposentadoria por incapacidade: 12 contribuições (Lei 8.213, art. 25, I). */
export const CARENCIA = 12
/** O auxílio por incapacidade temporária pede afastamento de mais de 15 dias (Lei 8.213, art. 59). */
export const AFASTAMENTO_MINIMO = 15
/** O LOAS Idoso pede 65 anos (Lei 8.742, art. 20). */
export const IDADE_DO_LOAS = 65

/** Como a advogada fala cada benefício na conversa: o nome do catálogo e os de todo dia. Do mais específico ao mais geral. */
const APELIDOS: [string, string[]][] = [
  ['incapacidade-permanente-acidentaria', ['aposentadoria por invalidez acidentaria', 'aposentadoria por incapacidade permanente acidentaria']],
  ['incapacidade-permanente', ['aposentadoria por invalidez', 'aposentadoria por incapacidade permanente']],
  ['incapacidade-temporaria', ['auxilio por incapacidade temporaria', 'auxilio-doenca', 'auxilio doenca']],
  ['auxilio-acidente', ['auxilio-acidente', 'auxilio acidente', 'auxilio acidentario']],
  ['loas-idoso', ['loas idoso', 'loas do idoso', 'bpc idoso', 'bpc do idoso']],
  ['loas-deficiente', ['loas deficiente', 'bpc deficiente', 'loas da pessoa com deficiencia', 'bpc da pessoa com deficiencia']],
  ['aposentadoria-idade', ['aposentadoria por idade']],
  ['aposentadoria-contribuicao', ['aposentadoria por contribuicao', 'aposentadoria por tempo de contribuicao']],
  ['aposentadoria-especial', ['aposentadoria especial']],
  ['aposentadoria-rural', ['aposentadoria rural']],
  ['pensao-morte', ['pensao por morte']],
  ['salario-maternidade', ['salario-maternidade', 'salario maternidade']],
]

/** O benefício que a advogada disse na entrevista (CA1, G3): o da última fala dela que cita um. */
export function beneficioCitado(trechos: Trecho[]): string | undefined {
  for (const t of [...trechos].reverse()) {
    if (t.papel !== 'advogada') continue
    const fala = semAcento(t.texto)
    const achado = APELIDOS.find(([, nomes]) => nomes.some((n) => fala.includes(n)))
    if (achado) return achado[0]
  }
  return undefined
}

const mes = (aaaaMm: string) => {
  const [a, m] = aaaaMm.split('-').map(Number)
  return a * 12 + (m - 1)
}

/** Contribuições no CNIS até `ate` (aaaa-mm-dd): os meses cobertos pelos vínculos, sem contar duas vezes o mesmo mês. */
export function contribuicoes(vinculos: Vinculo[], ate: string): number {
  const fim = mes(ate.slice(0, 7))
  const meses = new Set<number>()
  for (const v of vinculos) for (let m = mes(v.inicio); m <= Math.min(v.fim ? mes(v.fim) : fim, fim); m++) meses.add(m)
  return meses.size
}

/** Dias desde o primeiro dia do mês "mm/aaaa" até hoje; nulo se não der para ler. */
export function diasDesde(mesAno: string, hoje: string): number | null {
  const achado = /^(\d{2})\/(\d{4})$/.exec(mesAno.trim())
  if (!achado) return null
  const [a, m, d] = hoje.split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(Number(achado[2]), Number(achado[1]) - 1, 1)) / 86_400_000)
}

/**
 * Os requisitos numéricos do benefício, calculados por código (CA7, G19). Sem o dado, o requisito diz o que falta e fica
 * sem resposta (nulo).
 */
export function requisitosDoBeneficio(
  beneficio: string,
  dados: { vinculos?: Vinculo[]; semTrabalharDesde?: string; nascimento?: string },
  hoje: string,
): Requisito[] {
  const carencia = (): Requisito => {
    if (!dados.vinculos) return { texto: 'Carência: sem CNIS no caso para contar as contribuições', atende: null }
    const n = contribuicoes(dados.vinculos, hoje)
    return { texto: `Carência: ${n} contribuições no CNIS; o mínimo é ${CARENCIA} (calculado por código, G19)`, atende: n >= CARENCIA }
  }
  const afastamento = (): Requisito => {
    const dias = dados.semTrabalharDesde ? diasDesde(dados.semTrabalharDesde, hoje) : null
    if (dias === null) return { texto: 'Afastamento: a entrevista não disse desde quando', atende: null }
    return {
      texto: `Afastamento: ${dias} dias desde ${dados.semTrabalharDesde}; precisa de mais de ${AFASTAMENTO_MINIMO} (calculado por código, G19)`,
      atende: dias > AFASTAMENTO_MINIMO,
    }
  }
  const idade = (): Requisito => {
    if (!dados.nascimento) return { texto: 'Idade: sem data de nascimento na ficha', atende: null }
    const anos = idadeEm(dados.nascimento, hoje)
    return { texto: `Idade: ${anos} anos; o LOAS Idoso pede ${IDADE_DO_LOAS} (calculado por código, G19)`, atende: anos >= IDADE_DO_LOAS }
  }
  if (beneficio === 'incapacidade-temporaria') return [carencia(), afastamento()]
  if (beneficio === 'incapacidade-permanente') return [carencia()]
  if (beneficio === 'loas-idoso') return [idade()]
  return []
}
