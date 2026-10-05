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

export const VERSAO_MATRIZ = 1

/** Ação → perfis que podem. Lista vazia: só o sistema faz (CA6). Fonte: cartão da GGVP-96 e respostas do PO de 02/10. */
export const MATRIZ = {
  // Ver (o que a tela e a API devolvem para cada perfil; CA1, CA12)
  'entrevista.ver': ['atendimento', 'atendimento_lider', ...JURIDICO],
  'laudo.ver': ['atendimento', 'atendimento_lider', 'documentacao', ...JURIDICO],
  'dado_saude.ver_detalhe': JURIDICO,
  'peticao.ver': JURIDICO,
  'valores.ver': ['financeiro', 'socio'],
  'prestacao.ver': ['financeiro', 'advogada', 'senior', 'socio'],
  'gestao.ver': ['socio', 'senior', 'atendimento_lider', 'financeiro'],
  // Fazer
  'laudo.subir': ['atendimento', 'atendimento_lider'],
  'laudo.conferir': ['advogada'],
  'caso.liberar_ao_juridico': ['documentacao'],
  'caso.aprovar_para_inss': ['senior'],
  'protocolo_inss.registrar': ['juridico_adm'],
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
