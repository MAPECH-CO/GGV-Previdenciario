import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { normalizarData, validarData } from '@ggv/campos'
import { DecidirConferencia, DispensarParecer, ResponderDispensa, type CasoParaConferencia } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')
const ROTULO_PARECER = { suficiente: 'Suficiente', insuficiente: 'Insuficiente', contraditorio: 'Contraditório', dispensado: 'Dispensado por duas Sêniores' }

/** Por que Aprovar ainda não vale: G1 aqui; G17 vem do servidor, pela regra única do contrato (`travaDoParecer`). */
function bloqueioDeAprovar(c: CasoParaConferencia): string | null {
  if (c.checklist.cadastrado && !c.checklist.completo) return `Checklist incompleto (G1): faltam ${c.checklist.faltam.join(', ')}.`
  return c.travaDoParecer
}

/** Conferência da Sênior antes do INSS (GGVP-23). Quem não é Sênior vê só para leitura (CA4). */
export function Conferencia({ casoId }: { casoId: string }) {
  const ids = { motivo: useId(), prazo: useId(), justificativa: useId() }
  const [caso, setCaso] = useState<CasoParaConferencia | null>(null)
  const [modo, setModo] = useState<'nada' | 'reprovar' | 'dispensar'>('nada')
  const [motivo, setMotivo] = useState('')
  const [temPrazo, setTemPrazo] = useState<boolean | null>(null)
  const [prazo, setPrazo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  const carregar = () => chamarApi<CasoParaConferencia>(`/casos/${casoId}/conferencia`).then((r) => (r.ok ? setCaso(r.dados) : setErro(r.erro)))
  useEffect(() => {
    void carregar()
  }, [casoId])

  async function enviarDecisao(corpo: unknown, mensagem: string) {
    const entrada = DecidirConferencia.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a decisão.')
    const r = await chamarApi(`/casos/${casoId}/conferencia`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(mensagem)
  }

  function reprovar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (temPrazo === null) return setErro('Responda se a tarefa tem prazo')
    void enviarDecisao(
      { decisao: 'reprovar', motivo, temPrazo, ...(temPrazo ? { prazo } : {}) },
      'Reprovado. O caso voltou para o Atendimento ajustar, com o seu motivo.',
    )
  }

  async function dispensar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = DispensarParecer.safeParse({ justificativa })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Justificativa obrigatória.')
    const r = await chamarApi(`/casos/${casoId}/parecer/dispensa`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setModo('nada')
    await carregar()
  }

  /** A segunda Sênior, outra pessoa, aprova ou recusa (Q14). O servidor recusa quem pediu. */
  async function responderDispensa(aprova: boolean) {
    const corpo = ResponderDispensa.parse({ aprova })
    const r = await chamarApi(`/casos/${casoId}/parecer/dispensa/aprovacao`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    await carregar()
  }

  if (!caso)
    return (
      <main className={styles.pagina}>
        <title>Conferência · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const bloqueio = bloqueioDeAprovar(caso)

  return (
    <main className={styles.pagina}>
      <title>Conferência · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Conferência antes do INSS</h1>
      <p className={styles.subtitulo}>
        {caso.cliente} · {rotuloBeneficio(caso.beneficio)}
      </p>
      {!caso.podeDecidir && <span className={`${styles.selo} ${styles.seloAlerta}`}>Só leitura: aprovar e reprovar são da Sênior (G2)</span>}

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Checklist (G1)</h2>
        {!caso.checklist.cadastrado ? (
          <p className={styles.dica}>Kit do benefício não cadastrado: o checklist não foi conferido pelo portal.</p>
        ) : caso.checklist.completo ? (
          <span className={styles.selo}>Checklist completo</span>
        ) : (
          <p className={styles.erroCampo}>Faltam: {caso.checklist.faltam.join(', ')}</p>
        )}
        <h3 className={styles.rotulo}>Documentos</h3>
        <ol className={styles.lista}>
          {caso.documentos.map((d) => (
            <li key={d.id}>{d.nome}</li>
          ))}
        </ol>
        <p className={styles.dica}>
          Ficha do cliente: {caso.temFicha ? 'preenchida' : 'não preenchida'} · Kit assinado: {caso.kitAssinado ? 'sim' : 'não'} · Cálculo de tempo e pontos:
          não há para este caso
        </p>
      </section>

      <section className={styles.cartao}>
        <h2 className={styles.cartaoTitulo}>Parecer médico (G17)</h2>
        {caso.parecer ? (
          <>
            <span className={caso.parecer.resultado === 'suficiente' || caso.parecer.resultado === 'dispensado' ? styles.selo : `${styles.selo} ${styles.seloAlerta}`}>
              {ROTULO_PARECER[caso.parecer.resultado]}
            </span>
            {caso.parecer.justificativaDispensa && <p className={styles.dica}>Justificativa: {caso.parecer.justificativaDispensa}</p>}
            <ul className={styles.lista}>
              {caso.parecer.itens.map((i) => (
                <li key={i.item}>
                  {i.atendido ? '✓' : '✗'} {i.item}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.dica}>{caso.parecerRestrito ? 'Parecer médico restrito ao Jurídico.' : 'Sem parecer médico.'}</p>
        )}
        {caso.laudoNovoEsperando && <p className={styles.erroCampo}>Há laudo novo esperando conferência.</p>}
        {caso.dispensa && (
          <div className={styles.cartao}>
            <p className={styles.dica}>
              Dispensa pedida por {caso.dispensa.pedidaPor}: {caso.dispensa.justificativa}
            </p>
            {caso.dispensa.podeResponder ? (
              <div className={styles.acoes}>
                <button type="button" className={styles.botao} onClick={() => void responderDispensa(true)}>
                  Aprovar a dispensa
                </button>
                <button type="button" className={styles.botaoSecundario} onClick={() => void responderDispensa(false)}>
                  Recusar a dispensa
                </button>
              </div>
            ) : (
              <p className={styles.dica}>Espera a aprovação de outra Sênior: uma pessoa sozinha não dispensa o parecer.</p>
            )}
          </div>
        )}
      </section>

      {feito ? (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      ) : (
        caso.podeDecidir && (
          <section className={styles.cartao}>
            <h2 className={styles.cartaoTitulo}>Decisão</h2>
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
                disabled={Boolean(bloqueio)}
                onClick={() => void enviarDecisao({ decisao: 'aprovar' }, 'Aprovado. O protocolo e a decisão de perícia foram abertos.')}
              >
                Aprovar
              </button>
              <button type="button" className={styles.botaoSecundario} onClick={() => setModo('reprovar')}>
                Reprovar, volta ao Atendimento
              </button>
              {caso.travaDoParecer && !caso.laudoNovoEsperando && !caso.dispensa && (
                <button type="button" className={styles.botaoSecundario} onClick={() => setModo('dispensar')}>
                  Pedir a dispensa do parecer
                </button>
              )}
            </div>

            {modo === 'reprovar' && (
              <form className={styles.cartao} onSubmit={reprovar} noValidate>
                <label className={styles.rotulo} htmlFor={ids.motivo}>
                  O que o Atendimento precisa ajustar
                </label>
                <textarea id={ids.motivo} className={styles.campo} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <fieldset className={styles.cartao}>
                  <legend className={styles.rotulo}>Essa tarefa tem prazo?</legend>
                  <label className={styles.escolha}>
                    <input type="radio" name="prazo" checked={temPrazo === true} onChange={() => setTemPrazo(true)} />
                    Sim
                  </label>
                  <label className={styles.escolha}>
                    <input type="radio" name="prazo" checked={temPrazo === false} onChange={() => setTemPrazo(false)} />
                    Não
                  </label>
                </fieldset>
                {temPrazo && (
                  <>
                    <label className={styles.rotulo} htmlFor={ids.prazo}>
                      Data do ajuste
                    </label>
                    <input
                      id={ids.prazo}
                      className={styles.campo}
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      value={prazo}
                      aria-invalid={prazo && !validarData(prazo) ? true : undefined}
                      onChange={(e) => setPrazo(normalizarData(e.target.value))}
                    />
                  </>
                )}
                <div className={styles.acoes}>
                  <button type="submit" className={styles.botao}>
                    Confirmar reprovação
                  </button>
                </div>
              </form>
            )}

            {modo === 'dispensar' && (
              <form className={styles.cartao} onSubmit={(e) => void dispensar(e)} noValidate>
                <label className={styles.rotulo} htmlFor={ids.justificativa}>
                  Por que o parecer é dispensado
                </label>
                <textarea id={ids.justificativa} className={styles.campo} rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                <div className={styles.acoes}>
                  <button type="submit" className={styles.botao}>
                    Pedir a dispensa a outra Sênior
                  </button>
                </div>
              </form>
            )}
          </section>
        )
      )}
    </main>
  )
}
