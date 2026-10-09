import { useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca, ID_DA_BUSCA } from '../componentes/CampoBusca.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { ITENS_DA_GESTAO } from '../componentes/itensDaGestao.ts'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { usePerfil } from '../dados/perfis.ts'
import { editaRoteiro } from '../dados/roteiro.ts'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { usePode } from '../sessao.ts'
import styles from './CentralAtendimento.module.css'
import naoConstruida from './NaoConstruida.module.css'

// Figma: "Central de trabalho · Sênior" (59:609), com as tarefas do setor da Sênior líder (1600:672). É a tela inicial
// de quem entra como Sênior (App.tsx).
const CHAT = {
  exemplo: 'Ex.: “o que estourou o limite de cobrança esta semana?”',
  sugestoes: ['O que estourou o limite?', 'Criar tarefa', 'Casos para conferir', 'Subir no acervo'],
}

/**
 * A fila da Sênior: as tarefas do servidor (conferências antes do INSS, despachos, exigências vencidas, a vigília, a
 * revisão dos estudos e o acervo) no topo e, até a Recepção gravar tudo no servidor (GGVP-125), as de exemplo que o
 * App passa: a cobrança e a remarcação que passaram do limite (G15), a dispensa do parecer e o complemento a decidir.
 */
export function CentralSenior({ deExemplo = [] }: { deExemplo?: Tarefa[] }) {
  const perfil = usePerfil('Sênior')
  // GGVP-82: e as tarefas que o chat criou para a pessoa.
  const [doChat] = useState(() => tarefasCriadasPeloChat(perfil?.usuario))
  const doServidor = useTarefasDoServidor()
  // GGVP-147: o que o líder deu a outra pessoa sai da fila; o que deu a esta pessoa entra no topo.
  const minhasDoSetor = useMinhasDoSetor()
  const tarefas = doServidor && juntarMinhas([...doServidor, ...deExemplo, ...doChat], minhasDoSetor)
  // Os atalhos de hoje no topo: os estudos de caso (GGVP-19), os roteiros de laudos (GGVP-135, P13), a Gestão (GGVP-109,
  // GGVP-75) e a importação da planilha (GGVP-146).
  const estudos = usePode('estudo.ver')
  const gestao = usePode('gestao.ver')
  const importar = usePode('configuracao.editar')
  const itens: ItemNavegacao[] = [
    { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
    { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
    ...(estudos ? [{ id: 'estudos', glifo: '📚', rotulo: 'Estudos de caso', href: '/estudos' }] : []),
    ...(editaRoteiro(perfil?.id) ? [{ id: 'roteiros', glifo: '☰', rotulo: 'Roteiros de laudos', href: '/roteiros' }] : []),
    ...(gestao ? ITENS_DA_GESTAO : []),
    ...(importar ? [{ id: 'importar', glifo: '⇪', rotulo: 'Importar planilha', href: '/gestao/importar' }] : []),
  ]

  return (
    <>
      <title>Início da Sênior · GGV Previdenciário</title>
      <Topbar itens={itens} ativo="inicio" funcao="Sênior" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início da Sênior</h1>
          <CampoBusca tarefas={tarefas ?? []} />
          <ChatDoPortal exemplo={CHAT.exemplo} sugestoes={CHAT.sugestoes} funcao="Sênior" />
          {tarefas && (
            <FilasDeTarefas
              tarefas={tarefas}
              vazio={
                <>
                  <p className={naoConstruida.texto}>Nada na sua fila agora.</p>
                  {/* GGVP-135 CA4: no estado vazio, o atalho para buscar um cliente. */}
                  <button type="button" className={styles.atalhoDaBusca} onClick={() => document.getElementById(ID_DA_BUSCA)?.focus()}>
                    Buscar um cliente
                  </button>
                </>
              }
            />
          )}
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
