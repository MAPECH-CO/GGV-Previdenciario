// G17 fora da conferência da Sênior (GGVP-63, orquestrador 09/10): a mesma trava do parecer médico, lida do banco, para
// pedir a petição. A conferência (rotas/conferencia.ts) monta a mesma conta junto com o resto da tela.
// ponytail: a conferência pode passar a usar esta função quando o #24 (G1) entrar; até lá, as duas contas são iguais.
import { and, desc, eq, isNull } from 'drizzle-orm'
import { travaDoParecer, type AcaoDoPortao, type SituacaoDoParecer } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, documentoMedico, parecerMedico } from '../banco/esquema.ts'

/** Por que a ação não segue pelo G17, ou null: o parecer confirmado por pessoa, o laudo novo esperando e a dispensa pedida. */
export async function travaDoParecerDoCaso(banco: Banco, casoId: string, acao: AcaoDoPortao): Promise<string | null> {
  const [c] = await banco.select({ beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
  if (!c) return null
  const [parecer] = await banco.select().from(parecerMedico).where(eq(parecerMedico.casoId, casoId)).orderBy(desc(parecerMedico.criadoEm)).limit(1)
  const [laudoNovo] = await banco
    .select({ id: documentoMedico.id })
    .from(documentoMedico)
    .innerJoin(documento, eq(documentoMedico.documentoId, documento.id))
    .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm), isNull(documentoMedico.confirmadoEm)))
    .limit(1)
  // A dispensa espera resposta quando há mais pedidos que respostas (Q14).
  const dispensas = await banco.select({ resultado: decisao.resultado }).from(decisao).where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'dispensa_parecer')))
  const pedidas = dispensas.filter((d) => d.resultado === 'pedida').length
  // Sem a confirmação de uma pessoa, o parecer é só sugestão da IA ("pendente").
  const situacao: SituacaoDoParecer | null = !parecer ? null : parecer.confirmadoPor ? (parecer.resultado as SituacaoDoParecer) : 'pendente'
  return travaDoParecer(acao, c.beneficio, situacao && { situacao }, { laudoNovoEsperando: Boolean(laudoNovo), dispensaPedida: pedidas > dispensas.length - pedidas })
}
