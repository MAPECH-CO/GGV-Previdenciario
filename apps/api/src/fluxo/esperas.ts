// GGVP-158 P5.4 (Lucas, GGVP-116 item 4: "pode ser diário"): enquanto o caso espera alguém de fora, ele volta ao topo da
// Central da advogada todo dia útil, até alguém marcar "Olhei, sem novidade" no dia. Do INSS, contam as etapas que o
// esperam; da perícia, a feita e ainda sem resultado. A Justiça fica com a vigília do diário, que olha três vezes por dia;
// a vigília do Meu INSS continua manual (GGVP-35).
import { and, eq, gte, isNull, like } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, etapa, eventoAuditoria, pericia, pessoa } from '../banco/esquema.ts'
import { ehDiaUtil, feriadosNacionais } from './prazo-inss.ts'
import type { Pericia } from '../../../web/src/regras/periciaNoCaso.ts'

export type Espera = { id: string; casoId: string; passo: string; oQue: string; desde: Date; cliente: { id: string; nome: string }; beneficio: string | null }

/** As esperas de fora: as etapas que aguardam o INSS e as perícias com o comparecimento e sem o resultado à vista. */
export async function esperasDeFora(banco: Banco, casoId?: string): Promise<Espera[]> {
  const doCaso = casoId ? eq(caso.id, casoId) : undefined
  const etapas = await banco
    .select({ id: etapa.id, casoId: etapa.casoId, passo: etapa.passo, aguardando: etapa.aguardando, desde: etapa.iniciadaEm, pessoaId: pessoa.id, nome: pessoa.nome, beneficio: caso.beneficio })
    .from(etapa)
    .innerJoin(caso, eq(etapa.casoId, caso.id))
    .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .where(and(eq(etapa.situacao, 'aguardando_externo'), isNull(etapa.concluidaEm), like(etapa.aguardando, 'INSS%'), doCaso))
  const pericias = await banco
    .select({ id: pericia.id, casoId: pericia.casoId, documento: pericia.documento, desde: pericia.agendadaPara, criadoEm: pericia.criadoEm, pessoaId: pessoa.id, nome: pessoa.nome, beneficio: caso.beneficio })
    .from(pericia)
    .innerJoin(caso, eq(pericia.casoId, caso.id))
    .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .where(and(eq(pericia.compareceu, true), isNull(pericia.resultado), doCaso))
  return [
    ...etapas.map((e) => ({ id: e.id, casoId: e.casoId, passo: e.passo, oQue: e.aguardando!, desde: e.desde, cliente: { id: e.pessoaId, nome: e.nome }, beneficio: e.beneficio })),
    // O resultado que já apareceu (DP.E4) não é mais espera: a tarefa da advogada é conferir.
    ...pericias
      .filter((p) => !(p.documento as Pericia | null)?.resultado?.disponivelEm)
      .map((p) => ({ id: p.id, casoId: p.casoId, passo: 'DP.E4', oQue: 'o resultado da perícia', desde: p.desde ?? p.criadoEm, cliente: { id: p.pessoaId, nome: p.nome }, beneficio: p.beneficio })),
  ]
}

/** Hoje chama? Só no dia útil, e só a espera que ninguém olhou hoje. */
export async function esperasQueChamamHoje(banco: Banco, hoje: string): Promise<(id: string) => boolean> {
  if (!ehDiaUtil(hoje, await feriadosNacionais(banco))) return () => false
  const olhadas = await banco
    .select({ detalhe: eventoAuditoria.detalhe })
    .from(eventoAuditoria)
    .where(and(eq(eventoAuditoria.acao, 'espera_olhada'), gte(eventoAuditoria.quando, new Date(`${hoje}T00:00:00-03:00`))))
  const hojeJa = new Set(olhadas.map((o) => (o.detalhe as { espera?: string } | null)?.espera))
  return (id) => !hojeJa.has(id)
}
