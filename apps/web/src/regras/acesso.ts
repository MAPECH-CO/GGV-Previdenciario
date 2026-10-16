import { pode, type Acao } from '@ggv/contratos'

const CASO = '([0-9a-f-]{36})'
const caso = (resto: string) => new RegExp(`^/casos/${CASO}${resto}$`)

/**
 * Quem abre cada tela, pelo endereço: a ação da matriz que a tela exige (GGVP-96 CA11, GGVP-135). Vale a primeira que
 * casa. Primeiro as telas de passo de um caso do servidor, depois a Recepção, a Abertura e a Perícia (a raia do BPMN).
 * Sem linha aqui, a tela confere sozinha (documentação médica, roteiros, a perícia do caso) ou é de todos (agenda).
 * Quem protege é o servidor; a tela só não mostra o caminho que acabaria em "Sem permissão".
 */
const ACESSO: [RegExp, Acao][] = [
  [caso('/conferencia'), 'caso.ver'],
  // GGVP-127: o caso devolvido pela Sênior; quem libera de novo o servidor decide (o setor da tarefa de ajuste).
  [caso('/ajuste'), 'caso.ver'],
  [caso('/protocolo'), 'protocolo_inss.registrar'],
  // GGVP-137: a decisão (D2.03) tem endereço próprio; /casos/:id/pericia é a página da perícia.
  [caso('/pericia/decidir'), 'pericia.decidir'],
  [caso('/vigilia'), 'caso.ver'],
  [caso('/exigencia'), 'caso.ver'],
  [caso('/exigencia/documentos'), 'exigencia_inss.cumprir'],
  [caso('/prestacao'), 'prestacao.ver'],
  [caso('/prestacao/recebimento'), 'prestacao.registrar_recebimento'],
  [caso('/banco'), 'banco.agendar'],
  [caso('/banco/levar'), 'banco.levar'],
  [caso('/resultado'), 'caso.ver'],
  [caso('/desfecho'), 'caso.ver'],
  // GGVP-100: a Sênior decide se recorre; a advogada responsável e o Sócio só leem.
  [caso('/recurso'), 'recurso.ver'],
  [caso('/publicacoes'), 'caso.ver'],
  [/^\/publicacoes\/([0-9a-f-]{36})$/, 'caso.ver'],
  [caso('/exigencia-juiz'), 'caso.ver'],
  [caso('/exigencia-juiz/setor'), 'exigencia_juiz.cumprir'],
  // A manifestação é peça jurídica: só o Jurídico (GGVP-96; o Atendimento e a Documentação nunca veem petição).
  [caso('/manifestacao'), 'peticao.ver'],
  [caso('/pendencias'), 'pendencia.cumprir'],
  [caso('/despacho'), 'caso.ver'],
  [caso('/peticao'), 'peticao.ver'],
  [/^\/vigilia$/, 'vigilia.ver'],
  [/^\/peritos$/, 'estudo.ver'],
  [/^\/estudos$/, 'estudo.ver'],
  [caso('/pericias'), 'dado_saude.ver_detalhe'],
  [/^\/gestao\/(tentativas|prazos|cofre)$/, 'gestao.ver'],
  // GGVP-96: o Financeiro vê só os Resultados da Gestão.
  [/^\/gestao\/resultados$/, 'resultados.ver'],
  [/^\/acervo\/conferencia$/, 'acervo.conferir_desfecho'],
  [/^\/configuracao$/, 'gestao.ver'],
  // GGVP-146, parte 2: a planilha do escritório, pela gestão que muda a configuração.
  [/^\/gestao\/importar$/, 'configuracao.editar'],
  // GGVP-99 e GGVP-162: a linha do processo, só para quem abre o processo (o Jurídico e o Sócio).
  [caso('/historico'), 'processo.abrir'],
  // GGVP-78: o painel Financeiro, para quem vê os totais em dinheiro (o Financeiro e o Sócio).
  [/^\/financeiro$/, 'valores.ver_totais'],
  // A agenda lê a Recepção e as perícias do servidor, que pedem o caso: sem ele, a tela só daria erro.
  [/^\/agenda$/, 'caso.ver'],

  // Jurídico: a Central da advogada, preparar, analisar, entrevistar, gravar, cadastrar o lead, definir o benefício e
  // calcular tempo e pontos (o cálculo é do advogado, Pedro em 08/10).
  [/^\/advogada$/, 'entrevista.gravar'],
  // D1.08: a senha do gov.br vai ao cofre; o Atendimento renova, com o Jurídico.
  [/^\/entrevista\/[^/]+\/renovar-senha$/, 'cofre.cadastrar'],
  [/^\/entrevista\//, 'entrevista.gravar'],
  [/^\/clientes\/[^/]+\/cadastro$/, 'entrevista.gravar'],
  // A cobrança que passou do limite, a Sênior decide (a mesma decisão do complemento ao médico).
  [/^\/casos\/[^/]+\/cobranca\/decidir$/, 'complemento.decidir'],
  // Perícia: as mesmas ações que o servidor exige em cada passo.
  [/^\/juridico-administrativo$/, 'pericia.marcar'],
  [/^\/casos\/[^/]+\/pericia\/aberta$/, 'pericia.decidir'],
  [/^\/casos\/[^/]+\/pericia\/marcar$/, 'pericia.marcar'],
  [/^\/casos\/[^/]+\/pericia\/(documentos|cobranca)$/, 'pericia.reunir_documentos'],
  [/^\/casos\/[^/]+\/pericia\/orientar$/, 'pericia.orientar_cliente'],
  [/^\/casos\/[^/]+\/pericia\/comparecimento$/, 'pericia.registrar_comparecimento'],
  [/^\/casos\/[^/]+\/pericia\/resultado$/, 'pericia.conferir_resultado'],
  // GGVP-78: Clientes e Processos, as bases do topo (antes da regra geral de /clientes). Processos, só para quem abre o
  // processo (GGVP-162: o Jurídico e o Sócio).
  [/^\/clientes$/, 'caso.ver'],
  [/^\/processos$/, 'processo.abrir'],
  // D5: a conversa com o cliente, do Atendimento e do Jurídico.
  [/^\/conversas\//, 'conversa.registrar'],
  // Passou do limite de tentativas, a tarefa da Sênior abre a assinatura; quem vê o caso lê, sem % de honorários.
  [/^\/contrato\/[^/]+\/assinatura$/, 'caso.ver'],
  // D1.16 a D1.20: o contrato é da raia do Atendimento, e o % de honorários aparece só nele (GGVP-96).
  [/^\/contrato\//, 'contrato.conduzir'],
  // A ficha do cliente, para ler: quem vê o caso, e o Sócio, que lê tudo; mudar segue com ficha.editar no servidor.
  [/^\/clientes\/(?!novo$)[^/]+$/, 'caso.ver'],
  // O resto da Recepção e da Abertura: quem trabalha com o caso (Atendimento, Documentação e Jurídico).
  [/^\/(balcao|clientes|contrato)(\/|$)/, 'ficha.editar'],
  [/^\/agenda\/(marcar|confirmar)\//, 'ficha.editar'],
  [/^\/casos\/[^/]+\/cobranca$/, 'ficha.editar'],
  // A página do processo (GGVP-162): o Jurídico e o Sócio; o Atendimento e a Documentação leem o caso pela ficha.
  [/^\/casos\/[^/]+$/, 'processo.abrir'],
]

/** A ação que a tela do endereço exige, ou nada quando a tela confere sozinha ou é de todos. Ignora ?busca e #âncora. */
export function acaoDoCaminho(href: string): Acao | undefined {
  const caminho = href.split(/[?#]/)[0]
  return ACESSO.find(([padrao]) => padrao.test(caminho))?.[1]
}

/** O perfil abre a tela do endereço? Quando a tela confere sozinha, o link fica (a tela diz o que falta). */
export function podeAbrir(perfil: string | null | undefined, href: string): boolean {
  const acao = acaoDoCaminho(href)
  return !acao || pode(perfil, acao)
}
