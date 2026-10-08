import { useEffect, useState, type ReactNode } from 'react'
import { ROTULO_PERFIL, ehPerfil, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
import { Agenda, type Vista } from './paginas/Agenda.tsx'
import { AnalisarFicha } from './paginas/AnalisarFicha.tsx'
import { Balcao } from './paginas/Balcao.tsx'
import { CadastrarLead } from './paginas/CadastrarLead.tsx'
import { CentralAdvogada } from './paginas/CentralAdvogada.tsx'
import { CentralAtendimento } from './paginas/CentralAtendimento.tsx'
import { CentralEmConstrucao } from './paginas/CentralEmConstrucao.tsx'
import { tarefasDeDecidirCobranca } from './dados/cobranca.ts'
import { tarefasDaFilaDaSenior } from './dados/liberacao.ts'
import { daSenior, tarefasDoParecer } from './dados/parecer.ts'
import { tarefasDeDecidirComplemento } from './dados/complemento.ts'
import { Conferencia } from './paginas/Conferencia.tsx'
import { DecidirPericia } from './paginas/DecidirPericia.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { Protocolar } from './paginas/Protocolar.tsx'
import { Vigilia } from './paginas/Vigilia.tsx'
import { TratarExigencia } from './paginas/TratarExigencia.tsx'
import { CumprirExigencia } from './paginas/CumprirExigencia.tsx'
import { PrestarContas } from './paginas/PrestarContas.tsx'
import { ReceberPrestacao } from './paginas/ReceberPrestacao.tsx'
import { IdaAoBanco } from './paginas/IdaAoBanco.tsx'
import { ExplicarResultado } from './paginas/ExplicarResultado.tsx'
import { PainelVigilia } from './paginas/PainelVigilia.tsx'
import { Tentativas } from './paginas/Tentativas.tsx'
import { Historico } from './paginas/Historico.tsx'
import { Prazos, UsoDoCofreTela } from './paginas/Gestao.tsx'
import { Configuracao } from './paginas/Configuracao.tsx'
import { LerPublicacao } from './paginas/LerPublicacao.tsx'
import { PublicacoesDoProcesso } from './paginas/PublicacoesDoProcesso.tsx'
import { AnalisarExigenciaJuiz } from './paginas/AnalisarExigenciaJuiz.tsx'
import { CumprirExigenciaJuiz } from './paginas/CumprirExigenciaJuiz.tsx'
import { Manifestar } from './paginas/Manifestar.tsx'
import { DespacharCaso } from './paginas/Despachar.tsx'
import { Peticao } from './paginas/Peticao.tsx'
import { Exige } from './paginas/SemPermissao.tsx'
import { ConfirmarAgendamento } from './paginas/ConfirmarAgendamento.tsx'
import { Entrevista } from './paginas/Entrevista.tsx'
import { EntrevistaAoVivo } from './paginas/EntrevistaAoVivo.tsx'
import { FichaAtendimento } from './paginas/FichaAtendimento.tsx'
import { FichaCliente } from './paginas/FichaCliente.tsx'
import { MarcarEntrevista } from './paginas/MarcarEntrevista.tsx'
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
import { Entrar } from './paginas/Entrar.tsx'
import { SemPerfil } from './paginas/SemPerfil.tsx'
import { TrocarSenha } from './paginas/TrocarSenha.tsx'
import { SessaoContexto } from './sessao.ts'
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

/** Perfis que trabalham na Central do Atendimento (a Documentação não tem Central própria; Pedro, 30/09). */
const NA_CENTRAL_DO_ATENDIMENTO = ['atendimento', 'atendimento_lider', 'documentacao']

function ComSessao({ caminho, busca }: { caminho: string; busca: string }) {
  const [usuario, setUsuario] = useState<UsuarioDaSessao | null>(null)

  useEffect(() => {
    // Sem sessão, chamarApi já leva ao login com a volta para esta tela.
    void chamarApi<UsuarioDaSessao>('/sessao').then((r) => r.ok && setUsuario(r.dados))
  }, [])

  if (!usuario) return null
  if (usuario.trocarSenha) return <TrocarSenha />
  if (!usuario.perfilAtivo) return <SemPerfil nome={usuario.nome} />
  return (
    <SessaoContexto value={usuario}>
      <Inicio caminho={caminho} busca={busca} perfil={usuario.perfilAtivo} />
    </SessaoContexto>
  )
}

/** Telas de passo (GGVP-8). Cada uma dentro de <Exige>: sem a permissão, nem monta (GGVP-96 CA11). */
const TELAS_DE_CASO: { padrao: RegExp; tela: (id: string) => ReactNode }[] = [
  { padrao: /^\/casos\/([0-9a-f-]{36})\/conferencia$/, tela: (id) => <Exige acao="caso.ver"><Conferencia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/protocolo$/, tela: (id) => <Exige acao="protocolo_inss.registrar"><Protocolar casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/pericia$/, tela: (id) => <Exige acao="pericia.decidir"><DecidirPericia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/vigilia$/, tela: (id) => <Exige acao="caso.ver"><Vigilia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia$/, tela: (id) => <Exige acao="caso.ver"><TratarExigencia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia\/documentos$/, tela: (id) => <Exige acao="exigencia_inss.cumprir"><CumprirExigencia casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/prestacao$/, tela: (id) => <Exige acao="prestacao.ver"><PrestarContas casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/prestacao\/recebimento$/, tela: (id) => <Exige acao="prestacao.registrar_recebimento"><ReceberPrestacao casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/banco$/, tela: (id) => <Exige acao="banco.agendar"><IdaAoBanco casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/resultado$/, tela: (id) => <Exige acao="caso.ver"><ExplicarResultado casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/publicacoes$/, tela: (id) => <Exige acao="caso.ver"><PublicacoesDoProcesso casoId={id} /></Exige> },
  { padrao: /^\/publicacoes\/([0-9a-f-]{36})$/, tela: (id) => <Exige acao="caso.ver"><LerPublicacao publicacaoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia-juiz$/, tela: (id) => <Exige acao="caso.ver"><AnalisarExigenciaJuiz casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia-juiz\/setor$/, tela: (id) => <Exige acao="exigencia_juiz.cumprir"><CumprirExigenciaJuiz casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/manifestacao$/, tela: (id) => <Exige acao="caso.ver"><Manifestar casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/pendencias$/, tela: (id) => <Exige acao="pendencia.cumprir"><CumprirExigenciaJuiz casoId={id} origem="despacho" /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/despacho$/, tela: (id) => <Exige acao="caso.ver"><DespacharCaso casoId={id} /></Exige> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/peticao$/, tela: (id) => <Exige acao="peticao.ver"><Peticao casoId={id} /></Exige> },
  { padrao: /^\/vigilia$/, tela: () => <Exige acao="vigilia.ver"><PainelVigilia /></Exige> },
  { padrao: /^\/gestao\/tentativas$/, tela: () => <Exige acao="gestao.ver"><Tentativas /></Exige> },
  { padrao: /^\/gestao\/prazos$/, tela: () => <Exige acao="gestao.ver"><Prazos /></Exige> },
  { padrao: /^\/gestao\/cofre$/, tela: () => <Exige acao="gestao.ver"><UsoDoCofreTela /></Exige> },
  { padrao: /^\/configuracao$/, tela: () => <Exige acao="gestao.ver"><Configuracao /></Exige> },
  // GGVP-99: quem vê o caso vê a linha; a direção entra só para autorizar a exportação. O servidor decide.
  { padrao: /^\/casos\/([0-9a-f-]{36})\/historico$/, tela: (id) => <Historico casoId={id} /> },
]

function Inicio({ caminho, busca, perfil }: { caminho: string; busca: string; perfil: string }) {
  for (const { padrao, tela } of TELAS_DE_CASO) {
    const achou = caminho.match(padrao)
    if (achou) return tela(achou[1])
  }
  if (caminho === '/') {
    // Uma tela inicial por perfil, pelo perfil da sessão ("Entrar como...", GGVP-96; tela inicial, GGVP-78).
    if (NA_CENTRAL_DO_ATENDIMENTO.includes(perfil)) return <CentralAtendimento />
    if (perfil === 'advogada') return <CentralAdvogada />
    // A perícia passou ao Jurídico administrativo (Lucas, 29/09): a Central dele, com o protocolo do INSS do servidor.
    if (perfil === 'juridico_adm') return <CentralJuridicoAdm />
    // A cobrança que passou do limite (GGVP-101 CA7) e o caso liberado pela Documentação (GGVP-18 CA1) chegam à Sênior.
    // Da documentação médica: a dispensa esperando a segunda sênior (GGVP-33) e o complemento a decidir (GGVP-29).
    if (perfil === 'senior')
      return (
        <CentralEmConstrucao
          rotulo={ROTULO_PERFIL.senior}
          deExemplo={[...tarefasDeDecidirCobranca(), ...tarefasDaFilaDaSenior(), ...tarefasDoParecer().filter(daSenior), ...tarefasDeDecidirComplemento()]}
        />
      )
    // As Centrais dos outros perfis entram com as histórias de cada épico (GGVP-78).
    return <CentralEmConstrucao rotulo={ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : perfil} />
  }
  return <Telas caminho={caminho} busca={busca} />
}

/** Telas da Recepção e da Abertura. Os dados ainda são os de exemplo (src/dados/), até ligar no servidor (GGVP-125). */
function Telas({ caminho, busca }: { caminho: string; busca: string }) {
  const parametros = new URLSearchParams(busca)
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
  if (liberar) return <LiberarCaso processoId={decodeURIComponent(liberar[1])} />
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
