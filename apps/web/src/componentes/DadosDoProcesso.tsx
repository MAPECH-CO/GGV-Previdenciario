import { Fragment, useEffect, useState } from 'react'
import type { ResumoDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { formatarCnj, formatarCpf, formatarNb, formatarTelefone } from '../campos.ts'
import { nomeBeneficio } from '../dados/catalogos.ts'
import styles from '../paginas/Passo.module.css'
import { usePode } from '../sessao.ts'

const FASE: Record<ResumoDoCaso['fase'], string> = { atendimento: 'Atendimento', administrativa: 'Administrativa (INSS)', judicial: 'Judicial', encerrado: 'Encerrado' }

/**
 * Os dados do processo dentro da tarefa (GGVP-86 CA14, Pedro, 14/10): quem faz a tarefa vê o cliente e os números do caso
 * sem ir ao processo e voltar. Só para quem vê o caso; sem permissão (o Financeiro) ou sem o caso, o bloco não aparece.
 */
export function DadosDoProcesso({ casoId }: { casoId: string }) {
  const [resumo, setResumo] = useState<ResumoDoCaso | null>(null)
  const abreProcesso = usePode('processo.abrir')

  useEffect(() => {
    let valendo = true
    void chamarApi<ResumoDoCaso>(`/casos/${casoId}/resumo`).then((r) => {
      if (valendo && r.ok) setResumo(r.dados)
    })
    return () => {
      valendo = false
    }
  }, [casoId])

  if (!resumo) return null
  const { pessoa, identificadores: n } = resumo
  const linhas = [
    ['Cliente', pessoa.nome],
    ['CPF', pessoa.cpf && formatarCpf(pessoa.cpf)],
    ['Telefone', pessoa.telefone && formatarTelefone(pessoa.telefone)],
    ['Benefício', resumo.beneficio ? nomeBeneficio(resumo.beneficio) : 'a definir'],
    ['Fase', FASE[resumo.fase]],
    ['NB', n.nb && formatarNb(n.nb)],
    ['Requerimento', n.protocolo],
    ['Processo judicial', n.cnj && formatarCnj(n.cnj)],
    ['Vara', resumo.vara],
  ].filter((l): l is [string, string] => Boolean(l[1]))

  return (
    <section className={styles.cartao} aria-labelledby="dados-do-processo">
      <h2 id="dados-do-processo" className={styles.cartaoTitulo}>
        Dados do processo
      </h2>
      <dl className={styles.linhas}>
        {linhas.map(([rotulo, valor]) => (
          <Fragment key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </Fragment>
        ))}
      </dl>
      <p className={styles.dica}>
        <a href={`/clientes/${pessoa.id}`}>Abrir a ficha</a>
        {abreProcesso && (
          <>
            {' · '}
            <a href={`/casos/${resumo.casoId}`}>Abrir o processo</a>
          </>
        )}
      </p>
    </section>
  )
}
