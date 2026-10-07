import { useEffect, useId, useState } from 'react'
import { isoParaData } from '@ggv/campos'
import { ROTULO_CLASSE, type PublicacoesDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const dia = (iso: string) => isoParaData(iso) ?? iso

/** Publicações do processo (GGVP-74 CA5, CA7): cada uma com a classificação, quem leu e o prazo; as não lidas primeiro. */
export function PublicacoesDoProcesso({ casoId }: { casoId: string }) {
  const idFiltro = useId()
  const [d, setD] = useState<PublicacoesDoCaso | null>(null)
  const [soAndamento, setSoAndamento] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void chamarApi<PublicacoesDoCaso>(`/casos/${casoId}/publicacoes`).then((r) => (r.ok ? setD(r.dados) : setErro(r.erro)))
  }, [casoId])

  if (!d)
    return (
      <main className={styles.pagina}>
        <title>Publicações do processo · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const lista = [...d.publicacoes]
    .filter((p) => !soAndamento || p.classe === 'andamento')
    .sort((a, b) => Number(a.classe !== null) - Number(b.classe !== null))

  return (
    <main className={styles.pagina}>
      <title>Publicações do processo · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Publicações do processo</h1>
      <p className={styles.subtitulo}>{d.cliente}</p>
      <label className={styles.escolha} htmlFor={idFiltro}>
        <input id={idFiltro} type="checkbox" checked={soAndamento} onChange={(e) => setSoAndamento(e.target.checked)} />
        Só as lidas como "só andamento"
      </label>
      <ul className={styles.lista} aria-label="Publicações">
        {lista.map((p) => (
          <li key={p.id} className={styles.cartao}>
            <strong>
              {dia(p.disponibilizadaEm)} · {p.fonte.toUpperCase()}
            </strong>{' '}
            · {p.classe ? `${ROTULO_CLASSE[p.classe]} · lida por ${p.classificadaPor}` : 'Não lida'}
            {p.prazo ? ` · prazo até ${dia(p.prazo.fim)}` : ''}
            <p>{p.trecho}</p>
            <a className={p.classe ? styles.botaoSecundario : styles.botao} href={`/publicacoes/${p.id}`}>
              {p.classe ? (p.classe === 'andamento' ? 'Reclassificar' : 'Abrir') : 'Ler'}
            </a>
          </li>
        ))}
      </ul>
      {lista.length === 0 && <p className={styles.dica}>Nenhuma publicação.</p>}
    </main>
  )
}
