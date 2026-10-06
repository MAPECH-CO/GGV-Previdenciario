import { useEffect, useState } from 'react'
import type { TarefaDaCentral } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import type { Tarefa } from '../dados/tipos.ts'
import centralStyles from './CentralAtendimento.module.css'
import styles from './NaoConstruida.module.css'

const formatarPrazo = (iso: string | null) => (iso ? `até ${iso.slice(8, 10)}/${iso.slice(5, 7)}` : undefined)

/** Converte a tarefa da API na linha da Central do Pedro (mesmo visual da Central do Atendimento). */
const paraLinha = (t: TarefaDaCentral): Tarefa => ({
  id: t.id,
  codigo: t.passo ?? '',
  cliente: t.cliente,
  acao: t.titulo,
  detalhe: t.detalhe,
  prazo: formatarPrazo(t.prazo),
  urgente: t.urgente,
  href: t.tela ?? undefined,
})

/**
 * Início dos perfis que ainda não têm a Central desenhada em código (GGVP-78): a fila "O que você tem que fazer"
 * vem do servidor (GGVP-8), com a barra do topo, o "Entrar como…" e o "Sair".
 */
export function CentralEmConstrucao({ rotulo }: { rotulo: string }) {
  const [tarefas, setTarefas] = useState<TarefaDaCentral[] | null>(null)

  useEffect(() => {
    void chamarApi<TarefaDaCentral[]>('/tarefas').then((r) => setTarefas(r.ok ? r.dados : []))
  }, [])

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar itens={[{ id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' }]} ativo="inicio" funcao={rotulo} />
      <main className={centralStyles.pagina}>
        <div className={centralStyles.coluna}>
          <h1 className={styles.titulo}>Central · {rotulo}</h1>
          <div className={centralStyles.titulo}>
            <h2 className={centralStyles.tituloTexto}>O que você tem que fazer</h2>
            <span className={centralStyles.contagem}>{tarefas?.length ?? '…'}</span>
          </div>
          {tarefas && tarefas.length === 0 && <p className={styles.texto}>Nada na sua fila agora.</p>}
          {tarefas && tarefas.length > 0 && <ListaTarefas tarefas={tarefas.map(paraLinha)} />}
        </div>
      </main>
    </>
  )
}
