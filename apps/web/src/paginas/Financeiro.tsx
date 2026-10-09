import { useEffect, useState } from 'react'
import { formatarDecimal, isoParaData } from '@ggv/campos'
import {
  ROTULO_ORIGEM_DA_RECEITA,
  ROTULO_STATUS_DO_LANCAMENTO,
  STATUS_DO_LANCAMENTO,
  mesAntes,
  type LancamentoFinanceiro,
  type PainelFinanceiro,
  type StatusDoLancamento,
} from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { baixarCsv, comTodos, plural } from '../dados/bases.ts'
import { usePerfil } from '../dados/perfis.ts'
import { agora } from '../dados/servidor.ts'
import { hojeIso } from '../regras/datas.ts'
import { usePode } from '../sessao.ts'
import { CampoDaBusca, Etiqueta, Filtro, MolduraDaBase } from './Base.tsx'
import bases from './Bases.module.css'
import styles from './Financeiro.module.css'

// Figma: "Financeiro · painel" (1930:4). Os números vêm do servidor, calculados das prestações de contas gravadas
// (GET /api/financeiro); a tela só desenha. O que o banco não guarda (mensalidades, RPV, precatório, honorários previstos
// da safra, o "+ Lançamento" avulso) não aparece. O Sócio vê os totais; as linhas de cada cliente, só quem vê valores.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeDoMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1]
/** "2026-09" → "set/2026". */
const rotuloDoMes = (mes: string) => `${nomeDoMes(mes).slice(0, 3)}/${mes.slice(0, 4)}`
const reais = (valor: string) => `R$ ${formatarDecimal(Number(valor))}`
const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** A cor da etiqueta, nas classes das bases: âmbar espera, vermelho atraso, azul a receber, verde recebido. */
const ETIQUETA: Record<StatusDoLancamento, string> = { aguardando_ok: 'administrativo', atrasado: 'perdido', a_receber: 'em_andamento', recebido: 'exito' }
const TIPOS: [string, string][] = [
  ['', 'Todos'],
  ['inss', 'INSS'],
  ['justica', 'Justiça'],
]
const STATUS: [string, string][] = [['', 'Todos'], ...STATUS_DO_LANCAMENTO.map((s): [string, string] => [s, ROTULO_STATUS_DO_LANCAMENTO[s]])]
const SEM_FILTRO = { origem: '', status: '', responsavel: '', mes: '' }
const quando = (l: LancamentoFinanceiro) => (l.recebidoEm ? `recebido ${isoParaData(l.recebidoEm)?.slice(0, 5)}` : (isoParaData(l.vencimento) ?? '—'))

export function Financeiro() {
  const perfil = usePerfil()
  const atual = hojeIso(agora()).slice(0, 7)
  const [mes, setMes] = useState(atual)
  const [painel, setPainel] = useState<PainelFinanceiro | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let valendo = true
    void chamarApi<PainelFinanceiro>(`/financeiro?mes=${mes}`).then((r) => {
      if (!valendo) return
      if (r.ok) setPainel(r.dados)
      setErro(r.ok ? '' : r.erro)
    })
    return () => {
      valendo = false
    }
  }, [mes])

  const anterior = mesAntes(mes)
  const variacao = painel?.variacao ?? null

  return (
    <MolduraDaBase
      ativo="financeiro"
      titulo="Financeiro"
      subtitulo="Prestações de contas recebidas, honorários a receber e lançamentos. O aviso ao cliente só sai depois do OK da advogada (G8); o Financeiro não vê entrevista, petição nem laudos."
      acoes={
        <label className={bases.filtro}>
          Período:
          <select aria-label="Período" value={mes} onChange={(e) => setMes(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => mesAntes(atual, i)).map((m) => (
              <option key={m} value={m}>
                {rotuloDoMes(m)}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <ChatDoPortal
        exemplo="Ex.: “quais prestações estão esperando o OK da advogada?”"
        sugestoes={['Prestações aguardando OK', 'Recebido no mês', 'Lançar prestação']}
        funcao={perfil?.rotulo ?? 'Financeiro'}
      />

      {erro && (
        <p className={bases.erro} role="alert">
          {erro}
        </p>
      )}

      {painel && (
        <>
          <ul className={styles.cartoes} aria-label="Indicadores do mês">
            <Indicador
              rotulo="Recebido no mês"
              valor={reais(painel.recebidoNoMes)}
              nota={variacao === null ? `sem recebimento em ${nomeDoMes(anterior)}` : `${variacao >= 0 ? '▲' : '▼'} ${Math.abs(variacao)}% sobre ${nomeDoMes(anterior)}`}
              tom={variacao === null ? undefined : variacao >= 0 ? 'ok' : 'erro'}
            />
            <Indicador rotulo="A receber" valor={reais(painel.aReceber)} nota={`${plural(painel.processosAReceber, 'processo')} esperando o recebimento`} />
            <Indicador
              rotulo="Prestações de contas a lançar"
              valor={String(painel.aLancar)}
              nota={`${painel.aguardandoOk} aguardando o OK da advogada (G8)`}
              tom={painel.aguardandoOk ? 'alerta' : undefined}
            />
            <Indicador
              rotulo="Em atraso"
              valor={reais(painel.emAtraso)}
              nota={`${plural(painel.processosEmAtraso, 'processo')} com o prazo de pagamento vencido`}
              tom={painel.processosEmAtraso ? 'erro' : undefined}
            />
          </ul>

          <div className={styles.grade}>
            <ReceitaPorMes porMes={painel.porMes} ano={mes.slice(0, 4)} />
            <PorOrigem porOrigem={painel.porOrigem} />
            {painel.lancamentos && <Pendentes lancamentos={painel.lancamentos.filter((l) => l.status !== 'recebido')} />}
          </div>

          {painel.lancamentos ? (
            <Lancamentos lancamentos={painel.lancamentos} />
          ) : (
            <p className={bases.rodape}>Os lançamentos de cada cliente ficam com o Financeiro; aqui, os totais do escritório.</p>
          )}
        </>
      )}
    </MolduraDaBase>
  )
}

function Indicador({ rotulo, valor, nota, tom }: { rotulo: string; valor: string; nota: string; tom?: 'ok' | 'erro' | 'alerta' }) {
  return (
    <li className={styles.indicador}>
      <span className={styles.indicadorRotulo}>{rotulo}</span>
      <strong className={styles.indicadorValor}>{valor}</strong>
      <span className={`${styles.nota} ${tom ? styles[tom] : ''}`}>{nota}</span>
    </li>
  )
}

function ReceitaPorMes({ porMes, ano }: { porMes: PainelFinanceiro['porMes']; ano: string }) {
  const teto = Math.max(...porMes.flatMap((m) => [Number(m.recebido), Number(m.previsto)]), 0)
  const altura = (v: string) => `${teto ? (Number(v) / teto) * 100 : 0}%`
  return (
    <section className={styles.cartao} aria-label={`Receita por mês · ${ano}`}>
      <h2 className={styles.cartaoTitulo}>Receita por mês · {ano}</h2>
      <p className={styles.cartaoSub}>Honorários recebidos contra o previsto pelo prazo de pagamento das prestações de contas.</p>
      {teto === 0 ? (
        <p className={styles.vazio}>Nenhum honorário recebido ou previsto no ano.</p>
      ) : (
        <>
          <p className={styles.legenda} aria-hidden="true">
            <span className={styles.pontoRecebido} /> Recebido <span className={styles.pontoPrevisto} /> Previsto
          </p>
          <div className={styles.grafico}>
            <span className={styles.eixo} aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map((f) => (
                <span key={f}>{compacto.format(teto * f)}</span>
              ))}
            </span>
            <ul className={styles.barras} aria-label="Recebido e previsto por mês">
              {porMes.map((m) => (
                <li key={m.mes} aria-label={`${nomeDoMes(m.mes)}: recebido ${reais(m.recebido)}; previsto ${reais(m.previsto)}`}>
                  <span className={styles.par} aria-hidden="true">
                    <span className={styles.recebido} style={{ height: altura(m.recebido) }} />
                    <span className={styles.previsto} style={{ height: altura(m.previsto) }} />
                  </span>
                  <span className={styles.mesDoGrafico} aria-hidden="true">
                    {nomeDoMes(m.mes).slice(0, 3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}

function PorOrigem({ porOrigem }: { porOrigem: PainelFinanceiro['porOrigem'] }) {
  return (
    <section className={styles.cartao} aria-label="Por origem · últimos 12 meses">
      <h2 className={styles.cartaoTitulo}>Por origem · últimos 12 meses</h2>
      <p className={styles.cartaoSub}>Fatia dos honorários recebidos, pela origem do caso.</p>
      {porOrigem.length === 0 ? (
        <p className={styles.vazio}>Nenhum honorário recebido nos últimos 12 meses.</p>
      ) : (
        <ul className={styles.origens} aria-label="Receita por origem">
          {porOrigem.map((o) => (
            <li key={o.origem}>
              <span>{ROTULO_ORIGEM_DA_RECEITA[o.origem]}</span>
              <span className={styles.trilho} aria-hidden="true">
                <span className={styles.fatia} style={{ width: `${o.fatia}%` }} />
              </span>
              <strong>{o.fatia}%</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** As que esperam o OK da advogada (G8) ou o lançamento do Financeiro; "Lançar" abre o recebimento (GGVP-44 CA9). */
function Pendentes({ lancamentos }: { lancamentos: LancamentoFinanceiro[] }) {
  const podeLancar = usePode('prestacao.registrar_recebimento')
  return (
    <section className={styles.cartao} aria-label="Prestações de contas pendentes">
      <h2 className={styles.cartaoTitulo}>Prestações de contas pendentes</h2>
      <p className={styles.cartaoSub}>Esperando o OK da advogada (G8) ou o lançamento do Financeiro.</p>
      {lancamentos.length === 0 ? (
        <p className={styles.vazio}>Nenhuma prestação pendente.</p>
      ) : (
        <ul className={styles.pendentes} aria-label="Pendentes">
          {lancamentos.map((l) => (
            <li key={l.casoId}>
              <span>
                {l.cliente}
                {l.beneficio && ` · ${l.beneficio}`}
              </span>
              <strong>{l.valor ? reais(l.valor) : '—'}</strong>
              {l.status === 'aguardando_ok' ? (
                <span className={styles.seloEspera}>Aguardando OK</span>
              ) : podeLancar ? (
                <a className={styles.seloLancar} href={`/casos/${l.casoId}/prestacao/recebimento`} aria-label={`Lançar a prestação de ${l.cliente}`}>
                  Lançar
                </a>
              ) : (
                <span className={styles.seloLancar}>Lançar</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Lancamentos({ lancamentos }: { lancamentos: LancamentoFinanceiro[] }) {
  const [busca, setBusca] = useState('')
  const [filtros, setFiltros] = useState(SEM_FILTRO)
  // O nome abre a prestação de contas do caso, para quem a vê (o Financeiro não abre a ficha do cliente).
  const vePrestacao = usePode('prestacao.ver')
  const mudar = (campo: keyof typeof SEM_FILTRO) => (valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }))
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const digitos = termo.replace(/\D/g, '')
  const mesDe = (l: LancamentoFinanceiro) => (l.recebidoEm ?? l.vencimento)?.slice(0, 7)
  const linhas = lancamentos.filter(
    (l) =>
      (!termo || l.cliente.toLocaleLowerCase('pt-BR').includes(termo) || (digitos.length >= 3 && (l.processo ?? '').replace(/\D/g, '').includes(digitos))) &&
      (!filtros.origem || l.origem === filtros.origem) &&
      (!filtros.status || l.status === filtros.status) &&
      (!filtros.responsavel || l.responsavel === filtros.responsavel) &&
      (!filtros.mes || mesDe(l) === filtros.mes),
  )
  const meses = [...new Set(lancamentos.map(mesDe).filter((m): m is string => !!m))].sort().reverse()

  function exportar() {
    baixarCsv('lancamentos.csv', [
      ['Cliente', 'Processo', 'Tipo', 'Valor', 'Vencimento / recebido', 'Status', 'Responsável'],
      ...linhas.map((l) => [l.cliente, l.processo, ROTULO_ORIGEM_DA_RECEITA[l.origem], l.valor ? reais(l.valor) : null, quando(l), ROTULO_STATUS_DO_LANCAMENTO[l.status], l.responsavel]),
    ])
  }

  return (
    <>
      <div className={bases.filtros} role="group" aria-label="Filtros">
        <CampoDaBusca rotulo="Cliente ou nº do processo" valor={busca} aoMudar={setBusca} />
        <Filtro rotulo="Tipo" valor={filtros.origem} opcoes={TIPOS} aoMudar={mudar('origem')} />
        <Filtro rotulo="Status" valor={filtros.status} opcoes={STATUS} aoMudar={mudar('status')} />
        <Filtro rotulo="Responsável" valor={filtros.responsavel} opcoes={comTodos([...new Set(lancamentos.map((l) => l.responsavel))].sort())} aoMudar={mudar('responsavel')} />
        <Filtro rotulo="Vencimento" valor={filtros.mes} opcoes={[['', 'Todos'], ...meses.map((m): [string, string] => [m, rotuloDoMes(m)])]} aoMudar={mudar('mes')} />
        <button
          type="button"
          className={bases.limpar}
          onClick={() => {
            setBusca('')
            setFiltros(SEM_FILTRO)
          }}
        >
          Limpar
        </button>
        <span className={styles.espaco} />
        <button type="button" className={bases.exportar} onClick={exportar}>
          Exportar CSV
        </button>
      </div>

      <div className={bases.moldura}>
        <table className={bases.tabela} aria-label="Lançamentos">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Processo</th>
              <th scope="col">Tipo</th>
              <th scope="col">Valor</th>
              <th scope="col">Vencimento / recebido</th>
              <th scope="col">Status</th>
              <th scope="col">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.casoId}>
                <td>
                  {vePrestacao ? (
                    <a className={bases.link} href={`/casos/${l.casoId}/prestacao`}>
                      {l.cliente}
                    </a>
                  ) : (
                    l.cliente
                  )}
                </td>
                <td>{l.processo ?? '—'}</td>
                <td>{ROTULO_ORIGEM_DA_RECEITA[l.origem]}</td>
                <td>{l.valor ? reais(l.valor) : '—'}</td>
                <td>{quando(l)}</td>
                <td>
                  <Etiqueta tipo={ETIQUETA[l.status]}>{ROTULO_STATUS_DO_LANCAMENTO[l.status]}</Etiqueta>
                </td>
                <td>{l.responsavel}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className={bases.vazio}>
                  Nenhum lançamento com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className={bases.rodape}>
        Aguardando OK = a advogada ainda não validou a prestação; o aviso ao cliente espera (G8). A receber = o OK saiu e o Financeiro ainda não lançou o
        recebimento. Atrasado = a receber com o prazo de pagamento vencido.
      </p>
    </>
  )
}
