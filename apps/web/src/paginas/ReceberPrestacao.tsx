import { useEffect, useId, useState } from 'react'
import { formatarDecimal, isoParaData } from '@ggv/campos'
import { ROTULO_FORMA_DE_PAGAMENTO, ReceberPrestacao as Contrato, type PrestacaoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const reais = (texto: string | null) => (texto === null ? '—' : `R$ ${formatarDecimal(Number(texto))}`)
const dia = (iso: string | null) => (iso ? (isoParaData(iso.slice(0, 10)) ?? iso) : '—')

/** Receber a prestação de contas (GGVP-44, Financeiro): valores da versão concluída, agendamento, Recebido ou Divergência. */
export function ReceberPrestacao({ casoId }: { casoId: string }) {
  const idMotivo = useId()
  const [p, setP] = useState<PrestacaoDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [divergindo, setDivergindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<PrestacaoDoCaso>(`/casos/${casoId}/prestacao`).then((r) => (r.ok ? setP(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  async function registrar(corpo: object) {
    const entrada = Contrato.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/casos/${casoId}/prestacao/recebimento`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(entrada.data.resultado === 'recebido' ? 'Recebimento registrado.' : 'Divergência registrada. A prestação voltou para a advogada.')
    setVersao((v) => v + 1)
  }

  if (!p)
    return (
      <main className={styles.pagina}>
        <title>Receber a prestação · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const v = p.versoes[0]

  return (
    <main className={styles.pagina}>
      <title>Receber a prestação · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Receber a prestação de contas</h1>
      <p className={styles.subtitulo}>{p.cliente}</p>

      {v ? (
        <section className={styles.cartao} aria-label="Prestação">
          <h2 className={styles.cartaoTitulo}>
            Versão {v.versao}, concluída por {v.por} em {dia(v.em)}
          </h2>
          <ul className={styles.lista}>
            <li>Valor recebido: {reais(v.valorRecebido)}</li>
            <li>
              Honorários ({v.percentual ? `${formatarDecimal(Number(v.percentual))}%` : '—'}): {reais(v.honorarios)}
            </li>
            <li>Repasse ao cliente: {reais(v.repasse)}</li>
            <li>
              Forma de pagamento: {v.formaPagamento ? (ROTULO_FORMA_DE_PAGAMENTO[v.formaPagamento as keyof typeof ROTULO_FORMA_DE_PAGAMENTO] ?? v.formaPagamento) : '—'} · prazo{' '}
              {dia(v.prazoPagamento)}
            </li>
          </ul>
          {v.recebidaPor && <span className={styles.selo}>Recebida por {v.recebidaPor} em {dia(v.recebidaEm)}</span>}
          {v.divergencia && <span className={`${styles.selo} ${styles.seloAlerta}`}>Divergência: {v.divergencia}</span>}
        </section>
      ) : (
        <p className={styles.dica}>A prestação ainda não foi concluída pela advogada.</p>
      )}

      <section className={styles.cartao} aria-label="Ida ao banco">
        <h2 className={styles.cartaoTitulo}>Ida ao banco</h2>
        {p.agendamento ? (
          <p>
            {new Date(p.agendamento.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })} · {p.agendamento.local} ·
            acompanha: {p.agendamento.acompanhante ?? 'ninguém do escritório'}
          </p>
        ) : (
          <p className={styles.dica}>Ainda não agendada pelo Atendimento.</p>
        )}
      </section>

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      {p.podeReceber && (
        <section className={styles.cartao} aria-label="Registrar">
          {divergindo && (
            <>
              <label className={styles.rotulo} htmlFor={idMotivo}>
                Qual é a divergência
              </label>
              <textarea id={idMotivo} className={styles.campo} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </>
          )}
          <div className={styles.acoes}>
            {!divergindo && (
              <button type="button" className={styles.botao} onClick={() => void registrar({ resultado: 'recebido' })}>
                Recebido
              </button>
            )}
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => (divergindo ? void registrar({ resultado: 'divergencia', motivo }) : setDivergindo(true))}
            >
              {divergindo ? 'Confirmar divergência' : 'Divergência'}
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
