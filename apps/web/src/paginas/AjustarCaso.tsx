import { useEffect, useState } from 'react'
import { LiberarAoJuridico, type CasoParaLiberacao } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Por que ainda não libera: G1 aqui; G17 vem do servidor, pela regra única do contrato (`travaDoParecer`). */
function bloqueioDeLiberar(c: CasoParaLiberacao): string | null {
  if (c.checklist.cadastrado && !c.checklist.completo) return `Checklist incompleto (G1): faltam ${c.checklist.faltam.join(', ')}.`
  return c.travaDoParecer
}

/**
 * O caso devolvido pela Sênior (GGVP-127): o motivo e o prazo que ela deixou, o que ainda trava e "Liberar de novo".
 * O caso volta à fila dela com uma conferência nova, sem o OK anterior (GGVP-23 CA9); o servidor confere G1 e G17 de novo.
 */
export function AjustarCaso({ casoId }: { casoId: string }) {
  const [caso, setCaso] = useState<CasoParaLiberacao | null>(null)
  const [conferiChecklist, setConferiChecklist] = useState(false)
  const [conferiAssinaturas, setConferiAssinaturas] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)

  useEffect(() => {
    void chamarApi<CasoParaLiberacao>(`/casos/${casoId}/liberacao`).then((r) => (r.ok ? setCaso(r.dados) : setErro(r.erro)))
  }, [casoId])

  async function liberar() {
    const entrada = LiberarAoJuridico.safeParse({ conferiChecklist, conferiAssinaturas })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confirme as conferências.')
    setEnviando(true)
    const r = await chamarApi(`/casos/${casoId}/liberacao`, { method: 'POST', corpo: entrada.data })
    setEnviando(false)
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(true)
  }

  if (!caso)
    return (
      <main className={styles.pagina}>
        <title>Ajustar o caso · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const bloqueio = bloqueioDeLiberar(caso)
  const { ajuste } = caso

  return (
    <main className={styles.pagina}>
      <title>{`${caso.cliente} · Ajustar o caso · GGV Previdenciário`}</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Ajustar o caso</h1>
      <p className={styles.subtitulo}>
        {caso.cliente} · {rotuloBeneficio(caso.beneficio)}
      </p>

      {ajuste ? (
        <section className={styles.cartao} aria-labelledby="pedido-da-senior">
          <h2 id="pedido-da-senior" className={styles.cartaoTitulo}>
            O que a Sênior pediu
          </h2>
          <p>{ajuste.motivo}</p>
          {ajuste.prazo ? (
            <span className={`${styles.selo} ${styles.seloAlerta}`}>Prazo do ajuste: {dia(ajuste.prazo)}</span>
          ) : (
            <span className={styles.selo}>Sem prazo</span>
          )}
          <p className={styles.dica}>
            Devolvido por {ajuste.reprovadoPor} em {quando(ajuste.reprovadoEm)}, na conferência antes do INSS.
          </p>
        </section>
      ) : (
        <p className={styles.dica}>
          {caso.esperandoConferencia ? 'O caso já está na fila da Sênior.' : 'Este caso não tem ajuste pedido pela Sênior.'}
        </p>
      )}

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Checklist (G1)</h2>
        {!caso.checklist.cadastrado ? (
          <p className={styles.dica}>Kit do benefício não cadastrado: o checklist não foi conferido pelo portal.</p>
        ) : caso.checklist.completo ? (
          <span className={styles.selo}>Checklist completo</span>
        ) : (
          <p className={styles.erroCampo}>Faltam: {caso.checklist.faltam.join(', ')}</p>
        )}
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Parecer médico (G17)</h2>
        {caso.travaDoParecer ? <p className={styles.erroCampo}>{caso.travaDoParecer}</p> : <span className={styles.selo}>Em ordem para liberar</span>}
      </section>

      <p className={styles.dica}>
        Para corrigir, abra a <a href={`/casos/${casoId}`}>página do processo</a>: os documentos, o contrato e o parecer estão lá.
      </p>

      {feito ? (
        <p className={styles.sucesso} role="status">
          ✓ Liberado de novo. O caso voltou para a fila da Sênior, que confere outra vez, sem o OK anterior.
        </p>
      ) : (
        ajuste &&
        (caso.podeLiberar ? (
          <section className={styles.cartao} aria-labelledby="liberar-de-novo">
            <h2 id="liberar-de-novo" className={styles.cartaoTitulo}>
              Liberar de novo para a Sênior
            </h2>
            <label className={styles.escolha}>
              <input type="checkbox" checked={conferiChecklist} onChange={(e) => setConferiChecklist(e.target.checked)} /> Conferi o checklist
            </label>
            <label className={styles.escolha}>
              <input type="checkbox" checked={conferiAssinaturas} onChange={(e) => setConferiAssinaturas(e.target.checked)} /> Conferi as assinaturas e as
              datas
            </label>
            {bloqueio && <p className={styles.dica}>{bloqueio}</p>}
            {erro && (
              <p className={styles.erro} role="alert">
                {erro}
              </p>
            )}
            <div className={styles.acoes}>
              <button
                type="button"
                className={styles.botao}
                disabled={enviando || bloqueio !== null || !conferiChecklist || !conferiAssinaturas}
                onClick={() => void liberar()}
              >
                {enviando ? 'liberando…' : 'Liberar de novo'}
              </button>
            </div>
          </section>
        ) : (
          <span className={`${styles.selo} ${styles.seloAlerta}`}>Só leitura: quem ajusta e libera de novo é o Atendimento</span>
        ))
      )}
    </main>
  )
}
