import { Balcao } from './paginas/Balcao.tsx'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { FichaCliente } from './paginas/FichaCliente.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { NovoCliente } from './paginas/NovoCliente.tsx'
import { ReceberDocumento } from './paginas/ReceberDocumento.tsx'
import { Tokens } from './paginas/Tokens.tsx'

// Roteamento mínimo, com poucas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
export function App({ caminho = window.location.pathname }: { caminho?: string }) {
  if (caminho === '/') return <CentralAtendimento />
  if (caminho === '/tokens') return <Tokens />
  if (caminho === '/balcao') return <Balcao />
  if (caminho === '/clientes/novo') return <NovoCliente />
  const recebimento = /^\/balcao\/documento\/([^/]+)$/.exec(caminho)
  if (recebimento) return <ReceberDocumento tarefaId={decodeURIComponent(recebimento[1])} />
  const ficha = /^\/clientes\/([^/]+)$/.exec(caminho)
  if (ficha) return <FichaCliente id={decodeURIComponent(ficha[1])} />
  return <NaoConstruida caminho={caminho} />
}
