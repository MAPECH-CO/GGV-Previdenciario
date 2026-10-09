import { useState } from 'react'
import { Abas } from '../componentes/Abas.tsx'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDaPericia } from '../componentes/ChatDaPericia.tsx'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { exemploChatAdvogada, sugestoesChatAdvogada, totalTarefasSetorAdvogada } from '../dados/advogada.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
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
  const [aba, setAba] = useState('minhas')
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
  const tarefas = [...doServidor, ...daConversa, ...deExemplo]

  return (
    <>
      <title>Início da Advogada · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="inicio" funcao="Advogada" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início da Advogada</h1>
          <CampoBusca tarefas={tarefas} />
          <ChatDaPericia advogada exemplo={exemploChatAdvogada} sugestoes={sugestoesChatAdvogada} />
          <Abas
            rotulo="Filas de tarefas"
            ativa={aba}
            onMudar={setAba}
            abas={[
              { id: 'minhas', rotulo: `Minhas tarefas (${tarefas.length})` },
              { id: 'setor', rotulo: `Tarefas do setor (${totalTarefasSetorAdvogada})` },
            ]}
          />
          <section role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className={styles.painel}>
            {aba === 'minhas' ? (
              <>
                <div className={styles.titulo}>
                  <h2 className={styles.tituloTexto}>O que você tem que fazer</h2>
                  <span className={styles.contagem}>{tarefas.length}</span>
                </div>
                <ListaTarefas tarefas={tarefas} />
              </>
            ) : (
              <p className={styles.emConstrucao}>Tarefas do setor: tela ainda não construída.</p>
            )}
          </section>
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
