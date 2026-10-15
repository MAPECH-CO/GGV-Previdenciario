import { useEffect, useId, useState } from 'react'
import { formatarCnj, isoParaData, normalizarCnj } from '@ggv/campos'
import { VincularPublicacao, type ItemDaFila, type PainelDaVigilia } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { Icone } from '../componentes/Icone.tsx'
import { MolduraDaBase } from './Base.tsx'
import painel from './Financeiro.module.css'
import g from './Gestao.module.css'
import styles from './Passo.module.css'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const dia = (iso: string) => isoParaData(iso) ?? iso
type Rodada = PainelDaVigilia['rodadas'][number]

/** O que a rodada diz, em português (CA1, CA2). Falha nunca aparece como "sem publicação" (G13). */
function situacaoDaRodada(r: Rodada) {
  if (r.situacao === 'ok') return r.capturadas === 0 ? 'Rodada OK, nenhuma publicação' : `Rodada OK, ${r.capturadas} publicaç${r.capturadas === 1 ? 'ão' : 'ões'}`
  if (r.situacao === 'falhou') return `Vigília falhou às ${hora(r.fim ?? r.previstaPara)}: ${r.erro ?? ''}`
  if (r.situacao === 'nao_rodou') return 'A rodada não rodou no horário'
  return r.situacao === 'rodando' ? 'Rodando…' : 'Prevista'
}

const AVISO_DO_DIA: Record<PainelDaVigilia['situacaoDoDia'], string> = {
  incompleta: 'Vigília incompleta: há rodada com falha. Reprocesse antes de fechar o dia.',
  sem_publicacao: 'Dia sem publicação: conferir na fonte.',
  ok: 'Rodadas do dia OK.',
  em_andamento: 'Rodadas do dia em andamento.',
  // GGVP-158 I19: sem fonte ligada, nenhuma rodada roda; o dia nunca parece "em andamento" (G13).
  sem_fonte: 'Vigília sem fonte ligada: nenhuma publicação chega ao portal. O suporte técnico precisa ligar a fonte.',
}

const TOM_DO_DIA: Record<PainelDaVigilia['situacaoDoDia'], string> = {
  incompleta: g.tomErro,
  sem_publicacao: g.tomErro,
  ok: g.tomOk,
  em_andamento: g.tomNeutro,
  sem_fonte: g.tomErro,
}

/** Hora do dia em Brasília, de 0 a 24, para pôr a rodada na régua. */
function horaDoDia(iso: string) {
  const [h, m] = new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).split(':').map(Number)
  return h + m / 60
}

/** A régua do dia: as rodadas nas suas horas, na cor do que aconteceu, e o "agora". Só desenho: o texto está nas rodadas. */
function ReguaDoDia({ rodadas }: { rodadas: Rodada[] }) {
  const [agora] = useState(() => horaDoDia(new Date().toISOString()))
  return (
    <div className={g.reguaDoDia} aria-hidden="true">
      <div className={g.reguaTrilho}>
        <span className={g.reguaPassado} style={{ width: `${(agora / 24) * 100}%` }} />
        {rodadas.map((r) => (
          <span key={r.id} className={g.reguaMarca} data-situacao={r.situacao} style={{ left: `${(horaDoDia(r.previstaPara) / 24) * 100}%` }}>
            <span className={g.reguaHora}>{hora(r.previstaPara)}</span>
          </span>
        ))}
        <span className={g.reguaAgora} style={{ left: `${(agora / 24) * 100}%` }} />
      </div>
      <div className={g.reguaEixo}>
        {['0h', '6h', '12h', '18h', '24h'].map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
    </div>
  )
}

/** Um item da fila de revisão (GGVP-26 CA7, CA8): vincular com o CNJ ou registrar que não é do escritório. */
function ItemDaFilaDeRevisao({ item, aoDecidir }: { item: ItemDaFila; aoDecidir: (texto: string) => void }) {
  const idCnj = useId()
  const [cnj, setCnj] = useState('')
  const [erro, setErro] = useState('')

  async function decidir(corpo: object) {
    const entrada = VincularPublicacao.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o número.')
    const r = await chamarApi(`/publicacoes/${item.id}/vinculo`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoDecidir(entrada.data.decisao === 'vincular' ? 'Publicação vinculada. A advogada recebeu para ler.' : 'Registrado: não é do escritório.')
  }

  return (
    <li className={g.publicacao}>
      <p>
        <strong>
          {dia(item.disponibilizadaEm)} · {item.fonte.toUpperCase()}
        </strong>
        {item.partes && <span className={g.suave}> · {item.partes}</span>}
      </p>
      <p className={g.trecho}>{item.texto}</p>
      <span className={item.diasUteisAtePrazo <= 2 ? `${styles.selo} ${styles.seloAlerta}` : styles.selo}>
        {item.motivo} · prazo mínimo até {dia(item.prazoMinimo.fim)} ({item.diasUteisAtePrazo} dias úteis)
        {item.idadeEmDias >= 1 ? ` · há ${item.idadeEmDias} dia${item.idadeEmDias > 1 ? 's' : ''} na fila` : ''}
      </span>
      <div className={g.vincular}>
        <div className={g.campoCnj}>
          <label className={styles.rotulo} htmlFor={idCnj}>
            Número CNJ do processo
          </label>
          <input
            id={idCnj}
            className={styles.campo}
            inputMode="numeric"
            placeholder="0000000-00.0000.0.00.0000"
            value={cnj}
            onChange={(e) => setCnj(normalizarCnj(e.target.value).length === 20 ? formatarCnj(e.target.value) : e.target.value)}
          />
        </div>
        <div className={styles.acoes}>
          <button type="button" className={styles.botao} onClick={() => void decidir({ decisao: 'vincular', numeroCnj: cnj })}>
            Vincular ao processo
          </button>
          <button type="button" className={styles.botaoSecundario} onClick={() => void decidir({ decisao: 'fora_do_escritorio' })}>
            Não é do escritório
          </button>
        </div>
      </div>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

/**
 * Painel da vigília (GGVP-30, G13; GGVP-26): as rodadas do dia, a situação do dia, o reprocessamento da rodada que
 * falhou, a fila de revisão da Sênior e os descartes.
 */
export function PainelVigilia() {
  const [p, setP] = useState<PainelDaVigilia | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const recarregar = (texto: string) => {
    setFeito(texto)
    setVersao((v) => v + 1)
  }

  useEffect(() => {
    void chamarApi<PainelDaVigilia>('/vigilia').then((r) => (r.ok ? setP(r.dados) : setErro(r.erro)))
  }, [versao])

  async function reprocessar(id: string) {
    const r = await chamarApi<{ situacao: string; capturadas?: number; erro?: string }>(`/vigilia/rodadas/${id}/reprocessar`, { method: 'POST' })
    if (!r.ok) return setErro(r.erro)
    // GGVP-158 I18: a falha de novo é erro, e não sucesso.
    if (r.dados.situacao !== 'ok') {
      setFeito('')
      setErro(`Falhou de novo: ${r.dados.erro}`)
      return setVersao((v) => v + 1)
    }
    setErro('')
    recarregar(`Reprocessada: ${r.dados.capturadas} publicação(ões) nova(s).`)
  }

  return (
    <MolduraDaBase
      ativo="vigilia"
      titulo="Vigília das publicações"
      subtitulo={p ? `${dia(p.dia)} · Rodadas hoje ${p.concluidas} de ${p.previstas} · Falhas ${p.falhas}` : 'As rodadas de hoje, a fila de revisão e os descartes.'}
    >
      {p && (
        <section className={`${g.situacaoDoDia} ${TOM_DO_DIA[p.situacaoDoDia]}`} aria-label="O dia da vigília">
          <div className={g.situacaoTopo}>
            <span className={g.situacaoIcone} aria-hidden="true">
              <Icone nome="vigilia" />
            </span>
            <p className={g.situacaoTexto} aria-label="Situação do dia">
              {AVISO_DO_DIA[p.situacaoDoDia]}
            </p>
            <p className={g.situacaoConta}>
              <strong>
                {p.concluidas}/{p.previstas}
              </strong>{' '}
              rodadas
              {p.falhas > 0 && <span className={g.situacaoFalhas}>{p.falhas === 1 ? '1 falha' : `${p.falhas} falhas`}</span>}
            </p>
          </div>
          <ReguaDoDia rodadas={p.rodadas} />
        </section>
      )}

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

      {p && (
        <div className={g.grade}>
          <div className={g.coluna}>
            <section className={painel.cartao} aria-label="Rodadas do dia">
              <h2 className={painel.cartaoTitulo}>Rodadas do dia</h2>
              <p className={painel.cartaoSub}>Cada rodada lê as fontes no horário previsto. Falha ou atraso pede reprocessamento antes de fechar o dia (G13).</p>
              <ul className={g.rodadas}>
                {p.rodadas.map((r) => (
                  <li key={r.id} className={g.rodada} data-situacao={r.situacao}>
                    <span className={g.hora}>{hora(r.previstaPara)}</span>
                    <span className={g.fonte}>{r.fonte.toUpperCase()}</span>
                    <span className={g.situacao}>{situacaoDaRodada(r)}</span>
                    {p.podeReprocessar && (r.situacao === 'falhou' || r.situacao === 'nao_rodou') && (
                      <button type="button" className={styles.botaoSecundario} onClick={() => void reprocessar(r.id)}>
                        Reprocessar
                      </button>
                    )}
                    {r.reprocessadaPor && <span className={g.reprocessada}>reprocessada por {r.reprocessadaPor}</span>}
                  </li>
                ))}
              </ul>
            </section>

            <section className={painel.cartao} aria-label="Descartes">
              <h2 className={painel.cartaoTitulo}>Descartadas hoje ({p.descartes.length})</h2>
              {p.descartes.length === 0 ? (
                <p className={painel.cartaoSub}>Nenhuma publicação descartada hoje.</p>
              ) : (
                <ul className={g.rodadas}>
                  {p.descartes.map((d) => (
                    <li key={d.quando + d.trecho} className={g.rodada}>
                      <span className={g.fonte}>{d.fonte.toUpperCase()}</span>
                      <span className={g.quando}>{d.numeroCnj ? formatarCnj(d.numeroCnj) : 'sem CNJ'}</span>
                      <span className={g.suave}>
                        {d.motivo} · “{d.trecho.slice(0, 80)}”
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {p.podeCasar && (
            <section className={painel.cartao} aria-label="Fila de revisão">
              <h2 className={painel.cartaoTitulo}>Publicações sem processo ({p.fila.length})</h2>
              <p className={painel.cartaoSub}>Vincule cada uma ao processo pelo número CNJ, ou registre que não é do escritório.</p>
              {p.fila.length === 0 ? (
                <p className={g.vazio}>Nada na fila.</p>
              ) : (
                <ul className={g.publicacoes}>
                  {p.fila.map((item) => (
                    <ItemDaFilaDeRevisao key={item.id} item={item} aoDecidir={recarregar} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </MolduraDaBase>
  )
}
