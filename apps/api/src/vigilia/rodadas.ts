// Rodadas da vigília (GGVP-30, G13): 3 por dia por fonte, cada uma com início, fim, quantidade e status. Falha e
// "não rodou" ficam marcadas, para nunca parecer um dia sem publicação.
import { and, eq, gt, lte } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { configuracao, eventoAuditoria, rodadaVigilia } from '../banco/esquema.ts'
import { casarPublicacoes } from './casar.ts'
import { hojeEmBrasilia } from './fila.ts'
import type { Fonte } from './fontes.ts'

/** Horários de Brasília. A regra é 3 por dia (G13); os horários são parâmetro do escritório (`vigilia.horarios`). */
export const HORARIOS_PADRAO = ['08:00', '13:00', '18:00']
export const TEMPO_LIMITE_MS = 60_000
export const TOLERANCIA_NAO_RODOU_MS = 30 * 60_000
const UM_DIA_MS = 86_400_000

export async function horariosDaVigilia(banco: Banco): Promise<string[]> {
  const [c] = await banco.select({ valor: configuracao.valor }).from(configuracao).where(eq(configuracao.chave, 'vigilia.horarios'))
  const v = c?.valor
  return Array.isArray(v) && v.length > 0 && v.every((h) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h)) ? (v as string[]) : HORARIOS_PADRAO
}

export const momentoDoHorario = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`)

/** Cria as rodadas previstas do dia, por fonte e horário. Idempotente pela chave fonte + horário. */
export async function planejarDia(banco: Banco, fontes: Fonte[], agora: Date) {
  const dia = hojeEmBrasilia(agora)
  for (const hora of await horariosDaVigilia(banco))
    for (const f of fontes)
      await banco.insert(rodadaVigilia).values({ fonte: f.nome, previstaPara: momentoDoHorario(dia, hora) }).onConflictDoNothing()
}

const comTempoLimite = <T>(promessa: Promise<T>, ms: number) =>
  Promise.race([promessa, new Promise<never>((_, falhar) => setTimeout(() => falhar(new Error(`tempo esgotado: a fonte não respondeu em ${ms / 1000} s`)), ms))])

/**
 * Roda uma rodada: busca as 24 horas até o horário previsto (a janela se sobrepõe à anterior; a repetida é descartada
 * pelo hash, CA6) e casa as publicações. Erro, tempo esgotado ou credencial inválida: `falhou`, com o erro (CA8).
 */
export async function rodar(banco: Banco, rodadaId: string, fonte: Fonte, agora: () => Date, tempoLimite = TEMPO_LIMITE_MS) {
  const [r] = await banco.update(rodadaVigilia).set({ situacao: 'rodando', inicio: agora(), erro: null }).where(eq(rodadaVigilia.id, rodadaId)).returning()
  try {
    const brutas = await comTempoLimite(fonte.buscar(new Date(r.previstaPara.getTime() - UM_DIA_MS), r.previstaPara), tempoLimite)
    const { novas } = await casarPublicacoes(banco, brutas, agora())
    await banco.update(rodadaVigilia).set({ situacao: 'ok', fim: agora(), capturadas: novas }).where(eq(rodadaVigilia.id, rodadaId))
    return { situacao: 'ok' as const, capturadas: novas }
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e)
    await banco.update(rodadaVigilia).set({ situacao: 'falhou', fim: agora(), erro }).where(eq(rodadaVigilia.id, rodadaId))
    // CA8: falha de credencial ou da API vai também para o suporte técnico (canal a definir: por ora, histórico e log).
    if (/credencial|api/i.test(erro)) {
      await banco.insert(eventoAuditoria).values({ quem: 'sistema', acao: 'alarme_suporte', alvo: `rodada:${rodadaId}`, quando: agora(), detalhe: { fonte: fonte.nome, erro } })
      console.error(`[vigília] alarme ao suporte técnico: ${fonte.nome}: ${erro}`)
    }
    return { situacao: 'falhou' as const, erro }
  }
}

/** CA9: prevista que passou da tolerância sem rodar vira "não rodou" (também alarma). */
export async function marcarNaoRodou(banco: Banco, agora: Date) {
  await banco
    .update(rodadaVigilia)
    .set({ situacao: 'nao_rodou', erro: 'a rodada não foi executada no horário previsto' })
    .where(and(eq(rodadaVigilia.situacao, 'prevista'), lte(rodadaVigilia.previstaPara, new Date(agora.getTime() - TOLERANCIA_NAO_RODOU_MS))))
}

/** Uma batida do relógio: planeja o dia, marca as perdidas e roda as que chegaram na hora. */
export async function batida(banco: Banco, fontes: Fonte[], agora: () => Date) {
  const agoraFixo = agora()
  await planejarDia(banco, fontes, agoraFixo)
  await marcarNaoRodou(banco, agoraFixo)
  const prontas = await banco
    .select()
    .from(rodadaVigilia)
    .where(
      and(
        eq(rodadaVigilia.situacao, 'prevista'),
        lte(rodadaVigilia.previstaPara, agoraFixo),
        gt(rodadaVigilia.previstaPara, new Date(agoraFixo.getTime() - TOLERANCIA_NAO_RODOU_MS)),
      ),
    )
  for (const r of prontas) {
    const fonte = fontes.find((f) => f.nome === r.fonte)
    if (fonte) await rodar(banco, r.id, fonte, agora)
  }
}

/** Relógio da vigília: uma batida por minuto. Só em `principal.ts`; nos testes, chama-se `batida` direto. */
export function ligarRelogio(banco: Banco, fontes: Fonte[]) {
  let ocupado = false
  const bater = async () => {
    if (ocupado) return
    ocupado = true
    try {
      await batida(banco, fontes, () => new Date())
    } catch (e) {
      console.error('[vigília] batida falhou', e)
    } finally {
      ocupado = false
    }
  }
  void bater()
  return setInterval(() => void bater(), 60_000)
}
