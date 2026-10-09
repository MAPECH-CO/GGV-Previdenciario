// P17 do roteiro (orquestrador, 09/10): com a tabela de feriados vazia, o prazo só pula sábado e domingo. Ao subir com
// banco de verdade, a API carrega os da lei de 2026 e 2027 (os mesmos do botão da Configuração, GGVP-146 parte 3), só se
// a tabela estiver vazia: o que a Sênior tirou ou acrescentou depois nunca é refeito.
import { ANOS_DE_FERIADOS } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { eventoAuditoria, feriado } from '../banco/esquema.ts'
import { feriadosDaLei } from './feriados.ts'

/** Devolve quantos entraram (0 quando a tabela já tinha algum). A carga fica no histórico, como a do botão. */
export async function carregarFeriadosSeVazio(banco: Banco, agora: Date): Promise<number> {
  const [algum] = await banco.select({ id: feriado.id }).from(feriado).limit(1)
  if (algum) return 0
  const novos = ANOS_DE_FERIADOS.flatMap((ano) => feriadosDaLei(ano))
  await banco.transaction(async (tx) => {
    await tx.insert(feriado).values(novos)
    await tx.insert(eventoAuditoria).values({
      quem: 'sistema',
      acao: 'feriados_carregados',
      alvo: 'feriados',
      quando: agora,
      detalhe: { anos: [...ANOS_DE_FERIADOS], acrescentados: novos.length, origem: 'inicio_do_servidor' },
    })
  })
  return novos.length
}
