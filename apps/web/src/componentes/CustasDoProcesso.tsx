import { useEffect, useId, useRef, useState } from 'react'
import { LancarCusto, MSG_SEM_COMPROVANTE, ROTULO_SITUACAO_DO_CUSTO, type CustasDoProcesso as Custas, type SituacaoDoCusto } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { formatarDecimal, isoParaData, normalizarData } from '../campos.ts'
import { agora } from '../dados/servidor.ts'
import { problemaDoArquivo } from '../regras/arquivos.ts'
import { hojeIso } from '../regras/datas.ts'
import { Campo } from './Campo.tsx'
import base from '../paginas/ProcessoPericia.module.css'
import passo from '../paginas/Balcao.module.css'
import styles from './CustasDoProcesso.module.css'

// Custas do processo (GGVP-157; desenho aprovado pelo Pedro em 14/10): ganhos, custos aprovados, lucro e o que espera o
// Financeiro, cada lançamento e o "Lançar custo". O mesmo card serve à página do processo (Sênior e sócios) e ao detalhe
// do Financeiro na visão dele, onde aprova e recusa. Quem barra é o servidor; a tela só esconde.

const reais = (valor: string) => `R$ ${formatarDecimal(Number(valor))}`
const ORIGEM = { inss: 'INSS', justica: 'Justiça' } as const
const ETIQUETA: Record<SituacaoDoCusto, string> = { aprovado: base.ok, esperando: base.alerta, recusado: styles.erro, cancelado: base.neutro }
const VAZIO = { descricao: '', valor: '', data: '' }

export function CustasDoProcesso({ casoId }: { casoId: string }) {
  const [custas, setCustas] = useState<Custas | null | undefined>(undefined)
  const [form, setForm] = useState(() => ({ ...VAZIO, data: isoParaData(hojeIso(agora())) ?? '' }))
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [falha, setFalha] = useState('')
  const travado = useRef(false)
  const idArquivo = useId()

  async function carregar() {
    const r = await chamarApi<Custas>(`/casos/${casoId}/custas`)
    setCustas(r.ok ? r.dados : null)
  }
  useEffect(() => {
    let valendo = true
    void chamarApi<Custas>(`/casos/${casoId}/custas`).then((r) => valendo && setCustas(r.ok ? r.dados : null))
    return () => {
      valendo = false
    }
  }, [casoId])
  // O sócio chega da visão de custas por /casos/<id>#custas: o card abre depois da página, então a rolagem é aqui.
  const chegou = Boolean(custas)
  useEffect(() => {
    if (chegou && window.location.hash === '#custas') document.getElementById('custas')?.scrollIntoView?.()
  }, [chegou])

  if (custas === undefined) return <p className={base.nota}>Abrindo as custas do processo…</p>
  if (custas === null) return null

  /** Uma ação por vez: dois cliques não lançam duas vezes. */
  async function umaVez(acao: () => Promise<void>) {
    if (travado.current) return
    travado.current = true
    setAviso('')
    setFalha('')
    try {
      await acao()
    } finally {
      travado.current = false
    }
  }

  const lancar = () =>
    umaVez(async () => {
      const entrada = LancarCusto.safeParse(form)
      const novos: Record<string, string> = {}
      if (!entrada.success) for (const i of entrada.error.issues) novos[String(i.path[0])] ??= i.message
      const problema = arquivo ? problemaDoArquivo({ nome: arquivo.name, tamanho: arquivo.size }) : MSG_SEM_COMPROVANTE
      if (problema) novos.arquivo = problema
      setErros(novos)
      if (Object.keys(novos).length) return
      const corpo = new FormData()
      for (const [k, v] of Object.entries(form)) corpo.append(k, v)
      corpo.append('arquivo', arquivo!)
      const r = await chamarApi<{ situacao: SituacaoDoCusto }>(`/casos/${casoId}/custas`, { method: 'POST', corpo })
      if (!r.ok) return setFalha(r.erro)
      setForm({ ...VAZIO, data: form.data })
      setArquivo(null)
      setAviso(r.dados.situacao === 'aprovado' ? 'Custo lançado e já aprovado.' : 'Enviado ao Financeiro. Conta no lucro depois que ele aprovar.')
      await carregar()
    })

  const { totais } = custas
  const negativo = Number(totais.lucro) < 0
  return (
    <section id="custas" className={`${base.cartao} ${styles.custas}`} aria-labelledby="custas-titulo">
      <header className={styles.cabeca}>
        <div>
          <h2 id="custas-titulo" className={base.cartaoTitulo}>
            Custas do processo
          </h2>
          <p className={base.nota}>{[custas.cliente, custas.beneficio, ORIGEM[custas.origem]].filter(Boolean).join(' · ')}</p>
        </div>
        <span className={styles.restrito}>Só sócios, Financeiro e Sênior</span>
      </header>

      <dl className={styles.totais}>
        <div>
          <dt>Ganhos (honorários)</dt>
          <dd>{reais(totais.ganhos)}</dd>
        </div>
        <div>
          <dt>Custos aprovados</dt>
          <dd>{reais(totais.custos)}</dd>
        </div>
        <div className={negativo ? styles.prejuizo : styles.lucro}>
          <dt>Lucro do processo</dt>
          <dd>{reais(totais.lucro)}</dd>
        </div>
        <div className={styles.esperando}>
          <dt>Esperando o Financeiro</dt>
          <dd>{reais(totais.esperando)}</dd>
        </div>
      </dl>

      {custas.lancamentos.length === 0 ? (
        <p className={base.nota}>Nenhum custo lançado neste processo.</p>
      ) : (
        <div className={styles.rolagem}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Descrição</th>
                <th scope="col">Quem lançou</th>
                <th scope="col" className={styles.valor}>
                  Valor
                </th>
                <th scope="col">Situação</th>
                {custas.podeAprovar && <th scope="col">Conferir</th>}
              </tr>
            </thead>
            <tbody>
              {custas.lancamentos.map((l) => (
                <tr key={l.id}>
                  <td>{isoParaData(l.data)}</td>
                  <td>
                    <span className={styles.descricao}>
                      {l.descricao}
                      <a className={styles.clipe} href={`/api/casos/${casoId}/custas/${l.id}/comprovante`} target="_blank" rel="noreferrer" aria-label={`Abrir o comprovante de ${l.descricao}`}>
                        <span aria-hidden="true">📎</span>
                      </a>
                    </span>
                    {l.situacao === 'recusado' && l.motivo && <span className={styles.motivo}>Motivo: {l.motivo}</span>}
                  </td>
                  <td>{l.lancadoPor}</td>
                  <td className={styles.valor}>{reais(l.valor)}</td>
                  <td>
                    <span className={`${base.situacao} ${ETIQUETA[l.situacao]}`}>{ROTULO_SITUACAO_DO_CUSTO[l.situacao]}</span>
                  </td>
                  {custas.podeAprovar && (
                    <td>
                      {l.situacao === 'esperando' && (
                        <DecisaoDoCusto
                          casoId={casoId}
                          custoId={l.id}
                          aoDecidir={(texto) => {
                            setAviso(texto)
                            void carregar()
                          }}
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {custas.podeLancar && (
        <form
          className={styles.lancar}
          aria-labelledby="lancar-custo"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void lancar()
          }}
        >
          <h3 id="lancar-custo" className={base.grupo}>
            Lançar custo
          </h3>
          <div className={styles.campos}>
            <Campo id="custo-descricao" rotulo="Descrição" valor={form.descricao} aoMudar={(descricao) => setForm({ ...form, descricao })} erro={erros.descricao} maxLength={200} placeholder="Ex.: Uber para levar o cliente à perícia" />
            <Campo id="custo-valor" rotulo="Valor (R$)" valor={form.valor} aoMudar={(valor) => setForm({ ...form, valor })} erro={erros.valor} inputMode="decimal" placeholder="0,00" />
            <Campo id="custo-data" rotulo="Data" valor={form.data} aoMudar={(data) => setForm({ ...form, data: normalizarData(data) })} erro={erros.data} inputMode="numeric" maxLength={10} placeholder="dd/mm/aaaa" />
          </div>
          <div className={styles.anexo}>
            <label htmlFor={idArquivo} className={passo.atalho}>
              <span aria-hidden="true">📎</span> Anexar comprovante (foto ou PDF)
            </label>
            <input
              id={idArquivo}
              className={styles.arquivo}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              aria-invalid={erros.arquivo ? true : undefined}
              aria-describedby={`${idArquivo}-dica`}
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null)
                setErros({ ...erros, arquivo: '' })
              }}
            />
            <span id={`${idArquivo}-dica`} className={base.nota}>
              {arquivo ? arquivo.name : 'obrigatório para enviar'}
            </span>
          </div>
          {erros.arquivo && <p className={styles.erroCampo}>{erros.arquivo}</p>}
          <button type="submit" className={passo.principalBotao}>
            {custas.podeAprovar ? 'Lançar (já entra aprovado)' : 'Enviar ao Financeiro'}
          </button>
        </form>
      )}
      {falha && <p role="alert" className={styles.erroCampo}>{falha}</p>}
      {aviso && <p role="status">{aviso}</p>}
      <p className={base.nota}>Só conta no lucro depois que o Financeiro aprova. O custo não entra na prestação de contas do cliente.</p>
    </section>
  )
}

/** Aprovar, ou recusar com o motivo pedido antes de confirmar (CA3). Na tela de quem aprova: o card e a visão do Financeiro. */
export function DecisaoDoCusto({ casoId, custoId, aoDecidir }: { casoId: string; custoId: string; aoDecidir: (aviso: string) => void }) {
  const [motivo, setMotivo] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  async function decidir(qual: 'aprovacao' | 'recusa') {
    if (travado.current) return
    if (qual === 'recusa' && !motivo?.trim()) return setErro('Diga o motivo da recusa.')
    travado.current = true
    try {
      const r = await chamarApi(`/casos/${casoId}/custas/${custoId}/${qual}`, { method: 'POST', corpo: qual === 'recusa' ? { motivo } : {} })
      if (!r.ok) return setErro(r.erro)
      setMotivo(null)
      setErro('')
      aoDecidir(qual === 'aprovacao' ? 'Custo aprovado: passa a contar no lucro.' : 'Custo recusado. Fica no histórico e não conta no lucro.')
    } finally {
      travado.current = false
    }
  }

  if (motivo === null)
    return (
      <span className={styles.botoes}>
        <button type="button" className={passo.atalho} onClick={() => void decidir('aprovacao')}>
          Aprovar
        </button>
        <button type="button" className={passo.atalho} onClick={() => setMotivo('')}>
          Recusar com motivo
        </button>
        {erro && <span className={styles.erroCampo}>{erro}</span>}
      </span>
    )
  return (
    <span className={styles.recusa}>
      <Campo
        id={`motivo-${custoId}`}
        rotulo="Motivo da recusa"
        valor={motivo}
        aoMudar={(m) => {
          setMotivo(m)
          setErro('')
        }}
        erro={erro}
      />
      <button type="button" className={passo.atalho} onClick={() => void decidir('recusa')}>
        Confirmar a recusa
      </button>
      <button
        type="button"
        className={base.link}
        onClick={() => {
          setMotivo(null)
          setErro('')
        }}
      >
        Voltar
      </button>
    </span>
  )
}
