import { ChatDoPortal } from './ChatDoPortal.tsx'

/**
 * "Pergunte ou peça" da Central do Jurídico administrativo (Figma 2051:173): as perícias para marcar (2107:892), o
 * comprovante do INSS anexado (2085:2), o cliente que ligou (2107:1091) e a dica para a perícia (2186:857). Na Central da
 * advogada (`advogada`), as perícias da semana (2107:667) e como o perito avalia (2186:2). Desde a GGVP-82, é um caso do
 * motor único (ChatDoPortal, sobre dados/chat.ts).
 */
export function ChatDaPericia({ exemplo, sugestoes, advogada = false }: { exemplo: string; sugestoes: string[]; advogada?: boolean }) {
  return <ChatDoPortal exemplo={exemplo} sugestoes={sugestoes} funcao={advogada ? 'Advogada' : 'Jurídico administrativo'} />
}
