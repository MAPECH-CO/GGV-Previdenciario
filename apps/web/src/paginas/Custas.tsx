import { useEffect, useState } from 'react'
import { mesAntes, type TotaisDasCustas, type VisaoDasCustas } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { formatarDecimal, isoParaData } from '../campos.ts'
import { CustasDoProcesso, DecisaoDoCusto } from '../componentes/CustasDoProcesso.tsx'
import { NovoCusto } from '../componentes/NovoCusto.tsx'
import { agora } from '../dados/servidor.ts'
import { hojeIso, nomeDoMes, rotuloDoMes } from '../regras/datas.ts'
import { usePode } from '../sessao.ts'
import { MolduraDaBase } from './Base.tsx'
import bases from './Bases.module.css'
import styles from './Custas.module.css'

// Custas do processo (GGVP-157; desenho aprovado pelo Pedro em 14/10): a visão do Financeiro e, na Gestão, dos sócios
// (`valores.ver`). Os custos para aprovar e os totais do mês por processo vêm do servidor (GET /api/custas); a tela só
// desenha. O sócio abre o processo no card de custas; o Financeiro, que não abre o processo, vê o detalhe aqui mesmo.

const reais = (valor: string) => `R$ ${formatarDecimal(Number(valor))}`
const SUBTITULO = 'O que se gastou e o que se ganhou em cada processo. Só conta no lucro o custo que o Financeiro aprovou; o custo não entra na prestação de contas do cliente.'

export function Custas({ casoId }: { casoId?: string }) {
  return casoId ? <DetalheDasCustas casoId={casoId} /> : <VisaoDasCustasTela />
}

/** O detalhe de um processo para o Financeiro: o mesmo card da página do processo, com aprovar, recusar e lançar. */
function DetalheDasCustas({ casoId }: { casoId: string }) {
  return (
    <MolduraDaBase
      ativo="custas"
      titulo="Custas do processo"
      subtitulo={SUBTITULO}
      acoes={
        <a className={bases.link} href="/custas">
          ← Voltar às custas
        </a>
      }
    >
      <CustasDoProcesso casoId={casoId} />
    </MolduraDaBase>
  )
}

function VisaoDasCustasTela() {
  const atual = hojeIso(agora()).slice(0, 7)
  const [mes, setMes] = useState(atual)
  const [visao, setVisao] = useState<VisaoDasCustas | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [rodada, setRodada] = useState(0)
  const aprova = usePode('custas.aprovar')
  // Pedro, 16/10: quem lança custo (o Financeiro; a Sênior lança pelo processo) lança daqui, de qualquer processo.
  const lanca = usePode('custas.lancar')
  const [novo, setNovo] = useState(false)
  const abreProcesso = usePode('processo.abrir')

  useEffect(() => {
    let valendo = true
    void chamarApi<VisaoDasCustas>(`/custas?mes=${mes}`).then((r) => {
      if (!valendo) return
      if (r.ok) setVisao(r.dados)
      setErro(r.ok ? '' : r.erro)
    })
    return () => {
      valendo = false
    }
  }, [mes, rodada])

  // CA6: o sócio vai ao card de custas da página do processo; o Financeiro, ao detalhe dentro desta visão.
  const doProcesso = (casoId: string) => (abreProcesso ? `/casos/${casoId}#custas` : `/custas/${casoId}`)
  const mesExtenso = nomeDoMes(mes)

  return (
    <MolduraDaBase
      ativo="custas"
      titulo="Custas dos processos"
      subtitulo={SUBTITULO}
      acoes={
        <>
          <label className={bases.filtro}>
            Mês:
            <select aria-label="Mês" value={mes} onChange={(e) => setMes(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => mesAntes(atual, i)).map((m) => (
                <option key={m} value={m}>
                  {rotuloDoMes(m)}
                </option>
              ))}
            </select>
          </label>
          {lanca && (
            <button type="button" className={bases.novo} onClick={() => setNovo(true)}>
              + Novo custo
            </button>
          )}
        </>
      }
    >
      {erro && (
        <p className={bases.erro} role="alert">
          {erro}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {novo && (
        <NovoCusto
          podeAprovar={aprova}
          aoFechar={() => setNovo(false)}
          aoLancar={(texto) => {
            setNovo(false)
            setAviso(texto)
            setRodada((n) => n + 1)
          }}
        />
      )}

      {visao && (
        <>
          <section className={styles.secao} aria-labelledby="para-aprovar">
            <h2 id="para-aprovar" className={styles.titulo}>
              Custos para aprovar
            </h2>
            {visao.paraAprovar.length === 0 ? (
              <p className={styles.nota}>Nenhum custo esperando o Financeiro.</p>
            ) : (
              <div className={bases.moldura}>
                <table className={bases.tabela} aria-label="Custos para aprovar">
                  <thead>
                    <tr>
                      <th scope="col">Custo</th>
                      <th scope="col" className={styles.valor}>
                        Valor
                      </th>
                      {aprova && <th scope="col">Conferir</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visao.paraAprovar.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.descricao}</strong>
                          <span className={styles.nota}>
                            <a className={bases.link} href={doProcesso(c.casoId)}>
                              {c.cliente}
                            </a>
                            {` · ${c.lancadoPor} · ${isoParaData(c.data)} · `}
                            <a className={bases.link} href={`/api/casos/${c.casoId}/custas/${c.id}/comprovante`} target="_blank" rel="noreferrer">
                              <span aria-hidden="true">📎</span> comprovante anexado
                            </a>
                          </span>
                        </td>
                        <td className={styles.valor}>{reais(c.valor)}</td>
                        {aprova && (
                          <td>
                            <DecisaoDoCusto
                              casoId={c.casoId}
                              custoId={c.id}
                              aoDecidir={(texto) => {
                                setAviso(texto)
                                setRodada((n) => n + 1)
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.secao} aria-labelledby="por-processo">
            <h2 id="por-processo" className={styles.titulo}>
              {mesExtenso[0].toUpperCase() + mesExtenso.slice(1)}, por processo
            </h2>
            <div className={bases.moldura}>
              <table className={bases.tabela} aria-label={`Custas de ${mesExtenso}, por processo`}>
                <thead>
                  <tr>
                    <th scope="col">Processo</th>
                    <th scope="col" className={styles.valor}>
                      Ganhos
                    </th>
                    <th scope="col" className={styles.valor}>
                      Custos
                    </th>
                    <th scope="col" className={styles.valor}>
                      Lucro
                    </th>
                    <th scope="col" className={styles.valor}>
                      Esperando
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visao.porProcesso.map((p) => (
                    <tr key={p.casoId}>
                      <td>
                        <a className={bases.link} href={doProcesso(p.casoId)}>
                          {p.cliente}
                        </a>
                      </td>
                      <Valores t={p} />
                    </tr>
                  ))}
                  {visao.porProcesso.length === 0 && (
                    <tr>
                      <td colSpan={5} className={bases.vazio}>
                        Nenhum ganho nem custo em {mesExtenso}.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className={styles.total}>
                    <th scope="row">Total do mês</th>
                    <Valores t={visao.totalDoMes} />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className={styles.nota}>Ganhos são os honorários da prestação de contas que o Financeiro recebeu no mês; custos, os aprovados com a data do gasto no mês.</p>
          </section>
        </>
      )}
    </MolduraDaBase>
  )
}

function Valores({ t }: { t: TotaisDasCustas }) {
  return (
    <>
      <td className={styles.valor}>{reais(t.ganhos)}</td>
      <td className={styles.valor}>{reais(t.custos)}</td>
      <td className={`${styles.valor} ${Number(t.lucro) < 0 ? styles.negativo : styles.positivo}`}>{reais(t.lucro)}</td>
      <td className={`${styles.valor} ${Number(t.esperando) > 0 ? styles.esperando : ''}`}>{reais(t.esperando)}</td>
    </>
  )
}
