import { useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDaPericia } from '../componentes/ChatDaPericia.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { exemploChatAdvogada, sugestoesChatAdvogada } from '../dados/advogada.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import { tarefasDaAdvogada } from '../dados/preparacao.ts'
import { daSenior, tarefasDoParecer } from '../dados/parecer.ts'
// A perícia que passou do limite de remarcações sobe para a advogada responsável (épico GGVP-10, G15).
import { tarefasDaAdvogadaNaPericia, tarefasDeDecidirDocumentoDaPericia } from '../dados/pericia.ts'
import { useTarefasDaConversa } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import styles from './CentralAtendimento.module.css'

// Figma: "Central de trabalho · Advogada" (59:449). Sem cartão próprio: entra com a GGVP-32, porque a preparação da
// conversa pede "minha fila". É a tela inicial de quem entra como Advogada (App.tsx); também abre por /advogada.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/advogada' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

export function CentralAdvogada() {
  // O laudo novo e o parecer médico nascem do caso (GGVP-20); a aprovação da dispensa é da outra sênior (GGVP-33).
  // A conversa com o cliente é da pessoa que a abriu (GGVP-76).
  const perfil = usePerfil('Advogada')
  const [deExemplo] = useState(() => [
    ...tarefasDaAdvogada(),
    ...tarefasDoParecer().filter((t) => !daSenior(t)),
    ...tarefasDaAdvogadaNaPericia(),
    ...tarefasDeDecidirDocumentoDaPericia(),
    // GGVP-82: e as tarefas que o chat criou para a pessoa.
    ...tarefasCriadasPeloChat(perfil?.usuario),
  ])
  // As tarefas reais do servidor (perícia, vigília, exigência, prestação de contas, GGVP-8) vêm no topo; as de exemplo
  // continuam embaixo até a Recepção e a Abertura gravarem no servidor (GGVP-125).
  const doServidor = useTarefasDoServidor() ?? []
  // A conversa com o cliente e a pendência dela, do servidor, para quem está no login (GGVP-138).
  const daConversa = useTarefasDaConversa() ?? []
  // GGVP-147: o que o líder deu a outra pessoa sai da fila; o que deu a esta pessoa entra no topo.
  const tarefas = juntarMinhas([...doServidor, ...daConversa, ...deExemplo], useMinhasDoSetor())

  return (
    <>
      <title>Início da Advogada · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="inicio" funcao="Advogada" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início da Advogada</h1>
          <CampoBusca tarefas={tarefas} />
          <ChatDaPericia advogada exemplo={exemploChatAdvogada} sugestoes={sugestoesChatAdvogada} />
          <FilasDeTarefas tarefas={tarefas} />
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
