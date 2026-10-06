import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { isoParaData } from '@ggv/campos'
import { RegistrarMotivo, type Indeferimento } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')
const dia = (iso: string) => isoParaData(iso.slice(0, 10)) ?? iso

/**
 * Registrar o motivo do indeferimento (GGVP-52): a carta e o motivo do INSS ao lado do campo (CA3); o motivo com as
 * palavras de quem viu vai para o banco de motivos e a Sênior recebe "Despachar caso" (CA6). O servidor confere de novo.
 */
export function RegistrarIndeferimento({ casoId }: { casoId: string }) {
  const ids = { motivo: useId(), carta: useId() }
  const [x, setX] = useState<Indeferimento | null>(null)
  const [motivo, setMotivo] = useState('')
  const [carta, setCarta] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [versao, setVersao] = useState(0) // muda depois de registrar: recarrega

  useEffect(() => {
    void chamarApi<Indeferimento>(`/casos/${casoId}/indeferimento`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = RegistrarMotivo.safeParse({ motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    if (!x?.carta && !carta) return setErro('Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).')
    const dados = new FormData()
    dados.set('motivo', entrada.data.motivo)
    if (carta) dados.set('arquivo', carta)
    setEnviando(true)
    const r = await chamarApi(`/casos/${casoId}/indeferimento/motivo`, { method: 'POST', corpo: dados })
    setEnviando(false)
    // CA5: a falha aparece; tentar de novo não duplica.
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito('Motivo registrado no banco de motivos. A Sênior recebeu "Despachar caso".')
    setVersao((v) => v + 1)
  }

  if (!x)
    return (
      <main className={styles.pagina}>
        <title>Registrar indeferimento · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Registrar indeferimento · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Registrar indeferimento</h1>
      <p className={styles.subtitulo}>
        {x.cliente} · {rotuloBeneficio(x.beneficio)}
      </p>

      <section className={styles.cartao} aria-label="O que o INSS disse">
        <h2 className={styles.cartaoTitulo}>Indeferido em {dia(x.dataDecisao)}</h2>
        <p>Motivo no sistema do INSS: {x.motivoInss ?? 'não informado'}</p>
        {x.carta ? (
          <a href={`/api/casos/${casoId}/documentos/${x.carta.id}`} target="_blank" rel="noreferrer">
            Abrir a carta de indeferimento ({x.carta.nome})
          </a>
        ) : (
          <p className={styles.dica}>A carta de indeferimento não foi anexada.</p>
        )}
      </section>

      {x.motivoEscrito && (
        <section className={styles.cartao} aria-label="Motivo registrado">
          <h2 className={styles.cartaoTitulo}>Motivo com as palavras de quem viu</h2>
          <p>{x.motivoEscrito.texto}</p>
          <p className={styles.dica}>
            {x.motivoEscrito.por} em {dia(x.motivoEscrito.em)}
          </p>
        </section>
      )}

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {x.podeRegistrar && (
        <form className={styles.cartao} onSubmit={registrar} noValidate>
          <label className={styles.rotulo} htmlFor={ids.motivo}>
            Motivo com as suas palavras
          </label>
          <textarea id={ids.motivo} className={styles.campo} rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <p className={styles.dica}>Por que o INSS negou, do jeito que você entendeu. Vai para o banco de motivos.</p>
          {!x.carta && (
            <>
              <label className={styles.rotulo} htmlFor={ids.carta}>
                Carta de indeferimento
              </label>
              <input id={ids.carta} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setCarta(e.target.files?.[0] ?? null)} />
            </>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={enviando}>
              Registrar e enviar à Sênior
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
