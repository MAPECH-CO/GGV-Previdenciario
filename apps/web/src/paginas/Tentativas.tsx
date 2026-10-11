import { useEffect, useState } from 'react'
import { ROTULO_PERFIL, type Perfil, type TentativasBloqueadas } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { MolduraDaBase } from './Base.tsx'
import { Indicador } from './Financeiro.tsx'
import bases from './Bases.module.css'
import painel from './Financeiro.module.css'
import g from './Gestao.module.css'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Quantas vezes cada um aparece, do mais frequente ao menos. */
const contar = (nomes: string[]) =>
  [...nomes.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])

/** Uma contagem em barras curtas: o nome, quantas vezes e a barra do tamanho diante da maior. */
function Contagem({ rotulo, itens }: { rotulo: string; itens: [string, number][] }) {
  const maior = Math.max(1, ...itens.map(([, n]) => n))
  return (
    <ul className={g.contagem} aria-label={rotulo}>
      {itens.map(([nome, n]) => (
        <li key={nome}>
          <span className={g.contagemNome}>{nome}</span>
          <span className={g.contagemNumero}>{plural(n, 'vez', 'vezes')}</span>
          <span className={g.contagemTrilho} aria-hidden="true">
            <span style={{ width: `${(n / maior) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Tentativas bloqueadas (GGVP-109 CA9): quem tentou passar por um portão, em que caso e quando. Só a gestão vê. */
export function Tentativas() {
  const [lista, setLista] = useState<TentativasBloqueadas['tentativas'] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void chamarApi<TentativasBloqueadas>('/gestao/tentativas').then((r) => (r.ok ? setLista(r.dados.tentativas) : setErro(r.erro)))
  }, [])

  const pessoas = new Set(lista?.map((t) => t.quem)).size
  const casos = new Set(lista?.flatMap((t) => (t.casoId ? [t.casoId] : []))).size

  return (
    <MolduraDaBase ativo="tentativas" titulo="Tentativas bloqueadas" subtitulo="Quem tentou passar por um portão sem o que ele exige. O servidor recusou todas.">
      {erro && (
        <p className={bases.erro} role="alert">
          {erro}
        </p>
      )}
      {lista && lista.length === 0 && <p className={g.vazio}>Nenhuma tentativa bloqueada.</p>}
      {lista && lista.length > 0 && (
        <>
          <ul className={painel.cartoes} aria-label="Totais">
            <Indicador rotulo="Tentativas" valor={String(lista.length)} nota="todas recusadas pelo servidor" />
            <Indicador rotulo="Pessoas" valor={String(pessoas)} nota={plural(pessoas, 'pessoa tentou', 'pessoas tentaram')} />
            <Indicador rotulo="Casos" valor={String(casos)} nota={casos ? plural(casos, 'caso envolvido', 'casos envolvidos') : 'nenhuma ligada a um caso'} />
          </ul>
          <div className={g.comLado}>
            <div className={`${g.registros} ${g.tentativas}`}>
              <div className={g.colunas} aria-hidden="true">
                <span>Quando</span>
                <span>Quem</span>
                <span>Caso</span>
                <span>O que tentou</span>
              </div>
              <ul aria-label="Tentativas bloqueadas">
                {lista.map((t, i) => (
                  <li key={`${t.quando}-${i}`} className={g.registro}>
                    <span className={g.quando}>{quando(t.quando)}</span>
                    <span className={g.sep}> · </span>
                    <span>
                      <span className={g.forte}>{t.quem}</span>
                      {t.perfil && <span className={g.suave}>{` (${ROTULO_PERFIL[t.perfil as Perfil] ?? t.perfil})`}</span>}
                    </span>
                    <span className={g.sep}> · </span>
                    <span className={t.cliente ? undefined : g.suave}>{t.cliente ?? 'sem caso'}</span>
                    <span className={g.sep}> · </span>
                    <span>{t.descricao}</span>
                  </li>
                ))}
              </ul>
            </div>
            <aside className={g.lado} aria-label="Resumo das tentativas">
              <section className={painel.cartao}>
                <h2 className={painel.cartaoTitulo}>Quem mais tentou</h2>
                <Contagem rotulo="Por pessoa" itens={contar(lista.map((t) => t.quem))} />
              </section>
              <section className={painel.cartao}>
                <h2 className={painel.cartaoTitulo}>Onde barrou</h2>
                <Contagem rotulo="Por portão" itens={contar(lista.map((t) => (t.portao === 'perfil' ? 'Fora do perfil' : `Portão ${t.portao}`)))} />
              </section>
            </aside>
          </div>
        </>
      )}
    </MolduraDaBase>
  )
}
