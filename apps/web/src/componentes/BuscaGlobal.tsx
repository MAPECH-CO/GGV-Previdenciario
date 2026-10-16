import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  FiltrosDeClientes,
  ListaDeClientes,
  ListaDeProcessos,
  ROTULO_DESFECHO_DA_LISTA,
  ROTULO_FASE_DA_LISTA,
  ROTULO_SITUACAO_DO_CLIENTE,
} from '@ggv/contratos'
import { consultarBase } from '../dados/bases.ts'
import { agora, buscarNoBalcao, ler } from '../dados/servidor.ts'
import { destinoDaTarefa } from '../dados/tarefas.ts'
import type { ResultadoBusca, Tarefa } from '../dados/tipos.ts'
import { resultadoDaFicha, semAcento } from '../regras/busca.ts'
import { hojeIso } from '../regras/datas.ts'
import { usePode, useSessao } from '../sessao.ts'
import styles from './BuscaGlobal.module.css'

/** O campo da busca: o atalho da fila vazia põe o foco aqui (GGVP-78, CA4). */
export const ID_DA_BUSCA = 'busca-inicial'

/** Quantos de cada grupo aparecem; o resto pede uma busca mais exata. */
const POR_GRUPO = 8
const ESPERA_MS = 300

type Linha = { id: string; href: string; titulo: string; detalhe?: string }
type Grupo = { linhas: Linha[]; total: number }
type Resultado = { termo: string; clientes: Grupo; processos: Grupo; tarefas: Grupo }

const INDISPONIVEL = 'A busca está indisponível agora. Tente de novo em instantes.'

/** As fichas com um processo cujo número tem os dígitos buscados (CNJ ou requerimento), da cópia das telas. */
function porNumeroDoProcesso(termo: string): ResultadoBusca[] {
  const digitos = termo.replace(/\D/g, '')
  if (/\p{L}/u.test(termo) || digitos.length < 3) return []
  return ler()
    .fichas.filter((f) => f.processos.some((p) => (p.numero ?? '').replace(/\D/g, '').includes(digitos)))
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
 * A busca única do topo (antes eram duas na tela inicial, com resultados diferentes). Acha, conforme o perfil: clientes e
 * leads (a base do servidor e a ficha do balcão, sem repetir), processos (para quem abre o processo) e, na tela inicial,
 * as tarefas da fila. Mostra enquanto a pessoa digita, numa lista por cima da tela, sem empurrar o resto.
 */
export function BuscaGlobal({ tarefas }: { tarefas?: Tarefa[] }) {
  const sessao = useSessao()
  const veCaso = usePode('caso.ver')
  const abreProcesso = usePode('processo.abrir')
  if (!veCaso && !tarefas) return null
  // Trocar o perfil ativo zera o campo: o resultado de um perfil não fica na tela do outro.
  return <CampoDaBusca key={`${sessao?.email}-${sessao?.perfilAtivo}`} tarefas={tarefas} veCaso={veCaso} abreProcesso={abreProcesso} />
}

function CampoDaBusca({ tarefas, veCaso, abreProcesso }: { tarefas?: Tarefa[]; veCaso: boolean; abreProcesso: boolean }) {
  const idLista = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const pedido = useRef(0)
  // Busca enquanto a pessoa digita, depois de uma pausa curta; o Enter não espera.
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [termo, setTermo] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(false)

  const oQue = veCaso ? (abreProcesso ? 'processo, cliente' : 'cliente') : ''
  const rotulo = tarefas ? `Buscar ${oQue ? `${oQue} ou tarefa` : 'nas suas tarefas'}` : `Buscar ${abreProcesso ? 'processo ou cliente' : 'cliente'}`
  const dica = veCaso ? `Nome, CPF, telefone${abreProcesso ? ' ou nº do processo' : ''}` : 'Nome do cliente ou a tarefa'

  async function buscar(texto: string) {
    const atual = ++pedido.current
    const t = texto.trim()
    const filtro = FiltrosDeClientes.safeParse({ busca: t, pagina: 1, situacao: 'todos' })
    if (!filtro.success || !filtro.data.busca) {
      setResultado(null)
      setBuscando(false)
      setErro(filtro.success ? '' : 'Use até 100 caracteres na busca.')
      return
    }
    setBuscando(true)
    setErro('')
    setAberto(true)
    try {
      const [doBalcao, daBase, deProcessos] = await Promise.all([
        // Cada fonte falha sozinha: uma fora do ar não esconde o que as outras acharam.
        veCaso ? buscarNoBalcao(t).catch(() => []) : [],
        veCaso ? consultarBase<unknown>('clientes', { busca: t, pagina: 1, situacao: 'todos' }).catch(() => null) : null,
        abreProcesso ? consultarBase<unknown>('processos', { busca: t, pagina: 1 }).catch(() => null) : null,
      ])
      if (atual !== pedido.current) return
      const clientes = new Map<string, Linha>()
      for (const c of [...doBalcao, ...(veCaso ? porNumeroDoProcesso(t) : [])])
        clientes.set(c.id, { id: c.id, href: `/clientes/${c.id}`, titulo: c.nome, detalhe: c.etapa })
      const base = daBase?.ok ? ListaDeClientes.safeParse(daBase.dados) : null
      for (const c of base?.success ? base.data.clientes : [])
        if (!clientes.has(c.id))
          clientes.set(c.id, { id: c.id, href: `/clientes/${c.id}`, titulo: c.nome, detalhe: [ROTULO_SITUACAO_DO_CLIENTE[c.situacao], c.beneficio].filter(Boolean).join(' · ') })
      const lista = deProcessos?.ok ? ListaDeProcessos.safeParse(deProcessos.dados) : null
      const processos = (lista?.success ? lista.data.processos : []).map((p) => ({
        id: p.id,
        href: `/casos/${p.id}`,
        titulo: `${p.autor} · ${p.numero ?? 'sem número ainda'}`,
        detalhe: [p.beneficio, ROTULO_FASE_DA_LISTA[p.fase], p.desfecho !== 'em_andamento' && ROTULO_DESFECHO_DA_LISTA[p.desfecho]].filter(Boolean).join(' · '),
      }))
      const daFila = (tarefas ?? []).filter((x) => bateNaTarefa(x, t)).map((x) => ({
        id: x.id,
        href: destinoDaTarefa(x) ?? '',
        titulo: `${x.cliente?.nome ?? x.contexto ?? ''} · ${x.acao}`,
        detalhe: x.prazo,
      }))
      const semBase = veCaso && (!base?.success || (abreProcesso && !lista?.success))
      if (semBase && !clientes.size && !processos.length && !daFila.length) {
        setErro(INDISPONIVEL)
        setResultado(null)
        return
      }
      setResultado({
        termo: t,
        clientes: { linhas: [...clientes.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')), total: Math.max(clientes.size, base?.success ? base.data.total : 0) },
        processos: { linhas: processos, total: lista?.success ? lista.data.total : processos.length },
        tarefas: { linhas: daFila, total: daFila.length },
      })
    } catch {
      if (atual === pedido.current) setErro(INDISPONIVEL)
    } finally {
      if (atual === pedido.current) setBuscando(false)
    }
  }

  useEffect(() => () => clearTimeout(espera.current), [])

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false)
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberto])

  function enviar(e: FormEvent) {
    e.preventDefault()
    clearTimeout(espera.current)
    void buscar(termo)
  }

  // Esc fecha e volta ao campo; as setas andam pelos resultados.
  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && aberto) {
      e.preventDefault()
      setAberto(false)
      entrada.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const links = [...(caixa.current?.querySelectorAll<HTMLAnchorElement>(`#${CSS.escape(idLista)} a`) ?? [])]
    if (!links.length) return
    e.preventDefault()
    const atual = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (atual < 0) return links[e.key === 'ArrowDown' ? 0 : links.length - 1].focus()
    const proximo = atual + (e.key === 'ArrowDown' ? 1 : -1)
    if (proximo < 0) entrada.current?.focus()
    else links[Math.min(proximo, links.length - 1)].focus()
  }

  const mostrar = aberto && (buscando || erro || resultado)
  const nada = resultado && !resultado.clientes.total && !resultado.processos.total && !resultado.tarefas.total
  return (
    <div className={styles.busca} ref={caixa} onKeyDown={teclas}>
      <form className={styles.campo} role="search" onSubmit={enviar}>
        <span className={styles.lupa} aria-hidden="true">
          ⌕
        </span>
        <input
          ref={entrada}
          id={ID_DA_BUSCA}
          className={styles.entrada}
          type="search"
          aria-label={rotulo}
          aria-controls={idLista}
          aria-expanded={Boolean(mostrar)}
          placeholder={dica}
          maxLength={100}
          autoComplete="off"
          value={termo}
          onClick={() => resultado && setAberto(true)}
          onChange={(e) => {
            const valor = e.target.value
            pedido.current++
            clearTimeout(espera.current)
            setTermo(valor)
            setBuscando(false)
            setErro('')
            if (valor.trim().length < 2) {
              setResultado(null)
              setAberto(false)
            } else espera.current = setTimeout(() => void buscar(valor), ESPERA_MS)
          }}
        />
        {termo && (
          <button
            type="button"
            className={styles.limpar}
            aria-label="Limpar a busca"
            onClick={() => {
              pedido.current++
              clearTimeout(espera.current)
              setTermo('')
              setResultado(null)
              setAberto(false)
              entrada.current?.focus()
            }}
          >
            ×
          </button>
        )}
      </form>
      <section id={idLista} className={styles.resultado} aria-label="Resultado da busca" hidden={!mostrar}>
        {buscando && !resultado && (
          <p className={styles.nota} role="status">
            Buscando…
          </p>
        )}
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        {resultado && (
          <>
            <ListaDoGrupo titulo="Clientes" grupo={resultado.clientes} rotulo="Clientes encontrados" />
            <ListaDoGrupo titulo="Processos" grupo={resultado.processos} rotulo="Processos encontrados" />
            <ListaDoGrupo titulo="Tarefas" grupo={resultado.tarefas} rotulo="Tarefas encontradas" />
            {nada && !erro && (
              <p className={styles.nota}>
                Nada encontrado para «{resultado.termo}». Confira a grafia do nome, o CPF ou o telefone com DDD.
              </p>
            )}
            {!veCaso && <p className={styles.nota}>Aqui você busca nas suas tarefas; clientes e processos são de quem acompanha os casos.</p>}
          </>
        )}
      </section>
    </div>
  )
}

function ListaDoGrupo({ titulo, grupo: { linhas, total }, rotulo }: { titulo: string; grupo: Grupo; rotulo: string }) {
  const idDoGrupo = useId()
  if (!linhas.length) return null
  return (
    <>
      <h2 className={styles.grupo}>
        {titulo} <span className={styles.contagem}>{total}</span>
      </h2>
      <ul className={styles.lista} aria-label={rotulo}>
        {linhas.slice(0, POR_GRUPO).map((l) => {
          // O nome do link é o título; o detalhe vai como descrição (o leitor de tela lê os dois, separados).
          const idDetalhe = `${idDoGrupo}-${l.id}`
          const detalhe = l.detalhe && (
            <span id={idDetalhe} className={styles.detalhe}>
              {l.detalhe}
            </span>
          )
          return (
            <li key={l.id}>
              {l.href ? (
                <a className={styles.item} href={l.href} aria-label={l.titulo} aria-describedby={l.detalhe ? idDetalhe : undefined}>
                  <span className={styles.titulo}>{l.titulo}</span>
                  {detalhe}
                </a>
              ) : (
                <span className={styles.item}>
                  <span className={styles.titulo}>{l.titulo}</span>
                  {detalhe}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {total > POR_GRUPO && <p className={styles.nota}>E mais {total - POR_GRUPO}. Escreva mais do nome, ou o CPF, para achar.</p>}
    </>
  )
}
