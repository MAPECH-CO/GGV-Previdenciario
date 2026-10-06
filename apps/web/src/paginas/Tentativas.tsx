import { useEffect, useState } from 'react'
import { ROTULO_PERFIL, type Perfil, type TentativasBloqueadas } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/** Tentativas bloqueadas (GGVP-109 CA9): quem tentou passar por um portão, em que caso e quando. Só a gestão vê. */
export function Tentativas() {
  const [lista, setLista] = useState<TentativasBloqueadas['tentativas'] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void chamarApi<TentativasBloqueadas>('/gestao/tentativas').then((r) => (r.ok ? setLista(r.dados.tentativas) : setErro(r.erro)))
  }, [])

  return (
    <main className={styles.pagina}>
      <title>Tentativas bloqueadas · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Tentativas bloqueadas</h1>
      <p className={styles.subtitulo}>Quem tentou passar por um portão sem o que ele exige. O servidor recusou todas.</p>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {lista && lista.length === 0 && <p className={styles.dica}>Nenhuma tentativa bloqueada.</p>}
      {lista && lista.length > 0 && (
        <ul className={styles.lista} aria-label="Tentativas bloqueadas">
          {lista.map((t, i) => (
            <li key={`${t.quando}-${i}`}>
              {quando(t.quando)} · {t.quem}
              {t.perfil ? ` (${ROTULO_PERFIL[t.perfil as Perfil] ?? t.perfil})` : ''} · {t.cliente ?? 'sem caso'} · {t.descricao}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
