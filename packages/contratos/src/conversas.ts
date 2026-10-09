// Contratos do Relacionamento com o cliente ligado no servidor (GGVP-138): a conversa do D5, a transcrição, a
// conferência com versões e a pendência (GGVP-76, 80, 84, 88). Espelham os tipos das telas do Pedro
// (apps/web/src/dados/conversa.ts e regras/conversa.ts); a forma é conferida aqui, e as regras são as mesmas do servidor
// de exemplo, rodando no servidor de verdade. A gravação usa os contratos da entrevista (recepcao.ts): o mesmo motor.
import { z } from 'zod'

const Texto = (max: number) => z.string().trim().max(max)

export const CanalDoRegistro = z.enum(['ligacao', 'presencial'])
export const ComQuem = z.enum(['cliente', 'familiar', 'medico'])
export const ModoDoRegistro = z.enum(['tempo-real', 'arquivo', 'escrito'])

/**
 * POST /api/conversas: abre a conversa no card do lead ou do cliente (GGVP-76 CA3, CA4, CA9). A ficha vai no corpo:
 * `POST /api/fichas/:id/conversas` ainda é a conversa sem áudio da Recepção (GGVP-46).
 */
export const NovaConversa = z.object({
  fichaId: z.string().uuid(),
  canal: CanalDoRegistro,
  comQuem: ComQuem,
  modo: ModoDoRegistro,
  processoId: z.string().uuid().optional(),
  registro: Texto(4000).optional(),
})
export type NovaConversa = z.infer<typeof NovaConversa>

/** POST /api/conversas/:id/finalizar: o ponto do áudio, em segundos. */
export const FimDaConversa = z.object({ aos: z.number().min(0) })
export type FimDaConversa = z.infer<typeof FimDaConversa>

/** POST /api/conversas/:id/audio: a ligação já feita, com o aviso de gravação nela (G10); simulado: nome, tipo e tamanho. */
export const AudioDaLigacao = z.object({ nome: Texto(200).min(1), tipo: Texto(100), tamanho: z.number().int().min(1), avisoNaGravacao: z.literal(true) })
export type AudioDaLigacao = z.infer<typeof AudioDaLigacao>

/** Como o escritório confirmou que é o cliente (GGVP-111, Lucas 07/10). */
export const ComoVerificou = z.enum(['video', 'presencial'])
/** A verificação, com a alteração em contrato novo. Parcial: o servidor diz o que falta (GGVP-111 CA1). */
export const VerificacaoInformada = z.object({ como: ComoVerificou.optional(), contratoNovo: z.boolean().optional() })
export type VerificacaoInformada = z.infer<typeof VerificacaoInformada>

export const DecisaoDaMudanca = z.object({
  id: Texto(80),
  decisao: z.enum(['confirmada', 'corrigida', 'desfeita']),
  /** Só na corrigida; validado pelo campo (`erroDoValor`). */
  valor: Texto(200).optional(),
})

/** "Surgiu pendência?" (GGVP-88): nunca presumida; no "Sim", o combinado, o responsável e o prazo (dd/mm/aaaa). */
export const NovaPendencia = z.discriminatedUnion('surgiu', [
  z.object({ surgiu: z.literal(false) }),
  z.object({ surgiu: z.literal(true), texto: Texto(500), responsavel: Texto(200), prazo: Texto(10) }),
])

/** POST /api/conversas/:id/conferencia (GGVP-84, GGVP-88, GGVP-111). */
export const Conferencia = z.object({
  decisoes: z.array(DecisaoDaMudanca).max(50),
  pendencia: NovaPendencia.optional(),
  verificacao: VerificacaoInformada.optional(),
})
export type Conferencia = z.infer<typeof Conferencia>

/** O campo que a conversa muda: na ficha (contato, endereço, grupo familiar) ou no processo (D5.03). */
export const CampoDaConversa = z.enum(['telefone', 'endereco', 'contatoApoio', 'estadoCivil', 'email', 'pericia', 'fato', 'documento'])

/** POST /api/fichas/:id/versoes/:campo/volta: o índice da versão na lista do campo (GGVP-84 CA2). */
export const VoltarVersao = z.object({ onde: z.enum(['ficha', 'processo']), processoId: z.string().uuid().optional(), versao: z.number().int().min(0) })
export type VoltarVersao = z.infer<typeof VoltarVersao>

/** POST /api/conversas/:id/pendencia/prazo: só a Sênior, com a pendência atrasada (GGVP-88 CA5). */
export const NovoPrazoDaPendencia = z.object({ prazo: Texto(10) })
export type NovoPrazoDaPendencia = z.infer<typeof NovoPrazoDaPendencia>

// O que a tela recebe (GGVP-138 CA2): a conversa como as telas e o servidor a guardam.

/** Uma mudança que a conversa traz: o valor de antes (vazio: dado novo), o dito e o trecho de onde saiu (GGVP-80 CA5). */
export const Mudanca = z.object({
  id: z.string(),
  onde: z.enum(['ficha', 'processo']),
  campo: CampoDaConversa,
  rotulo: z.string(),
  antes: z.string(),
  depois: z.string(),
  /** Segundos desde o início do áudio. */
  aos: z.number(),
  trecho: z.string(),
  /** Fato novo de saúde: só o Jurídico vê o conteúdo. */
  saude: z.literal(true).optional(),
})
export type Mudanca = z.infer<typeof Mudanca>

/** O quadro da IA depois de transcrever: o que mudou, o que precisa atualizar, a observação e o combinado (GGVP-80). */
export const AnaliseDaConversa = z.object({
  mudancas: z.array(Mudanca),
  atualizar: z.array(z.enum(['ficha', 'processo'])),
  observacao: z.string(),
  pendencia: z.string().optional(),
  /** GGVP-140: quando a IA de verdade leu a conversa: o resumo sugerido, o registro da chamada e o alerta do motor. */
  daIa: z.object({ resumo: z.string(), chamadaId: z.uuid(), modelo: z.string(), alerta: z.string().nullable() }).optional(),
})
export type AnaliseDaConversa = z.infer<typeof AnaliseDaConversa>

/** A pendência que virou tarefa no card (GGVP-88). */
export const Pendencia = z.object({
  texto: z.string(),
  responsavel: z.string(),
  setor: z.enum(['Jurídico', 'Documentação · ADM', 'Financeiro', 'Atendimento']),
  /** aaaa-mm-dd */
  prazo: z.string(),
  criadaEm: z.string(),
  cumpridaEm: z.string().optional(),
  cumpridaPor: z.string().optional(),
})
export type Pendencia = z.infer<typeof Pendencia>

/** A conversa do D5: quem conduziu, o canal, com quem, como foi registrada, a análise, a conferência e a pendência. */
export const Conversa = z.object({
  id: z.string(),
  fichaId: z.string(),
  processoId: z.string().optional(),
  canal: CanalDoRegistro,
  comQuem: ComQuem,
  modo: ModoDoRegistro,
  quem: z.string(),
  papel: z.enum(['atendimento', 'juridico']),
  abertaEm: z.string(),
  gravacaoId: z.string().optional(),
  registro: z.string().optional(),
  finalizadaEm: z.string().optional(),
  /** O que a pessoa contou ao abrir, para a Central. */
  motivo: z.string().optional(),
  analise: AnaliseDaConversa.optional(),
  decisoes: z.array(DecisaoDaMudanca).optional(),
  conferidaEm: z.string().optional(),
  pendencia: Pendencia.optional(),
})
export type Conversa = z.infer<typeof Conversa>
