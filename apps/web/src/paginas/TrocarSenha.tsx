import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { TrocarSenha as Contrato, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi, voltaSegura } from '../api.ts'
import styles from './Entrar.module.css'

/** Primeiro acesso com senha provisória: a pessoa define a própria senha antes de qualquer tela (GGVP-117, resposta do PO Q1). */
export function TrocarSenha({ busca = window.location.search }: { busca?: string }) {
  const volta = voltaSegura(new URLSearchParams(busca).get('volta'))
  const idNova = useId()
  const idConfirma = useId()
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')

  async function trocar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = Contrato.safeParse({ senhaNova: nova })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Senha inválida')
    if (nova !== confirma) return setErro('As duas senhas não são iguais.')
    const r = await chamarApi<UsuarioDaSessao>('/sessao/senha', { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    window.location.assign(volta)
  }

  return (
    <main className={styles.pagina}>
      <title>Trocar a senha · GGV Previdenciário</title>
      <form className={styles.cartao} onSubmit={trocar} noValidate>
        <h1 className={styles.titulo}>Crie a sua senha</h1>
        <p className={styles.texto}>A senha que a gestão entregou é provisória. Escolha uma só sua, com pelo menos 8 caracteres.</p>
        <label className={styles.rotulo} htmlFor={idNova}>
          Nova senha
        </label>
        <input id={idNova} className={styles.campo} type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
        <label className={styles.rotulo} htmlFor={idConfirma}>
          Repita a nova senha
        </label>
        <input
          id={idConfirma}
          className={styles.campo}
          type="password"
          autoComplete="new-password"
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
        />
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        <button type="submit" className={styles.botao}>
          Salvar e continuar
        </button>
      </form>
    </main>
  )
}
