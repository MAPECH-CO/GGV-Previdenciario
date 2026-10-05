import { useId, useRef, useState, type FormEvent } from 'react'
import { conferirSenhaLida, guardarSenhaNoCofre, naoSabeASenha } from '../dados/cofre.ts'
import { agora } from '../dados/servidor.ts'
import type { SenhaGov } from '../dados/tipos.ts'
import { hojeIso } from '../regras/datas.ts'
import { situacaoDaSenha } from '../regras/fichaAtendimento.ts'
import styles from './CampoCofre.module.css'

type Props = { fichaId: string; senhaGov: SenhaGov; aoMudar: (senhaGov: SenhaGov) => void }

/**
 * O componente do cofre (GGVP-24, CA2, CA3, CA8, CA9, CA15): fica fora do formulário da ficha, manda a senha direto ao
 * cofre e esquece o valor. A ficha só vê a situação. O cofre de verdade, com o "Revelar", é da GGVP-103.
 */
export function CampoCofre({ fichaId, senhaGov, aoMudar }: Props) {
  const id = useId()
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  async function fazer(acao: () => Promise<{ senhaGov: SenhaGov }>) {
    if (travado.current) return
    travado.current = true
    setEnviando(true)
    setErro('')
    try {
      const r = await acao()
      setSenha('')
      aoMudar(r.senhaGov)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para guardar.')
    } finally {
      travado.current = false
      setEnviando(false)
    }
  }

  function guardar(e: FormEvent) {
    e.preventDefault()
    if (senha !== '') fazer(() => guardarSenhaNoCofre(fichaId, senha))
  }

  return (
    <form className={styles.cofre} aria-label="Cofre da senha do gov.br" onSubmit={guardar} autoComplete="off">
      <p className={styles.titulo}>
        <span aria-hidden="true">🔒 </span>Senha do gov.br
      </p>
      <p className={styles.situacao} aria-live="polite">
        gov.br: {situacaoDaSenha(senhaGov, hoje)}
      </p>
      {senhaGov.conferir && (
        <div className={styles.conferir}>
          <p>A IA leu uma senha escrita na ficha em papel e ela foi para o cofre. Confira com o papel.</p>
          <button type="button" className={styles.botao} disabled={enviando} onClick={() => fazer(() => conferirSenhaLida(fichaId))}>
            Conferi a senha do cofre com o papel
          </button>
        </div>
      )}
      <div className={styles.linha}>
        <label className={styles.rotulo} htmlFor={id}>
          {senhaGov.situacao === 'no-cofre' ? 'Trocar a senha (vai direto ao cofre)' : 'Digite a senha (vai direto ao cofre)'}
        </label>
        <div className={styles.entradaEBotao}>
          <input
            id={id}
            className={styles.entrada}
            type="password"
            autoComplete="new-password"
            maxLength={100}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="submit" className={styles.botao} disabled={senha === '' || enviando}>
            {enviando ? 'guardando…' : 'Guardar no cofre'}
          </button>
          {senhaGov.situacao !== 'no-cofre' && !senhaGov.naoSabe && (
            <button type="button" className={styles.botao} disabled={enviando} onClick={() => fazer(() => naoSabeASenha(fichaId))}>
              Não sei a senha
            </button>
          )}
        </div>
      </div>
      {erro && (
        <p role="alert" className={styles.erro}>
          {erro}
        </p>
      )}
    </form>
  )
}
