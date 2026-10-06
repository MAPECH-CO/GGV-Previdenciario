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
import { PrepararContrato } from './paginas/PrepararContrato.tsx'
import { ColherAssinatura } from './paginas/ColherAssinatura.tsx'
import { ConferirContrato } from './paginas/ConferirContrato.tsx'
import { EntregarCopia } from './paginas/EntregarCopia.tsx'
import { ConferirDocumentos } from './paginas/ConferirDocumentos.tsx'
import { ConferirChecklist } from './paginas/ConferirChecklist.tsx'
import { CobrarDocumento } from './paginas/CobrarDocumento.tsx'
import { DecidirCobranca } from './paginas/DecidirCobranca.tsx'
import { LiberarCaso } from './paginas/LiberarCaso.tsx'
import type { Perfil } from './regras/liberacao.ts'

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
  const prepararContrato = /^\/contrato\/([^/]+)\/preparar$/.exec(caminho)
  if (prepararContrato) return <PrepararContrato processoId={decodeURIComponent(prepararContrato[1])} />
  const colherAssinatura = /^\/contrato\/([^/]+)\/assinatura$/.exec(caminho)
  if (colherAssinatura) return <ColherAssinatura processoId={decodeURIComponent(colherAssinatura[1])} />
  const conferirContrato = /^\/contrato\/([^/]+)\/conferir$/.exec(caminho)
  if (conferirContrato) return <ConferirContrato processoId={decodeURIComponent(conferirContrato[1])} />
  const entregarCopia = /^\/contrato\/([^/]+)\/copia$/.exec(caminho)
  if (entregarCopia) return <EntregarCopia processoId={decodeURIComponent(entregarCopia[1])} />
  const conferirDocumentos = /^\/clientes\/([^/]+)\/conferir-documentos$/.exec(caminho)
  if (conferirDocumentos) return <ConferirDocumentos fichaId={decodeURIComponent(conferirDocumentos[1])} />
  const checklist = /^\/casos\/([^/]+)\/checklist$/.exec(caminho)
  if (checklist) return <ConferirChecklist processoId={decodeURIComponent(checklist[1])} />
  const cobrar = /^\/casos\/([^/]+)\/cobranca$/.exec(caminho)
  if (cobrar) return <CobrarDocumento processoId={decodeURIComponent(cobrar[1])} />
  const decidir = /^\/casos\/([^/]+)\/cobranca\/decidir$/.exec(caminho)
  if (decidir) return <DecidirCobranca processoId={decodeURIComponent(decidir[1])} />
  const liberar = /^\/casos\/([^/]+)\/liberar$/.exec(caminho)
  const perfil = parametros.get('perfil')
  if (liberar) return <LiberarCaso processoId={decodeURIComponent(liberar[1])} perfil={perfil === 'atendimento' || perfil === 'juridico' ? (perfil as Perfil) : 'documentacao'} />
  return <NaoConstruida caminho={caminho} />
}
