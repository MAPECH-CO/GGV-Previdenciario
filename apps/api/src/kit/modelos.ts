// Os modelos do kit no banco (GGVP-136): cada versão é uma linha de `modelo` (tipo "contrato"), com a chave do .docx no
// armazenamento privado em `conteudo`. A versão em vigor é a única com `ativo`; as anteriores ficam guardadas.
import { and, eq } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { modelo } from '../banco/esquema.ts'

/** O que `modelo.conteudo` guarda de um modelo do kit: onde está o arquivo e o que ele é. Nunca o nome do arquivo enviado. */
export type ArquivoDoModelo = { chave: string; sha256: string; tamanho: number }

export type ModeloEmVigor = { id: string; nome: string; versao: number; desde: Date; arquivo: ArquivoDoModelo }

const doBanco = (m: typeof modelo.$inferSelect): ModeloEmVigor => ({ id: m.id, nome: m.nome, versao: m.versao, desde: m.criadoEm, arquivo: JSON.parse(m.conteudo) as ArquivoDoModelo })

/** Os modelos do kit em vigor, um por identificador (`contrato-completo-loas`, `modelo-6`...). */
export async function modelosEmVigor(banco: Banco): Promise<ModeloEmVigor[]> {
  return (await banco.select().from(modelo).where(and(eq(modelo.tipo, 'contrato'), eq(modelo.ativo, true)))).map(doBanco)
}

/** O modelo em vigor de um identificador, ou nada quando a Sênior ainda não subiu o arquivo. */
export async function modeloEmVigor(banco: Banco, id: string): Promise<ModeloEmVigor | undefined> {
  const [m] = await banco.select().from(modelo).where(and(eq(modelo.tipo, 'contrato'), eq(modelo.nome, id), eq(modelo.ativo, true)))
  return m && doBanco(m)
}
