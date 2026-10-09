// Tarefas do setor (GGVP-147): o quadro do líder, o "Atribuir" e o que o líder deu a quem está na sessão. Tudo no
// servidor (GET /api/setor, POST /api/setor/atribuicoes, GET /api/setor/minhas).
import { useCallback, useEffect, useState } from 'react'
import { MinhasDoSetor, QuadroDoSetor, pode, type AtribuirTarefa, type TarefaDoSetor } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { useSessao } from '../sessao.ts'
import type { Tarefa } from './tipos.ts'

/** O quadro do líder; `recarregar` depois de cada atribuição. `null` enquanto carrega ou sem permissão. */
export function useQuadroDoSetor(ligado: boolean): { quadro: QuadroDoSetor | null; erro: string; recarregar: () => void } {
  const [quadro, setQuadro] = useState<QuadroDoSetor | null>(null)
  const [erro, setErro] = useState('')
  const recarregar = useCallback(() => {
    if (!ligado) return
    // Resposta fora do formato (servidor antigo, teste) não derruba a Central: fica o aviso.
    void chamarApi<QuadroDoSetor>('/setor').then((r) => {
      const lido = r.ok ? QuadroDoSetor.safeParse(r.dados) : null
      if (lido?.success) setQuadro(lido.data)
      else setErro(r.ok ? 'Não deu para abrir as tarefas do setor.' : r.erro)
    })
  }, [ligado])
  useEffect(recarregar, [recarregar])
  return { quadro, erro, recarregar }
}

export async function atribuir(corpo: AtribuirTarefa): Promise<string | null> {
  const r = await chamarApi('/setor/atribuicoes', { method: 'POST', corpo })
  return r.ok ? null : r.erro
}

/** O que o líder deu a quem está na sessão e o que deu a outra pessoa. Sem resposta, nada muda na fila. */
export function useMinhasDoSetor(): MinhasDoSetor | null {
  const [minhas, setMinhas] = useState<MinhasDoSetor | null>(null)
  // Quem não vê o caso (o Financeiro) não tem fila de setor: o servidor responderia 403, só barulho no console.
  const perfil = useSessao()?.perfilAtivo
  const fora = perfil !== undefined && !pode(perfil, 'caso.ver')
  useEffect(() => {
    if (fora) return
    void chamarApi<MinhasDoSetor>('/setor/minhas')
      .then((r) => {
        const lido = r.ok ? MinhasDoSetor.safeParse(r.dados) : null
        if (lido?.success) setMinhas(lido.data)
      })
      .catch(() => undefined)
  }, [fora])
  return minhas
}

/** A linha da Central para uma tarefa do setor, com o aviso de quem atribuiu e o recado. */
export function linhaDoSetor(t: TarefaDoSetor): Tarefa {
  const aviso = t.atribuidaPor ? `${t.atribuidaPor} atribuiu a você${t.recado ? `: ${t.recado}` : ''}` : null
  return {
    id: t.id,
    codigo: t.codigo,
    cliente: t.cliente,
    ...(t.contexto && { contexto: t.contexto }),
    acao: t.acao,
    detalhe: aviso ? `${t.detalhe} · ${aviso}` : t.detalhe,
    ...(t.prazo && { prazo: t.prazo }),
    urgente: t.urgente,
    ...(t.href && { href: t.href }),
  }
}

/**
 * "Minhas tarefas" com a distribuição do líder (CA2): sai o que ele deu a outra pessoa, e entra, no topo, o que ele deu
 * a quem está na sessão, mesmo de outra raia do setor.
 */
export function juntarMinhas(tarefas: Tarefa[], minhas: MinhasDoSetor | null): Tarefa[] {
  if (!minhas) return tarefas
  const deOutros = new Set(minhas.deOutros)
  const doLider = minhas.minhas.map(linhaDoSetor)
  const ids = new Set(doLider.map((t) => t.id))
  return [...doLider, ...tarefas.filter((t) => !deOutros.has(t.id) && !ids.has(t.id))]
}
