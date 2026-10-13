// GGVP-158 P5.8: num banco novo, a petição precisa do tribunal e da assinatura para protocolar, e antes só a semente de
// exemplo os criava. Ao subir com banco de verdade, como os feriados, entram os padrões que faltarem; o que a Sênior
// mudou na Configuração nunca é refeito. A assinatura sai com a OAB a completar: a petição não protocola até a Sênior
// pôr a OAB do Dr. Glauco, que espera o Lucas.
import type { Banco } from '../banco/conexao.ts'
import { configuracao, eventoAuditoria } from '../banco/esquema.ts'

/**
 * A Justiça Federal da 3ª Região primeiro (GGVP-71); a Estadual entra pela Configuração. 3 MB por arquivo é o menor
 * limite publicado pelo TRF3 (o PJe pede 3 MB por PDF; os JEFs, 10 MB): o lado seguro, e a Sênior ajusta.
 */
export const TRIBUNAL_PADRAO = { nome: 'Justiça Federal da 3ª Região', site: 'https://www.trf3.jus.br/', tamanhoMaximoMb: 3 }

/** A assinatura do Dr. Glauco (GGVP-87), com a OAB a completar. */
export const ASSINATURA_PADRAO = 'Dr. Glauco\nAdvogado responsável · OAB/UF [completar]'

/** Devolve as chaves que entraram (nenhuma quando as duas já estavam). A carga fica no histórico da Configuração. */
export async function garantirPadroesDoProtocolo(banco: Banco, agora: Date): Promise<string[]> {
  const entraram: string[] = []
  for (const [chave, valor] of [
    ['tribunais', [TRIBUNAL_PADRAO]],
    ['peticao.assinatura', ASSINATURA_PADRAO],
  ] as const) {
    const [nova] = await banco.insert(configuracao).values({ chave, valor }).onConflictDoNothing().returning({ chave: configuracao.chave })
    if (nova) entraram.push(chave)
  }
  if (entraram.length)
    await banco.insert(eventoAuditoria).values({ quem: 'sistema', acao: 'protocolo_padrao_carregado', alvo: 'configuracao', quando: agora, detalhe: { chaves: entraram } })
  return entraram
}
