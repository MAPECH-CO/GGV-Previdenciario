import { Fragment, useEffect, useRef, useState } from 'react'
import { useCelular } from '../design/celular.ts'
import { useSessao } from '../sessao.ts'
import { BotoesPreferencias } from './BotoesPreferencias.tsx'
import { Icone } from './Icone.tsx'
import { ITENS_DA_GESTAO, itensDoPerfil } from './itensDaGestao.ts'
import { Avatar, BotaoSair, MenuDaPessoa, PerfisDaPessoa } from './MenuDaPessoa.tsx'
import styles from './Topbar.module.css'
import { BuscaGlobal } from './BuscaGlobal.tsx'

export type ItemNavegacao = {
  id: string
  rotulo: string
  href: string
}

type Props = {
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
}

const DA_GESTAO = new Set(ITENS_DA_GESTAO.map((i) => i.id))
/** Quantos itens cabem na barra de baixo do celular, antes do "Menu". */
const NA_BARRA = 4

function IconeDoItem({ id }: { id: string }) {
  return <Icone nome={id} className={styles.icone} />
}

/**
 * O topo de toda tela (refeito em 11/10). No computador: a marca, a ação da tela, tema e tamanho e a pessoa na primeira
 * linha; na segunda, os botões da função, cada um com o seu ícone, com a Gestão separada por um traço. No celular: a
 * marca e a pessoa em cima e, embaixo, uma barra fixa com os quatro primeiros e o "Menu", que abre tudo.
 */
export function Topbar({ itens, ativo, funcao, acao, voltar = false, contexto }: Props) {
  const usuario = useSessao()
  const celular = useCelular()
  const [menuAberto, setMenuAberto] = useState(false)
  const lista = itensDoPerfil(itens, usuario?.perfilAtivo)
  const primeiroDaGestao = lista.find((i) => DA_GESTAO.has(i.id))?.id

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
        <div className={styles.espaco} />
        {acao && (
          <a className={styles.acao} href={acao.href} aria-label={celular ? acao.rotulo : undefined}>
            {celular ? <Icone nome="mais" /> : acao.rotulo}
          </a>
        )}
        {!celular && <BotoesPreferencias />}
        {pessoa}
      </div>

      {usuario && <div className={styles.busca}><BuscaGlobal /></div>}

      {celular && contexto && <p className={styles.contextoCelular}>{contexto}</p>}

      {!celular && (
        <nav className={styles.nav} aria-label="Principal">
          {botaoVoltar}
          {botaoVoltar && <span className={styles.divisor} aria-hidden="true" />}
          {lista.map((item) => (
            <Fragment key={item.id}>
              {item.id === primeiroDaGestao && <span className={styles.divisor} aria-hidden="true" />}
              <a className={styles.item} href={item.href} aria-current={item.id === ativo ? 'page' : undefined}>
                <IconeDoItem id={item.id} />
                {item.rotulo}
              </a>
            </Fragment>
          ))}
          {contexto && <p className={styles.contexto}>{contexto}</p>}
        </nav>
      )}

      {celular && (
        <>
          <nav className={styles.barra} aria-label="Principal" data-barra-celular="">
            {lista.slice(0, NA_BARRA).map((item) => (
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
          {menuAberto && <MenuDoCelular itens={lista} ativo={ativo} aoFechar={() => setMenuAberto(false)} />}
        </>
      )}
    </header>
  )
}

/** O menu do celular: a pessoa, todos os botões da função, tema e tamanho, a troca de perfil e o "Sair". */
function MenuDoCelular({ itens, ativo, aoFechar }: { itens: ItemNavegacao[]; ativo: string; aoFechar: () => void }) {
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

      <nav className={styles.folhaLista} aria-label="Todas as telas">
        {itens.map((item) => (
          <a key={item.id} className={styles.folhaItem} href={item.href} aria-current={item.id === ativo ? 'page' : undefined}>
            <IconeDoItem id={item.id} />
            {item.rotulo}
          </a>
        ))}
      </nav>

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
