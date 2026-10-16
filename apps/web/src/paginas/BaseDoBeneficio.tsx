import { useEffect, useState } from 'react'
import { isoParaData } from '@ggv/campos'
import { BENEFICIOS, ROTULO_BENEFICIO, type BaseHistoricaDoBeneficio as Pagina } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { textoDoIndicador } from '../regras/baseHistorica.ts'
import { MolduraDaBase } from './Base.tsx'
import g from './Gestao.module.css'
import styles from './Passo.module.css'

/** O Markdown da síntese, simples: títulos, listas e negrito; sem dependência nova. */
function Sintese({ texto }: { texto: string }) {
  const negrito = (linha: string) => linha.split(/\*\*/).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : parte))
  const blocos: { tipo: 'p' | 'li' | 'h'; texto: string }[] = []
  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim()
    if (!linha) continue
    if (/^#+\s/.test(linha)) blocos.push({ tipo: 'h', texto: linha.replace(/^#+\s/, '') })
    else if (/^[-*]\s/.test(linha)) blocos.push({ tipo: 'li', texto: linha.replace(/^[-*]\s/, '') })
    else blocos.push({ tipo: 'p', texto: linha })
  }
  const saida: React.ReactNode[] = []
  let itens: React.ReactNode[] = []
  const fechar = () => {
    if (itens.length) saida.push(<ul key={`l${saida.length}`}>{itens}</ul>)
    itens = []
  }
  blocos.forEach((b, i) => {
    if (b.tipo === 'li') itens.push(<li key={i}>{negrito(b.texto)}</li>)
    else {
      fechar()
      saida.push(b.tipo === 'h' ? <h4 key={i}>{negrito(b.texto)}</h4> : <p key={i}>{negrito(b.texto)}</p>)
    }
  })
  fechar()
  return <>{saida}</>
}

/**
 * A base histórica (GGVP-163 R5): sem benefício, a lista; com ele, a síntese e as taxas de `conhecimento.portal_*`, com o
 * número de casos e a data da base (G22). Só o Jurídico e o Sócio (`estudo.ver`); o servidor confere de novo.
 */
export function BaseDoBeneficio({ beneficio }: { beneficio?: string }) {
  // A resposta guarda de qual benefício é: trocar de benefício mostra a página vazia até a resposta nova chegar.
  const [resposta, setResposta] = useState<{ beneficio: string; pagina: Pagina | null; erro: string } | null>(null)
  const atual = resposta && resposta.beneficio === beneficio ? resposta : null
  const pagina = atual?.pagina ?? null
  const erro = atual?.erro ?? ''

  useEffect(() => {
    if (!beneficio) return
    void chamarApi<Pagina>(`/base-historica/${encodeURIComponent(beneficio)}`).then((r) =>
      setResposta(r.ok ? { beneficio, pagina: r.dados, erro: '' } : { beneficio, pagina: null, erro: r.erro }),
    )
  }, [beneficio])

  if (!beneficio)
    return (
      <MolduraDaBase ativo="estudos" titulo="Base histórica" subtitulo="O que os processos já decididos do escritório ensinam sobre cada benefício. Estratégia interna: não vai ao cliente.">
        <div className={g.estreito}>
          <ul className={styles.lista} aria-label="Benefícios">
            {BENEFICIOS.filter((b) => b !== 'outro').map((b) => (
              <li key={b}>
                <a href={`/beneficios/${b}`}>{ROTULO_BENEFICIO[b]}</a>
              </li>
            ))}
          </ul>
        </div>
      </MolduraDaBase>
    )

  const nome = pagina?.nome ?? ROTULO_BENEFICIO[beneficio as keyof typeof ROTULO_BENEFICIO] ?? beneficio
  return (
    <MolduraDaBase ativo="estudos" titulo={`Base histórica · ${nome}`} subtitulo="Números contados pelo sistema a partir da base histórica, sempre com o número de casos e a data da base.">
      <div className={g.estreito}>
        <p className={styles.dica}>
          <a href="/beneficios">‹ Todos os benefícios</a>
        </p>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        {pagina && !pagina.dataDaBase && <p className={g.vazio}>Sem base histórica carregada: nada a mostrar ainda.</p>}
        {pagina?.dataDaBase && (
          <>
            <p className={styles.dica}>Base de {isoParaData(pagina.dataDaBase) ?? pagina.dataDaBase}.</p>
            <section className={styles.cartao} aria-label="Taxas da base histórica">
              <h2 className={styles.cartaoTitulo}>Taxas</h2>
              {pagina.indicadores.length === 0 && <p className={styles.dica}>Nenhuma taxa para este benefício na base.</p>}
              <dl className={styles.numeros}>
                {pagina.indicadores.map((i) => (
                  <div key={`${i.recorte}|${i.chave}|${i.indicador}`} className={styles.par}>
                    <dt>{i.nome}</dt>
                    <dd>{textoDoIndicador(i, pagina.dataDaBase)}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className={styles.cartao} aria-label="Síntese da base histórica">
              <h2 className={styles.cartaoTitulo}>Síntese</h2>
              {pagina.sintese.length === 0 && <p className={styles.dica}>Sem síntese para este benefício na base.</p>}
              {pagina.sintese.map((s) => (
                <article key={s.ordem} aria-label={`Síntese ${s.ordem}`}>
                  <Sintese texto={s.texto} />
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </MolduraDaBase>
  )
}
