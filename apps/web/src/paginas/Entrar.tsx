import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { validarEmail } from '@ggv/campos'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi, marcarEntrou, voltaSegura } from '../api.ts'
import styles from './Entrar.module.css'

/** Tela "Entrar" (GGVP-117). Erro de senha nunca diz qual campo errou. */
export function Entrar({ busca = window.location.search }: { busca?: string }) {
  const params = new URLSearchParams(busca)
  const expirou = params.get('expirou') === '1'
  const volta = voltaSegura(params.get('volta'))
  const idEmail = useId()
  const idSenha = useId()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erroEmail, setErroEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro('') // a mensagem da tentativa anterior some: a próxima é a resposta desta
    if (!validarEmail(email)) return setErroEmail('Digite um e-mail válido.')
    if (!senha) return setErro('Digite a senha.')
    setEnviando(true)
    const r = await chamarApi<UsuarioDaSessao>('/sessao', { method: 'POST', corpo: { email, senha } })
    setEnviando(false)
    if (!r.ok) {
      setSenha('')
      return setErro(r.erro)
    }
    marcarEntrou(true)
    window.location.assign(r.dados.trocarSenha ? `/trocar-senha?volta=${encodeURIComponent(volta)}` : volta)
  }

  return (
    <main className={styles.pagina}>
      <title>Entrar · GGV Previdenciário</title>
      <form className={styles.cartao} onSubmit={entrar} noValidate>
        <div className={styles.marca}>
          <span className={styles.logo} aria-hidden="true">
            §
          </span>
          <span>GGV Previdenciário</span>
        </div>
        <h1 className={styles.titulo}>Entrar</h1>
        {expirou && (
          <p className={styles.aviso} role="status">
            Sua sessão expirou. Entre de novo para continuar de onde parou.
          </p>
        )}

        <label className={styles.rotulo} htmlFor={idEmail}>
          E-mail
        </label>
        <input
          id={idEmail}
          className={styles.campo}
          type="email"
          autoComplete="username"
          value={email}
          aria-invalid={erroEmail ? true : undefined}
          aria-describedby={erroEmail ? `${idEmail}-erro` : undefined}
          onChange={(e) => {
            setEmail(e.target.value.trim())
            setErroEmail('')
          }}
          onBlur={() => setErroEmail(email && !validarEmail(email) ? 'Digite um e-mail válido.' : '')}
        />
        {erroEmail && (
          <p id={`${idEmail}-erro`} className={styles.erroCampo}>
            {erroEmail}
          </p>
        )}

        <label className={styles.rotulo} htmlFor={idSenha}>
          Senha
        </label>
        <input
          id={idSenha}
          className={styles.campo}
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className={styles.botao} disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className={styles.dica}>Esqueceu a senha ou a conta travou? Fale com a gestão.</p>
      </form>
    </main>
  )
}
