import { ChatDoPortal } from './ChatDoPortal.tsx'

/**
 * O chat da Central do Atendimento (Figma 11:2): "Subir laudo novo" (GGVP-17, CA8; Figma 2052:2), "o cliente me ligou" com o
 * lembrete de confirmar a identidade (GGVP-111) e o resto do chat (GGVP-82). Desde a GGVP-82, é um caso do motor único
 * (ChatDoPortal, sobre dados/chat.ts): nada acontece antes de "Confirmar".
 */
export function LaudoPeloChat({ exemplo, sugestoes }: { exemplo: string; sugestoes: string[] }) {
  return <ChatDoPortal exemplo={exemplo} sugestoes={sugestoes} funcao="Atendimento" />
}
