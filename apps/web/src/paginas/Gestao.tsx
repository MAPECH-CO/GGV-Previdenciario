import { useEffect, useState } from 'react'
import type { PrazosDoEscritorio, UsoDoCofre } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { MolduraDaBase } from './Base.tsx'
import { Indicador } from './Financeiro.tsx'
import bases from './Bases.module.css'
import painel from './Financeiro.module.css'
import g from './Gestao.module.css'

const momento = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const soma = (u: UsoDoCofre, campo: 'leituras' | 'cadastros' | 'recusas') => u.pessoas.reduce((t, p) => t + p[campo], 0)
const Sep = () => <span className={g.sep}> · </span>

/** O placar dos prazos: os dois números, a barra repartida e quanto foi cumprido. */
function Placar({ cumpridos, perdidos }: { cumpridos: number; perdidos: number }) {
  const total = cumpridos + perdidos
  return (
    <section className={g.placar} aria-label="Placar dos prazos">
      <p className={g.placarNumero} data-tom="ok">
        <strong>{cumpridos}</strong> {cumpridos === 1 ? 'cumprido' : 'cumpridos'}
      </p>
      <div className={g.placarBarra} aria-hidden="true">
        <span data-tom="ok" style={{ flexGrow: cumpridos }} />
        <span data-tom="erro" style={{ flexGrow: perdidos }} />
      </div>
      <p className={g.placarNumero} data-tom="erro">
        <strong>{perdidos}</strong> {perdidos === 1 ? 'perdido' : 'perdidos'}
      </p>
      <p className={g.placarTaxa}>{Math.round((cumpridos / total) * 100)}% dos prazos do histórico foram cumpridos</p>
    </section>
  )
}

/** As iniciais de quem usou o cofre, desenhadas pelo CSS (data-iniciais): ficam fora do texto lido da linha. */
const iniciais = (nome: string) =>
  nome
    .replace(/\(.*?\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i, todos) => (i === 0 || i === todos.length - 1 ? p[0] : ''))
    .join('')
    .slice(0, 2)
    .toUpperCase()

/** Prazos cumpridos e perdidos (GGVP-99 CA14), tirados do histórico. Só a gestão vê. */
export function Prazos() {
  const [p, setP] = useState<PrazosDoEscritorio | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    void chamarApi<PrazosDoEscritorio>('/gestao/prazos').then((r) => (r.ok ? setP(r.dados) : setErro(r.erro)))
  }, [])
  return (
    <MolduraDaBase ativo="prazos" titulo="Prazos cumpridos e perdidos" subtitulo={p ? `Cumpridos: ${p.cumpridos} · Perdidos: ${p.perdidos}` : ''}>
      {erro && (
        <p className={bases.erro} role="alert">
          {erro}
        </p>
      )}
      {p && p.cumpridos + p.perdidos > 0 && <Placar cumpridos={p.cumpridos} perdidos={p.perdidos} />}
      {p &&
        (p.itens.length === 0 ? (
          <p className={g.vazio}>Nenhum prazo cumprido ou perdido no histórico ainda.</p>
        ) : (
          <div className={`${g.registros} ${g.prazos}`}>
            <div className={g.colunas} aria-hidden="true">
              <span>Quando</span>
              <span>Situação</span>
              <span>Cliente</span>
              <span>Prazo</span>
            </div>
            <ul aria-label="Prazos">
              {p.itens.map((i, n) => (
                <li key={`${i.quando}-${n}`} className={g.registro}>
                  <span className={g.quando}>{momento(i.quando)}</span>
                  <Sep />
                  <span className={`${g.etiqueta} ${g[i.situacao]}`}>{i.situacao === 'cumprido' ? 'Cumprido' : 'Perdido'}</span>
                  <Sep />
                  <span className={i.cliente ? g.forte : g.suave}>{i.cliente ?? 'sem caso'}</span>
                  <Sep />
                  <span>{i.descricao}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </MolduraDaBase>
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
    <MolduraDaBase ativo="cofre" titulo="Uso do cofre do gov.br" subtitulo="Quem leu, cadastrou ou trocou a senha, e as recusas. A senha nunca aparece aqui.">
      {erro && (
        <p className={bases.erro} role="alert">
          {erro}
        </p>
      )}
      {u && u.pessoas.length === 0 && <p className={g.vazio}>Ninguém usou o cofre ainda.</p>}
      {u && u.pessoas.length > 0 && (
        <>
          <ul className={painel.cartoes} aria-label="Totais">
            <Indicador rotulo="Leituras" valor={String(soma(u, 'leituras'))} nota={`de ${u.pessoas.length} ${u.pessoas.length === 1 ? 'pessoa' : 'pessoas'}`} />
            <Indicador rotulo="Cadastros e trocas" valor={String(soma(u, 'cadastros'))} nota="senhas guardadas ou trocadas" />
            <Indicador rotulo="Recusas" valor={String(soma(u, 'recusas'))} nota="acessos negados" tom={soma(u, 'recusas') ? 'alerta' : undefined} />
          </ul>
          <div className={`${g.registros} ${g.cofre}`}>
            <ul aria-label="Uso do cofre por pessoa">
              {u.pessoas.map((p) => (
                <li key={p.quem} className={g.registro}>
                  <span className={g.pessoa}>
                    <span className={g.iniciais} data-iniciais={iniciais(p.quem)} aria-hidden="true" />
                    <span className={g.forte}>{p.quem}</span>
                  </span>
                  <Sep />
                  <Metrica rotulo="leituras" valor={p.leituras} />
                  <Sep />
                  <Metrica rotulo="cadastros e trocas" valor={p.cadastros} />
                  <Sep />
                  <Metrica rotulo="recusas" valor={p.recusas} alerta={p.recusas > 0} />
                  {p.ultimoUso && (
                    <>
                      <Sep />
                      <span className={g.metrica}>
                        <span className={g.suave}>último uso</span> <span className={g.quando}>{momento(p.ultimoUso)}</span>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </MolduraDaBase>
  )
}

/** "leituras 2": o número em destaque e o nome dele embaixo; quem lê a linha ouve na ordem de antes. */
function Metrica({ rotulo, valor, alerta = false }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <span className={`${g.metrica} ${g.metricaNumero}`}>
      <span className={g.suave}>{rotulo}</span> <strong className={alerta ? g.alerta : undefined}>{valor}</strong>
    </span>
  )
}
