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

export const VERSAO_MATRIZ = 13

/** Ação → perfis que podem. Lista vazia: só o sistema faz (CA6). Fonte: cartão da GGVP-96 e respostas do PO de 02/10. */
export const MATRIZ = {
  // Ver (o que a tela e a API devolvem para cada perfil; CA1, CA12)
  'entrevista.ver': ['atendimento', 'atendimento_lider', ...JURIDICO],
  'laudo.ver': ['atendimento', 'atendimento_lider', 'documentacao', ...JURIDICO],
  'dado_saude.ver_detalhe': JURIDICO,
  'peticao.ver': JURIDICO,
  // O financeiro do escritório é todo do Financeiro (Pedro, 06/10). A advogada vê os valores só na prestação de
  // contas, que é ela quem faz; o Sócio vê só totais do escritório, no painel da GGVP-75. Valor da causa e renda per
  // capita do LOAS não são financeiro do escritório: são dado jurídico e seguem para a advogada (Pedro, 07/10).
  'valores.ver': ['financeiro'],
  'prestacao.ver': ['financeiro', 'advogada'],
  'gestao.ver': ['socio', 'senior', 'atendimento_lider', 'financeiro'],
  /** Ver o caso só para leitura (GGVP-23 CA4). Financeiro vê prestação e Gestão; o Sócio, Gestão; nenhum dos dois vê o caso. */
  'caso.ver': ['atendimento', 'atendimento_lider', 'documentacao', ...JURIDICO],
  // Fazer
  'laudo.subir': ['atendimento', 'atendimento_lider'],
  'laudo.conferir': ['advogada'],
  'caso.liberar_ao_juridico': ['documentacao'],
  'caso.aprovar_para_inss': ['senior'],
  'caso.encerrar': ['senior'],
  'inss.registrar_resposta': JURIDICO,
  'protocolo_inss.registrar': ['juridico_adm'],
  'pericia.decidir': ['advogada'],
  'pericia.abrir_tarefa': [],
  'pericia.marcar': ['juridico_adm'],
  'pericia.decidir_documento_novo': ['juridico_adm'],
  'pericia.orientar_cliente': ['juridico_adm'],
  'pericia.registrar_comparecimento': ['juridico_adm'],
  'caso.despachar_indeferimento': ['senior'],
  'exigencia_juiz.analisar': ['advogada', 'senior'],
  'peticao.pedir': ['advogada'],
  'peticao.aprovar': ['advogada'],
  'prestacao.dar_ok': ['advogada'],
  'prestacao.registrar_recebimento': ['financeiro'],
  'tarefa.atribuir': ['atendimento_lider', 'senior'],
  'perfis.atribuir': ['socio'],
  // Versão 4 (GGVP-39 e GGVP-44): exigência do INSS e ida ao banco
  'exigencia_inss.tratar': ['advogada'],
  'exigencia_inss.cumprir': ['documentacao'],
  'exigencia_inss.decidir_vencida': ['senior'],
  // Versão 11 (GGVP-98, Lucas 06/10): o Financeiro avisa o cliente e marca a ida ao banco; o Atendimento leva.
  'banco.agendar': ['financeiro'],
  // Versão 5 (GGVP-26, 30, 34, 74): vigília das publicações; a fila sem CNJ é da Sênior (resposta do revisor de 06/10)
  'vigilia.ver': ['senior', 'advogada'],
  'vigilia.reprocessar': ['senior'],
  'publicacao.casar': ['senior'],
  'publicacao.classificar': ['advogada', 'senior'],
  // Versão 6 (GGVP-79, 83, 87): exigência do juiz; o Jurídico entre os setores é o Jurídico administrativo
  'exigencia_juiz.distribuir': ['advogada'],
  'exigencia_juiz.cumprir': ['atendimento', 'atendimento_lider', 'documentacao', 'juridico_adm'],
  'exigencia_juiz.manifestar': ['advogada'],
  'exigencia_juiz.autorizar_dilacao': ['senior'],
  // Versão 7 (GGVP-58, 71): os laços do despacho da Sênior e o protocolo da petição inicial
  'pendencia.cumprir': ['atendimento', 'atendimento_lider', 'documentacao'],
  'peticao.protocolar': ['advogada'],
  // GGVP-103 CA11: a senha do gov.br entra e muda só pelo cofre, pelo Atendimento ou pelo Jurídico.
  'cofre.cadastrar': ['atendimento', 'atendimento_lider', ...JURIDICO],
  // GGVP-99 CA12 (Lucas, 01/10): ninguém exporta o histórico sem a autorização da direção.
  'historico.autorizar_exportacao': ['socio'],
  // GGVP-104: a gestão do escritório muda limites, kits e mensagens sem mexer no código.
  'configuracao.editar': ['socio', 'senior'],
  // Versão 12 (GGVP-22, Lucas 06/10): o Jurídico aprova o resumo do resultado; a advogada ou o Atendimento explica ao cliente.
  'resultado.aprovar_resumo': ['advogada', 'senior'],
  'resultado.explicar': ['atendimento', 'atendimento_lider', 'advogada'],
  // Versão 13 (GGVP-19, Lucas 06/10): o estudo de caso do processo perdido é estratégia interna, do Jurídico; quando ele
  // indica novo processo, quem decide é a Sênior.
  'estudo.ver': JURIDICO,
  'estudo.revisar': ['senior'],
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
