import type { HTMLAttributes } from 'react'
import type { ItemCatalogo } from '../dados/catalogos.ts'
import styles from './Campo.module.css'

type Props = {
  id: string
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  /** Ao sair do campo: normaliza e valida (a regra vem de regras/formularios.ts, sobre a biblioteca campos). */
  aoSair?: () => void
  erro?: string
  /** Com opções, vira uma lista (select). */
  opcoes?: ItemCatalogo[]
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  largo?: boolean
  /** 'time': a hora pelo campo do navegador (a biblioteca campos não tem hora). */
  tipo?: 'text' | 'time'
  placeholder?: string
  /** Linha de apoio embaixo da caixa: a idade, "conferido", "lido pela IA · confira" (GGVP-24). */
  dica?: string
}

/** Campo de formulário das fichas (Figma 73:371 e 73:199): rótulo pequeno, caixa e a mensagem de erro embaixo. */
export function Campo({ id, rotulo, valor, aoMudar, aoSair, erro, opcoes, inputMode, maxLength, largo, tipo, placeholder, dica }: Props) {
  const descricao = [erro ? `${id}-erro` : '', dica ? `${id}-dica` : ''].filter(Boolean).join(' ')
  const comum = {
    id,
    className: styles.entrada,
    value: valor,
    onBlur: aoSair,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': descricao || undefined,
  }
  return (
    <div className={`${styles.campo} ${largo ? styles.largo : ''}`}>
      <label className={styles.rotulo} htmlFor={id}>
        {rotulo}
      </label>
      {opcoes ? (
        <select {...comum} onChange={(e) => aoMudar(e.target.value)}>
          <option value="">Escolha…</option>
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      ) : (
        <input {...comum} type={tipo} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} />
      )}
      {dica && (
        <p id={`${id}-dica`} className={styles.dica}>
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className={styles.erro}>
          {erro}
        </p>
      )}
    </div>
  )
}
