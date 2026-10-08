// Sugestão pronta (Mateus, 07/10): em segundo plano, a IA prepara a sugestão de cada tarefa que espera alguém, antes de a
// pessoa abrir; a tela só mostra (a sugestão fica guardada pelo conteúdo, em `sugerir`). Cada rota com IA registra aqui
// como achar o que espera e como preparar um, com a mesma função que a rota usa.
import { and, eq, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { tarefa } from '../banco/esquema.ts'
import type { Ia } from './ia.ts'

type Item = { listar: () => Promise<string[]>; preparar: (id: string) => Promise<unknown> }
export type Preparo = ReturnType<typeof criarPreparo>

export function criarPreparo(ia: Ia, aoFalhar: (erro: unknown) => void) {
  const itens: Item[] = []
  let rodando = false
  return {
    registrar: (listar: Item['listar'], preparar: Item['preparar']) => void itens.push({ listar, preparar }),
    /** Uma rodada, uma de cada vez. Sem chave, não roda. A falha da IA já fica no registro; a pessoa tenta ao abrir. */
    async rodar() {
      if (!ia.ligada || rodando) return
      rodando = true
      try {
        for (const i of itens) for (const id of await i.listar()) await i.preparar(id).catch(aoFalhar)
      } finally {
        rodando = false
      }
    },
  }
}

/** Os casos com a tarefa do passo esperando alguém. */
export async function casosComTarefaAberta(banco: Banco, passo: string) {
  const linhas = await banco.selectDistinct({ casoId: tarefa.casoId }).from(tarefa).where(and(eq(tarefa.passo, passo), isNull(tarefa.concluidaEm)))
  return linhas.flatMap((l) => (l.casoId ? [l.casoId] : []))
}
