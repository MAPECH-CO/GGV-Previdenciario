// Rodadas da vigília (GGVP-30, G13): 3 por dia por fonte, cada uma com início, fim, quantidade e status. Falha e
// "não rodou" ficam marcadas, para nunca parecer um dia sem publicação.
import { and, eq, gt, gte, lt, lte } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { configuracao, eventoAuditoria, rodadaVigilia } from '../banco/esquema.ts'
import { criarSuporte, type Suporte } from '../suporte.ts'
import { casarPublicacoes } from './casar.ts'
import { hojeEmBrasilia } from './fila.ts'
import type { Fonte } from './fontes.ts'

/** Horários de Brasília. A regra é 3 por dia (G13); os horários são parâmetro do escritório (`vigilia.horarios`). */
export const HORARIOS_PADRAO = ['08:00', '13:00', '18:00']
export const TEMPO_LIMITE_MS = 60_000
export const TOLERANCIA_NAO_RODOU_MS = 30 * 60_000
/** GGVP-158 P5.10: "rodando" além do tempo limite e mais esta folga é rodada que parou no meio. */
export const FOLGA_DA_PRESA_MS = 5 * 60_000
export const MSG_PRESA = 'a rodada parou no meio (o servidor reiniciou ou travou)'
export const MSG_SEM_FONTE = 'nenhuma fonte de publicação ligada: nenhuma publicação chega ao portal'
const horaBr = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)

/**
 * GGVP-158 P5.10 (ADR-018): todo alarme da vigília vai ao suporte técnico (canal e Jira, quando ligados), ao log e ao
 * histórico, com o resultado de cada entrega. A Sênior vê no topo da Central (`alarmesDaVigilia`).
 */
async function alarmar(banco: Banco, suporte: Suporte, quando: Date, alvo: string, detalhe: { fonte: string; erro: string; previstaPara?: Date }) {
  const titulo = `Vigília das publicações: ${detalhe.fonte.toUpperCase()}`
  const rodada = detalhe.previstaPara ? `a rodada das ${horaBr(detalhe.previstaPara)} ` : ''
  const entregas = await suporte({ titulo, texto: `${rodada}não trouxe as publicações. Motivo: ${detalhe.erro}` })
  await banco.insert(eventoAuditoria).values({ quem: 'sistema', acao: 'alarme_suporte', alvo, quando, detalhe: { fonte: detalhe.fonte, erro: detalhe.erro.slice(0, 300), ...entregas } })
  console.error(`[vigília] alarme ao suporte técnico: ${detalhe.fonte}: ${detalhe.erro} (canal: ${entregas.canal}; Jira: ${entregas.jira})`)
}
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

/**
 * GGVP-158 I13: o motivo que vai à rodada, ao alarme e ao log. O que as fontes escrevem (a API, a credencial, o tempo) passa;
 * o resto (o erro do banco traz o SQL e os parâmetros, com o texto da publicação; o da leitura da resposta, um trecho dela)
 * vira um motivo fixo, com o tipo e o código do erro.
 */
export function motivoSeguro(e: unknown): string {
  const mensagem = e instanceof Error ? e.message : ''
  if (/^(api|credencial|tempo esgotado)\b/.test(mensagem)) return mensagem.slice(0, 300)
  const erro = e as { name?: string; code?: unknown; cause?: { code?: unknown } } | null
  const codigo = erro?.code ?? erro?.cause?.code
  return `erro inesperado ao ler ou gravar as publicações (${erro?.name ?? 'erro'}${typeof codigo === 'string' || typeof codigo === 'number' ? `, código ${codigo}` : ''})`
}

const comTempoLimite = <T>(promessa: Promise<T>, ms: number) =>
  Promise.race([promessa, new Promise<never>((_, falhar) => setTimeout(() => falhar(new Error(`tempo esgotado: a fonte não respondeu em ${ms / 1000} s`)), ms))])

/**
 * Roda uma rodada: busca as 24 horas até o horário previsto (a janela se sobrepõe à anterior; a repetida é descartada
 * pelo hash, CA6) e casa as publicações. Erro, tempo esgotado ou credencial inválida: `falhou`, com o erro (CA8).
 */
export async function rodar(banco: Banco, rodadaId: string, fonte: Fonte, agora: () => Date, tempoLimite = TEMPO_LIMITE_MS, suporte: Suporte = criarSuporte()) {
  const [r] = await banco.update(rodadaVigilia).set({ situacao: 'rodando', inicio: agora(), erro: null }).where(eq(rodadaVigilia.id, rodadaId)).returning()
  try {
    const brutas = await comTempoLimite(fonte.buscar(new Date(r.previstaPara.getTime() - UM_DIA_MS), r.previstaPara), tempoLimite)
    const { novas } = await casarPublicacoes(banco, brutas, agora())
    await banco.update(rodadaVigilia).set({ situacao: 'ok', fim: agora(), capturadas: novas }).where(eq(rodadaVigilia.id, rodadaId))
    return { situacao: 'ok' as const, capturadas: novas }
  } catch (e) {
    const erro = motivoSeguro(e)
    await banco.update(rodadaVigilia).set({ situacao: 'falhou', fim: agora(), erro }).where(eq(rodadaVigilia.id, rodadaId))
    // CA8 e GGVP-158 P5.10: falha de qualquer tipo vai ao suporte técnico.
    await alarmar(banco, suporte, agora(), `rodada:${rodadaId}`, { fonte: fonte.nome, erro, previstaPara: r.previstaPara })
    return { situacao: 'falhou' as const, erro }
  }
}

/** CA9: prevista que passou da tolerância sem rodar vira "não rodou" (também alarma). */
export async function marcarNaoRodou(banco: Banco, agora: Date, suporte: Suporte = criarSuporte()) {
  const perdidas = await banco
    .update(rodadaVigilia)
    .set({ situacao: 'nao_rodou', erro: 'a rodada não foi executada no horário previsto' })
    .where(and(eq(rodadaVigilia.situacao, 'prevista'), lte(rodadaVigilia.previstaPara, new Date(agora.getTime() - TOLERANCIA_NAO_RODOU_MS))))
    .returning()
  for (const r of perdidas) await alarmar(banco, suporte, agora, `rodada:${r.id}`, { fonte: r.fonte, erro: r.erro!, previstaPara: r.previstaPara })
}

/** GGVP-158 P5.10: "rodando" além do tempo limite (o servidor caiu no meio) vira falha, com alarme. */
export async function marcarPresas(banco: Banco, agora: Date, suporte: Suporte = criarSuporte(), tempoLimite = TEMPO_LIMITE_MS) {
  const presas = await banco
    .update(rodadaVigilia)
    .set({ situacao: 'falhou', fim: agora, erro: MSG_PRESA })
    .where(and(eq(rodadaVigilia.situacao, 'rodando'), lt(rodadaVigilia.inicio, new Date(agora.getTime() - tempoLimite - FOLGA_DA_PRESA_MS))))
    .returning()
  for (const r of presas) await alarmar(banco, suporte, agora, `rodada:${r.id}`, { fonte: r.fonte, erro: MSG_PRESA, previstaPara: r.previstaPara })
}

/** GGVP-158 P5.10: sem fonte ligada (a produção sem `FONTES_PUBLICACAO`), um alarme por dia, nunca um dia mudo (G13). */
export async function alarmarSemFonte(banco: Banco, agora: Date, suporte: Suporte = criarSuporte()) {
  const alvo = `vigilia:sem-fonte:${hojeEmBrasilia(agora)}`
  const [ja] = await banco.select({ id: eventoAuditoria.id }).from(eventoAuditoria).where(and(eq(eventoAuditoria.acao, 'alarme_suporte'), eq(eventoAuditoria.alvo, alvo))).limit(1)
  if (!ja) await alarmar(banco, suporte, agora, alvo, { fonte: 'sem fonte', erro: MSG_SEM_FONTE })
}

/**
 * O alarme de hoje da vigília sem fonte, para a Central da Sênior. GGVP-158 I14: `avisado` diz se o canal ou o Jira do
 * suporte receberam, pelas entregas gravadas no alarme.
 */
export async function semFonteHoje(banco: Banco, agora: Date) {
  const [e] = await banco
    .select({ id: eventoAuditoria.id, detalhe: eventoAuditoria.detalhe })
    .from(eventoAuditoria)
    .where(and(eq(eventoAuditoria.acao, 'alarme_suporte'), eq(eventoAuditoria.alvo, `vigilia:sem-fonte:${hojeEmBrasilia(agora)}`), gte(eventoAuditoria.quando, new Date(agora.getTime() - 86_400_000))))
    .limit(1)
  if (!e) return null
  const entregas = e.detalhe as { canal?: string; jira?: string } | null
  return { id: e.id, avisado: entregas?.canal === 'enviado' || entregas?.jira === 'enviado' }
}

/** Uma batida do relógio: planeja o dia, marca as perdidas e roda as que chegaram na hora. */
export async function batida(banco: Banco, fontes: Fonte[], agora: () => Date, suporte: Suporte = criarSuporte()) {
  const agoraFixo = agora()
  if (!fontes.length) await alarmarSemFonte(banco, agoraFixo, suporte)
  await planejarDia(banco, fontes, agoraFixo)
  await marcarNaoRodou(banco, agoraFixo, suporte)
  await marcarPresas(banco, agoraFixo, suporte)
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
    if (fonte) await rodar(banco, r.id, fonte, agora, TEMPO_LIMITE_MS, suporte)
  }
}

/** Relógio da vigília: uma batida por minuto. Só em `principal.ts`; nos testes, chama-se `batida` direto. */
export function ligarRelogio(banco: Banco, fontes: Fonte[], suporte: Suporte = criarSuporte()) {
  let ocupado = false
  const bater = async () => {
    if (ocupado) return
    ocupado = true
    try {
      await batida(banco, fontes, () => new Date(), suporte)
    } catch (e) {
      // GGVP-158 I13: o erro do banco traz o SQL e os parâmetros (texto de publicação): no log, só o motivo seguro.
      console.error(`[vigília] batida falhou: ${motivoSeguro(e)}`)
    } finally {
      ocupado = false
    }
  }
  void bater()
  return setInterval(() => void bater(), 60_000)
}
