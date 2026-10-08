import { useState, type FormEvent } from 'react'
import { agora, buscarNoBalcao, ler } from '../dados/servidor.ts'
import type { ResultadoBusca, Tarefa } from '../dados/tipos.ts'
import { resultadoDaFicha, semAcento } from '../regras/busca.ts'
import { hojeIso } from '../regras/datas.ts'
import { usePode } from '../sessao.ts'
import styles from './CampoBusca.module.css'

const ROTULO = 'Buscar processo, cliente ou tarefa'
/** O campo da tela inicial: o atalho do estado vazio põe o foco aqui (GGVP-78, CA4). */
export const ID_DA_BUSCA = 'busca-inicial'

type Resultado = { termo: string; clientes: ResultadoBusca[]; tarefas: Tarefa[] }

/** As fichas com um processo cujo número tem os dígitos buscados (CNJ ou requerimento), da cópia das telas. */
function porNumeroDoProcesso(termo: string, jaAchados: Set<string>): ResultadoBusca[] {
  const digitos = termo.replace(/\D/g, '')
  if (/\p{L}/u.test(termo) || digitos.length < 3) return []
  return ler()
    .fichas.filter((f) => !jaAchados.has(f.id) && f.processos.some((p) => (p.numero ?? '').replace(/\D/g, '').includes(digitos)))
    .map((f) => resultadoDaFicha(f, hojeIso(agora())))
}

/** A tarefa bate quando cada pedaço do termo está no nome do cliente (ou no contexto) ou na ação. */
function bateNaTarefa(t: Tarefa, termo: string): boolean {
  const onde = semAcento(`${t.cliente?.nome ?? t.contexto ?? ''} ${t.acao}`)
  return semAcento(termo)
    .split(' ')
    .every((pedaco) => onde.includes(pedaco))
}

/**
 * A busca da tela inicial (GGVP-78, CA9): o resultado respeita o perfil. Quem vê o caso acha clientes (nome, CPF ou
 * telefone, como no balcão) e processos (pelo número); todo perfil acha as tarefas da própria fila.
 */
export function CampoBusca({ tarefas = [] }: { tarefas?: Tarefa[] }) {
  const veCaso = usePode('caso.ver')
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')

  async function buscar(e: FormEvent) {
    e.preventDefault()
    const t = termo.trim()
    setErro('')
    if (!t) return setResultado(null)
    setBuscando(true)
    try {
      const doBalcao = veCaso ? await buscarNoBalcao(t) : []
      const clientes = veCaso ? [...doBalcao, ...porNumeroDoProcesso(t, new Set(doBalcao.map((c) => c.id)))] : []
      setResultado({ termo: t, clientes, tarefas: tarefas.filter((x) => bateNaTarefa(x, t)) })
    } catch {
      setErro('Não deu para buscar agora. Tente de novo.')
    } finally {
      setBuscando(false)
    }
  }

  const nada = resultado && resultado.clientes.length === 0 && resultado.tarefas.length === 0
  return (
    <div className={styles.busca}>
      <form className={styles.campo} role="search" onSubmit={buscar}>
        <span className={styles.lupa} aria-hidden="true">
          ⌕
        </span>
        <input
          id={ID_DA_BUSCA}
          className={styles.entrada}
          type="search"
          placeholder={ROTULO}
          aria-label={ROTULO}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value)
            if (!e.target.value.trim()) setResultado(null)
          }}
        />
      </form>
      {buscando && <p className={styles.nota}>Buscando…</p>}
      {erro && (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
      {resultado && !buscando && (
        <section className={styles.resultado} aria-label="Resultado da busca">
          {nada && <p className={styles.nota}>Nada encontrado para «{resultado.termo}».</p>}
          {resultado.clientes.length > 0 && (
            <>
              <h2 className={styles.grupo}>Clientes ({resultado.clientes.length})</h2>
              <ul className={styles.lista} aria-label="Clientes encontrados">
                {resultado.clientes.map((c) => (
                  <li key={c.id}>
                    <a href={`/clientes/${c.id}`}>{c.nome}</a>
                    {c.etapa && <span className={styles.detalhe}> · {c.etapa}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {resultado.tarefas.length > 0 && (
            <>
              <h2 className={styles.grupo}>Tarefas ({resultado.tarefas.length})</h2>
              <ul className={styles.lista} aria-label="Tarefas encontradas">
                {resultado.tarefas.map((t) => (
                  <li key={t.id}>
                    <a href={t.href ?? `/tarefas/${t.id}`}>
                      {t.cliente?.nome ?? t.contexto} · {t.acao}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!veCaso && <p className={styles.nota}>A busca de clientes e processos é de quem vê o caso: aqui, só as suas tarefas.</p>}
        </section>
      )}
    </div>
  )
}
