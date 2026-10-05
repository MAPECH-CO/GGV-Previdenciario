// Forma dos dados que as telas consomem. Provisória: o contrato de verdade (schema Zod)
// nasce na design.md de cada história e mora em packages/contratos.

export type ClienteResumo = {
  id: string
  nome: string
}

export type Tarefa = {
  id: string
  /** Código do passo do BPMN, como D1.19 ou DP.03. */
  codigo: string
  /** Quem é o cliente da tarefa. Nulo quando a tarefa é de um contexto (Balcão, Fila de revisão...). */
  cliente: ClienteResumo | null
  contexto?: string
  /** Ação da lista fixa do perfil (Cobrar documento, Conferir contrato...). */
  acao: string
  /** Benefício, o que falta, de onde veio. */
  detalhe: string
  /** Texto do prazo como a pessoa lê: "hoje", "vence 30/09", "15:30". */
  prazo?: string
  /** Prazo vencido ou estourado: ponto e prazo em cor de ação. */
  urgente?: boolean
  /** Para onde a linha leva. Sem ele, /tarefas/:id. */
  href?: string
  /** O caso em andamento a que a tarefa está ligada (GGVP-17, CA3). */
  processoId?: string
  /** Concluída sai da Central. */
  concluida?: boolean
}

// GGVP-16 em diante: a ficha única da pessoa. Espelho do Zod da design.md da change ggvp-6.

export type Situacao = 'lead' | 'cliente'

/** 'Atendimento': as pendências do próprio Atendimento, como "Preencher ficha" (GGVP-21). */
export type Setor = 'Jurídico' | 'Documentação · ADM' | 'Financeiro' | 'Atendimento'

/** Um processo tem um benefício só; outro benefício do mesmo cliente é processo novo, na mesma ficha. */
export type Processo = {
  id: string
  /** Número do processo (CNJ) ou do requerimento, quando já existe. */
  numero?: string
  /** Id do catálogo de benefícios. */
  beneficio: string
  /** Etapa como o Atendimento lê: "Judicial · exigência". */
  etapa: string
  /** O que o Atendimento faz agora no caso. */
  proximaAcao?: string
  prazo?: string
  urgente?: boolean
  /** Data (aaaa-mm-dd) do laudo novo ainda não analisado pelo Jurídico (GGVP-17, CA6). */
  laudoNovoEm?: string
}

export type Agendamento = {
  id: string
  /** aaaa-mm-dd */
  data: string
  /** hh:mm */
  hora: string
  /** "Entrevista", "Retirada da cópia do contrato"... */
  oQue: string
  /** Com quem: "Dra. Paula". */
  com?: string
  // GGVP-123: a marcação da entrevista. Sem estes campos, vale o padrão (marcado, 45 minutos).
  tipo?: TipoDeEntrevista
  /** Em minutos. */
  duracao?: number
  estado?: EstadoDoCompromisso
  /** Quantas vezes já foi remarcada: até 2 (G15). */
  remarcacoes?: number
  conviteEnviadoEm?: string
  /** Aviso de gravação no início (G10). */
  gravar?: boolean
  /** O convite pede o que trazer. */
  levar?: boolean
  /** O convite pede a ficha de atendimento em papel (até o tablet chegar). */
  pedirFicha?: boolean
  /** A confirmação da entrevista do lead, por mensagem ou ligação (GGVP-21). */
  confirmacao?: Confirmacao
}

/** Uma linha de "Últimos contatos". */
export type Contato = {
  /** aaaa-mm-dd */
  data: string
  canal: string
  texto: string
}

/** Toda decisão e toda alteração: quem, quando e o quê. */
export type EventoHistorico = {
  /** Data e hora ISO. */
  quando: string
  quem: string
  oQue: string
}

export type DocumentoPessoal = {
  nome: string
  detalhe: string
}

/** Pasta do cliente no Drive (simulado): uma só por cliente, com uma subpasta por processo. */
export type PastaDrive = {
  id: string
  nome: string
  caminho: string
  /** CPF guardado pelo scanner, quando ele leu. */
  cpf?: string
}

export type Ficha = {
  id: string
  situacao: Situacao
  /** Mês e ano em que virou lead ou cliente: "03/2023". */
  desde: string
  nome: string
  /** Só números. */
  cpf?: string
  /** Quando não há data de nascimento, a idade dita no balcão. */
  idade?: number
  /** aaaa-mm-dd */
  nascimento?: string
  /** Só números, com DDD. */
  telefone: string
  email?: string
  estadoCivil?: string
  endereco?: string
  cidadeUf?: string
  /** Só números. */
  cep?: string
  profissao?: string
  /** Id do catálogo de fontes. */
  comoChegou?: string
  /** Nome de quem indicou. Não vira captador. */
  indicadoPor?: string
  contatoPreferido?: string
  contatoApoio?: string
  observacoes?: string
  /** Id do catálogo de benefícios. */
  beneficioInteresse?: string
  /** Linha embaixo do nome na ficha: "trabalhador rural aposentando · Santo Amaro, São Paulo/SP". */
  resumo?: string
  /** Só a situação da senha do gov.br: o valor fica no cofre e nunca vem para cá (GGVP-24, G9). */
  senhaGov: SenhaGov
  /** Data (aaaa-mm-dd) do laudo novo que o Jurídico ainda não analisou. */
  laudoNovoEm?: string
  fichaAtendimentoPreenchida: boolean
  /** As respostas da triagem da ficha de atendimento (GGVP-24). Os dados pessoais ficam na própria ficha. */
  fichaAtendimento?: FichaDeAtendimento
  /** "Pode ser auxílio acidentário?", decidido na análise da ficha (GGVP-28). */
  analise?: AnaliseDaFicha
  /** A tentativa do Atendimento de renovar a senha do gov.br (GGVP-36). */
  renovacao?: Renovacao
  /** A FICHA DE ATENDIMENTO AUXILIO ACIDENTE (GGVP-28). A seção médica só o Jurídico vê. */
  segundaFicha?: SegundaFicha
  processos: Processo[]
  agendamentos: Agendamento[]
  contatos: Contato[]
  documentos: DocumentoPessoal[]
  /** Só a situação da documentação médica. O conteúdo do laudo nunca vem para o Atendimento. */
  documentacaoMedica?: string
  transcricoes: number
  historico: EventoHistorico[]
  pastaId?: string
  /** O que está na pasta do Drive (simulado): Documentos pessoais e uma subpasta por processo (GGVP-17, CA14). */
  arquivos: Arquivo[]
  /** Ficha criada pela automação do scanner: pode chegar sem telefone (GGVP-17, CA15). */
  origem?: 'scanner'
}

/** Uma pessoa na lista da busca do balcão. */
export type ResultadoBusca = {
  id: string
  nome: string
  situacao: Situacao
  /** Onde a pessoa está: a etapa do primeiro caso, ou a do lead ("Lead · entrevista hoje 15:30"). */
  etapa: string
  /** Cada caso em andamento, com o nome do benefício. */
  casos: { beneficio: string; etapa: string }[]
  /** Nome do benefício de interesse do lead. */
  beneficioInteresse?: string
  agendamentoHoje?: Agendamento
  fichaAtendimentoPreenchida: boolean
}

export type FichaResumo = {
  id: string
  nome: string
  situacao: Situacao
  etapa: string
  telefone: string
}

/** O que a tela "Novo cliente" manda salvar. */
export type NovoCliente = {
  nome: string
  idade: number
  pretende: string
  telefone: string
  cpf?: string
  email?: string
  cidadeUf?: string
  beneficioInteresse: string
  comoChegou?: string
  indicadoPor?: string
  observacao?: string
  /** "É outra pessoa", depois do aviso de telefone ou nome igual. */
  outraPessoa: boolean
}

/** Criada a ficha, vêm as pastas do Drive que podem ser dela; a tela liga uma ou cria a pasta. */
export type RespostaNovoCliente =
  | { resultado: 'criada'; id: string; pastas: PastaDrive[] }
  | { resultado: 'ja-existe'; id: string }
  | { resultado: 'parecidas'; fichas: FichaResumo[] }

export type Encaminhamento = {
  fichaId: string
  /** 'documento' vai sempre para a Documentação · ADM (GGVP-17, CA1). */
  motivo: 'entrevista' | 'outra-etapa' | 'documento'
  setor: Setor
}

/** Tarefa que um setor recebeu do balcão. `lote` é o resultado do scanner, quando a tarefa é "Receber documento". */
export type TarefaEncaminhada = Tarefa & { setor: Setor; lote?: LoteDigitalizado }

/** Campos que a ficha deixa editar. */
export type EdicaoFicha = Pick<
  Ficha,
  | 'nome'
  | 'cpf'
  | 'nascimento'
  | 'telefone'
  | 'email'
  | 'estadoCivil'
  | 'endereco'
  | 'cidadeUf'
  | 'cep'
  | 'profissao'
  | 'comoChegou'
  | 'contatoPreferido'
  | 'contatoApoio'
  | 'observacoes'
>

// GGVP-17 em diante: documentos na pasta do cliente. Espelho do Zod da design.md da change ggvp-6.

/** 'pessoais' (Documentos pessoais) ou o id do processo, que tem a sua subpasta. */
export type LocalNaPasta = string

export type Arquivo = {
  /** Com "(2)" quando o nome já existia na pasta (CA13). */
  nome: string
  /** Id do catálogo de tipos de documento. */
  tipo: string
  local: LocalNaPasta
  /** aaaa-mm-dd */
  data: string
  origem: 'scanner' | 'card' | 'chat'
  /** O mesmo conteúdo já estava na pasta (CA13). */
  repetido: boolean
  /** Segue para a leitura da GGVP-81 (CA2). */
  aguardaLeitura: boolean
  /** SHA-256 do conteúdo. Só o servidor usa, para achar o repetido. */
  hash?: string
}

/** O que o n8n manda ao portal quando um lote do scanner termina (CA2, CA4, CA10). */
export type LoteDigitalizado = {
  loteId: string
  /** A coluna Status do "Painel da digitalização". */
  status: 'arquivado' | 'pasta-criada' | 'revisao' | 'falhou'
  /** O motivo como está na planilha. */
  motivo: string
  /** Ausente na revisão: lote em revisão não mexe no portal. */
  fichaId?: string
  /** Página em branco: aviso "CONFERIR O PAPEL" (CA10). */
  conferirPapel: boolean
  arquivos: { nome: string; tipo: string; paginas: number }[]
}

/** Um arquivo da janela "Conferir e enviar", já conferido pela pessoa (CA12). */
export type ArquivoParaEnviar = {
  nome: string
  formato: 'pdf' | 'jpg' | 'png'
  /** Em bytes. */
  tamanho: number
  tipo: string
  hash: string
}

export type EnvioDeArquivos = { origem: 'card' | 'chat'; arquivos: ArquivoParaEnviar[] }

export type RespostaEnvio =
  | { resultado: 'enviado'; arquivos: Arquivo[]; laudoNovo: boolean }
  /** Sem pasta achada e sem CPF: pasta nova só nasce com CPF (CA11). */
  | { resultado: 'sem-pasta' }

/** "Registrar" na tela do passo (CA5, CA10). */
export type RegistroRecebimento = {
  forma: 'papel' | 'digital'
  conferiTipos: true
  /** Obrigatório quando o lote veio com "CONFERIR O PAPEL". */
  conferiPapel: boolean
}

// GGVP-123 em diante: a entrevista e a agenda. Espelho do Zod da design.md da change ggvp-6.

export type TipoDeEntrevista = 'video' | 'presencial' | 'telefone'

export type EstadoDoCompromisso = 'marcado' | 'realizado' | 'faltou' | 'remarcado'

export type CategoriaDaAgenda = 'visitas' | 'pericias' | 'audiencias' | 'protocolos' | 'prazos' | 'bancos' | 'retornos'

/** O que a agenda mostra: entrevistas e retiradas das fichas e os compromissos internos (CA5). */
export type EventoDaAgenda = {
  /** O id do agendamento ou do compromisso interno. */
  id: string
  /** aaaa-mm-dd */
  data: string
  /** hh:mm */
  hora: string
  /** Em minutos. */
  duracao: number
  /** O nome do cliente, ou o título do compromisso interno. */
  titulo: string
  /** "Fazer entrevista", "Retirada da cópia do contrato", "Compromisso interno". */
  oQue: string
  categoria: CategoriaDaAgenda
  tipo?: TipoDeEntrevista
  responsavel?: string
  /** "D1.09 · Atender e entrevistar". */
  passo?: string
  /** 'confirmar': passou sem registro (CA8). */
  estado: 'agendado' | 'realizado' | 'faltou' | 'confirmar'
  fichaId?: string
  remarcacoes: number
  conviteEnviadoEm?: string
  gravar?: boolean
  /** Entrevista de lead que ainda espera a confirmação (GGVP-21). */
  aConfirmar?: boolean
}

/** "Marcar e enviar convite" (CA1, CA3); com `remarcar`, o motivo é obrigatório (CA7). */
export type Marcacao = {
  tipo: TipoDeEntrevista
  /** aaaa-mm-dd */
  data: string
  hora: string
  duracao: number
  /** Id da EQUIPE: nunca captador (CA2). */
  com: string
  gravar: boolean
  levar: boolean
  pedirFicha: boolean
  /** Horário ocupado: o escritório tem duas salas (CA3). */
  confirmarHorarioOcupado: boolean
  remarcar?: { agendamentoId: string; motivo: string }
}

export type RespostaMarcacao =
  | { resultado: 'marcado'; agendamento: Agendamento }
  | { resultado: 'ocupado'; conflitos: EventoDaAgenda[] }
  /** Já são 2 remarcações: o caso sobe para a advogada sênior (G15). */
  | { resultado: 'limite' }

/** Compromisso sem cliente, como "gravação amanhã" (CA5). */
export type CompromissoInterno = {
  titulo: string
  /** aaaa-mm-dd */
  data: string
  hora: string
  duracao: number
  /** Id da EQUIPE ou 'atendimento'. */
  responsavel: string
}

/** O compromisso interno guardado no servidor. */
export type CompromissoGuardado = CompromissoInterno & { id: string; estado: EstadoDoCompromisso }

// GGVP-21 em diante: a confirmação da entrevista do lead. Espelho do Zod da design.md da change ggvp-6.

export type CanalDoContato = 'mensagem' | 'ligacao'

export type Tentativa = {
  /** Data e hora ISO. */
  quando: string
  quem: string
  canal: CanalDoContato
  resultado: 'confirmou' | 'sem-resposta'
}

export type Confirmacao = {
  tentativas: Tentativa[]
  /** aaaa-mm-dd: 3 dias depois da tentativa sem resposta (CA6). */
  proximaEm?: string
  /** Duas sem resposta: a advogada sênior resolve (CA6). */
  naSenior?: boolean
}

export type RegistroDaConfirmacao =
  | { resultado: 'confirmou'; canal: CanalDoContato; jaPreencheuFicha: boolean }
  | { resultado: 'sem-resposta'; canal: CanalDoContato }

export type RespostaDaConfirmacao = {
  /** O número desta tentativa. */
  tentativa: number
  proximaEm?: string
  naSenior: boolean
  /** Preparar entrevista, Preencher ficha ou a da sênior. */
  tarefa?: TarefaEncaminhada
}

// GGVP-24 em diante: a ficha de atendimento e o cofre. Espelho do Zod da design.md da change ggvp-6.

export type SituacaoDaSenha = 'sem-senha' | 'escritorio-tem' | 'no-cofre'

export type SenhaGov = {
  situacao: SituacaoDaSenha
  /** "Não sei a senha" (CA3): a ficha segue com o alerta de senha (GGVP-36). */
  naoSabe?: boolean
  /** Lida da ficha em papel: o Atendimento confere (CA15). */
  conferir?: boolean
  /** Data e hora ISO. */
  atualizadaEm?: string
  por?: string
  /** aaaa-mm-dd: a última vez que a senha entrou na conta (GGVP-36). */
  funcionouEm?: string
}

export type ModeloDaFicha = 'GGV' | 'APA'

export type FichaDeAtendimento = {
  /** aaaa-mm-dd: o dia em que foi preenchida, sem edição (CA12). */
  data: string
  origem: 'papel' | 'tablet'
  modelo?: ModeloDaFicha
  pessoasNaCasa?: number
  ultimaAtividade?: string
  semTrabalharDesde?: string
  pedidosAoInss?: string
  /** O que ficou em branco, para o Jurídico (CA6). */
  emBranco: string[]
}

/** O que "Salvar ficha" manda. Sem campo de senha (CA8). */
export type EnvioDaFicha = {
  nome: string
  cpf: string
  /** dd/mm/aaaa */
  nascimento: string
  telefone: string
  endereco?: string
  pessoasNaCasa?: number
  beneficioInteresse: string
  ultimaAtividade?: string
  semTrabalharDesde?: string
  pedidosAoInss?: string
  origem: 'papel' | 'tablet'
  modelo?: ModeloDaFicha
}

/** O que a automação do scanner e a IA devolvem da ficha em papel (CA14). */
export type LeituraDaFicha = {
  modelo: ModeloDaFicha
  arquivo: Arquivo
  campos: Partial<EnvioDaFicha>
  /** Os campos que a IA não conseguiu ler. */
  naoLidos: (keyof EnvioDaFicha)[]
  /** Havia senha escrita: foi para o cofre, para conferir (CA15). */
  senhaLida: boolean
}

// GGVP-32 em diante: a preparação da conversa. Espelho do Zod da design.md da change ggvp-6.

export type AnaliseDaFicha = {
  acidentario: boolean
  quem: string
  /** Data e hora ISO. */
  quando: string
}

export type Renovacao =
  | { resultado: 'renovou'; quem: string; quando: string }
  | { resultado: 'nao-conseguiu'; motivo: string; quem: string; quando: string }

export type PontoDeAtencao = {
  tipo: 'acidentario' | 'senha' | 'beneficio' | 'em-branco'
  texto: string
  /** O que entra no detalhe da tarefa da fila, quando é alerta. */
  curto: string
  alerta: boolean
}

export type Preparacao = {
  ficha: Ficha
  agendamento: Agendamento
  /** A leitura da IA, para conferir (CA3). */
  resumo: string
  pontos: PontoDeAtencao[]
  /** A anotação mais antiga de "Últimos contatos" (CA5). */
  primeiroContato?: Contato
}

// GGVP-28 em diante: a segunda ficha, de auxílio acidentário. Espelho do Zod da design.md da change ggvp-6.

/** Todas as respostas em texto; '' é em branco. Escolhas: 'sim', 'nao', 'nao-sei'; lado: 'direito', 'esquerdo', 'os dois'. */
export type RespostasDaSegundaFicha = {
  // (2) dados profissionais
  empresa: string
  funcao: string
  vinculo: string
  /** dd/mm/aaaa */
  afastamentoEm: string
  acidenteEm: string
  acidenteLocal: string
  // (3) benefício e INSS; a senha do Meu INSS vai ao cofre
  nb: string
  der: string
  // (4) acidente
  cat: string
  catEm: string
  boletim: string
  boletimEm: string
  deTrabalho: string
  parteDoCorpo: string
  lado: string
  // (5) dados médicos: só o Jurídico vê
  doencas: string
  cid: string
  tratamento: string
  cirurgia: string
  medico: string
  laudos: string
  // (6) histórico do caso contado pelo cliente
  historico: string
}

export type SegundaFicha = {
  /** aaaa-mm-dd: o dia em que foi preenchida. */
  data: string
  origem: 'papel' | 'tablet'
  respostas: RespostasDaSegundaFicha
  /** O que ficou em branco, pelo rótulo. */
  emBranco: string[]
}

// GGVP-36 em diante: a renovação da senha do gov.br. Espelho do Zod da design.md da change ggvp-6.

/** A senha vai ao cofre e não volta; "Não" pede o motivo e o aviso ao cliente. */
export type RegistroDaRenovacao =
  | { resultado: 'renovou'; senha: string; conferiMeuInss: true }
  | { resultado: 'nao-conseguiu'; motivo: string; aviseiOCliente: true }

// GGVP-40 em diante: a entrevista gravada e a transcrição. Espelho do Zod da design.md da change ggvp-6.

export type Papel = 'advogada' | 'cliente' | 'atendimento'

export type Trecho = {
  /** Segundos desde o início do áudio. */
  aos: number
  quem: string
  papel: Papel
  texto: string
  /** Marcado como prova (GGVP-46, CA6). */
  prova?: boolean
}

/** Campos da ficha que a entrevista pode atualizar, depois de conferidos (GGVP-46, CA6). */
export type CampoDaEntrevista = 'telefone' | 'estadoCivil' | 'profissao' | 'contatoApoio'

export type InformacaoExtraida = {
  id: string
  rotulo: string
  valor: string
  destino: 'ficha' | 'documentacao' | 'cofre' | 'processo'
  campo?: CampoDaEntrevista
  /** Data e hora ISO da conferência: antes dela, a ficha não muda. */
  conferidaEm?: string
}

export type AcaoNaGravacao = {
  acao: 'avisou' | 'gravou' | 'pausou' | 'retomou' | 'abriu-cofre' | 'guardou-senha' | 'falhou' | 'encerrou' | 'sem-audio' | 'subiu-arquivo' | 'enviou-audio'
  /** Data e hora ISO. */
  quando: string
  /** Onde estava a gravação, em segundos. */
  aos: number
}

export type Audio = {
  nome: string
  formato: string
  /** Em bytes. Sem limite (CA10). */
  tamanho: number
  /** Partes de até 24 MB para a transcrição (CA10). */
  partes: number
}

export type EstadoDaTranscricao = 'aguardando-internet' | 'transcrevendo' | 'falhou' | 'pronta' | 'sem-audio'

export type Gravacao = {
  id: string
  fichaId: string
  agendamentoId?: string
  /** aaaa-mm-dd */
  data: string
  /** "Entrevista com a advogada", "Telefone: indeferimento e próximo passo". */
  titulo: string
  /** "vídeo", "telefone", "presencial", "WhatsApp". */
  canal: string
  participantes: string[]
  /** Em segundos. */
  duracao: number
  origem: 'portal' | 'arquivo' | 'registro'
  /** Data e hora ISO do aviso de gravação (G10). */
  avisoEm?: string
  estado: 'gravando' | 'pausada' | 'falhou' | 'encerrada'
  acoes: AcaoNaGravacao[]
  /** Guardado para sempre no caso (CA13). */
  audio?: Audio
  transcricao: EstadoDaTranscricao
  motivoDaFalha?: string
  trechos: Trecho[]
  resumo?: string
  extraidas: InformacaoExtraida[]
  /** O que o cliente precisa trazer: vai ao checklist do benefício depois de conferido (GGVP-46, CA7). */
  documentos: string[]
  documentosConferidosEm?: string
  /** A conversa sem áudio, escrita por quem participou. */
  registro?: string
  /** Entrevista com a advogada: tem dado de saúde, o Atendimento vê só a data, quem participou e a duração. */
  soJuridico: boolean
  /** "ficha atualizada", "benefício definido". */
  marcas: string[]
}

/** O que a tela da entrevista lê. */
export type Entrevista = { ficha: Ficha; agendamento: Agendamento; gravacao?: Gravacao }

/** O áudio gravado fora do portal, como a ligação do Chatwoot baixada (CA9). */
export type AudioDeFora = { nome: string; tipo: string; tamanho: number }

/** Encerrar devolve a gravação e a tarefa nova da advogada (CA5). */
export type RespostaDoEncerramento = { gravacao: Gravacao; tarefa?: TarefaEncaminhada }
