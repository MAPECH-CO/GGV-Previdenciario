// Tarefas do perfil que vêm do servidor (GET /api/tarefas, GGVP-8), no formato da linha da Central do Pedro.
import { useEffect, useState } from 'react'
import type { PedidoDoResumoDaTarefa, SugestaoDoResumo, TarefaDaCentral } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import type { Tarefa } from './tipos.ts'

const formatarPrazo = (iso: string | null) => (iso ? `até ${iso.slice(8, 10)}/${iso.slice(5, 7)}` : undefined)

/**
 * Para onde a linha da tarefa leva, na fila e na busca (GGVP-120 CA4, Pedro, 14/10): a tela da tarefa; sem ela, a ficha
 * do cliente; sem cliente, a linha não é link. Nunca a "tela não construída".
 */
export const destinoDaTarefa = (t: Pick<Tarefa, 'href' | 'cliente'>) => t.href ?? (t.cliente ? `/clientes/${t.cliente.id}` : undefined)

export const paraLinha = (t: TarefaDaCentral): Tarefa => ({
  id: t.id,
  codigo: t.passo ?? '',
  cliente: t.cliente,
  contexto: t.contexto ?? undefined,
  acao: t.titulo,
  detalhe: t.detalhe,
  prazo: formatarPrazo(t.prazo),
  urgente: t.urgente,
  href: t.tela ?? undefined,
  processoId: t.casoId ?? undefined,
})

/** `null` enquanto carrega; sem servidor (ou resposta estranha), lista vazia: a tela segue com o que tem. */
export function useTarefasDoServidor(): Tarefa[] | null {
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)
  useEffect(() => {
    chamarApi<TarefaDaCentral[]>('/tarefas')
      .then((r) => setTarefas(r.ok && Array.isArray(r.dados) ? r.dados.map(paraLinha) : []))
      .catch(() => setTarefas([]))
  }, [])
  return tarefas
}

/** Os resumos já pedidos, pela tarefa como a linha mostra: passar de novo não pede de novo. Falha sai para tentar outra vez. */
const resumos = new Map<string, Promise<string | null>>()

/** O resumo da IA para o balão da tarefa (POST /api/tarefas/resumo); nulo quando a IA não resumiu. */
export function resumirTarefa(t: Tarefa): Promise<string | null> {
  const pedido: PedidoDoResumoDaTarefa = {
    acao: t.acao,
    detalhe: t.detalhe,
    prazo: t.prazo,
    urgente: t.urgente,
    contexto: t.cliente ? undefined : t.contexto,
    casoId: t.processoId && /^[0-9a-f-]{36}$/.test(t.processoId) ? t.processoId : undefined,
  }
  const chave = JSON.stringify(pedido)
  let resumo = resumos.get(chave)
  if (!resumo) {
    resumo = chamarApi<SugestaoDoResumo>('/tarefas/resumo', { method: 'POST', corpo: pedido }).then((r) => {
      if (!r.ok) throw new Error(r.erro)
      return r.dados.sugestao?.texto ?? null
    })
    resumos.set(chave, resumo)
    void resumo.catch(() => resumos.delete(chave))
  }
  return resumo
}
