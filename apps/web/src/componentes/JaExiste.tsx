import type { FichaResumo } from '../dados/tipos.ts'
import { Cartao } from './Cartao.tsx'
import styles from './JaExiste.module.css'

type Props = {
  /** Ficha que já tem este CPF: salvar abre ela (CA6). */
  comCpf?: FichaResumo
  /** Fichas com o mesmo telefone ou nome: só avisa (CA9). */
  parecidas: FichaResumo[]
  outraPessoa: boolean
  aoMarcarOutraPessoa: (sim: boolean) => void
}

/** "Já existe?" (Figma 73:456): uma ficha só por pessoa. */
export function JaExiste({ comCpf, parecidas, outraPessoa, aoMarcarOutraPessoa }: Props) {
  return (
    <Cartao titulo="Já existe?">
      {comCpf ? (
        <p className={styles.alerta}>
          Este CPF já está na ficha de <a href={`/clientes/${comCpf.id}`}>{comCpf.nome}</a> ({comCpf.etapa}). Salvar abre essa
          ficha e não cria outra.
        </p>
      ) : parecidas.length === 0 ? (
        <p className={styles.texto}>
          Nenhum cliente com este CPF. CPF repetido abre a ficha que já existe; telefone ou nome parecido só avisa e deixa
          seguir (família divide celular).
        </p>
      ) : (
        <>
          <p className={styles.alerta}>
            {parecidas.length === 1 ? 'Já há uma ficha' : `Já há ${parecidas.length} fichas`} com este telefone ou nome. Pode
            ser alguém da mesma família.
          </p>
          <ul className={styles.lista} aria-label="Fichas parecidas">
            {parecidas.map((f) => (
              <li key={f.id}>
                <a href={`/clientes/${f.id}`}>{f.nome}</a> · {f.situacao === 'cliente' ? 'Cliente' : 'Lead'} · {f.etapa}
              </li>
            ))}
          </ul>
          <label className={styles.outra}>
            <input type="checkbox" checked={outraPessoa} onChange={(e) => aoMarcarOutraPessoa(e.target.checked)} />É outra
            pessoa
          </label>
        </>
      )}
    </Cartao>
  )
}
