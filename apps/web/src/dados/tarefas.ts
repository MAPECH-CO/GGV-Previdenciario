// Tarefas do perfil que vêm do servidor (GET /api/tarefas, GGVP-8), no formato da linha da Central do Pedro.
import { useEffect, useState } from 'react'
import type { TarefaDaCentral } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import type { Tarefa } from './tipos.ts'

const formatarPrazo = (iso: string | null) => (iso ? `até ${iso.slice(8, 10)}/${iso.slice(5, 7)}` : undefined)

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
