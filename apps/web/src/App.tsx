import { useEffect, useState } from 'react'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
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
import { Entrar } from './paginas/Entrar.tsx'
import { SemPerfil } from './paginas/SemPerfil.tsx'
import { TrocarSenha } from './paginas/TrocarSenha.tsx'
import { DefinirBeneficio } from './paginas/DefinirBeneficio.tsx'
import { CalcularTempo } from './paginas/CalcularTempo.tsx'
import { RegistrarFechamento } from './paginas/RegistrarFechamento.tsx'
import { Recontatar } from './paginas/Recontatar.tsx'
import { NovaDemanda } from './paginas/NovaDemanda.tsx'
import { Roteiro } from './paginas/Roteiro.tsx'
import { AnalisarLaudoNovo } from './paginas/AnalisarLaudoNovo.tsx'
import { DarParecer } from './paginas/DarParecer.tsx'
import { PedirComplemento } from './paginas/PedirComplemento.tsx'
import { DispensarParecer } from './paginas/DispensarParecer.tsx'
import { LinhaDaDeficiencia } from './paginas/LinhaDaDeficiencia.tsx'
import { CentralJuridicoAdm } from './paginas/CentralJuridicoAdm.tsx'
import { PericiaAberta } from './paginas/PericiaAberta.tsx'
import { ProcessoPericia } from './paginas/ProcessoPericia.tsx'
import { MarcarPericia } from './paginas/MarcarPericia.tsx'
import { ReunirDocumentosPericia } from './paginas/ReunirDocumentosPericia.tsx'
import { CobrarDocumentoPericia } from './paginas/CobrarDocumentoPericia.tsx'
import { OrientarPericia } from './paginas/OrientarPericia.tsx'
import { ComparecimentoPericia } from './paginas/ComparecimentoPericia.tsx'
import { ResultadoPericia } from './paginas/ResultadoPericia.tsx'
import { Conversa } from './paginas/Conversa.tsx'
import { ConferirConversa } from './paginas/ConferirConversa.tsx'

// Roteamento mínimo, com poucas telas. Entra um roteador de verdade junto com as telas de passo (GGVP-86).
// Só "Entrar" e o guia de tokens (sem dado) abrem sem sessão; o resto confere a sessão no servidor primeiro (GGVP-117).
export function App({ caminho = window.location.pathname, busca = window.location.search }: { caminho?: string; busca?: string }) {
  if (caminho === '/entrar') return <Entrar />
  if (caminho === '/tokens') return <Tokens />
  return <ComSessao caminho={caminho} busca={busca} />
}

function ComSessao({ caminho, busca }: { caminho: string; busca: string }) {
  const [usuario, setUsuario] = useState<UsuarioDaSessao | null>(null)

  useEffect(() => {
    // Sem sessão, chamarApi já leva ao login com a volta para esta tela.
    void chamarApi<UsuarioDaSessao>('/sessao').then((r) => r.ok && setUsuario(r.dados))
  }, [])

  if (!usuario) return null
  if (usuario.trocarSenha) return <TrocarSenha />
  if (!usuario.perfil) return <SemPerfil nome={usuario.nome} />
  return <Telas caminho={caminho} busca={busca} />
}

/** As telas do portal, já com sessão. Os dados ainda são os de exemplo (src/dados/). */
function Telas({ caminho, busca }: { caminho: string; busca: string }) {
  const parametros = new URLSearchParams(busca)
  if (caminho === '/') return <CentralAtendimento />
  if (caminho === '/advogada') return <CentralAdvogada />
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
  const beneficio = /^\/entrevista\/([^/]+)\/beneficio$/.exec(caminho)
  if (beneficio) return <DefinirBeneficio agendamentoId={decodeURIComponent(beneficio[1])} />
  const calculo = /^\/entrevista\/([^/]+)\/calculo$/.exec(caminho)
  if (calculo) return <CalcularTempo agendamentoId={decodeURIComponent(calculo[1])} />
  const fechamento = /^\/clientes\/([^/]+)\/fechamento$/.exec(caminho)
  if (fechamento) return <RegistrarFechamento fichaId={decodeURIComponent(fechamento[1])} />
  const recontato = /^\/clientes\/([^/]+)\/recontato$/.exec(caminho)
  if (recontato) return <Recontatar fichaId={decodeURIComponent(recontato[1])} />
  const novaDemanda = /^\/clientes\/([^/]+)\/nova-demanda$/.exec(caminho)
  if (novaDemanda) return <NovaDemanda fichaId={decodeURIComponent(novaDemanda[1])} />
  if (caminho === '/roteiros') return <Roteiro />
  const roteiro = /^\/roteiros\/([^/]+)$/.exec(caminho)
  if (roteiro) return <Roteiro id={decodeURIComponent(roteiro[1])} />
  const laudoNovo = /^\/casos\/([^/]+)\/laudo-novo$/.exec(caminho)
  if (laudoNovo) return <AnalisarLaudoNovo processoId={decodeURIComponent(laudoNovo[1])} />
  const parecer = /^\/casos\/([^/]+)\/parecer$/.exec(caminho)
  if (parecer) return <DarParecer processoId={decodeURIComponent(parecer[1])} />
  const complemento = /^\/casos\/([^/]+)\/complemento$/.exec(caminho)
  if (complemento) return <PedirComplemento processoId={decodeURIComponent(complemento[1])} />
  const dispensa = /^\/casos\/([^/]+)\/parecer\/dispensa$/.exec(caminho)
  if (dispensa) return <DispensarParecer processoId={decodeURIComponent(dispensa[1])} />
  const deficiencia = /^\/casos\/([^/]+)\/deficiencia$/.exec(caminho)
  if (deficiencia) return <LinhaDaDeficiencia processoId={decodeURIComponent(deficiencia[1])} />
  // Perícia (épico GGVP-10): a Central do Jurídico administrativo, a página do processo com a perícia e os passos DP.
  if (caminho === '/juridico-administrativo') return <CentralJuridicoAdm />
  const periciaAberta = /^\/casos\/([^/]+)\/pericia\/aberta$/.exec(caminho)
  if (periciaAberta) return <PericiaAberta processoId={decodeURIComponent(periciaAberta[1])} />
  const marcarPericia = /^\/casos\/([^/]+)\/pericia\/marcar$/.exec(caminho)
  if (marcarPericia) return <MarcarPericia processoId={decodeURIComponent(marcarPericia[1])} remarcar={parametros.get('remarcar') === '1'} />
  const documentosPericia = /^\/casos\/([^/]+)\/pericia\/documentos$/.exec(caminho)
  if (documentosPericia) return <ReunirDocumentosPericia processoId={decodeURIComponent(documentosPericia[1])} />
  const cobrancaPericia = /^\/casos\/([^/]+)\/pericia\/cobranca$/.exec(caminho)
  if (cobrancaPericia) return <CobrarDocumentoPericia processoId={decodeURIComponent(cobrancaPericia[1])} />
  const orientarPericia = /^\/casos\/([^/]+)\/pericia\/orientar$/.exec(caminho)
  if (orientarPericia) return <OrientarPericia processoId={decodeURIComponent(orientarPericia[1])} />
  const comparecimentoPericia = /^\/casos\/([^/]+)\/pericia\/comparecimento$/.exec(caminho)
  if (comparecimentoPericia) return <ComparecimentoPericia processoId={decodeURIComponent(comparecimentoPericia[1])} />
  const resultadoPericia = /^\/casos\/([^/]+)\/pericia\/resultado$/.exec(caminho)
  if (resultadoPericia) return <ResultadoPericia processoId={decodeURIComponent(resultadoPericia[1])} />
  const pericia = /^\/casos\/([^/]+)\/pericia$/.exec(caminho)
  if (pericia) return <ProcessoPericia processoId={decodeURIComponent(pericia[1])} abrirPerito={parametros.get('perito') === '1'} />
  const conversa = /^\/conversas\/([^/]+)$/.exec(caminho)
  if (conversa) return <Conversa conversaId={decodeURIComponent(conversa[1])} simular={parametros.get('simular') ?? undefined} />
  const conferirConversa = /^\/conversas\/([^/]+)\/conferir$/.exec(caminho)
  if (conferirConversa) return <ConferirConversa conversaId={decodeURIComponent(conferirConversa[1])} />
  return <NaoConstruida caminho={caminho} />
}
