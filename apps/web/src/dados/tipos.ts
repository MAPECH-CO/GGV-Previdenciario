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
}

// GGVP-16 em diante: a ficha única da pessoa. Espelho do Zod da design.md da change ggvp-6.

export type Situacao = 'lead' | 'cliente'

export type Setor = 'Jurídico' | 'Documentação · ADM' | 'Financeiro'

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
  senhaGovNoCofre: boolean
  /** Data (aaaa-mm-dd) do laudo novo que o Jurídico ainda não analisou. */
  laudoNovoEm?: string
  fichaAtendimentoPreenchida: boolean
  processos: Processo[]
  agendamentos: Agendamento[]
  contatos: Contato[]
  documentos: DocumentoPessoal[]
  /** Só a situação da documentação médica. O conteúdo do laudo nunca vem para o Atendimento. */
  documentacaoMedica?: string
  transcricoes: number
  historico: EventoHistorico[]
  pastaId?: string
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
  motivo: 'entrevista' | 'outra-etapa'
  setor: Setor
}

/** Tarefa que um setor recebeu do balcão. */
export type TarefaEncaminhada = Tarefa & { setor: Setor }

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
