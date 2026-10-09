import { useEffect, useState } from 'react'
import { DESFECHOS_DA_LISTA, FASES_DA_LISTA, ROTULO_DESFECHO_DA_LISTA, ROTULO_FASE_DA_LISTA, type ListaDeProcessos } from '@ggv/contratos'
import { baixarCsv, comTodos, consultarBase, plural, useTermo } from '../dados/bases.ts'
import { mesAno } from '../regras/bases.ts'
import { CampoDaBusca, Etiqueta, Filtro, MolduraDaBase, Paginacao } from './Base.tsx'
import styles from './Bases.module.css'

// Figma: "Processos · Atendimento líder" (1927:888), "· Sênior" (1927:293), "· Advogada" (1931:424), "· Financeiro" (1933:322).
// Todos os processos do servidor, administrativos e judiciais; o número abre o processo, o autor abre a ficha.

const EXITOS: [string, string][] = [['', 'Todos'], ...DESFECHOS_DA_LISTA.map((d): [string, string] => [d, ROTULO_DESFECHO_DA_LISTA[d]])]
const FASES: [string, string][] = [['', 'Todas'], ...FASES_DA_LISTA.map((f): [string, string] => [f, ROTULO_FASE_DA_LISTA[f]])]
const INICIO = { foro: '', juiz: '', perito: '', beneficio: '', exito: '', fase: '', ordem: 'ajuizamento' }

/** `cliente`: vindo da contagem de processos em Clientes, só os daquele cliente. */
export function Processos({ cliente: doCliente }: { cliente?: string }) {
  const [busca, setBusca] = useState('')
  const termo = useTermo(busca)
  const [filtros, setFiltros] = useState(INICIO)
  const [cliente, setCliente] = useState(doCliente ?? '')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaDeProcessos | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let valendo = true
    void consultarBase<ListaDeProcessos>('processos', { ...filtros, cliente, busca: termo, pagina }).then((r) => {
      if (!valendo) return
      if (r.ok) setLista(r.dados)
      setErro(r.ok ? '' : r.erro)
    })
    return () => {
      valendo = false
    }
  }, [filtros, cliente, termo, pagina])

  const mudar = (campo: keyof typeof INICIO) => (valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }
  function limpar() {
    setBusca('')
    setFiltros(INICIO)
    setCliente('')
    setPagina(1)
  }
  async function exportar() {
    const r = await consultarBase<ListaDeProcessos>('processos', { ...filtros, cliente, busca: termo, tudo: '1' })
    if (!r.ok) return setErro(r.erro)
    baixarCsv('processos.csv', [
      ['Processo', 'Fase', 'Autor (cliente)', 'Benefício', 'Tribunal / foro', 'Juiz', 'Perito', 'Desfecho', 'Ajuizado'],
      ...r.dados.processos.map((p) => [p.numero, ROTULO_FASE_DA_LISTA[p.fase], p.autor, p.beneficio, p.foro, p.juiz, p.perito, ROTULO_DESFECHO_DA_LISTA[p.desfecho], p.ajuizadoEm]),
    ])
  }

  return (
    <MolduraDaBase
      ativo="processos"
      titulo="Processos"
      subtitulo="Todos os processos, administrativos e judiciais. Pesquise pelo autor, tribunal, juiz, perito, benefício ou êxito; clique para abrir o processo completo."
    >
      <div className={styles.filtros} role="group" aria-label="Filtros">
        <CampoDaBusca rotulo="Autor, nº do processo ou CPF" valor={busca} aoMudar={setBusca} />
        <Filtro rotulo="Tribunal" valor={filtros.foro} opcoes={comTodos(lista?.opcoes.foros ?? [])} aoMudar={mudar('foro')} />
        <Filtro rotulo="Juiz" valor={filtros.juiz} opcoes={comTodos(lista?.opcoes.juizes ?? [])} aoMudar={mudar('juiz')} />
        <Filtro rotulo="Perito" valor={filtros.perito} opcoes={comTodos(lista?.opcoes.peritos ?? [])} aoMudar={mudar('perito')} />
        <Filtro rotulo="Benefício" valor={filtros.beneficio} opcoes={comTodos(lista?.opcoes.beneficios ?? [])} aoMudar={mudar('beneficio')} />
        <Filtro rotulo="Êxito" valor={filtros.exito} opcoes={EXITOS} aoMudar={mudar('exito')} />
        <Filtro rotulo="Fase" valor={filtros.fase} opcoes={FASES} aoMudar={mudar('fase')} />
        <button type="button" className={styles.limpar} onClick={limpar}>
          Limpar
        </button>
      </div>

      <div className={styles.resumo}>
        <span role="status">
          {lista
            ? `${plural(lista.total, 'processo')} · ${lista.doAcervo.toLocaleString('pt-BR')} lidos no Raio-X · mostrando ${lista.processos.length}${cliente && lista.processos[0] ? ` · só de ${lista.processos[0].autor}` : ''}`
            : 'Carregando…'}
        </span>
        <span className={styles.espaco} />
        <label className={styles.ordem}>
          Ordenar:
          <select value={filtros.ordem} onChange={(e) => mudar('ordem')(e.target.value)}>
            <option value="ajuizamento">ajuizamento</option>
            <option value="autor">autor</option>
          </select>
        </label>
        <button type="button" className={styles.exportar} onClick={() => void exportar()}>
          Exportar CSV
        </button>
      </div>

      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      <div className={styles.moldura}>
        <table className={styles.tabela} aria-label="Processos">
          <thead>
            <tr>
              <th scope="col">Processo</th>
              <th scope="col">Autor (cliente)</th>
              <th scope="col">Benefício</th>
              <th scope="col">Tribunal / foro</th>
              <th scope="col">Juiz</th>
              <th scope="col">Perito</th>
              <th scope="col">Desfecho</th>
              <th scope="col">Ajuizado</th>
            </tr>
          </thead>
          <tbody>
            {lista?.processos.map((p) => (
              <tr key={p.id}>
                <td>
                  <a className={styles.link} href={`/casos/${p.id}`}>
                    {p.numero ?? 'Sem número ainda'}
                  </a>
                  <div className={styles.fase}>{ROTULO_FASE_DA_LISTA[p.fase]}</div>
                </td>
                <td>
                  <a className={styles.autor} href={`/clientes/${p.clienteId}`}>
                    {p.autor}
                  </a>
                </td>
                <td>{p.beneficio ?? '—'}</td>
                <td>{p.foro ?? '—'}</td>
                <td>{p.juiz ?? '—'}</td>
                <td>{p.perito ?? '—'}</td>
                <td>
                  <Etiqueta tipo={p.desfecho}>{ROTULO_DESFECHO_DA_LISTA[p.desfecho]}</Etiqueta>
                </td>
                <td>{p.ajuizadoEm ? mesAno(p.ajuizadoEm) : '—'}</td>
              </tr>
            ))}
            {lista?.processos.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.vazio}>
                  Nenhum processo com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.rodape}>
        <p>Desfecho segue o Raio-X: Êxito (ganho, ganho parcial), Acordo, Perdido no mérito, Extinto sem mérito, Em andamento.</p>
        {lista && <Paginacao pagina={lista.pagina} paginas={lista.paginas} aoMudar={setPagina} />}
      </div>
    </MolduraDaBase>
  )
}
