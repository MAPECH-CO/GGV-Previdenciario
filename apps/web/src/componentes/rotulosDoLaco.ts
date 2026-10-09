// Rótulos e linhas do laço de cobrança (GGVP-94, GGVP-68), usados pelos componentes de Laco.tsx e pelas telas.
import type { TentativaDoLaco } from '@ggv/contratos'

/** Canais do laço: os da cobrança e a decisão da Sênior, que entra no histórico do laço (CA10). */
export const ROTULO_DO_CANAL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  email: 'E-mail',
  sms: 'SMS',
  presencial: 'Presencial',
  decisao_senior: 'Decisão da Sênior',
}
/** Data de um momento (ISO com hora), no fuso do escritório. */
export const dataDe = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
/** Resultado da cobrança da exigência do INSS (GGVP-39). */
export const ROTULO_RESULTADO_DA_COBRANCA: Record<string, string> = { entregou: 'Entregou', sem_resposta: 'Sem resposta', vai_entregar: 'Vai entregar' }

/** A última linha do laço, para a lista de setores (GGVP-68 CA14). */
export const ultimaDoLaco = (historico: TentativaDoLaco[]) => {
  const t = historico.at(-1)
  return t ? `última: ${dataDe(t.quando)}, ${ROTULO_DO_CANAL[t.canal] ?? t.canal}, ${t.resultado}` : 'sem tentativa ainda'
}
