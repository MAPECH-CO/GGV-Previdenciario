import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { Tokens } from './paginas/Tokens.tsx'

// Roteamento mínimo, enquanto há só duas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
export function App({ caminho = window.location.pathname }: { caminho?: string }) {
  if (caminho === '/') return <CentralAtendimento />
  if (caminho === '/tokens') return <Tokens />
  return <NaoConstruida caminho={caminho} />
}
