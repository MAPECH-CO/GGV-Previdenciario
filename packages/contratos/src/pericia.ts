// Contratos da Perícia ligada no servidor (GGVP-137). Espelham o que as telas do Pedro mandam (apps/web/src/dados/
// pericia.ts); a forma é conferida aqui, e as regras (tentativa, marcação, documentos, orientação, comparecimento e
// resultado) são as de apps/web/src/regras/periciaNoCaso.ts, rodando no servidor. A resposta é a perícia na tela.
import { z } from 'zod'
import { SugestaoDaIa } from './ia.ts'

const Texto = (max: number) => z.string().trim().max(max)
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const Hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const TipoDePericia = z.enum(['medica', 'social'])

/** POST /api/processos/:id/pericia/tentativas: a tentativa sem sucesso de marcar (GGVP-53, CA1). */
export const TentativaDeMarcar = z.object({ dia: Data, oQueAconteceu: Texto(300) })
export type TentativaDeMarcar = z.infer<typeof TentativaDeMarcar>

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

/**
 * POST /api/processos/:id/pericia/documentos, em multipart: `dados` (este JSON) e o arquivo `documento` (PDF ou imagem).
 * O item do kit que o documento cumpre (GGVP-56, CA2, CA4).
 */
export const AnexoNaPericia = z.object({ itemId: Texto(60).min(1) })
export type AnexoNaPericia = z.infer<typeof AnexoNaPericia>

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
export const ResultadoConferido = z.object({
  favoravel: z.boolean().optional(),
  novaPericia: z.boolean().optional(),
  conferidas: z.array(Texto(60)).max(10),
  /** A leitura da IA que a advogada conferiu (GGVP-139 CA3): o servidor relê a chamada; sem ela, o resultado é manual. */
  chamadaIaId: z.uuid().optional(),
})
export type ResultadoConferido = z.infer<typeof ResultadoConferido>

// GGVP-139 · a IA de verdade na Perícia, pelo motor do portal (apps/api/src/ia). A IA sugere; a pessoa confere e decide.

/** O que a IA devolve do comprovante do INSS (GGVP-139 CA1): sem o perito, nunca. O tipo vem da perícia, não da IA. */
export const ComprovantePelaIa = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: Hora,
  local: Texto(120).min(3),
  modalidade: Texto(60),
})
export type ComprovantePelaIa = z.infer<typeof ComprovantePelaIa>

/**
 * POST /api/processos/:id/pericia/comprovante/leitura, em multipart com o PDF em `comprovante`: a leitura sugerida, com a
 * marca de sugestão, as fontes e o alerta; sem IA (desligada, recusada, fora do formato), `lido` nulo e o motivo.
 */
export const LeituraDoComprovante = z.object({ lido: ComprovanteLido.nullable(), sugestao: SugestaoDaIa.nullable(), motivo: z.string().nullable() })
export type LeituraDoComprovante = z.infer<typeof LeituraDoComprovante>

/**
 * POST /api/processos/:id/pericia/orientacao/sugestao (GGVP-139 CA2): o texto da orientação escrito pela IA, já verificado
 * (G11, G20), para a pessoa revisar; sem IA, `texto` nulo e o motivo, e fica a orientação que o código montou.
 */
export const OrientacaoPelaIa = z.object({ texto: z.string().nullable(), sugestao: SugestaoDaIa.nullable(), motivo: z.string().nullable() })
export type OrientacaoPelaIa = z.infer<typeof OrientacaoPelaIa>

const Itens = z.array(Texto(300)).max(10).default([])

/** O que a IA devolve do laudo (GGVP-139 CA3, CA4): o resumo para a advogada e os padrões do perito para o perfil. */
export const LaudoPelaIa = z.object({
  favoravel: z.boolean(),
  resumo: Texto(1000).min(1),
  conclusao: Texto(300).min(1),
  coerencia: Texto(1000).min(1),
  pontoDeAtencao: Texto(1000).default(''),
  porque: Texto(1000).nullable().optional(),
  valeNovaPericia: z.boolean().nullable().optional(),
  assunto: Texto(60).min(1),
  observou: Itens,
  perguntou: Itens,
  pediu: Itens,
})
export type LaudoPelaIa = z.infer<typeof LaudoPelaIa>

/** POST /api/processos/:id/pericia/laudo/leitura, em multipart com o PDF em `laudo`: a leitura sugerida, ou o motivo. */
export const LeituraDoLaudoPelaIa = z.object({ leitura: LaudoPelaIa.nullable(), sugestao: SugestaoDaIa.nullable(), motivo: z.string().nullable() })
export type LeituraDoLaudoPelaIa = z.infer<typeof LeituraDoLaudoPelaIa>
