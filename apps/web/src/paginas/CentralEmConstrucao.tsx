import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { usePode } from '../sessao.ts'
import centralStyles from './CentralAtendimento.module.css'
import styles from './NaoConstruida.module.css'

/**
 * Início dos perfis que ainda não têm a Central desenhada em código (GGVP-78): a fila "O que você tem que fazer"
 * vem do servidor (GGVP-8), com a barra do topo, o "Entrar como…" e o "Sair".
 */
export function CentralEmConstrucao({ rotulo }: { rotulo: string }) {
  const tarefas = useTarefasDoServidor()
  // GGVP-109 CA9 e GGVP-75: a gestão chega às tentativas bloqueadas e aos resultados pelo topo.
  const gestao = usePode('gestao.ver')

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar
        itens={[
          { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
          ...(gestao
            ? [
                { id: 'tentativas', glifo: '⛔', rotulo: 'Tentativas bloqueadas', href: '/gestao/tentativas' },
                { id: 'prazos', glifo: '⏱', rotulo: 'Prazos', href: '/gestao/prazos' },
                { id: 'cofre', glifo: '🔒', rotulo: 'Uso do cofre', href: '/gestao/cofre' },
                { id: 'resultados', glifo: '📊', rotulo: 'Resultados', href: '/gestao/resultados' },
                { id: 'configuracao', glifo: '⚙', rotulo: 'Configuração', href: '/configuracao' },
              ]
            : []),
        ]}
        ativo="inicio"
        funcao={rotulo}
      />
      <main className={centralStyles.pagina}>
        <div className={centralStyles.coluna}>
          <h1 className={styles.titulo}>Central · {rotulo}</h1>
          <div className={centralStyles.titulo}>
            <h2 className={centralStyles.tituloTexto}>O que você tem que fazer</h2>
            <span className={centralStyles.contagem}>{tarefas?.length ?? '…'}</span>
          </div>
          {tarefas && tarefas.length === 0 && <p className={styles.texto}>Nada na sua fila agora.</p>}
          {tarefas && tarefas.length > 0 && <ListaTarefas tarefas={tarefas} />}
        </div>
      </main>
    </>
  )
}
