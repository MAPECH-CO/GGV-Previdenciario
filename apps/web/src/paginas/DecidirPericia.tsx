import { useState } from 'react'
import type { FormEvent } from 'react'
import { DecidirPericia as Contrato, TIPOS_DE_PERICIA } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const ROTULO = { medica: 'Perícia médica', social: 'Avaliação social' } as const
type Tipo = (typeof TIPOS_DE_PERICIA)[number]

/** Decidir perícia (GGVP-31): "Definir" só habilita com a resposta; com "Sim", o sistema abre a tarefa de perícia. */
export function DecidirPericia({ casoId }: { casoId: string }) {
  const [precisa, setPrecisa] = useState<boolean | null>(null)
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<string | null>(null)
  const pronto = precisa === false || (precisa === true && tipos.length > 0)

  async function definir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = Contrato.safeParse(precisa ? { precisa, tipos } : { precisa })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Responda se o caso precisa de perícia')
    const r = await chamarApi(`/casos/${casoId}/pericia`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setFeito(precisa ? 'Decidido. O sistema abriu a tarefa de perícia para o Jurídico administrativo.' : 'Decidido: sem perícia. O caso espera só o protocolo para entrar na vigília.')
  }

  const alternar = (t: Tipo) => setTipos((atual) => (atual.includes(t) ? atual.filter((x) => x !== t) : [...atual, t]))

  return (
    <main className={styles.pagina}>
      <title>Decidir perícia · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Precisa de perícia?</h1>
      <p className={styles.subtitulo}>A decisão corre junto com o protocolo. A marcação é do Jurídico administrativo.</p>
      {feito ? (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      ) : (
        <form className={styles.cartao} onSubmit={definir}>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Precisa de perícia?</legend>
            <label className={styles.escolha}>
              <input type="radio" name="precisa" checked={precisa === true} onChange={() => setPrecisa(true)} />
              Sim, o sistema abre a tarefa de perícia
            </label>
            <label className={styles.escolha}>
              <input
                type="radio"
                name="precisa"
                checked={precisa === false}
                onChange={() => {
                  setPrecisa(false)
                  setTipos([])
                }}
              />
              Não
            </label>
          </fieldset>
          {precisa && (
            <fieldset className={styles.cartao}>
              <legend className={styles.rotulo}>Qual?</legend>
              {TIPOS_DE_PERICIA.map((t) => (
                <label key={t} className={styles.escolha}>
                  <input type="checkbox" checked={tipos.includes(t)} onChange={() => alternar(t)} />
                  {ROTULO[t]}
                </label>
              ))}
            </fieldset>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!pronto}>
              Definir
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
