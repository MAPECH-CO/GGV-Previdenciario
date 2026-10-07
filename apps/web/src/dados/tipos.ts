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
  /** Tela do passo, quando já existe (GGVP-8); sem ela, a linha abre /tarefas/:id. */
  href?: string
}
