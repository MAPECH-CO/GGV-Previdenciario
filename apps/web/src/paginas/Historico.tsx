import { useEffect, useId, useState, type FormEvent } from 'react'
import { PedirExportacao, type HistoricoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const momento = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/**
 * Histórico do processo (GGVP-99): a linha montada do histórico, em ordem (CA11). A gestão pede a exportação com o
 * motivo, a direção autoriza, e só quem pediu baixa a trilha (CA12). Ninguém edita nem apaga (CA9).
 */
export function Historico({ casoId }: { casoId: string }) {
  const idMotivo = useId()
  const [h, setH] = useState<HistoricoDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<HistoricoDoCaso>(`/casos/${casoId}/historico`).then((r) => (r.ok ? setH(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  const depois = (texto: string) => {
    setErro('')
    setFeito(texto)
    setVersao((v) => v + 1)
  }

  async function pedir(e: FormEvent) {
    e.preventDefault()
    const entrada = PedirExportacao.safeParse({ motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0].message)
    const r = await chamarApi(`/casos/${casoId}/historico/exportacao`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setMotivo('')
    depois('Pedido enviado. A direção recebeu a tarefa de autorizar a exportação.')
  }

  async function autorizar() {
    const r = await chamarApi(`/casos/${casoId}/historico/exportacao/autorizacao`, { method: 'POST' })
    if (!r.ok) return setErro(r.erro)
    depois('Exportação autorizada. Quem pediu já pode baixar o histórico.')
  }

  return (
    <main className={styles.pagina}>
      <title>Histórico do processo · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Histórico do processo</h1>
      {h && <p className={styles.subtitulo}>{h.cliente} · ninguém edita nem apaga o histórico; uma correção entra como evento novo</p>}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {h && h.eventos.length > 0 && (
        <ol className={styles.lista} aria-label="Linha do processo">
          {h.eventos.map((e, i) => (
            <li key={`${e.quando}-${i}`}>
              {momento(e.quando)} · {e.quem} · {e.descricao}
              {e.passo ? ` (${e.passo})` : ''}
            </li>
          ))}
        </ol>
      )}

      {h && (h.exportacao || h.podePedirExportacao) && (
        <section className={styles.cartao} aria-label="Exportação do histórico">
          <h2 className={styles.cartaoTitulo}>Exportação do histórico</h2>
          {h.exportacao && (
            <p className={styles.dica}>
              Pedida por {h.exportacao.pedidaPor} em {momento(h.exportacao.pedidaEm)}: {h.exportacao.motivo}.{' '}
              {h.exportacao.situacao === 'pedida' ? 'Esperando a autorização da direção.' : 'Autorizada pela direção.'}
            </p>
          )}
          {h.podeAutorizarExportacao && (
            <div className={styles.acoes}>
              <button type="button" className={styles.botao} onClick={() => void autorizar()}>
                Autorizar a exportação
              </button>
            </div>
          )}
          {h.podeExportar && (
            <a href={`/api/casos/${casoId}/historico/exportacao`} download>
              Baixar o histórico (JSON)
            </a>
          )}
          {h.podePedirExportacao && (
            <form onSubmit={pedir} noValidate>
              <label className={styles.rotulo} htmlFor={idMotivo}>
                Motivo do pedido (auditoria, titular dos dados)
              </label>
              <textarea id={idMotivo} className={styles.campo} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <p className={styles.dica}>Ninguém exporta sem a autorização da direção. O pedido e a exportação ficam no histórico.</p>
              <div className={styles.acoes}>
                <button type="submit" className={styles.botao} disabled={!motivo.trim()}>
                  Pedir a exportação
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  )
}
