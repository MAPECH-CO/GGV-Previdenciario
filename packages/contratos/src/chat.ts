// Contrato do chat (GGVP-82): a pergunta, a resposta com as fontes e o cartão de ação. A IA só sugere e orienta; para
// executar algo, mostra um cartão e nada acontece sem o clique. O chat herda as permissões de quem pergunta.
import { z } from 'zod'
import { SugestaoDaIa } from './ia.ts'

/** Um arquivo anexado ao chat: só o nome e o tamanho viajam na pergunta; o conteúdo sobe pelo envio de arquivos. */
export const AnexoDoChat = z.object({ nome: z.string().min(1).max(200), tamanho: z.number().int().min(0) })

/** POST /api/chat: a pergunta. `processoId` quando o chat foi aberto de dentro de um caso. */
export const PerguntaDoChat = z
  .object({
    texto: z.string().trim().max(2000),
    anexos: z.array(AnexoDoChat).max(500).default([]),
    processoId: z.string().optional(),
  })
  .refine((p) => p.texto.length > 0 || p.anexos.length > 0, { message: 'Escreva a pergunta ou anexe um arquivo', path: ['texto'] })
export type PerguntaDoChat = z.infer<typeof PerguntaDoChat>

/** Um link da resposta: o caso, a tarefa ou a tela para abrir. */
export const LinkDoChat = z.object({ rotulo: z.string(), sub: z.string().optional(), href: z.string().startsWith('/') })
export type LinkDoChat = z.infer<typeof LinkDoChat>

export const TIPOS_DE_ACAO = ['criar-tarefa', 'pedir-peca', 'anexar-laudo', 'marcar-pericia', 'lancar-comprovante', 'enviar-documento', 'subir-acervo'] as const

/** O cartão de ação: o resumo em passos, o que conferir, as travas e o responsável; executa só com "Confirmar". */
export const CartaoDeAcao = z.object({
  id: z.string(),
  tipo: z.enum(TIPOS_DE_ACAO),
  titulo: z.string(),
  cliente: z.object({ id: z.string(), nome: z.string() }).optional(),
  processoId: z.string().optional(),
  passos: z.array(z.string()).min(1),
  conferir: z.array(z.string()),
  travas: z.array(z.string()),
  /** Criar tarefa: a linha "Responsável" e o botão "Trocar" (CA7). */
  responsavel: z.object({ nome: z.string(), setor: z.string() }).optional(),
  /** Pedido fora do perfil: o cartão "Criar tarefa para" quem pode (CA8). */
  foraDoPerfil: z.boolean().optional(),
  /** Uma escolha obrigatória antes de confirmar ("A perícia pede documento novo?"). */
  escolha: z.object({ pergunta: z.string(), opcoes: z.array(z.string()).min(2) }).optional(),
  rotuloConfirmar: z.string(),
})
export type CartaoDeAcao = z.infer<typeof CartaoDeAcao>

/** A resposta: o texto da IA com as fontes, os links, e no máximo um cartão de ação ou uma pergunta de volta. */
export const RespostaDoChat = z.object({
  tipo: z.enum(['resposta', 'recusa', 'pergunta', 'acao']),
  sugestao: SugestaoDaIa,
  links: z.array(LinkDoChat),
  /** O portão de governança que barrou o pedido (CA4): "G2", "G8"... */
  portao: z.string().regex(/^G\d{1,2}$/).optional(),
  /** A pergunta de volta (quem do setor, quem é o responsável): as opções para um clique. */
  opcoes: z.array(z.string()).optional(),
  acao: CartaoDeAcao.optional(),
})
export type RespostaDoChat = z.infer<typeof RespostaDoChat>

/** POST /api/chat/acoes/:id: confirmar o cartão, com o responsável trocado quando a pessoa trocou. */
export const ConfirmacaoDoCartao = z.object({ acaoId: z.string(), responsavel: z.string().optional(), escolha: z.string().optional() })
export type ConfirmacaoDoCartao = z.infer<typeof ConfirmacaoDoCartao>
