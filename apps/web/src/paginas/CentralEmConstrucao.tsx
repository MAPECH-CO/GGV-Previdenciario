import { CampoBusca, ID_DA_BUSCA } from '../componentes/CampoBusca.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import { usePerfil } from '../dados/perfis.ts'
import { editaRoteiro } from '../dados/roteiro.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { usePode } from '../sessao.ts'
import centralStyles from './CentralAtendimento.module.css'
import styles from './NaoConstruida.module.css'

/**
 * "Pergunte ou peça" de cada Central (GGVP-78 CA6): Sênior (Figma 59:609) e Financeiro (59:863); o Sócio, sem quadro
 * próprio, com o que o motor do chat responde a quem vê valores.
 */
const CHAT_DO_PERFIL: Record<string, { exemplo: string; sugestoes: string[] }> = {
  senior: { exemplo: 'Ex.: “o que estourou o limite de cobrança esta semana?”', sugestoes: ['O que estourou o limite?', 'Criar tarefa', 'Casos para conferir', 'Subir no acervo'] },
  financeiro: { exemplo: 'Ex.: “o que chegou de prestação de contas hoje?”', sugestoes: ['Prestações recebidas', 'Documento novo', 'Resumo do cliente'] },
  socio: { exemplo: 'Ex.: “o que chegou de prestação de contas hoje?”', sugestoes: ['Prestações recebidas', 'Criar tarefa'] },
}

/**
 * Início dos perfis que ainda não têm a Central desenhada em código (GGVP-78): a fila "O que você tem que fazer"
 * vem do servidor (GGVP-8), com a barra do topo, o "Entrar como…" e o "Sair".
 */
export function CentralEmConstrucao({ rotulo, deExemplo = [] }: { rotulo: string; /** Do servidor de exemplo, até a GGVP-125. */ deExemplo?: Tarefa[] }) {
  const doServidor = useTarefasDoServidor()
  const tarefas = doServidor && [...doServidor, ...deExemplo]
  // GGVP-109 CA9 e GGVP-75: a gestão chega às tentativas bloqueadas e aos resultados pelo topo.
  const gestao = usePode('gestao.ver')
  // GGVP-146, parte 2: a importação da planilha do escritório.
  const importar = usePode('configuracao.editar')
  // GGVP-19: o Jurídico chega aos estudos de caso feitos pela IA pelo topo.
  const estudos = usePode('estudo.ver')
  // GGVP-135 (P13): a Sênior edita os roteiros de laudos; antes, só pelo endereço.
  const perfil = usePerfil()
  const roteiros = editaRoteiro(perfil?.id)
  // GGVP-135 (P11): a busca e o chat, como nas outras Centrais; no estado vazio, o atalho para buscar um cliente (CA4).
  const chat = CHAT_DO_PERFIL[perfil?.id ?? ''] ?? { exemplo: 'Ex.: “qual é a próxima tarefa da Maria Exemplo?”', sugestoes: [] }
  const veCaso = usePode('caso.ver')

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar
        itens={[
          { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
          // GGVP-78: a Agenda depois do Início, como no Figma da Sênior (1927:14) e do Financeiro (1933:29).
          { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
          ...(estudos ? [{ id: 'estudos', glifo: '📚', rotulo: 'Estudos de caso', href: '/estudos' }] : []),
          ...(roteiros ? [{ id: 'roteiros', glifo: '☰', rotulo: 'Roteiros de laudos', href: '/roteiros' }] : []),
          ...(gestao
            ? [
                { id: 'tentativas', glifo: '⛔', rotulo: 'Tentativas bloqueadas', href: '/gestao/tentativas' },
                { id: 'prazos', glifo: '⏱', rotulo: 'Prazos', href: '/gestao/prazos' },
                { id: 'cofre', glifo: '🔒', rotulo: 'Uso do cofre', href: '/gestao/cofre' },
                { id: 'resultados', glifo: '📊', rotulo: 'Resultados', href: '/gestao/resultados' },
                { id: 'configuracao', glifo: '⚙', rotulo: 'Configuração', href: '/configuracao' },
              ]
            : []),
          ...(importar ? [{ id: 'importar', glifo: '⇪', rotulo: 'Importar planilha', href: '/gestao/importar' }] : []),
        ]}
        ativo="inicio"
        funcao={rotulo}
      />
      <main className={centralStyles.pagina}>
        <div className={centralStyles.coluna}>
          <h1 className={styles.titulo}>Central · {rotulo}</h1>
          <CampoBusca tarefas={tarefas ?? []} />
          <ChatDoPortal exemplo={chat.exemplo} sugestoes={chat.sugestoes} funcao={rotulo} />
          <div className={centralStyles.titulo}>
            <h2 className={centralStyles.tituloTexto}>O que você tem que fazer</h2>
            <span className={centralStyles.contagem}>{tarefas?.length ?? '…'}</span>
          </div>
          {tarefas && tarefas.length === 0 && <p className={styles.texto}>Nada na sua fila agora.</p>}
          {tarefas && tarefas.length === 0 && veCaso && (
            <button type="button" className={centralStyles.atalhoDaBusca} onClick={() => document.getElementById(ID_DA_BUSCA)?.focus()}>
              Buscar um cliente
            </button>
          )}
          {tarefas && tarefas.length > 0 && <ListaTarefas tarefas={tarefas} />}
        </div>
      </main>
    </>
  )
}
