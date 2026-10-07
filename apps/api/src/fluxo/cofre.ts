// Cofre do gov.br (GGVP-103): a guarda de 1 ano depois do encerramento (CA10) e o alerta de uso fora do padrão (CA7).
import { and, eq, gte, inArray } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, configuracao, credencialGovbr, eventoAuditoria, tarefa, usuario } from '../banco/esquema.ts'

/** Tarefas que usam o gov.br: protocolar no Meu INSS e marcar a perícia (GGVP-103 CA5). */
export const PASSOS_COM_GOVBR = ['D2.02', 'DP.01', 'DP.02'] as const
/** CA10 (Lucas, 02/10): a senha fica guardada até 1 ano depois do encerramento, porque o cliente às vezes liga pedindo ajuda. */
export const MESES_DE_GUARDA = 12
const FUSO_EM_HORAS = -3

/** CA10: apaga a senha de quem tem todos os casos encerrados há mais de 1 ano. Grava o fato no histórico, sem o valor. */
export async function apagarSenhasVencidas(banco: Banco, agora: Date) {
  const limite = new Date(agora)
  limite.setUTCMonth(limite.getUTCMonth() - MESES_DE_GUARDA)
  const credenciais = await banco.select({ id: credencialGovbr.id, pessoaId: credencialGovbr.pessoaId }).from(credencialGovbr)
  let apagadas = 0
  for (const c of credenciais) {
    const casos = await banco.select({ fase: caso.fase, encerradoEm: caso.encerradoEm }).from(caso).where(eq(caso.pessoaId, c.pessoaId))
    const vencida = casos.length > 0 && casos.every((x) => x.fase === 'encerrado' && x.encerradoEm !== null && x.encerradoEm < limite)
    if (!vencida) continue
    await banco.delete(credencialGovbr).where(eq(credencialGovbr.id, c.id))
    await banco.insert(eventoAuditoria).values({ quem: 'sistema', acao: 'cofre_senha_apagada', alvo: `pessoa:${c.pessoaId}`, quando: agora, detalhe: { motivo: 'guarda_de_1_ano' } })
    apagadas++
  }
  return apagadas
}

/** Os limites do alerta (Q1): leituras por pessoa no dia e o horário de expediente, da configuração do escritório. */
async function limitesDoAlerta(banco: Banco) {
  const linhas = await banco.select().from(configuracao).where(inArray(configuracao.chave, ['cofre.alerta.leituras_por_dia', 'cofre.alerta.horario']))
  const por = (chave: string) => linhas.find((l) => l.chave === chave)?.valor
  const leituras = por('cofre.alerta.leituras_por_dia')
  const horario = por('cofre.alerta.horario') as { inicio?: number; fim?: number } | undefined
  return {
    leiturasPorDia: typeof leituras === 'number' && leituras > 0 ? leituras : null,
    horario: horario && typeof horario.inicio === 'number' && typeof horario.fim === 'number' ? { inicio: horario.inicio, fim: horario.fim } : null,
  }
}

/**
 * CA7: depois de cada leitura, confere se o uso saiu do padrão (mais leituras no dia que o limite, ou fora do horário).
 * Saiu, a Sênior recebe uma tarefa no caso, uma por pessoa por dia, e o fato vai para o histórico.
 */
export async function alertarUsoForaDoPadrao(banco: Banco, quem: string, casoId: string, agora: Date) {
  const { leiturasPorDia, horario } = await limitesDoAlerta(banco)
  const local = new Date(agora.getTime() + FUSO_EM_HORAS * 3_600_000)
  const inicioDoDia = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - FUSO_EM_HORAS * 3_600_000)
  const hora = local.getUTCHours()
  const doDia = await banco
    .select({ acao: eventoAuditoria.acao })
    .from(eventoAuditoria)
    .where(and(eq(eventoAuditoria.quem, quem), gte(eventoAuditoria.quando, inicioDoDia), inArray(eventoAuditoria.acao, ['cofre_senha_lida', 'cofre_uso_fora_do_padrao'])))
  if (doDia.some((e) => e.acao === 'cofre_uso_fora_do_padrao')) return null
  const leituras = doDia.filter((e) => e.acao === 'cofre_senha_lida').length
  const motivo =
    leiturasPorDia !== null && leituras > leiturasPorDia
      ? `${leituras} leituras hoje (limite ${leiturasPorDia})`
      : horario && (hora < horario.inicio || hora >= horario.fim)
        ? `leitura às ${String(hora).padStart(2, '0')}h, fora do horário (${horario.inicio}h às ${horario.fim}h)`
        : null
  if (!motivo) return null
  const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, quem))
  await banco.insert(eventoAuditoria).values({ quem, acao: 'cofre_uso_fora_do_padrao', alvo: `caso:${casoId}`, quando: agora, detalhe: { motivo } })
  await banco.insert(tarefa).values({ casoId, passo: 'cofre', titulo: `Uso do cofre fora do padrão: ${u?.nome ?? 'pessoa'}, ${motivo}`, perfilDono: 'senior', criadoEm: agora })
  return motivo
}
