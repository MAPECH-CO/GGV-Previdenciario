import { Fragment, useEffect, useRef, useState } from 'react'
import type { Tarefa } from '../dados/tipos.ts'
import { useCelular } from '../design/celular.ts'
import { useSessao } from '../sessao.ts'
import { BotoesPreferencias } from './BotoesPreferencias.tsx'
import { BuscaGlobal } from './BuscaGlobal.tsx'
import { Icone } from './Icone.tsx'
import { menuDoPerfil } from './menuDoPerfil.ts'
import { Avatar, BotaoSair, MenuDaPessoa, PerfisDaPessoa } from './MenuDaPessoa.tsx'
import styles from './Topbar.module.css'

export type ItemNavegacao = {
  id: string
  rotulo: string
  href: string
}

type Props = {
  /** Só vale sem sessão (testes, /tokens): com sessão, o topo vem do perfil, igual em toda tela. */
  itens: ItemNavegacao[]
  /** id do item da página atual. */
  ativo: string
  /** Nome da função, para quando não há sessão (testes, /tokens). Com sessão, aparece a pessoa. */
  funcao: string
  acao?: { rotulo: string; href: string }
  /** Telas de passo e de ficha: o "Voltar" (para a tela de onde a pessoa veio) antes dos botões. */
  voltar?: boolean
  /** Telas de passo: de quem é a tela ("Processo 0012… · Maria", "Cliente · Ana"), à direita dos botões. */
  contexto?: string
  /** A fila da tela inicial: a busca do topo acha as tarefas dela também. */
  tarefas?: Tarefa[]
}

/** Quantos itens cabem na barra de baixo do celular, antes do "Menu". */
const NA_BARRA = 4

function IconeDoItem({ id }: { id: string }) {
  return <Icone nome={id} className={styles.icone} />
}

/**
 * O topo de toda tela (refeito em 11/10; menu pelo perfil e busca única em 15/10). No computador: a marca, a busca, a ação
 * da tela, tema e tamanho e a pessoa na primeira linha; na segunda, os botões da função e a Gestão num menu só. No celular:
 * a marca e a pessoa em cima, a busca embaixo delas e uma barra fixa com os quatro primeiros e o "Menu", que abre tudo.
 */
export function Topbar({ itens, ativo, funcao, acao, voltar = false, contexto, tarefas }: Props) {
  const usuario = useSessao()
  const celular = useCelular()
  const [menuAberto, setMenuAberto] = useState(false)
  const { principais, gestao } = usuario ? menuDoPerfil(usuario.perfilAtivo) : { principais: itens, gestao: [] }
  // Um item só de gestão (o Financeiro, com os Resultados) fica solto; mais de um vai para o menu "Gestão".
  const soltos = gestao.length === 1 ? [...principais, ...gestao] : principais
  const doMenuDaGestao = gestao.length > 1 ? gestao : []

  const pessoa = usuario ? (
    celular ? (
      <button type="button" className={styles.pessoaCelular} aria-label={`${usuario.nome}: abrir o menu`} onClick={() => setMenuAberto(true)}>
        <Avatar nome={usuario.nome} />
      </button>
    ) : (
      <MenuDaPessoa usuario={usuario} />
    )
  ) : funcao ? (
    <button type="button" className={styles.semSessao} aria-disabled="true">
      {funcao}
    </button>
  ) : null

  const botaoVoltar = voltar && (
    <button type="button" className={celular ? styles.voltarCelular : styles.voltar} aria-label="Voltar à tela anterior" onClick={() => history.back()}>
      <Icone nome="voltar" />
      {!celular && <span>Voltar</span>}
    </button>
  )

  const busca = (usuario || tarefas) && <BuscaGlobal tarefas={tarefas} />

  return (
    <header className={styles.topo}>
      <div className={styles.linha}>
        {celular && botaoVoltar}
        <a className={styles.marca} href="/" aria-label="GGV Previdenciário, início">
          <span className={styles.logo} aria-hidden="true">
            §
          </span>
          <span className={styles.nome}>GGV Previdenciário</span>
        </a>
        {!celular && busca && <div className={styles.busca}>{busca}</div>}
        <div className={styles.espaco} />
        {acao && (
          <a className={styles.acao} href={acao.href} aria-label={celular ? acao.rotulo : undefined}>
            {celular ? <Icone nome="mais" /> : acao.rotulo}
          </a>
        )}
        {!celular && <BotoesPreferencias />}
        {pessoa}
      </div>

      {celular && busca && <div className={styles.buscaCelular}>{busca}</div>}

      {celular && contexto && <p className={styles.contextoCelular}>{contexto}</p>}

      {!celular && (
        <nav className={styles.nav} aria-label="Principal">
          {botaoVoltar}
          {botaoVoltar && <span className={styles.divisor} aria-hidden="true" />}
          {soltos.map((item) => (
            <a key={item.id} className={styles.item} href={item.href} aria-current={item.id === ativo ? 'page' : undefined}>
              <IconeDoItem id={item.id} />
              {item.rotulo}
            </a>
          ))}
          {doMenuDaGestao.length > 0 && (
            <>
              <span className={styles.divisor} aria-hidden="true" />
              <MenuDaGestao itens={doMenuDaGestao} ativo={ativo} />
            </>
          )}
          {contexto && <p className={styles.contexto}>{contexto}</p>}
        </nav>
      )}

      {celular && (
        <>
          <nav className={styles.barra} aria-label="Principal" data-barra-celular="">
            {principais.slice(0, NA_BARRA).map((item) => (
              <a key={item.id} className={styles.aba} href={item.href} aria-current={item.id === ativo ? 'page' : undefined}>
                <IconeDoItem id={item.id} />
                <span className={styles.abaNome}>{item.rotulo}</span>
              </a>
            ))}
            <button type="button" className={styles.aba} aria-haspopup="dialog" aria-expanded={menuAberto} onClick={() => setMenuAberto(true)}>
              <Icone nome="menu" className={styles.icone} />
              <span className={styles.abaNome}>Menu</span>
            </button>
          </nav>
          {menuAberto && <MenuDoCelular principais={principais} gestao={gestao} ativo={ativo} aoFechar={() => setMenuAberto(false)} />}
        </>
      )}
    </header>
  )
}

/**
 * A Gestão num botão só (no Figma é um item): as telas de quem gere ficam a um clique, sem dividir o topo com o dia a dia.
 * Fecha com Esc, ao clicar fora e ao escolher; o botão fica aceso quando a tela atual é dela.
 */
function MenuDaGestao({ itens, ativo }: { itens: ItemNavegacao[]; ativo: string }) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const atual = itens.find((i) => i.id === ativo)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberto])

  return (
    <div
      className={styles.gestao}
      ref={caixa}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !aberto) return
        setAberto(false)
        botao.current?.focus()
      }}
    >
      <button
        ref={botao}
        type="button"
        className={styles.item}
        aria-expanded={aberto}
        aria-controls="menu-da-gestao"
        data-atual={atual ? '' : undefined}
        onClick={() => setAberto(!aberto)}
      >
        <Icone nome="gestao" className={styles.icone} />
        {atual ? `Gestão · ${atual.rotulo}` : 'Gestão'}
        <Icone nome="abrir" className={styles.abrir} />
      </button>
      {aberto && (
        <ul id="menu-da-gestao" className={styles.menuGestao}>
          {itens.map((item) => (
            <li key={item.id}>
              <a className={styles.menuItem} href={item.href} aria-current={item.id === ativo ? 'page' : undefined}>
                <IconeDoItem id={item.id} />
                {item.rotulo}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** O menu do celular: a pessoa, todos os botões da função, a Gestão, tema e tamanho, a troca de perfil e o "Sair". */
function MenuDoCelular({ principais, gestao, ativo, aoFechar }: { principais: ItemNavegacao[]; gestao: ItemNavegacao[]; ativo: string; aoFechar: () => void }) {
  const usuario = useSessao()
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = janela.current
    if (d && typeof d.showModal === 'function' && !d.open) d.showModal()
  }, [])

  return (
    <dialog ref={janela} className={styles.folha} aria-label="Menu" onClose={aoFechar} onClick={(e) => e.target === e.currentTarget && janela.current?.close()}>
      <div className={styles.folhaCabeca}>
        {usuario && <Avatar nome={usuario.nome} grande />}
        <div className={styles.folhaQuem}>
          {usuario && <p className={styles.menuNome}>{usuario.nome}</p>}
          {usuario && <p className={styles.menuEmail}>{usuario.email}</p>}
        </div>
        <button type="button" className={styles.folhaFechar} aria-label="Fechar o menu" onClick={() => janela.current?.close()}>
          <Icone nome="fechar" />
        </button>
      </div>

      {[
        { titulo: '', lista: principais },
        { titulo: 'Gestão', lista: gestao },
      ].map(
        ({ titulo, lista }) =>
          lista.length > 0 && (
            <Fragment key={titulo || 'principais'}>
              {titulo && <p className={styles.folhaTitulo}>{titulo}</p>}
              <nav className={styles.folhaLista} aria-label={titulo || 'Todas as telas'}>
                {lista.map((item) => (
                  <a key={item.id} className={styles.folhaItem} href={item.href} aria-current={item.id === ativo ? 'page' : undefined}>
                    <IconeDoItem id={item.id} />
                    {item.rotulo}
                  </a>
                ))}
              </nav>
            </Fragment>
          ),
      )}

      <section className={styles.folhaSecao} aria-label="Aparência">
        <BotoesPreferencias empilhado />
      </section>

      {usuario && (
        <section className={styles.folhaSecao} role="menu" aria-label="Entrar como">
          <PerfisDaPessoa usuario={usuario} />
          <BotaoSair className={`${styles.menuItem} ${styles.sair}`} />
        </section>
      )}
    </dialog>
  )
}
