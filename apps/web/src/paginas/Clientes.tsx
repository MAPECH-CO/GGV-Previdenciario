import { useEffect, useState } from 'react'
import { ROTULO_SITUACAO_DO_CLIENTE, SITUACOES_DO_CLIENTE, type ListaDeClientes } from '@ggv/contratos'
import { baixarCsv, comTodos, consultarBase, plural, useTermo } from '../dados/bases.ts'
import { agora } from '../dados/servidor.ts'
import { haQuanto } from '../regras/bases.ts'
import { hojeIso } from '../regras/datas.ts'
import { CampoDaBusca, Etiqueta, Filtro, MolduraDaBase, Paginacao } from './Base.tsx'
import styles from './Bases.module.css'

// Figma: "Clientes · Atendimento líder" (1927:605), "· Sênior" (1927:14), "· Advogada" (1931:130), "· Financeiro" (1933:29).
// A base de clientes e leads do servidor, com busca, filtros e página; o nome abre a ficha, a contagem abre os processos.

const SITUACOES: [string, string][] = [
  ['ativos', 'Ativos'],
  ['clientes', 'Clientes'],
  ['leads', 'Leads'],
  ['todos', 'Todos'],
]
const EXITOS: [string, string][] = [['', 'Todos'], ...SITUACOES_DO_CLIENTE.map((s): [string, string] => [s, ROTULO_SITUACAO_DO_CLIENTE[s]])]
const INICIO = { beneficio: '', cidade: '', exito: '', situacao: 'ativos', ordem: 'contato' }

export function Clientes() {
  const [busca, setBusca] = useState('')
  const termo = useTermo(busca)
  const [filtros, setFiltros] = useState(INICIO)
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaDeClientes | null>(null)
  const [erro, setErro] = useState('')
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    void consultarBase<ListaDeClientes>('clientes', { ...filtros, busca: termo, pagina }).then((r) => {
      if (!valendo) return
      if (r.ok) setLista(r.dados)
      setErro(r.ok ? '' : r.erro)
    })
    return () => {
      valendo = false
    }
  }, [filtros, termo, pagina])

  // Filtro novo e termo novo voltam à primeira página: a página 3 da busca antiga pode não existir na nova.
  function buscar(valor: string) {
    setBusca(valor)
    setPagina(1)
  }
  const mudar = (campo: keyof typeof INICIO) => (valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }
  function limpar() {
    setBusca('')
    setFiltros(INICIO)
    setPagina(1)
  }
  async function exportar() {
    const r = await consultarBase<ListaDeClientes>('clientes', { ...filtros, busca: termo, tudo: '1' })
    if (!r.ok) return setErro(r.erro)
    baixarCsv('clientes.csv', [
      ['Cliente', 'CPF', 'Benefício', 'Cidade', 'Processos', 'Situação / êxito', 'Último contato'],
      ...r.dados.clientes.map((c) => [c.nome, c.cpf, c.beneficio, c.cidade, c.processos, ROTULO_SITUACAO_DO_CLIENTE[c.situacao], c.ultimoContato]),
    ])
  }

  return (
    <MolduraDaBase
      ativo="clientes"
      titulo="Clientes"
      subtitulo="Base de todos os clientes e leads do escritório. Filtre por nome, benefício, localização ou êxito; clique num cliente para abrir a ficha e os processos."
      novoNaPagina
    >
      <div className={styles.filtros} role="group" aria-label="Filtros">
        <CampoDaBusca rotulo="Buscar por nome, CPF ou telefone" valor={busca} aoMudar={buscar} />
        <Filtro rotulo="Benefício" valor={filtros.beneficio} opcoes={comTodos(lista?.opcoes.beneficios ?? [])} aoMudar={mudar('beneficio')} />
        <Filtro rotulo="Localização" valor={filtros.cidade} opcoes={comTodos(lista?.opcoes.cidades ?? [], 'Todas')} aoMudar={mudar('cidade')} />
        <Filtro rotulo="Êxito" valor={filtros.exito} opcoes={EXITOS} aoMudar={mudar('exito')} />
        <Filtro rotulo="Situação" valor={filtros.situacao} opcoes={SITUACOES} aoMudar={mudar('situacao')} />
        <button type="button" className={styles.limpar} onClick={limpar}>
          Limpar filtros
        </button>
      </div>

      <div className={styles.resumo}>
        <span role="status">{lista ? `${plural(lista.total - lista.leads, 'cliente')} · ${plural(lista.leads, 'lead')} · mostrando ${lista.clientes.length}` : 'Carregando…'}</span>
        <span className={styles.espaco} />
        <label className={styles.ordem}>
          Ordenar:
          <select value={filtros.ordem} onChange={(e) => mudar('ordem')(e.target.value)}>
            <option value="contato">último contato</option>
            <option value="nome">nome</option>
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
        <table className={styles.tabela} aria-label="Clientes">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">CPF</th>
              <th scope="col">Benefício</th>
              <th scope="col">Cidade</th>
              <th scope="col">Processos</th>
              <th scope="col">Situação / êxito</th>
              <th scope="col">Último contato</th>
            </tr>
          </thead>
          <tbody>
            {lista?.clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  <a className={styles.link} href={`/clientes/${c.id}`}>
                    {c.nome}
                  </a>
                </td>
                <td>{c.cpf ?? '—'}</td>
                <td>{c.beneficio ?? '—'}</td>
                <td>{c.cidade ?? '—'}</td>
                <td>
                  {c.processos > 0 ? (
                    <a className={styles.link} href={`/processos?cliente=${c.id}`} aria-label={`${plural(c.processos, 'processo')} de ${c.nome}`}>
                      {c.processos}
                    </a>
                  ) : (
                    0
                  )}
                </td>
                <td>
                  <Etiqueta tipo={c.situacao}>{ROTULO_SITUACAO_DO_CLIENTE[c.situacao]}</Etiqueta>
                </td>
                <td>{c.ultimoContato ? haQuanto(c.ultimoContato, hoje) : '—'}</td>
              </tr>
            ))}
            {lista?.clientes.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.vazio}>
                  Nenhum cliente com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.rodape}>
        <p>Situação: Êxito = ganho, ganho parcial ou acordo já decidido; Perdido = improcedente ou extinto; Administrativo = ainda no INSS.</p>
        {lista && <Paginacao pagina={lista.pagina} paginas={lista.paginas} aoMudar={setPagina} />}
      </div>
    </MolduraDaBase>
  )
}
