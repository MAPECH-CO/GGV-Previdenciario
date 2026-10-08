import { useEffect, useState } from 'react'
import type { PrazosDoEscritorio, UsoDoCofre } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const momento = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

/** Prazos cumpridos e perdidos (GGVP-99 CA14), tirados do histórico. Só a gestão vê. */
export function Prazos() {
  const [p, setP] = useState<PrazosDoEscritorio | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    void chamarApi<PrazosDoEscritorio>('/gestao/prazos').then((r) => (r.ok ? setP(r.dados) : setErro(r.erro)))
  }, [])
  return (
    <main className={styles.pagina}>
      <title>Prazos cumpridos e perdidos · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Prazos cumpridos e perdidos</h1>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {p && (
        <>
          <p className={styles.subtitulo}>
            Cumpridos: {p.cumpridos} · Perdidos: {p.perdidos}
          </p>
          {p.itens.length === 0 ? (
            <p className={styles.dica}>Nenhum prazo cumprido ou perdido no histórico ainda.</p>
          ) : (
            <ul className={styles.lista} aria-label="Prazos">
              {p.itens.map((i, n) => (
                <li key={`${i.quando}-${n}`}>
                  {momento(i.quando)} · {i.cliente ?? 'sem caso'} · {i.descricao}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}

/** Uso do cofre do gov.br por pessoa (GGVP-103 CA6), sem o valor. Só a gestão vê. */
export function UsoDoCofreTela() {
  const [u, setU] = useState<UsoDoCofre | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    void chamarApi<UsoDoCofre>('/gestao/cofre').then((r) => (r.ok ? setU(r.dados) : setErro(r.erro)))
  }, [])
  return (
    <main className={styles.pagina}>
      <title>Uso do cofre · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Uso do cofre do gov.br</h1>
      <p className={styles.subtitulo}>Quem leu, cadastrou ou trocou a senha, e as recusas. A senha nunca aparece aqui.</p>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {u && u.pessoas.length === 0 && <p className={styles.dica}>Ninguém usou o cofre ainda.</p>}
      {u && u.pessoas.length > 0 && (
        <ul className={styles.lista} aria-label="Uso do cofre por pessoa">
          {u.pessoas.map((p) => (
            <li key={p.quem}>
              {p.quem} · leituras {p.leituras} · cadastros e trocas {p.cadastros} · recusas {p.recusas}
              {p.ultimoUso ? ` · último uso ${momento(p.ultimoUso)}` : ''}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
