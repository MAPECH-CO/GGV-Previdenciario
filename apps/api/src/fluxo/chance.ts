// Chance de êxito (GGVP-131; GGVP-163 R6, regra do Lucas em 16/10): número é código com teste (G19). Por etapa do caso,
// sobre os desfechos conferidos do acervo com o mesmo benefício. Antes da perícia é o êxito no mérito: ganho é
// procedente (total ou em parte), deferido e acordo; perda é improcedente; extinção sem mérito e desistência ficam fora,
// porque são falha de condução e não chance da tese. Depois do laudo é a mesma conta, só entre os casos com o mesmo
// resultado de laudo; no LOAS idoso, quem decide é o estudo social. Recorte vazio: a etapa anterior, com aviso. O
// benefício "outro" mistura matérias e não tem chance. Sem caso decidido, não há número (G22: zero não é amostra).
import type { EtapaDaChance } from '@ggv/contratos'

export const REGRA_DA_CHANCE =
  'Desfechos conferidos do acervo com o mesmo benefício, por etapa do caso: antes da perícia, ganhos (procedente, em parte, deferido ou acordo) sobre os decididos no mérito, com a extinção e a desistência fora; depois do laudo, só entre os casos com o mesmo resultado de laudo; no LOAS idoso, pelo estudo social'
export const MSG_CHANCE_DO_OUTRO = 'O benefício "outro" mistura matérias: sem chance.'

const GANHO = new Set(['procedente_total', 'procedente_parcial', 'deferido', 'acordo'])
const PERDA = new Set(['improcedente'])

/** Um processo do acervo conferido, com o que a etapa precisa. */
export type ProcessoParaAChance = { desfecho: string | null; laudoFavoravel: boolean | null; estudoSocialFavoravel: boolean | null }
/** O que o caso já sabe: o resultado do laudo (e do estudo social no LOAS idoso); indefinido ou nulo é "antes da perícia". */
export type EtapaDoCaso = { laudoFavoravel?: boolean | null; estudoSocialFavoravel?: boolean | null }
export type Chance = { casos: number; favoraveis: number; porcentagem: number | null; etapa: EtapaDaChance; aviso: string | null }

const contar = (lista: ProcessoParaAChance[]) => {
  const favoraveis = lista.filter((p) => GANHO.has(p.desfecho!)).length
  return { casos: lista.length, favoraveis, porcentagem: lista.length ? Math.round((favoraveis / lista.length) * 100) : null }
}

export function calcularChancePorEtapa(beneficio: string | null, acervo: ProcessoParaAChance[], caso: EtapaDoCaso = {}): Chance {
  if (!beneficio || beneficio === 'outro') return { casos: 0, favoraveis: 0, porcentagem: null, etapa: 'antes_da_pericia', aviso: beneficio === 'outro' ? MSG_CHANCE_DO_OUTRO : null }
  const decididos = acervo.filter((p) => p.desfecho !== null && (GANHO.has(p.desfecho) || PERDA.has(p.desfecho)))
  const peloEstudo = beneficio === 'bpc_loas_idoso'
  const resultado = peloEstudo ? caso.estudoSocialFavoravel : caso.laudoFavoravel
  if (resultado === undefined || resultado === null) return { ...contar(decididos), etapa: 'antes_da_pericia', aviso: null }
  const mesmos = decididos.filter((p) => (peloEstudo ? p.estudoSocialFavoravel : p.laudoFavoravel) === resultado)
  if (!mesmos.length)
    return { ...contar(decididos), etapa: 'antes_da_pericia', aviso: `Nenhum caso da base com o mesmo ${peloEstudo ? 'estudo social' : 'laudo'}: a chance é a de antes da perícia.` }
  return { ...contar(mesmos), etapa: peloEstudo ? 'depois_do_estudo_social' : 'depois_do_laudo', aviso: null }
}

export const REGRA_DA_CHANCE_DO_RECURSO = 'Recursos julgados no acervo conferido, do mesmo benefício: providos (no todo ou em parte) sobre julgados'

/** GGVP-161 CA2: a chance do recurso; o caso sem recurso julgado não entra (G22: toda amostra conta, zero não é amostra). */
export function calcularChanceDoRecurso(resultados: (string | null)[]) {
  const julgados = resultados.filter((r): r is string => r !== null)
  const favoraveis = julgados.filter((r) => r === 'provido' || r === 'provido_parcial').length
  return { casos: julgados.length, favoraveis, porcentagem: julgados.length ? Math.round((favoraveis / julgados.length) * 100) : null }
}

/** GGVP-150 CA2 (Lucas, 07/10): pela porcentagem mostrada; 15 e 50 ficam no amarelo. */
export function corDaChance(porcentagem: number | null) {
  if (porcentagem === null) return null
  return porcentagem < 15 ? 'vermelho' : porcentagem <= 50 ? 'amarelo' : 'verde'
}

/** GGVP-150 CA4: o que o caso ainda não sabe e deixa a chance menos certa. */
export function oQueFaltaSaber(c: { peritoConhecido: boolean; juizoConhecido: boolean; temParecer: boolean; faltamNoChecklist: string[] }) {
  return [
    !c.peritoConhecido && 'o perito',
    !c.juizoConhecido && 'o juízo',
    !c.temParecer && 'o parecer médico',
    c.faltamNoChecklist.length > 0 && `os documentos que faltam no checklist: ${c.faltamNoChecklist.join(', ')}`,
  ].filter((t): t is string => !!t)
}
