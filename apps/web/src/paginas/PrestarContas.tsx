import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { diaLocal, formatarDecimal, isoParaData, normalizarDecimal } from '@ggv/campos'
import { FORMAS_DE_PAGAMENTO, ROTULO_FORMA_DE_PAGAMENTO, SalvarPrestacao, calcularPrestacao, type PrestacaoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { Moldura } from './Moldura.tsx'
import styles from './Passo.module.css'

const reais = (texto: string | null) => (texto === null ? '—' : `R$ ${formatarDecimal(Number(texto))}`)
const dia = (iso: string | null) => (iso ? (isoParaData(diaLocal(iso)) ?? iso) : '—')

/**
 * Prestação de contas do benefício deferido (GGVP-44, advogada). Os valores são calculados por código (CA5): a tela
 * mostra a prévia com a mesma conta do servidor. Concluir abre o Financeiro e o Atendimento juntos (CA2).
 */
export function PrestarContas({ casoId, embutida = false }: { casoId: string; embutida?: boolean }) {
  const ids = { valor: useId(), percentual: useId(), forma: useId(), prazo: useId(), conferi: useId() }
  const [p, setP] = useState<PrestacaoDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [valor, setValor] = useState('')
  const [percentual, setPercentual] = useState('')
  const [forma, setForma] = useState('')
  const [prazo, setPrazo] = useState('')
  const [conferi, setConferi] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ocupado = useRef(false)

  useEffect(() => {
    void chamarApi<PrestacaoDoCaso>(`/casos/${casoId}/prestacao`).then((r) => {
      if (!r.ok) return setErro(r.erro)
      setP(r.dados)
      const atual = r.dados.versoes[0]
      const pct = atual?.percentual ?? r.dados.percentualContrato
      setPercentual(pct === null || pct === undefined ? '' : formatarDecimal(Number(pct)))
      setValor(atual ? formatarDecimal(Number(atual.valorRecebido)) : '')
      setForma(atual?.formaPagamento ?? '')
      setPrazo(atual?.prazoPagamento ?? '')
    })
  }, [casoId, versao])

  const valorNum = normalizarDecimal(valor)
  const pctNum = normalizarDecimal(percentual)
  const previa = valorNum !== null && valorNum > 0 && pctNum !== null && pctNum >= 0 && pctNum <= 100 ? calcularPrestacao(valorNum, pctNum) : null

  async function concluir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (ocupado.current || !p?.podeEditar) return
    const corpo = { valorRecebido: valor, percentual, formaPagamento: forma, prazoPagamento: isoParaData(prazo) ?? '', conferiCarta: conferi }
    const entrada = SalvarPrestacao.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    ocupado.current = true
    setSalvando(true)
    setFeito('')
    try {
      const r = await chamarApi<{ versao: number }>(`/casos/${casoId}/prestacao`, { method: 'POST', corpo })
      if (!r.ok) return setErro(r.erro)
      setErro('')
      setConferi(false)
      setFeito(
        r.dados.versao === 1
          ? 'Prestação concluída. O Financeiro recebe e, depois, avisa o cliente e marca a ida ao banco.'
          : `Versão ${r.dados.versao} registrada. O Financeiro confere de novo.`,
      )
      setVersao((v) => v + 1)
    } catch {
      setErro('Não foi possível confirmar o registro da prestação. Consulte as versões antes de repetir.')
    } finally {
      ocupado.current = false
      setSalvando(false)
    }
  }

  if (!p)
    return (
      <Moldura titulo="Prestar contas" embutida={embutida}>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </Moldura>
    )

  const atual = p.versoes[0]

  return (
    <Moldura
      titulo="Prestar contas"
      embutida={embutida}
      cabecalho={
        <>
          <h1 className={styles.titulo}>Prestação de contas do benefício deferido</h1>
          <p className={styles.subtitulo}>{p.cliente}</p>
        </>
      }
    >

      <section className={styles.cartao} aria-label="Carta de concessão">
        <h2 className={styles.cartaoTitulo}>Carta de concessão</h2>
        {p.carta ? <span className={styles.selo}>{p.carta.nome}</span> : <span className={`${styles.selo} ${styles.seloAlerta}`}>Sem a carta</span>}
      </section>

      <section className={styles.cartao} aria-label="Contrato e fonte dos valores">
        <h2 className={styles.cartaoTitulo}>Contrato e fonte dos valores</h2>
        <p>Valor recebido: a Sênior informa e confere com a carta de concessão. Honorários e repasse: calculados pelo sistema a partir desse valor e do percentual informado.</p>
        <p>Percentual do contrato: {p.percentualContrato === null ? 'não informado pelo servidor' : formatarDecimal(Number(p.percentualContrato)) + '%'}.</p>
        {atual && <p>Os campos começam com a versão {atual.versao}, registrada por {atual.por ?? 'pessoa não identificada'} em {dia(atual.em)}. Confira antes de dar um novo OK.</p>}
        <p>A entrada, as parcelas do contrato e a divisão de uma parte na Caixa ainda não estão disponíveis. Esses valores não entram nesta conta.</p>
        {['Entrada do contrato', 'Parcelas do contrato', 'Parte na Caixa'].map(rotulo => <label key={rotulo} className={styles.rotulo}>
          {rotulo}<input className={styles.campo} disabled value="" placeholder="Ainda indisponível" />
        </label>)}
        <p className={styles.dica}>Quem faz a prestação e dá o OK é a Sênior. A edição direta dos honorários ainda não está disponível.</p>
      </section>

      {atual && (
        <section className={styles.cartao} aria-label="Versões">
          <h2 className={styles.cartaoTitulo}>Versões</h2>
          <ol className={styles.lista}>
            {p.versoes.map((v) => (
              <li key={v.versao}>
                Versão {v.versao} · recebido {reais(v.valorRecebido)} · honorários {reais(v.honorarios)} · repasse {reais(v.repasse)} · {v.por} em {dia(v.em)}
                {v.recebidaPor ? ` · recebida por ${v.recebidaPor}` : ''}
                {v.divergencia ? ` · divergência: ${v.divergencia}` : ''}
              </li>
            ))}
          </ol>
        </section>
      )}

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {p.podeEditar && (
        <form className={styles.cartao} onSubmit={concluir} noValidate>
          <h2 className={styles.cartaoTitulo}>{atual ? 'Alterar (gera nova versão)' : 'Valores'}</h2>
          <label className={styles.rotulo} htmlFor={ids.valor}>
            Valor recebido (atrasados)
          </label>
          <input
            id={ids.valor}
            className={styles.campo}
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => { setValor(e.target.value); setConferi(false) }}
            onBlur={() => valorNum !== null && setValor(formatarDecimal(valorNum))}
          />
          <label className={styles.rotulo} htmlFor={ids.percentual}>
            Honorários do contrato (%)
          </label>
          <input id={ids.percentual} className={styles.campo} inputMode="decimal" value={percentual} onChange={(e) => { setPercentual(e.target.value); setConferi(false) }} />
          {!p.percentualContrato && <p className={styles.dica}>O contrato não tem o percentual: informe o combinado com o cliente.</p>}
          {previa && (
            <p className={styles.selo} aria-label="Valores calculados">
              Honorários {reais(previa.honorarios)} · repasse ao cliente {reais(previa.repasse)} (calculado pelo sistema)
            </p>
          )}
          <label className={styles.rotulo} htmlFor={ids.forma}>
            Forma de pagamento (opcional)
          </label>
          <select id={ids.forma} className={styles.campo} value={forma} onChange={(e) => { setForma(e.target.value); setConferi(false) }}>
            <option value="">Escolha</option>
            {FORMAS_DE_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {f === 'boleto' ? 'Boleto do escritório' : ROTULO_FORMA_DE_PAGAMENTO[f]}
              </option>
            ))}
            <option value="caixa-indisponivel" disabled>Parte na Caixa · ainda indisponível</option>
          </select>
          <label className={styles.rotulo} htmlFor={ids.prazo}>
            Prazo de pagamento
          </label>
          <input id={ids.prazo} className={styles.campo} type="date" value={prazo} onChange={(e) => { setPrazo(e.target.value); setConferi(false) }} />
          <label className={styles.escolha} htmlFor={ids.conferi}>
            <input id={ids.conferi} type="checkbox" checked={conferi} onChange={(e) => setConferi(e.target.checked)} />
            Conferi os valores com a carta de concessão
          </label>
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!conferi || salvando}>
              {atual ? 'Registrar nova versão' : 'Concluir a prestação'}
            </button>
          </div>
          <p className={styles.dica}>Ao concluir, o Financeiro recebe e, depois, avisa o cliente e marca a ida ao banco.</p>
        </form>
      )}
    </Moldura>
  )
}
