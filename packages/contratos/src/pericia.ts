// Contratos da Perícia ligada no servidor (GGVP-137). Espelham o que as telas do Pedro mandam (apps/web/src/dados/
// pericia.ts); a forma é conferida aqui, e as regras (tentativa, marcação, documentos, orientação, comparecimento e
// resultado) são as de apps/web/src/regras/periciaNoCaso.ts, rodando no servidor. A resposta é a perícia na tela.
import { z } from 'zod'

const Texto = (max: number) => z.string().trim().max(max)
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const TipoDePericia = z.enum(['medica', 'social'])

/** POST /api/processos/:id/pericia/tentativas: a tentativa sem sucesso de marcar (GGVP-53, CA1). */
export const TentativaDeMarcar = z.object({ dia: Data, oQueAconteceu: Texto(300) })
export type TentativaDeMarcar = z.infer<typeof TentativaDeMarcar>

/** POST /api/processos/:id/pericia/comprovante/leitura e /laudo/leitura: o nome do arquivo que a IA lê (simulada). */
export const ArquivoParaLer = z.object({ nome: Texto(200).min(1) })
export type ArquivoParaLer = z.infer<typeof ArquivoParaLer>

/** O que o comprovante do INSS diz, conferido pela pessoa (GGVP-53, CA2, CA3). Nunca traz o perito. */
export const ComprovanteLido = z.object({ data: Data, hora: Hora, local: Texto(120), modalidade: Texto(60), tipo: TipoDePericia })

/**
 * POST /api/processos/:id/pericia/marcacao, em multipart: `dados` (este JSON) e o arquivo `comprovante` (PDF). Registra
 * a perícia conferida; de novo, troca a data (GGVP-53, CA2 a CA4, CA8).
 */
export const MarcacaoConferida = z.object({ lido: ComprovanteLido, pedeDocumentoNovo: z.boolean() })
export type MarcacaoConferida = z.infer<typeof MarcacaoConferida>

/** POST /api/processos/:id/pericia/espera-do-comprovante: marcada no Meu INSS, sem comprovante ainda (DP.E1, CA6). */
export const EsperaDoComprovante = z.object({ pedeDocumentoNovo: z.boolean() })
export type EsperaDoComprovante = z.infer<typeof EsperaDoComprovante>

/** POST /api/processos/:id/pericia/remarcacao (GGVP-53, CA8, CA9). */
export const RemarcacaoDaPericia = z.object({ motivo: Texto(300) })
export type RemarcacaoDaPericia = z.infer<typeof RemarcacaoDaPericia>

/** POST /api/processos/:id/pericia/autorizacao: a advogada autoriza mais uma remarcação, no limite (G15). */
export const AutorizacaoDeRemarcacao = z.object({ justificativa: Texto(1000) })
export type AutorizacaoDeRemarcacao = z.infer<typeof AutorizacaoDeRemarcacao>

/** POST /api/processos/:id/pericia/lembrete e /cobranca: a mensagem conferida, enviada pelo Chatwoot (simulado). */
export const MensagemConferida = z.object({ mensagem: Texto(4000).min(1) })
export type MensagemConferida = z.infer<typeof MensagemConferida>

/** POST /api/processos/:id/pericia/faltas: a falta de um item do kit, com justificativa (GGVP-56, CA5). */
export const FaltaNaPericia = z.object({ itemId: Texto(60), justificativa: Texto(500) })
export type FaltaNaPericia = z.infer<typeof FaltaNaPericia>

/** POST /api/processos/:id/pericia/documentos/conclusao (GGVP-56, CA5, CA6). */
export const ConclusaoDosDocumentos = z.object({ conferidas: z.array(Texto(60)).max(10) })
export type ConclusaoDosDocumentos = z.infer<typeof ConclusaoDosDocumentos>

/** POST /api/processos/:id/pericia/pedido-ao-medico: só o que o documento deve abordar (GGVP-56, CA7, G20). */
export const PedidoAoMedicoNaPericia = z.object({ abordar: Texto(4000) })
export type PedidoAoMedicoNaPericia = z.infer<typeof PedidoAoMedicoNaPericia>

/** POST /api/processos/:id/pericia/decisao-da-falta: o que a advogada decidiu sobre o documento que falta (G15). */
export const DecisaoDaFalta = z.object({ texto: Texto(1000) })
export type DecisaoDaFalta = z.infer<typeof DecisaoDaFalta>

/** POST /api/processos/:id/pericia/perito e /laudo/perito: a pergunta de um clique (GGVP-61 e GGVP-73, CA6). */
export const PeritoEscolhido = z.object({ peritoId: Texto(60).min(1) })
export type PeritoEscolhido = z.infer<typeof PeritoEscolhido>

/** POST /api/processos/:id/pericia/orientacao: a orientação revisada, passada ao cliente (GGVP-62, CA2 a CA7). */
export const OrientacaoAoCliente = z.object({ texto: Texto(6000), canal: z.enum(['chatwoot', 'ligacao']), revisei: z.boolean() })
export type OrientacaoAoCliente = z.infer<typeof OrientacaoAoCliente>

/** POST /api/processos/:id/pericia/presenca: a confirmação da véspera (GGVP-66, CA7). */
export const PresencaNaPericia = z.object({ confirmou: z.boolean(), observacao: Texto(300).optional() })
export type PresencaNaPericia = z.infer<typeof PresencaNaPericia>

/** POST /api/processos/:id/pericia/comparecimento: compareceu ou faltou, com a justificativa (GGVP-66, CA1 a CA5). */
export const ComparecimentoNaPericia = z.object({ compareceu: z.boolean(), justificativa: Texto(300).optional() })
export type ComparecimentoNaPericia = z.infer<typeof ComparecimentoNaPericia>

/**
 * POST /api/processos/:id/pericia/resultado, em multipart: `dados` (este JSON) e o arquivo `laudo` (PDF). O que a
 * advogada registrou (GGVP-70, CA2 a CA6). O laudo é dado de saúde.
 */
export const ResultadoConferido = z.object({ favoravel: z.boolean().optional(), novaPericia: z.boolean().optional(), conferidas: z.array(Texto(60)).max(10) })
export type ResultadoConferido = z.infer<typeof ResultadoConferido>
