import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { hojeIso, isoParaData, somenteDigitos } from '@ggv/campos'
import { RegistrarProtocolo, type CasoParaProtocolo, type SenhaDoCofre } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')

/** Senha do gov.br do cofre (G9): pede a senha do portal, mostra por tempo limitado e some sozinha. */
function SenhaDoGov({ casoId }: { casoId: string }) {
  const idSenha = useId()
  const [pedindo, setPedindo] = useState(false)
  const [senhaDoPortal, setSenhaDoPortal] = useState('')
  const [mostrada, setMostrada] = useState<SenhaDoCofre | null>(null)
  const [restante, setRestante] = useState(0)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!mostrada) return
    const relogio = setInterval(() => setRestante((s) => s - 1), 1000)
    const fim = setTimeout(() => setMostrada(null), mostrada.segundos * 1000)
    return () => {
      clearInterval(relogio)
      clearTimeout(fim)
    }
  }, [mostrada])

  async function pedir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const r = await chamarApi<SenhaDoCofre>(`/casos/${casoId}/cofre`, { method: 'POST', corpo: { senhaDoPortal } })
    setSenhaDoPortal('')
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setPedindo(false)
    setRestante(r.dados.segundos) // a contagem já aparece certa no primeiro desenho
    setMostrada(r.dados)
  }

  if (mostrada)
    return (
      <p role="status">
        Senha do gov.br: <span className={styles.senha}>{mostrada.senha}</span> · some em {restante}s
      </p>
    )
  if (!pedindo)
    return (
      <button type="button" className={styles.botaoSecundario} onClick={() => setPedindo(true)}>
        Ver a senha do gov.br
      </button>
    )
  return (
    <form className={styles.cartao} onSubmit={pedir}>
      <label className={styles.rotulo} htmlFor={idSenha}>
        Confirme com a sua senha do portal
      </label>
      <input id={idSenha} className={styles.campo} type="password" autoComplete="current-password" value={senhaDoPortal} onChange={(e) => setSenhaDoPortal(e.target.value)} />
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao}>
          Mostrar por 60 segundos
        </button>
        <button type="button" className={styles.botaoSecundario} onClick={() => setPedindo(false)}>
          Cancelar
        </button>
      </div>
      <p className={styles.dica}>O uso da senha fica no histórico do caso (G9).</p>
    </form>
  )
}

/** Protocolar no Meu INSS (GGVP-27). Número, DER, comprovante e a conferência são obrigatórios; o servidor confere de novo. */
export function Protocolar({ casoId }: { casoId: string }) {
  const ids = { numero: useId(), der: useId(), comprovante: useId(), revisado: useId() }
  const [caso, setCaso] = useState<CasoParaProtocolo | null>(null)
  const [numero, setNumero] = useState('')
  const [der, setDer] = useState(() => hojeIso()) // calendário do navegador, já em hoje; não aceita data futura
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [revisado, setRevisado] = useState(false)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    void chamarApi<CasoParaProtocolo>(`/casos/${casoId}/protocolo`).then((r) => (r.ok ? setCaso(r.dados) : setErro(r.erro)))
  }, [casoId])

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = RegistrarProtocolo.safeParse({ numero, der: isoParaData(der) ?? '', revisado })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    if (!comprovante) return setErro('Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).')
    const dados = new FormData()
    dados.set('numero', numero)
    dados.set('der', isoParaData(der) ?? '')
    dados.set('revisado', String(revisado))
    dados.set('comprovante', comprovante)
    setEnviando(true)
    const r = await chamarApi(`/casos/${casoId}/protocolo`, { method: 'POST', corpo: dados })
    setEnviando(false)
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(true)
  }

  if (!caso)
    return (
      <main className={styles.pagina}>
        <title>Protocolar no Meu INSS · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Protocolar no Meu INSS · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Protocolar no Meu INSS</h1>
      <p className={styles.subtitulo}>
        {caso.cliente} · {rotuloBeneficio(caso.beneficio)}
      </p>

      <section className={styles.cartao} aria-labelledby={`${ids.numero}-ok`}>
        <h2 id={`${ids.numero}-ok`} className={styles.cartaoTitulo}>
          OK da Sênior
        </h2>
        {caso.okSenior ? (
          <span className={styles.selo}>
            OK recebido · {caso.okSenior.por} em {new Date(caso.okSenior.em).toLocaleDateString('pt-BR')} (G2)
          </span>
        ) : (
          <span className={`${styles.selo} ${styles.seloAlerta}`}>Sem o OK da Sênior: não dá para protocolar (G2)</span>
        )}
      </section>

      <section className={styles.cartao} aria-labelledby={`${ids.numero}-docs`}>
        <h2 id={`${ids.numero}-docs`} className={styles.cartaoTitulo}>
          Documentos, na ordem
        </h2>
        <ol className={styles.lista}>
          {caso.documentos.map((d) => (
            <li key={d.id}>{d.nome}</li>
          ))}
        </ol>
        {caso.temSenhaNoCofre ? <SenhaDoGov casoId={casoId} /> : <p className={styles.dica}>Este cliente não tem senha do gov.br no cofre.</p>}
      </section>

      {caso.jaProtocolado || feito ? (
        <p className={styles.sucesso} role="status">
          Protocolo registrado. O caso agora espera o INSS.
        </p>
      ) : (
        <form className={styles.cartao} onSubmit={registrar} noValidate>
          <h2 className={styles.cartaoTitulo}>Registrar o protocolo</h2>
          <label className={styles.rotulo} htmlFor={ids.numero}>
            Número do requerimento
          </label>
          <input id={ids.numero} className={styles.campo} inputMode="numeric" value={numero} onChange={(e) => setNumero(somenteDigitos(e.target.value))} />
          <label className={styles.rotulo} htmlFor={ids.der}>
            Data de entrada do requerimento (DER)
          </label>
          <input id={ids.der} className={styles.campo} type="date" max={hojeIso()} value={der} onChange={(e) => setDer(e.target.value)} />
          <label className={styles.rotulo} htmlFor={ids.comprovante}>
            Comprovante do protocolo
          </label>
          <input id={ids.comprovante} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
          <label className={styles.escolha} htmlFor={ids.revisado}>
            <input id={ids.revisado} type="checkbox" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />
            Revisei o requerimento antes de enviar
          </label>
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={enviando || !caso.okSenior}>
              {enviando ? 'Registrando…' : 'Registrar protocolo'}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
