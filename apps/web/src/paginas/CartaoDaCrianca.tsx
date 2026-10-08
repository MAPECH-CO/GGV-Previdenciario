import { useEffect, useRef, useState } from 'react'
import { obterCrianca, salvarCrianca, type CriancaNaTela } from '../dados/infantil.ts'
import { CONDICOES_DA_CRIANCA, TERAPIAS, type CondicaoDaCrianca, type DadosDaCrianca, type Terapia } from '../regras/infantil.ts'
import styles from './Balcao.module.css'
import proprio from './ConferirChecklist.module.css'

// GGVP-50: a condição e as terapias da criança no parecer (step_D1.21M, 14:195; não há quadro do roteiro infantil). A
// condição é dado de saúde: o cartão só aparece ao Jurídico. Os relatórios que o caso pede entram no checklist.

const alternar = <T,>(lista: T[], item: T, sim: boolean) => (sim ? [...lista, item] : lista.filter((x) => x !== item))

export function CartaoDaCrianca({ processoId, perfil, nome }: { processoId: string; perfil?: string; nome: string }) {
  const [tela, setTela] = useState<CriancaNaTela | null>(null)
  const [d, setD] = useState<DadosDaCrianca>({ condicoes: [], terapias: [], escola: false })
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const travado = useRef(false)

  useEffect(() => {
    let valendo = true
    obterCrianca(processoId, perfil).then((t) => {
      if (!valendo || !t) return
      setTela(t)
      if (t.dados) setD({ condicoes: t.dados.condicoes, terapias: t.dados.terapias, escola: t.dados.escola === true })
    })
    return () => {
      valendo = false
    }
  }, [processoId, perfil])

  if (!tela?.infantil) return null

  const mudar = (x: Partial<DadosDaCrianca>) => {
    setD((a) => ({ ...a, ...x }))
    setAviso('')
  }

  async function salvar() {
    if (travado.current) return
    travado.current = true
    setSalvando(true)
    setErro('')
    try {
      setTela(await salvarCrianca(processoId, d, { perfil, nome }))
      setAviso('Condição salva: o checklist pede os relatórios dela.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar a condição.')
    } finally {
      travado.current = false
      setSalvando(false)
    }
  }

  return (
    <section className={styles.cartao} aria-labelledby="crianca">
      <div className={proprio.cartaoTopo}>
        <h2 id="crianca" className={styles.cartaoTitulo}>
          Criança · condição e terapias
        </h2>
        <span className={proprio.especie}>roteiro infantil · {tela.idade} anos</span>
      </div>
      <p className={proprio.itemDetalhe}>
        Menor de 16 anos pela data de nascimento (calculado por código): a análise usa o roteiro infantil. Marque a condição e as
        terapias que a criança faz; os relatórios que provam o caso entram no checklist.
      </p>
      <fieldset className={proprio.grupo}>
        <legend>Condição</legend>
        {(Object.entries(CONDICOES_DA_CRIANCA) as [CondicaoDaCrianca, string][]).map(([id, texto]) => (
          <label key={id} className={proprio.marcar}>
            <input type="checkbox" checked={d.condicoes.includes(id)} onChange={(e) => mudar({ condicoes: alternar(d.condicoes, id, e.target.checked) })} />
            {texto}
          </label>
        ))}
      </fieldset>
      <fieldset className={proprio.grupo}>
        <legend>Terapias que a criança faz</legend>
        {(Object.entries(TERAPIAS) as [Terapia, string][]).map(([id, texto]) => (
          <label key={id} className={proprio.marcar}>
            <input type="checkbox" checked={d.terapias.includes(id)} onChange={(e) => mudar({ terapias: alternar(d.terapias, id, e.target.checked) })} />
            {texto}
          </label>
        ))}
      </fieldset>
      <fieldset className={proprio.grupo}>
        <legend>Escola</legend>
        <label className={proprio.marcar}>
          <input type="checkbox" checked={d.escola} onChange={(e) => mudar({ escola: e.target.checked })} />
          Frequenta escola ou creche (o relatório escolar entra no checklist)
        </label>
        <p className={proprio.itemDetalhe}>
          O relatório escolar conta a comunicação, a interação, a participação, o comportamento, a autonomia e as dificuldades da
          criança. Sem escola, valem os relatórios dos profissionais que a acompanham.
        </p>
      </fieldset>
      <h3 className={proprio.itemNome}>Relatórios que o caso pede</h3>
      <ul className={proprio.itens} aria-label="Relatórios que o caso pede">
        {tela.relatorios.map((r) => (
          <li key={r} className={proprio.item}>
            {r}
          </li>
        ))}
      </ul>
      {!tela.dados && <p className={styles.aviso}>Sem a condição marcada, o checklist fica travado: os relatórios dependem dela.</p>}
      <div className={styles.rodape}>
        <button type="button" className={styles.principalBotao} disabled={salvando} onClick={salvar}>
          {salvando ? 'salvando…' : 'Salvar a condição'}
        </button>
        <a className={styles.atalho} href={`/casos/${processoId}/checklist`}>
          Abrir o checklist
        </a>
      </div>
      {aviso && (
        <p role="status" className={styles.motivo}>
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className={styles.motivo}>
          {erro}
        </p>
      )}
    </section>
  )
}
