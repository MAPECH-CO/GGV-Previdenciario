import passo from '../paginas/Balcao.module.css'
import {
  PARENTESCOS,
  ROTULOS_DAS_ORIGENS,
  caminhoDoModelo,
  corrigivel,
  HONORARIOS_DO_MODELO,
  type CampoDoModelo,
  type CampoPreenchido,
  type Modelo,
} from '../regras/contrato.ts'
import { Campo } from './Campo.tsx'
import styles from './CartaoDocumento.module.css'

type Props = {
  campos: CampoPreenchido[]
  modelo: Modelo
  /** "Não, corrigir campos": os campos que se corrigem viram caixas (CA3). */
  corrigindo: boolean
  /** O que está em cada caixa. */
  valorDe: (c: CampoPreenchido) => string
  erros: Partial<Record<CampoDoModelo, string>>
  aoMudar: (campo: CampoDoModelo, valor: string) => void
  aoSair: (campo: CampoDoModelo) => void
}

const NUMERICOS: CampoDoModelo[] = ['cpf', 'representanteCpf', 'telefone']

/** "Documento preenchido" (GGVP-69): cada campo do modelo, com o valor e de onde veio (CA1, CA5), e os honorários (CA11). */
export function CartaoDocumento({ campos, modelo, corrigindo, valorDe, erros, aoMudar, aoSair }: Props) {
  return (
    <section className={passo.cartao} aria-labelledby="documento-titulo">
      <h2 id="documento-titulo" className={passo.cartaoTitulo}>
        Documento preenchido
      </h2>
      <p className={styles.modelo}>
        A IA preencheu o {modelo.nome} com os dados do cliente e do caso · modelo {caminhoDoModelo(modelo)}, o mesmo no ZapSign
      </p>
      <dl className={styles.campos}>
        {campos.map((c) => {
          const id = `contrato-${c.campo}`
          if (corrigindo && corrigivel(c)) {
            return (
              <div key={c.campo} className={styles.caixa}>
                <Campo
                  id={id}
                  rotulo={`${c.rotulo} *`}
                  valor={valorDe(c)}
                  aoMudar={(v) => aoMudar(c.campo, v)}
                  aoSair={() => aoSair(c.campo)}
                  erro={erros[c.campo]}
                  opcoes={c.campo === 'representanteParentesco' ? PARENTESCOS : undefined}
                  inputMode={NUMERICOS.includes(c.campo) ? 'numeric' : undefined}
                  maxLength={c.campo === 'endereco' || c.campo === 'profissao' ? 200 : c.campo === 'estadoCivil' ? 40 : 120}
                  dica={`veio de: ${ROTULOS_DAS_ORIGENS[c.origem]}`}
                  largo
                />
              </div>
            )
          }
          return (
            <div key={c.campo} className={styles.linha}>
              <dt className={styles.rotulo}>{c.rotulo}</dt>
              <dd className={styles.valor} data-falta={c.valor === ''}>
                {c.valor || 'falta'}
              </dd>
              <dd className={styles.origem}>{ROTULOS_DAS_ORIGENS[c.origem]}</dd>
            </div>
          )
        })}
        <div className={styles.linha}>
          <dt className={styles.rotulo}>Honorários</dt>
          <dd className={styles.valor}>{HONORARIOS_DO_MODELO}</dd>
          <dd className={styles.origem}>do modelo, sem campo para digitar</dd>
        </div>
      </dl>
    </section>
  )
}
