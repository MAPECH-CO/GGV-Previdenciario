import { useId, useState, type FormEvent } from 'react'
import { CadastrarSenhaGovbr } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from '../paginas/Passo.module.css'

/**
 * Cofre do gov.br (GGVP-103 CA4, CA11): a senha entra e muda só por aqui, num campo de senha que vai direto ao cofre,
 * nunca num campo de texto da ficha. Serve ao protocolo e à ficha do cliente.
 */
export function CofreGovbr({ pessoaId, temSenha, aoGuardar }: { pessoaId: string; temSenha: boolean; aoGuardar: () => void }) {
  const id = useId()
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const entrada = CadastrarSenhaGovbr.safeParse({ senha })
    if (!entrada.success) return setErro(entrada.error.issues[0].message)
    const r = await chamarApi<{ trocada: boolean }>(`/pessoas/${pessoaId}/cofre`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setSenha('')
    setErro('')
    setFeito(r.dados.trocada ? 'Senha trocada no cofre.' : 'Senha guardada no cofre.')
    aoGuardar()
  }

  return (
    <details>
      <summary>{temSenha ? 'Trocar a senha do gov.br no cofre' : 'Cadastrar a senha do gov.br no cofre'}</summary>
      <form onSubmit={guardar} noValidate aria-label="Cofre do gov.br">
        <label className={styles.rotulo} htmlFor={id}>
          Senha do gov.br
        </label>
        <input id={id} className={styles.campo} type="password" autoComplete="off" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <p className={styles.dica}>A senha vai direto para o cofre, cifrada. Ninguém a vê aqui depois, e o histórico guarda só quem guardou (G9).</p>
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
        <div className={styles.acoes}>
          <button type="submit" className={styles.botao} disabled={!senha}>
            Guardar no cofre
          </button>
        </div>
      </form>
    </details>
  )
}
