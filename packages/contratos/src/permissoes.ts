// Matriz de permissões (GGVP-96): quem pode fazer o quê. A tela usa para esconder; o servidor, para recusar.
// Mudou a matriz: suba VERSAO_MATRIZ e atualize a impressão digital no teste (CA15).

export const PERFIS = ['atendimento', 'atendimento_lider', 'documentacao', 'advogada', 'senior', 'juridico_adm', 'financeiro', 'socio'] as const
export type Perfil = (typeof PERFIS)[number]

export const ROTULO_PERFIL: Record<Perfil, string> = {
  atendimento: 'Atendimento',
  atendimento_lider: 'Atendimento · líder',
  documentacao: 'Documentação',
  advogada: 'Advogada responsável',
  senior: 'Sênior',
  juridico_adm: 'Jurídico administrativo',
  financeiro: 'Financeiro',
  socio: 'Sócio',
}

const JURIDICO: Perfil[] = ['advogada', 'senior', 'juridico_adm']
/**
 * A Sênior é advogada com mais poderes (Pedro, 07/10): faz os passos jurídicos da advogada. Ficam só com a advogada a decisão
 * no limite da perícia e o resultado dela (G15: "nunca a Sênior", Lucas 29/09) e tudo de valores (a prestação de contas).
 */
const ADVOGADAS: Perfil[] = ['advogada', 'senior']

// Ordem de entrada de 08/10: Jurimetria 11 e 12, Recepção no servidor 13, Desfecho 14, IA 15, Relacionamento no servidor
// 16, Perícia no servidor 17, documentação médica no servidor 18, glossário 19, Recepção blocos 3b a 4c 20, levar ao banco
// 21, acesso por perfil 22 (09/10), recurso 23, o Sócio lê tudo 24, a Sênior vê a prestação 25, o kit de verdade 26. Quem
// entrar depois renumera.
export const VERSAO_MATRIZ = 26

/** Ação → perfis que podem. Lista vazia: só o sistema faz (CA6). Fonte: cartão da GGVP-96 e respostas do PO de 02/10. */
export const MATRIZ = {
  // Ver (o que a tela e a API devolvem para cada perfil; CA1, CA12). O Sócio é dono e lê tudo, inclusive o conteúdo médico,
  // as peças e os valores (Pedro, 09/10); fazer, só o que cada ação diz.
  'entrevista.ver': ['atendimento', 'atendimento_lider', ...JURIDICO, 'socio'],
  'laudo.ver': ['atendimento', 'atendimento_lider', 'documentacao', ...JURIDICO, 'socio'],
  'dado_saude.ver_detalhe': [...JURIDICO, 'socio'],
  'peticao.ver': [...JURIDICO, 'socio'],
  // O financeiro do escritório é do Financeiro (Pedro, 06/10). A advogada vê os valores só na prestação de contas, que é
  // ela quem faz. O Sócio tem acesso total de leitura, inclusive os valores de cada cliente (Lucas, 07/10) e o dado de
  // saúde (Pedro, 09/10), sem fazer passo. Valor da causa e renda per capita do LOAS não são financeiro do escritório: são dado jurídico e
  // seguem para a advogada (Pedro, 07/10). A Sênior não vê valores.
  'valores.ver': ['financeiro', 'socio'],
  /** Os totais em dinheiro do painel de resultados (GGVP-75 CA4): honorários recebidos e tempo até o dinheiro. */
  'valores.ver_totais': ['socio', 'financeiro'],
  // Versão 25 (Pedro, 09/10): a Sênior vê a prestação de contas, só ela; os outros valores do caso continuam fora.
  'prestacao.ver': ['financeiro', 'advogada', 'senior', 'socio'],
  /** Prazos, tentativas bloqueadas, uso do cofre, configuração e a exportação da trilha. O Financeiro vê só os Resultados (Figma). */
  'gestao.ver': ['socio', 'senior', 'atendimento_lider'],
  /** Ver o caso só para leitura (GGVP-23 CA4). O Sócio lê tudo (Lucas, 07/10); o Financeiro vê a prestação e os Resultados, não o caso. */
  'caso.ver': ['atendimento', 'atendimento_lider', 'documentacao', ...JURIDICO, 'socio'],
  // Fazer
  'laudo.subir': ['atendimento', 'atendimento_lider'],
  'laudo.conferir': ADVOGADAS,
  'caso.liberar_ao_juridico': ['documentacao'],
  'caso.aprovar_para_inss': ['senior'],
  'caso.encerrar': ['senior'],
  'inss.registrar_resposta': JURIDICO,
  'protocolo_inss.registrar': ['juridico_adm'],
  'pericia.decidir': ADVOGADAS,
  'pericia.abrir_tarefa': [],
  'pericia.marcar': ['juridico_adm'],
  'pericia.decidir_documento_novo': ['juridico_adm'],
  'pericia.orientar_cliente': ['juridico_adm'],
  'pericia.registrar_comparecimento': ['juridico_adm'],
  'caso.despachar_indeferimento': ['senior'],
  'exigencia_juiz.analisar': ['advogada', 'senior'],
  'peticao.pedir': ADVOGADAS,
  'peticao.aprovar': ADVOGADAS,
  'prestacao.dar_ok': ['advogada'],
  'prestacao.registrar_recebimento': ['financeiro'],
  'tarefa.atribuir': ['atendimento_lider', 'senior'],
  'perfis.atribuir': ['socio'],
  // Versão 4 (GGVP-39 e GGVP-44): exigência do INSS e ida ao banco
  'exigencia_inss.tratar': ADVOGADAS,
  'exigencia_inss.cumprir': ['documentacao'],
  'exigencia_inss.decidir_vencida': ['senior'],
  // Versão 14 (GGVP-98, Lucas 06/10): o Financeiro avisa o cliente e marca a ida ao banco; o Atendimento leva.
  'banco.agendar': ['financeiro'],
  // Versão 21 (GGVP-98, P3 do roteiro de 09/10): quem leva o cliente ao banco é do Atendimento (Lucas, Q24).
  'banco.levar': ['atendimento', 'atendimento_lider'],
  // Versão 5 (GGVP-26, 30, 34, 74): vigília das publicações; a fila sem CNJ é da Sênior (resposta do revisor de 06/10)
  'vigilia.ver': ['senior', 'advogada', 'socio'],
  'vigilia.reprocessar': ['senior'],
  'publicacao.casar': ['senior'],
  // Versão 12 (GGVP-55 CA7): só o desfecho conferido pela Sênior entra nas contas da jurimetria.
  'acervo.conferir_desfecho': ['senior'],
  'publicacao.classificar': ['advogada', 'senior'],
  // Versão 6 (GGVP-79, 83, 87): exigência do juiz; o Jurídico entre os setores é o Jurídico administrativo
  'exigencia_juiz.distribuir': ADVOGADAS,
  'exigencia_juiz.cumprir': ['atendimento', 'atendimento_lider', 'documentacao', 'juridico_adm'],
  'exigencia_juiz.manifestar': ADVOGADAS,
  'exigencia_juiz.autorizar_dilacao': ['senior'],
  // Versão 7 (GGVP-58, 71): os laços do despacho da Sênior e o protocolo da petição inicial
  'pendencia.cumprir': ['atendimento', 'atendimento_lider', 'documentacao'],
  'peticao.protocolar': ADVOGADAS,
  // GGVP-103 CA11: a senha do gov.br entra e muda só pelo cofre, pelo Atendimento ou pelo Jurídico.
  'cofre.cadastrar': ['atendimento', 'atendimento_lider', ...JURIDICO],
  // GGVP-99 CA12 (Lucas, 01/10): ninguém exporta o histórico sem a autorização da direção.
  'historico.autorizar_exportacao': ['socio'],
  // GGVP-104: a gestão do escritório muda limites, kits e mensagens sem mexer no código.
  'configuracao.editar': ['socio', 'senior'],
  // Versão 14 (GGVP-22, Lucas 06/10): o Jurídico aprova o resumo do resultado; a advogada ou o Atendimento explica ao cliente.
  'resultado.aprovar_resumo': ['advogada', 'senior'],
  'resultado.explicar': ['atendimento', 'atendimento_lider', 'advogada'],
  // Versão 13 (GGVP-125, bloco 1): a ficha da Recepção no servidor. Quem trabalha com o caso cadastra e edita a ficha
  // (Atendimento, Documentação e Jurídico); Financeiro e Sócio, não. Quem mesclar com os PRs da IA e da Jurimetria
  // renumera a versão.
  'ficha.editar': ['atendimento', 'atendimento_lider', 'documentacao', ...JURIDICO],
  // GGVP-125, bloco 3a: gravar e transcrever a entrevista, que tem dado de saúde. Quem entrevista e analisa a ficha é "a
  // doutora" (Miro): a advogada e a Sênior; o Jurídico administrativo faz protocolo e perícia (perfis.md).
  'entrevista.gravar': ADVOGADAS,
  // GGVP-125, bloco 3b: analisar a ficha, definir o benefício e registrar o cálculo; a IA sugere, a doutora decide (G3). O
  // Jurídico administrativo não analisa a ficha (GGVP-96, 09/10).
  'ficha.analisar': ADVOGADAS,
  // Versão 15 (GGVP-19, Lucas 06/10): o estudo de caso do processo perdido é estratégia interna, do Jurídico; quando ele
  // indica novo processo, quem decide é a Sênior.
  'estudo.ver': [...JURIDICO, 'socio'],
  'estudo.revisar': ['senior'],
  // Versão 16 (GGVP-138, Pedro, 08/10): o Relacionamento com o cliente no servidor. Quem conversa com o cliente e registra
  // a conversa é o Atendimento e o Jurídico (advogada e Sênior), como nas telas; só a Sênior volta uma versão e dá prazo
  // novo à pendência atrasada; a segunda confirmação dos dados bancários é do Atendimento líder, da advogada ou da Sênior.
  'conversa.registrar': ['atendimento', 'atendimento_lider', 'advogada', 'senior'],
  'ficha.voltar_versao': ['senior'],
  'conversa.prazo_da_pendencia': ['senior'],
  'mensagem.enviar': ['atendimento', 'atendimento_lider', ...JURIDICO],
  'dados_bancarios.pedir': ['atendimento', 'atendimento_lider', 'advogada', 'senior'],
  'dados_bancarios.confirmar': ['atendimento_lider', 'advogada', 'senior'],
  // Versão 17 (GGVP-137, Pedro, 08/10): a Perícia no servidor. A Documentação reúne o que a perícia pede (DP.03); a advogada
  // responsável decide no limite (G15), nunca a Sênior, e confere o resultado e o laudo (DP.08, DP.09).
  'pericia.reunir_documentos': ['documentacao'],
  'pericia.decidir_no_limite': ['advogada'],
  'pericia.conferir_resultado': ['advogada'],
  // Versão 18 (GGVP-132, Pedro, 08/10): a documentação médica no servidor. Só a Sênior edita a régua do roteiro (GGVP-93).
  'roteiro.editar': ['senior'],
  // O parecer médico é do Jurídico que confere o caso: a advogada e a Sênior (GGVP-20 CA3). A IA nunca registra (G17).
  'parecer.registrar': ['advogada', 'senior'],
  // O complemento ao médico (GGVP-29): o Atendimento tenta, e no limite a Sênior decide (G15).
  'complemento.cobrar': ['atendimento', 'atendimento_lider'],
  'complemento.decidir': ['senior'],
  // A deficiência (GGVP-42) e a condição da criança (GGVP-50) são dado de saúde: só a advogada e a Sênior registram.
  'dado_saude.registrar': ['advogada', 'senior'],
  // A circunstância do acidente (GGVP-47): a Documentação ou o Jurídico marcam.
  'acidente.registrar': ['documentacao', 'advogada', 'senior'],
  // Versão 19 (GGVP-143, Pedro, 08/10): o glossário do escritório, que a transcrição e a IA usam, só a Sênior muda.
  'glossario.editar': ['senior'],
  // Versão 22 (GGVP-96, 09/10): o contrato (D1.16 a D1.20) é da raia do Atendimento; o % de honorários aparece só nele.
  'contrato.conduzir': ['atendimento', 'atendimento_lider'],
  // Os dados bancários do repasse (GGVP-111; LGPD, minimização): quem pede ou confirma a mudança e o Financeiro, que repassa.
  'dados_bancarios.ver': ['atendimento', 'atendimento_lider', 'advogada', 'senior', 'financeiro', 'socio'],
  // O painel de resultados (GGVP-75): a gestão e o Financeiro, que no Figma vê só ele.
  'resultados.ver': ['socio', 'senior', 'atendimento_lider', 'financeiro'],
  // Versão 23 (GGVP-100, Lucas 07/10): depois da sentença improcedente, quem confirma se recorre é a Sênior. A advogada
  // responsável e o Sócio só leem.
  'recurso.ver': ['advogada', 'senior', 'socio'],
  'recurso.decidir': ['senior'],
  // Versão 26 (GGVP-136, Orquestrador, 09/10): o kit de verdade. Só a Sênior sobe ou troca o modelo do Word do kit, com versão.
  'modelo.subir': ['senior'],
} as const satisfies Record<string, readonly Perfil[]>

export type Acao = keyof typeof MATRIZ

export function ehPerfil(valor: unknown): valor is Perfil {
  return typeof valor === 'string' && (PERFIS as readonly string[]).includes(valor)
}

export function pode(perfil: string | null | undefined, acao: Acao): boolean {
  return ehPerfil(perfil) && (MATRIZ[acao] as readonly Perfil[]).includes(perfil)
}

/** Impressão digital da matriz (FNV-1a), para o teste perceber mudança sem versão nova. */
export function digitalDaMatriz(): string {
  const texto = JSON.stringify(Object.entries(MATRIZ).sort(([a], [b]) => a.localeCompare(b)))
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(16)
}
