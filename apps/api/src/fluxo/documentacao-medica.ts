// O caso como as telas da documentação médica leem (GGVP-132): a pessoa, o processo no catálogo das telas e as partes
// guardadas em `documentacao_medica`. Comum às rotas do parecer, do complemento, da deficiência, do acidente e da criança.
import { and, eq } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, documentacaoMedica, pessoa, type PARTES_DOCUMENTACAO_MEDICA } from '../banco/esquema.ts'
import type { Processo } from '../../../web/src/dados/tipos.ts'

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MSG_CASO_NAO_ENCONTRADO = 'Caso não encontrado.'

/**
 * Os benefícios do servidor no catálogo das telas. ponytail: o mesmo mapa do pedido #29 (`rotas/recepcao.ts`); quando ele
 * entrar na main, importar de lá.
 */
const NO_CATALOGO: Record<string, string> = {
  bpc_loas_deficiente: 'loas-deficiente',
  bpc_loas_idoso: 'loas-idoso',
  aposentadoria_pcd: 'aposentadoria-pcd',
  aposentadoria_idade: 'aposentadoria-idade',
  aposentadoria_tempo: 'aposentadoria-contribuicao',
  aposentadoria_especial: 'aposentadoria-especial',
  aposentadoria_incapacidade_permanente: 'incapacidade-permanente',
  auxilio_incapacidade_temporaria: 'incapacidade-temporaria',
  auxilio_acidente: 'auxilio-acidente',
  pensao_morte: 'pensao-morte',
  salario_maternidade: 'salario-maternidade',
}
const ETAPA: Record<string, string> = { atendimento: 'Atendimento', administrativa: 'Administrativa · INSS', judicial: 'Judicial', encerrado: 'Encerrado' }

export type CasoMedico = {
  id: string
  pessoaId: string
  ficha: { id: string; nome: string; telefone: string; nascimento?: string }
  processo: Processo
}

export type Parte = (typeof PARTES_DOCUMENTACAO_MEDICA)[number]

export function criarCasoMedico(banco: Banco, agora: () => Date) {
  async function acharCaso(id: string): Promise<CasoMedico | null> {
    if (!UUID.test(id)) return null
    const [c] = await banco
      .select({ id: caso.id, beneficio: caso.beneficio, fase: caso.fase, pessoaId: pessoa.id, nome: pessoa.nome, telefone: pessoa.telefone, nascimento: pessoa.dataNascimento })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, id))
    if (!c) return null
    return {
      id: c.id,
      pessoaId: c.pessoaId,
      ficha: { id: c.pessoaId, nome: c.nome, telefone: c.telefone ?? '', ...(c.nascimento && { nascimento: c.nascimento }) },
      processo: { id: c.id, beneficio: c.beneficio ? (NO_CATALOGO[c.beneficio] ?? c.beneficio) : 'nao-sei', etapa: ETAPA[c.fase] ?? c.fase },
    }
  }

  async function lerParte<T>(casoId: string, parte: Parte): Promise<T | undefined> {
    const [l] = await banco
      .select({ documento: documentacaoMedica.documento })
      .from(documentacaoMedica)
      .where(and(eq(documentacaoMedica.casoId, casoId), eq(documentacaoMedica.parte, parte)))
    return l?.documento as T | undefined
  }

  async function gravarParte(casoId: string, parte: Parte, documento: unknown) {
    await banco
      .insert(documentacaoMedica)
      .values({ casoId, parte, documento, atualizadoEm: agora() })
      .onConflictDoUpdate({ target: [documentacaoMedica.casoId, documentacaoMedica.parte], set: { documento, atualizadoEm: agora() } })
  }

  return { acharCaso, lerParte, gravarParte }
}
