import { Balcao } from './paginas/Balcao.tsx'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { Tokens } from './paginas/Tokens.tsx'

// Roteamento mínimo, com poucas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
export function App({ caminho = window.location.pathname }: { caminho?: string }) {
  if (caminho === '/') return <CentralAtendimento />
  if (caminho === '/tokens') return <Tokens />
  if (caminho === '/balcao') return <Balcao />
  return <NaoConstruida caminho={caminho} />
}
