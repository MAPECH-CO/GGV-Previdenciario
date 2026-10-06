import { Agenda, type Vista } from './paginas/Agenda.tsx'
import { AnalisarFicha } from './paginas/AnalisarFicha.tsx'
import { Balcao } from './paginas/Balcao.tsx'
import { CadastrarLead } from './paginas/CadastrarLead.tsx'
import { CentralAdvogada } from './paginas/CentralAdvogada.tsx'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { ConfirmarAgendamento } from './paginas/ConfirmarAgendamento.tsx'
import { Entrevista } from './paginas/Entrevista.tsx'
import { EntrevistaAoVivo } from './paginas/EntrevistaAoVivo.tsx'
import { FichaAtendimento } from './paginas/FichaAtendimento.tsx'
import { FichaCliente } from './paginas/FichaCliente.tsx'
import { MarcarEntrevista } from './paginas/MarcarEntrevista.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { NovoCliente } from './paginas/NovoCliente.tsx'
import { PrepararEntrevista } from './paginas/PrepararEntrevista.tsx'
import { ReceberDocumento } from './paginas/ReceberDocumento.tsx'
import { RenovarSenha } from './paginas/RenovarSenha.tsx'
import { SegundaFicha } from './paginas/SegundaFicha.tsx'
import { Tokens } from './paginas/Tokens.tsx'
import { RegistrarFechamento } from './paginas/RegistrarFechamento.tsx'
import { Recontatar } from './paginas/Recontatar.tsx'
import { NovaDemanda } from './paginas/NovaDemanda.tsx'

// Roteamento mínimo, com poucas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
export function App({ caminho = window.location.pathname, busca = window.location.search }: { caminho?: string; busca?: string }) {
  const parametros = new URLSearchParams(busca)
  if (caminho === '/') return <CentralAtendimento />
  if (caminho === '/advogada') return <CentralAdvogada />
  if (caminho === '/tokens') return <Tokens />
  if (caminho === '/balcao') return <Balcao />
  if (caminho === '/clientes/novo') return <NovoCliente />
  if (caminho === '/agenda') return <Agenda vistaInicial={(parametros.get('ver') as Vista | null) ?? undefined} />
  const marcar = /^\/agenda\/marcar\/([^/]+)$/.exec(caminho)
  if (marcar) return <MarcarEntrevista fichaId={decodeURIComponent(marcar[1])} remarcar={parametros.get('remarcar') ?? undefined} />
  const confirmar = /^\/agenda\/confirmar\/([^/]+)$/.exec(caminho)
  if (confirmar) return <ConfirmarAgendamento agendamentoId={decodeURIComponent(confirmar[1])} />
  const preparar = /^\/entrevista\/([^/]+)\/preparar$/.exec(caminho)
  if (preparar) return <PrepararEntrevista agendamentoId={decodeURIComponent(preparar[1])} />
  const analisar = /^\/entrevista\/([^/]+)\/analisar$/.exec(caminho)
  if (analisar) return <AnalisarFicha agendamentoId={decodeURIComponent(analisar[1])} />
  const renovar = /^\/entrevista\/([^/]+)\/renovar-senha$/.exec(caminho)
  if (renovar) return <RenovarSenha agendamentoId={decodeURIComponent(renovar[1])} />
  const gravacao = /^\/entrevista\/([^/]+)\/gravacao$/.exec(caminho)
  if (gravacao) return <EntrevistaAoVivo agendamentoId={decodeURIComponent(gravacao[1])} simular={parametros.get('simular') ?? undefined} />
  const entrevista = /^\/entrevista\/([^/]+)$/.exec(caminho)
  if (entrevista) return <Entrevista agendamentoId={decodeURIComponent(entrevista[1])} />
  const recebimento = /^\/balcao\/documento\/([^/]+)$/.exec(caminho)
  if (recebimento) return <ReceberDocumento tarefaId={decodeURIComponent(recebimento[1])} />
  const fichaDeAtendimento = /^\/clientes\/([^/]+)\/ficha-de-atendimento$/.exec(caminho)
  if (fichaDeAtendimento) return <FichaAtendimento fichaId={decodeURIComponent(fichaDeAtendimento[1])} tablet={parametros.get('modo') === 'tablet'} />
  const segunda = /^\/clientes\/([^/]+)\/segunda-ficha$/.exec(caminho)
  if (segunda) return <SegundaFicha fichaId={decodeURIComponent(segunda[1])} tablet={parametros.get('modo') === 'tablet'} />
  const cadastro = /^\/clientes\/([^/]+)\/cadastro$/.exec(caminho)
  if (cadastro) return <CadastrarLead fichaId={decodeURIComponent(cadastro[1])} />
  const ficha = /^\/clientes\/([^/]+)$/.exec(caminho)
  if (ficha) return <FichaCliente id={decodeURIComponent(ficha[1])} />
  const fechamento = /^\/clientes\/([^/]+)\/fechamento$/.exec(caminho)
  if (fechamento) return <RegistrarFechamento fichaId={decodeURIComponent(fechamento[1])} />
  const recontato = /^\/clientes\/([^/]+)\/recontato$/.exec(caminho)
  if (recontato) return <Recontatar fichaId={decodeURIComponent(recontato[1])} />
  const novaDemanda = /^\/clientes\/([^/]+)\/nova-demanda$/.exec(caminho)
  if (novaDemanda) return <NovaDemanda fichaId={decodeURIComponent(novaDemanda[1])} />
  return <NaoConstruida caminho={caminho} />
}
