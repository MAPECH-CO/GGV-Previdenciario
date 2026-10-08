import { useEffect, useId, useState } from 'react'
import { formatarCnj, isoParaData, normalizarCnj } from '@ggv/campos'
import { VincularPublicacao, type ItemDaFila, type PainelDaVigilia } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
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
    <li className={styles.cartao}>
      <strong>
        {dia(item.disponibilizadaEm)} · {item.fonte.toUpperCase()}
      </strong>
      {item.partes && <span> · {item.partes}</span>}
      <p style={{ whiteSpace: 'pre-wrap' }}>{item.texto}</p>
      <span className={item.diasUteisAtePrazo <= 2 ? `${styles.selo} ${styles.seloAlerta}` : styles.selo}>
        {item.motivo} · prazo mínimo até {dia(item.prazoMinimo.fim)} ({item.diasUteisAtePrazo} dias úteis)
        {item.idadeEmDias >= 1 ? ` · há ${item.idadeEmDias} dia${item.idadeEmDias > 1 ? 's' : ''} na fila` : ''}
      </span>
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
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="button" className={styles.botao} onClick={() => void decidir({ decisao: 'vincular', numeroCnj: cnj })}>
          Vincular ao processo
        </button>
        <button type="button" className={styles.botaoSecundario} onClick={() => void decidir({ decisao: 'fora_do_escritorio' })}>
          Não é do escritório
        </button>
      </div>
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
    setErro('')
    recarregar(r.dados.situacao === 'ok' ? `Reprocessada: ${r.dados.capturadas} publicação(ões) nova(s).` : `Falhou de novo: ${r.dados.erro}`)
  }

  if (!p)
    return (
      <main className={styles.pagina}>
        <title>Vigília das publicações · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Vigília das publicações · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Vigília das publicações</h1>
      <p className={styles.subtitulo}>
        {dia(p.dia)} · Rodadas hoje {p.concluidas} de {p.previstas} · Falhas {p.falhas}
      </p>
      <p className={p.situacaoDoDia === 'incompleta' || p.situacaoDoDia === 'sem_publicacao' ? styles.erro : styles.dica} aria-label="Situação do dia">
        {AVISO_DO_DIA[p.situacaoDoDia]}
      </p>

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

      <section className={styles.cartao} aria-label="Rodadas do dia">
        <h2 className={styles.cartaoTitulo}>Rodadas do dia</h2>
        <ul className={styles.lista}>
          {p.rodadas.map((r) => (
            <li key={r.id}>
              {hora(r.previstaPara)} · {r.fonte.toUpperCase()} · {situacaoDaRodada(r)}
              {r.reprocessadaPor ? ` · reprocessada por ${r.reprocessadaPor}` : ''}
              {p.podeReprocessar && (r.situacao === 'falhou' || r.situacao === 'nao_rodou') && (
                <button type="button" className={styles.botaoSecundario} onClick={() => void reprocessar(r.id)}>
                  Reprocessar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {p.podeCasar && (
        <section className={styles.cartao} aria-label="Fila de revisão">
          <h2 className={styles.cartaoTitulo}>Publicações sem processo ({p.fila.length})</h2>
          {p.fila.length === 0 ? (
            <p className={styles.dica}>Nada na fila.</p>
          ) : (
            <ul className={styles.lista}>
              {p.fila.map((item) => (
                <ItemDaFilaDeRevisao key={item.id} item={item} aoDecidir={recarregar} />
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={styles.cartao} aria-label="Descartes">
        <h2 className={styles.cartaoTitulo}>Descartadas hoje ({p.descartes.length})</h2>
        <ul className={styles.lista}>
          {p.descartes.map((d) => (
            <li key={d.quando + d.trecho}>
              {d.fonte.toUpperCase()} · {d.numeroCnj ? formatarCnj(d.numeroCnj) : 'sem CNJ'} · {d.motivo} · “{d.trecho.slice(0, 80)}”
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
