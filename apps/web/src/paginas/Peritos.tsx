import { useEffect, useState } from 'react'
import { chamarApi } from '../api.ts'
import { CampoDaBusca, MolduraDaBase } from './Base.tsx'
import styles from './Passo.module.css'
type Perito = { id: string; nome: string; especialidade: string; tipo: 'medica' | 'social' }

/** A main só oferece GET /peritos. Cadastro e edição não são simulados no navegador. */
export function Peritos() {
  const [lista, setLista] = useState<Perito[] | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => {
    let atual = true
    void chamarApi<Perito[]>('/peritos').then(r => {
      if (!atual) return
      if (r.ok) setLista(r.dados)
      else setErro(r.erro)
    }).catch(() => { if (atual) setErro('Não foi possível consultar os peritos agora.') })
    return () => { atual = false }
  }, [])
  const visiveis = lista?.filter(p => (p.nome + ' ' + p.especialidade).toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')))
  return <MolduraDaBase ativo="peritos" titulo="Peritos" subtitulo="Cadastro consultado no servidor. O perfil e a jurimetria ficam no processo em que o perito está ligado.">
    <section className={styles.cartao} aria-label="Cadastro de peritos">
      <p>Cadastro e edição de peritos ainda não disponíveis no servidor.</p>
      <button type="button" className={styles.botao} disabled>Cadastrar perito</button>
      <CampoDaBusca rotulo="Buscar perito por nome ou especialidade" valor={busca} aoMudar={setBusca} />
      {erro && <p role="alert" className={styles.erro}>{erro}</p>}
      {!lista && !erro && <p>Consultando peritos…</p>}
      {visiveis?.length === 0 && <p>Nenhum perito encontrado.</p>}
      <ul className={styles.lista}>{visiveis?.map(p => <li key={p.id}>
        <details><summary>{p.nome}</summary>
          <p>{p.especialidade} · {p.tipo === 'medica' ? 'Perícia médica' : 'Avaliação social'}</p>
          <p>O perfil independente ainda não está disponível. Abra um processo deste perito para consultar os laudos e números retornados pelo servidor.</p>
          <a href="/processos">Buscar um processo</a>
        </details>
      </li>)}</ul>
    </section>
  </MolduraDaBase>
}
