// Os feriados e as suspensões que a lei fixa, para carregar na tabela `feriado` (GGVP-146, parte 3). Só entra o que é
// certo por lei. Na dúvida, fica de fora: um feriado a menos adianta o prazo (o lado seguro), um a mais o atrasaria. O
// resto (o feriado da cidade da vara, Corpus Christi, a suspensão de cada ano) a Sênior acrescenta na Configuração.
// Regra de data é código com teste: a Páscoa sai da conta, nunca digitada.
import { TRIBUNAIS_CONHECIDOS, type TribunalConhecido } from '@ggv/contratos'
import { somarDias } from './prazo-inss.ts'

export type FeriadoDaLei = { data: string; tribunal: TribunalConhecido | null; descricao: string }

/** Domingo de Páscoa (algoritmo de Meeus, Jones e Butcher), em aaaa-mm-dd. */
export function pascoa(ano: number): string {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Os dias de `de` a `ate`, inclusive. */
function periodo(de: string, ate: string): string[] {
  const dias: string[] = []
  for (let d = de; d <= ate; d = somarDias(d, 1)) dias.push(d)
  return dias
}

const JUSTICA_FEDERAL = (Object.keys(TRIBUNAIS_CONHECIDOS) as TribunalConhecido[]).filter((t) => t.startsWith('4.'))
const LEI_5010 = 'Justiça Federal (Lei 5.010/1966, art. 62)'
const CPC_220 = 'suspensão dos prazos (CPC, art. 220)'

/** Os feriados nacionais, os da Justiça Federal (TRF1 a TRF6) e os do TJSP no ano, sem repetir o dia que já é nacional. */
export function feriadosDaLei(ano: number): FeriadoDaLei[] {
  const p = pascoa(ano)
  const nacionais: FeriadoDaLei[] = [
    [`${ano}-01-01`, 'Confraternização Universal (Lei 662/1949)'],
    [somarDias(p, -2), 'Paixão de Cristo (feriado nacional na portaria anual do governo federal)'],
    [`${ano}-04-21`, 'Tiradentes (Lei 662/1949)'],
    [`${ano}-05-01`, 'Dia do Trabalho (Lei 662/1949)'],
    [`${ano}-09-07`, 'Independência do Brasil (Lei 662/1949)'],
    [`${ano}-10-12`, 'Nossa Senhora Aparecida (Lei 6.802/1980)'],
    [`${ano}-11-02`, 'Finados (Lei 662/1949)'],
    [`${ano}-11-15`, 'Proclamação da República (Lei 662/1949)'],
    [`${ano}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)'],
    [`${ano}-12-25`, 'Natal (Lei 662/1949)'],
  ].map(([data, descricao]) => ({ data, tribunal: null, descricao }))
  const jaNacional = new Set(nacionais.map((f) => f.data))

  const federal: [string, string][] = [
    ...periodo(`${ano}-01-01`, `${ano}-01-06`).map((d): [string, string] => [d, `Recesso de fim de ano: ${LEI_5010}`]),
    [somarDias(p, -48), `Segunda-feira de Carnaval: ${LEI_5010}`],
    [somarDias(p, -47), `Terça-feira de Carnaval: ${LEI_5010}`],
    ...periodo(somarDias(p, -4), p).map((d): [string, string] => [d, `Semana Santa: ${LEI_5010}`]),
    [`${ano}-08-11`, `11 de agosto: ${LEI_5010}`],
    [`${ano}-11-01`, `Todos os Santos: ${LEI_5010}`],
    [`${ano}-12-08`, `8 de dezembro: ${LEI_5010}`],
    ...periodo(`${ano}-12-20`, `${ano}-12-31`).map((d): [string, string] => [d, `Recesso de fim de ano: ${LEI_5010}`]),
  ]
  const tjsp: [string, string][] = [
    ...periodo(`${ano}-01-01`, `${ano}-01-20`).map((d): [string, string] => [d, `Começo do ano: ${CPC_220}`]),
    [`${ano}-07-09`, 'Revolução Constitucionalista de 1932 (Lei estadual 9.497/1997)'],
    ...periodo(`${ano}-12-20`, `${ano}-12-31`).map((d): [string, string] => [d, `Fim do ano: ${CPC_220}`]),
  ]
  const doTribunal = (tribunal: TribunalConhecido, dias: [string, string][]) =>
    dias.filter(([data]) => !jaNacional.has(data)).map(([data, descricao]): FeriadoDaLei => ({ data, tribunal, descricao }))
  return [...nacionais, ...JUSTICA_FEDERAL.flatMap((t) => doTribunal(t, federal)), ...doTribunal('8.26', tjsp)]
}
