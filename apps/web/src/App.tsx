import { useEffect, useState, type ReactNode } from 'react'
import { ROTULO_PERFIL, ehPerfil, pode, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
import { Carregando } from './componentes/Carregando.tsx'
import { definirQuemFaz, sincronizarRecepcao } from './dados/servidor.ts'
import { sincronizarDocumentacaoMedica } from './dados/parecer.ts'
import { sincronizarPericias } from './dados/pericia.ts'
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
import { AjustarCaso } from './paginas/AjustarCaso.tsx'
import { DecidirPericia } from './paginas/DecidirPericia.tsx'
import { NaoConstruida } from './paginas/NaoConstruida.tsx'
import { Protocolar } from './paginas/Protocolar.tsx'
import { Vigilia } from './paginas/Vigilia.tsx'
import { TratarExigencia } from './paginas/TratarExigencia.tsx'
import { CumprirExigencia } from './paginas/CumprirExigencia.tsx'
import { PrestarContas } from './paginas/PrestarContas.tsx'
import { ReceberPrestacao } from './paginas/ReceberPrestacao.tsx'
import { IdaAoBanco } from './paginas/IdaAoBanco.tsx'
import { ConfirmarDesfecho } from './paginas/ConfirmarDesfecho.tsx'
import { LevarAoBanco } from './paginas/LevarAoBanco.tsx'
import { ExplicarResultado } from './paginas/ExplicarResultado.tsx'
import { DecidirRecurso } from './paginas/DecidirRecurso.tsx'
import { Estudos } from './paginas/Estudos.tsx'
import { BaseDoBeneficio } from './paginas/BaseDoBeneficio.tsx'
import { Pericias } from './paginas/Pericias.tsx'
import { PainelVigilia } from './paginas/PainelVigilia.tsx'
import { Tentativas } from './paginas/Tentativas.tsx'
import { Resultados } from './paginas/Resultados.tsx'
import { ConferirAcervo } from './paginas/ConferirAcervo.tsx'
import { Historico } from './paginas/Historico.tsx'
import { Prazos, UsoDoCofreTela } from './paginas/Gestao.tsx'
import { Configuracao } from './paginas/Configuracao.tsx'
import { Importar } from './paginas/Importar.tsx'
import { LerPublicacao } from './paginas/LerPublicacao.tsx'
import { PublicacoesDoProcesso } from './paginas/PublicacoesDoProcesso.tsx'
import { AnalisarExigenciaJuiz } from './paginas/AnalisarExigenciaJuiz.tsx'
import { CumprirExigenciaJuiz } from './paginas/CumprirExigenciaJuiz.tsx'
import { Manifestar } from './paginas/Manifestar.tsx'
import { DespacharCaso } from './paginas/Despachar.tsx'
import { Peticao } from './paginas/Peticao.tsx'
import { Exige } from './paginas/SemPermissao.tsx'
import { acaoDoCaminho } from './regras/acesso.ts'
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
import { Peritos } from './paginas/Peritos.tsx'
import { OrientarPericia } from './paginas/OrientarPericia.tsx'
import { ComparecimentoPericia } from './paginas/ComparecimentoPericia.tsx'
import { ResultadoPericia } from './paginas/ResultadoPericia.tsx'
import { Conversa } from './paginas/Conversa.tsx'
import { ConferirConversa } from './paginas/ConferirConversa.tsx'
import { PaginaDoCaso } from './paginas/PaginaDoCaso.tsx'
import { Clientes } from './paginas/Clientes.tsx'
import { Processos } from './paginas/Processos.tsx'
import { CentralSenior } from './paginas/CentralSenior.tsx'
import { CentralFinanceiro } from './paginas/CentralFinanceiro.tsx'
import { InicioDoSocio } from './paginas/InicioDoSocio.tsx'
import { Financeiro } from './paginas/Financeiro.tsx'
import { Custas } from './paginas/Custas.tsx'

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
  // Enquanto confere: o "Carregando"; servidor fora: o aviso; sessão vencida (401): nada, porque o login já está abrindo.
  const [espera, setEspera] = useState<'carregando' | 'falhou' | 'saindo'>('carregando')

  useEffect(() => {
    // Sem sessão, chamarApi já leva ao login com a volta para esta tela.
    void chamarApi<UsuarioDaSessao>('/sessao').then(async (r) => {
      if (!r.ok) return setEspera(r.status === 401 ? 'saindo' : 'falhou')
      // GGVP-135: o que ainda grava só no navegador guarda no histórico o nome de quem entrou.
      definirQuemFaz(r.dados.nome)
      // GGVP-125: antes de a tela abrir, a cópia da Recepção no navegador recebe o que está no servidor, para quem vê os
      // casos (o Financeiro e o Sócio não). Sem rede, a tela abre com a cópia que já tinha.
      if (pode(r.dados.perfilAtivo, 'caso.ver')) await sincronizarRecepcao().catch(() => undefined)
      // GGVP-132: as tarefas e o parecer (G17) da documentação médica dos casos do servidor, depois da Recepção.
      if (pode(r.dados.perfilAtivo, 'caso.ver')) await sincronizarDocumentacaoMedica().catch(() => undefined)
      // GGVP-137: e as perícias, com as tarefas da Central de quem está na sessão.
      if (pode(r.dados.perfilAtivo, 'caso.ver')) await sincronizarPericias(pode(r.dados.perfilAtivo, 'dado_saude.ver_detalhe')).catch(() => undefined)
      setUsuario(r.dados)
    }).catch(() => setEspera('falhou'))
  }, [])

  if (!usuario) return espera === 'saindo' ? null : <Carregando falhou={espera === 'falhou'} />
  if (usuario.trocarSenha) return <TrocarSenha />
  if (!usuario.perfilAtivo) return <SemPerfil nome={usuario.nome} />
  return (
    <SessaoContexto value={usuario}>
      <Inicio caminho={caminho} busca={busca} perfil={usuario.perfilAtivo} />
    </SessaoContexto>
  )
}

/** Telas de passo (GGVP-8). Cada uma dentro de <Exige>, pela regra de regras/acesso.ts: sem a permissão, nem monta (GGVP-96 CA11). */
const TELAS_DE_CASO: { padrao: RegExp; tela: (id: string) => ReactNode }[] = [
  { padrao: /^\/casos\/([0-9a-f-]{36})\/conferencia$/, tela: (id) => <Conferencia casoId={id} /> },
  // GGVP-127: o caso devolvido pela Sênior; quem libera de novo o servidor decide (o setor da tarefa de ajuste).
  { padrao: /^\/casos\/([0-9a-f-]{36})\/ajuste$/, tela: (id) => <AjustarCaso casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/protocolo$/, tela: (id) => <Protocolar casoId={id} /> },
  // GGVP-137: a decisão (D2.03) tem endereço próprio; /casos/:id/pericia é a página da perícia, também no caso do servidor.
  { padrao: /^\/casos\/([0-9a-f-]{36})\/pericia\/decidir$/, tela: (id) => <DecidirPericia casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/vigilia$/, tela: (id) => <Vigilia casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia$/, tela: (id) => <TratarExigencia casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia\/documentos$/, tela: (id) => <CumprirExigencia casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/prestacao$/, tela: (id) => <PrestarContas casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/prestacao\/recebimento$/, tela: (id) => <ReceberPrestacao casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/banco$/, tela: (id) => <IdaAoBanco casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/banco\/levar$/, tela: (id) => <LevarAoBanco casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/resultado$/, tela: (id) => <ExplicarResultado casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/desfecho$/, tela: (id) => <ConfirmarDesfecho casoId={id} /> },
  // GGVP-100: a Sênior decide se recorre; a advogada responsável e o Sócio só leem.
  { padrao: /^\/casos\/([0-9a-f-]{36})\/recurso$/, tela: (id) => <DecidirRecurso casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/publicacoes$/, tela: (id) => <PublicacoesDoProcesso casoId={id} /> },
  { padrao: /^\/publicacoes\/([0-9a-f-]{36})$/, tela: (id) => <LerPublicacao publicacaoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia-juiz$/, tela: (id) => <AnalisarExigenciaJuiz casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/exigencia-juiz\/setor$/, tela: (id) => <CumprirExigenciaJuiz casoId={id} /> },
  // A manifestação é peça jurídica: só o Jurídico (GGVP-96; perfis.md, o Atendimento e a Documentação nunca veem petição).
  { padrao: /^\/casos\/([0-9a-f-]{36})\/manifestacao$/, tela: (id) => <Manifestar casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/pendencias$/, tela: (id) => <CumprirExigenciaJuiz casoId={id} origem="despacho" /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/despacho$/, tela: (id) => <DespacharCaso casoId={id} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/peticao$/, tela: (id) => <Peticao casoId={id} /> },
  { padrao: /^\/vigilia$/, tela: () => <PainelVigilia /> },
  { padrao: /^\/peritos$/, tela: () => <Peritos /> },
  { padrao: /^\/estudos$/, tela: () => <Estudos /> },
  // GGVP-163 R5: a base histórica por benefício (a síntese e as taxas da base do Lucas), só para quem tem `estudo.ver`.
  { padrao: /^\/beneficios$/, tela: () => <BaseDoBeneficio /> },
  { padrao: /^\/beneficios\/([^/]+)$/, tela: (id) => <BaseDoBeneficio beneficio={decodeURIComponent(id)} /> },
  { padrao: /^\/casos\/([0-9a-f-]{36})\/pericias$/, tela: (id) => <Pericias casoId={id} /> },
  { padrao: /^\/gestao\/tentativas$/, tela: () => <Tentativas /> },
  { padrao: /^\/gestao\/prazos$/, tela: () => <Prazos /> },
  { padrao: /^\/gestao\/cofre$/, tela: () => <UsoDoCofreTela /> },
  // GGVP-96: o Financeiro vê só os Resultados da Gestão (Figma).
  { padrao: /^\/gestao\/resultados$/, tela: () => <Resultados /> },
  { padrao: /^\/acervo\/conferencia$/, tela: () => <ConferirAcervo /> },
  { padrao: /^\/configuracao$/, tela: () => <Configuracao /> },
  // GGVP-146, parte 2: a planilha do escritório, pela gestão que muda a configuração.
  { padrao: /^\/gestao\/importar$/, tela: () => <Importar /> },
  // GGVP-99: a linha do processo. GGVP-162: só para quem abre o processo (o Jurídico e o Sócio, que autoriza a exportação).
  { padrao: /^\/casos\/([0-9a-f-]{36})\/historico$/, tela: (id) => <Historico casoId={id} /> },
  // GGVP-78: o painel Financeiro, para quem vê os totais em dinheiro (o Financeiro e o Sócio).
  { padrao: /^\/financeiro$/, tela: () => <Financeiro /> },
  // GGVP-157: as custas dos processos, para quem vê valores (o Financeiro e o Sócio), e o detalhe de um processo.
  { padrao: /^\/custas$/, tela: () => <Custas /> },
  { padrao: /^\/custas\/([0-9a-f-]{36})$/, tela: (id) => <Custas casoId={id} /> },
]

function Inicio({ caminho, busca, perfil }: { caminho: string; busca: string; perfil: string }) {
  for (const { padrao, tela } of TELAS_DE_CASO) {
    const achou = caminho.match(padrao)
    if (achou) return <Exige acao={acaoDoCaminho(caminho)!}>{tela(achou[1])}</Exige>
  }
  // GGVP-158: as telas desenhadas para a advogada levam o Início a /advogada; outro perfil vai à tela inicial dele, e não à
  // Central da advogada (o Atendimento na página da perícia, a Sênior na entrevista ao vivo).
  if (caminho === '/' || (caminho === '/advogada' && perfil !== 'advogada')) {
    // Uma tela inicial por perfil, pelo perfil da sessão ("Entrar como...", GGVP-96; tela inicial, GGVP-78).
    if (NA_CENTRAL_DO_ATENDIMENTO.includes(perfil)) return <CentralAtendimento />
    if (perfil === 'advogada') return <CentralAdvogada />
    // A perícia passou ao Jurídico administrativo (Lucas, 29/09): a Central dele, com o protocolo do INSS do servidor.
    if (perfil === 'juridico_adm') return <CentralJuridicoAdm />
    // A cobrança que passou do limite (GGVP-101 CA7) e o caso liberado pela Documentação (GGVP-18 CA1) chegam à Sênior.
    // Da documentação médica: a dispensa esperando a segunda sênior (GGVP-33) e o complemento a decidir (GGVP-29).
    if (perfil === 'senior')
      return (
        <CentralSenior
          deExemplo={[...tarefasDeDecidirCobranca(), ...tarefasDaFilaDaSenior(), ...tarefasDoParecer().filter(daSenior), ...tarefasDeDecidirComplemento()]}
        />
      )
    // GGVP-78: a Central do Financeiro (Figma 59:863) e, para o Sócio, o painel de resultado com a busca e o chat (perfis.md).
    if (perfil === 'financeiro') return <CentralFinanceiro />
    if (perfil === 'socio') return <InicioDoSocio />
    // As Centrais dos outros perfis entram com as histórias de cada épico (GGVP-78).
    return <CentralEmConstrucao rotulo={ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : perfil} />
  }
  return <Telas caminho={caminho} busca={busca} />
}

function Telas({ caminho, busca }: { caminho: string; busca: string }) {
  const acao = acaoDoCaminho(caminho)
  const tela = <TelaDoCaminho caminho={caminho} busca={busca} />
  return acao ? <Exige acao={acao}>{tela}</Exige> : tela
}

/** Telas da Recepção e da Abertura. Os dados ainda são os de exemplo (src/dados/), até ligar no servidor (GGVP-125). */
function TelaDoCaminho({ caminho, busca }: { caminho: string; busca: string }) {
  const parametros = new URLSearchParams(busca)
  // GGVP-96: os ganchos de teste (?simular=) só no desenvolvimento; na homologação e na produção, nunca.
  const simular = import.meta.env.DEV ? (parametros.get('simular') ?? undefined) : undefined
  if (caminho === '/advogada') return <CentralAdvogada />
  if (caminho === '/balcao') return <Balcao />
  if (caminho === '/clientes/novo') return <NovoCliente />
  // GGVP-78: as bases do topo; a contagem de processos em Clientes abre /processos?cliente=<id>.
  if (caminho === '/clientes') return <Clientes />
  if (caminho === '/processos') return <Processos cliente={parametros.get('cliente') ?? undefined} />
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
  if (gravacao) return <EntrevistaAoVivo agendamentoId={decodeURIComponent(gravacao[1])} simular={simular} />
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
  if (fechamento) return <RegistrarFechamento fichaId={decodeURIComponent(fechamento[1])} antesDaEntrevista={parametros.get("antes-da-entrevista") === "1"} />
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
  if (conversa) return <Conversa conversaId={decodeURIComponent(conversa[1])} simular={simular} />
  const conferirConversa = /^\/conversas\/([^/]+)\/conferir$/.exec(caminho)
  if (conferirConversa) return <ConferirConversa conversaId={decodeURIComponent(conferirConversa[1])} />
  // Experiência por perfil (épico GGVP-5): o caso numa linha só (GGVP-86).
  const caso = /^\/casos\/([^/]+)$/.exec(caminho)
  if (caso) return <PaginaDoCaso processoId={decodeURIComponent(caso[1])} />
  return <NaoConstruida caminho={caminho} />
}
