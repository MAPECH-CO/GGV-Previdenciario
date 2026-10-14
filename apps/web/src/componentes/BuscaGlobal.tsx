import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { FiltrosDeClientes, ListaDeClientes, ListaDeProcessos } from '@ggv/contratos'
import { consultarBase } from '../dados/bases.ts'
import { usePode, useSessao } from '../sessao.ts'
import styles from './CampoBusca.module.css'

/** Busca nas duas bases reais, sem ler a cópia ou mandar o termo no endereço. */
export function BuscaGlobal({ local = 'topo' }: { local?: 'topo' | 'central' }) {
  const sessao = useSessao()
  const permitido = usePode('caso.ver')
  if (!permitido) return null
  return <CampoDaBuscaGlobal key={`${sessao?.email}-${sessao?.perfilAtivo}`} local={local} />
}

function CampoDaBuscaGlobal({ local }: { local: 'topo' | 'central' }) {
  const id = useId()
  const pedido = useRef(0)
  const invalidar = useCallback(() => { pedido.current++ }, [])
  // GGVP-162: os processos só para quem abre o processo; o Atendimento e a Documentação acham o cliente.
  const abreProcesso = usePode('processo.abrir')
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<{ clientes: ListaDeClientes; processos: ListaDeProcessos | null; termo: string; pagina: number } | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => invalidar, [invalidar])

  async function buscar(e?: FormEvent, pagina = 1) {
    e?.preventDefault()
    const atual = ++pedido.current
    setResultado(null)
    setErro('')
    const entrada = FiltrosDeClientes.safeParse({ busca: termo, pagina, situacao: 'todos' })
    if (!entrada.success || !entrada.data.busca) {
      setBuscando(false)
      if (!entrada.success) setErro('Use até 100 caracteres na busca.')
      return
    }
    const busca = entrada.data.busca
    setBuscando(true)
    try {
      const [c, p] = await Promise.all([
        consultarBase<unknown>('clientes', { busca, pagina, situacao: 'todos' }),
        abreProcesso ? consultarBase<unknown>('processos', { busca, pagina }) : null,
      ])
      if (atual !== pedido.current) return
      const clientes = c.ok ? ListaDeClientes.safeParse(c.dados) : null
      const processos = p && (p.ok ? ListaDeProcessos.safeParse(p.dados) : null)
      if (!clientes?.success || (p && !processos?.success)) { setErro('A busca está indisponível. Tente novamente.'); return }
      setResultado({ clientes: clientes.data, processos: processos?.success ? processos.data : null, termo: busca, pagina })
    } catch {
      if (atual === pedido.current) setErro('Não foi possível consultar a busca. Tente novamente.')
    } finally {
      if (atual === pedido.current) setBuscando(false)
    }
  }

  const rotulo = local === 'topo' ? 'Buscar cliente, caso ou processo' : 'Buscar cliente, caso ou processo na Central'
  const paginas = resultado ? Math.max(resultado.clientes.paginas, resultado.processos?.paginas ?? 1) : 1
  return <div className={styles.busca}>
    <form className={styles.campo} role="search" aria-label={rotulo} onSubmit={e => void buscar(e)}>
      <span className={styles.lupa} aria-hidden="true">⌕</span>
      <input id={id} className={styles.entrada} type="search" aria-label={rotulo} placeholder={abreProcesso ? 'Cliente, CPF, telefone ou número do processo' : 'Cliente, CPF ou telefone'} maxLength={100} value={termo} onChange={e => {
        pedido.current++
        setTermo(e.target.value)
        setResultado(null)
        setErro('')
        setBuscando(false)
      }} />
      <button className={styles.botao} type="submit" disabled={buscando || !termo.trim()}>Buscar</button>
    </form>
    {buscando && <p className={styles.nota} role="status">Buscando no servidor…</p>}
    {erro && <p className={styles.erro} role="alert">{erro}</p>}
    {resultado && <section className={styles.resultado} aria-label={`Resultado da busca ${local === 'topo' ? 'do topo' : 'da Central'}`}>
      <h2 className={styles.grupo}>Clientes ({resultado.clientes.total})</h2>
      <ul className={styles.lista}>{resultado.clientes.clientes.map(c => <li key={c.id}><a href={`/clientes/${c.id}`}>{c.nome}</a></li>)}</ul>
      {resultado.processos && <>
        <h2 className={styles.grupo}>Casos e processos ({resultado.processos.total})</h2>
        <ul className={styles.lista}>{resultado.processos.processos.map(p => <li key={p.id}><a href={`/casos/${p.id}`}>{p.numero ?? 'Caso sem número'} · {p.autor}</a>{p.beneficio && <span className={styles.detalhe}> · {p.beneficio}</span>}</li>)}</ul>
      </>}
      {!resultado.clientes.total && !resultado.processos?.total && <p className={styles.nota}>Nada encontrado para «{resultado.termo}».</p>}
      {paginas > 1 && <div role="group" aria-label="Páginas da busca">
        <button className={styles.botao} disabled={resultado.pagina <= 1} onClick={() => void buscar(undefined, resultado.pagina - 1)}>Anterior</button>
        <span className={styles.nota}> Página {resultado.pagina} de {paginas} </span>
        <button className={styles.botao} disabled={resultado.pagina >= paginas} onClick={() => void buscar(undefined, resultado.pagina + 1)}>Próxima</button>
      </div>}
    </section>}
  </div>
}
