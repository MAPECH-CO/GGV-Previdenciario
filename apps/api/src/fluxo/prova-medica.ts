// A prova de exigência que é documento médico sobe como sensível (GGVP-39 CA15 e GGVP-83 CA15; orquestrador, 09/10):
// dado de saúde só com `dado_saude.ver_detalhe`, e cada leitura fica em `acesso_dado_sensivel`. Regra é código com teste.

const PEDE_DOCUMENTO_MEDICO = /\b(laudos?|atestados?|exames?|receitas?|receitu[áa]rios?|prontu[áa]rios?|relat[óo]rios? m[ée]dicos?|per[íi]cias? m[ée]dicas?)\b/i

/** Sensível quando o item pede documento médico ou quem sobe marca que é laudo, atestado ou exame (campo `medico`). */
export function provaEhSensivel(descricaoDoItem: string | null | undefined, campoMedico: string | undefined): boolean {
  return campoMedico === 'true' || PEDE_DOCUMENTO_MEDICO.test(descricaoDoItem ?? '')
}
