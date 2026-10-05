import { useEffect, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterPreparacao } from '../dados/preparacao.ts'
import { agora } from '../dados/servidor.ts'
import type { Preparacao } from '../dados/tipos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { motivoParaIniciar } from '../regras/preparacao.ts'
import styles from './Balcao.module.css'
import proprio from './PrepararEntrevista.module.css'

// Figma: step_D1.06 "Preparar entrevista" (14:2). Tela do Jurídico: a advogada lê o resumo da IA e confere antes de o
// cliente entrar. A tarefa vem da fila dela (/advogada) ou do compromisso da agenda.

export function PrepararEntrevista({ agendamentoId }: { agendamentoId: string }) {
  const [dados, setDados] = useState<Preparacao | null | undefined>(undefined)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterPreparacao(agendamentoId).then((d) => {
      if (valendo) setDados(d)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Preparar entrevista · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo a preparação…'}</h1>
        {dados === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha, agendamento: a, resumo, pontos, primeiroContato } = dados
  const quando = `${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)} ${a.hora}`
  const motivo = motivoParaIniciar(ficha)
  const fichaLida = ficha.fichaAtendimento ? 'lida' : ficha.fichaAtendimentoPreenchida ? 'em papel, na pasta do cliente' : 'ainda não preenchida'

  return (
    <>
      <title>{`${ficha.nome} · Preparar entrevista · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Advogada responsável" inicio="/advogada" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.06 · Preparar a entrevista (passo do BPMN)">
                D1.06
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Preparar entrevista
            </h1>
            <p className={styles.subtitulo}>entrevista {quando} · ler a ficha</p>
          </div>

          <section className={styles.cartao} aria-labelledby="ia-sugere">
            <h2 id="ia-sugere" className={styles.cartaoTitulo}>
              A IA sugere · você confere
            </h2>
            <p className={styles.trava}>A IA leu a ficha e resumiu o caso. Confira antes de entrevistar.</p>
            <dl className={proprio.linhas}>
              <div className={proprio.linha}>
                <dt>Ficha</dt>
                <dd>{fichaLida}</dd>
              </div>
              <div className={proprio.linha}>
                <dt>Resumo da IA</dt>
                <dd>{resumo}</dd>
              </div>
            </dl>
            <div className={proprio.links}>
              <a className={styles.atalho} href={`/clientes/${ficha.id}/ficha-de-atendimento`}>
                Abrir a ficha completa
              </a>
              <a className={styles.atalho} href={`/clientes/${ficha.id}`}>
                Abrir a ficha do cliente
              </a>
            </div>
            <p className={styles.nota}>O resumo não substitui a leitura da ficha.</p>
          </section>

          <section className={styles.cartao} aria-labelledby="pontos">
            <h2 id="pontos" className={styles.cartaoTitulo}>
              Pontos de atenção
            </h2>
            <ul className={proprio.pontos}>
              {pontos.map((p) => (
                <li key={p.tipo} className={proprio.ponto} data-alerta={p.alerta}>
                  {p.alerta ? '⚠ ' : '• '}
                  {p.texto}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.cartao} aria-labelledby="primeiro-contato">
            <h2 id="primeiro-contato" className={styles.cartaoTitulo}>
              Anotação do Atendimento no primeiro contato
            </h2>
            {primeiroContato ? (
              <p className={proprio.contato}>
                <span className={proprio.contatoQuando}>
                  {dataCurta(primeiroContato.data, hoje)} · {primeiroContato.canal}
                </span>
                <br />
                {primeiroContato.texto}
              </p>
            ) : (
              <p className={proprio.contato}>Nenhuma anotação do primeiro contato.</p>
            )}
          </section>

          <div className={styles.rodape}>
            <a className={styles.atalho} href={`/entrevista/${a.id}/analisar`}>
              Analisar a ficha
            </a>
            {motivo ? (
              <button type="button" className={styles.principalBotao} disabled>
                Iniciar entrevista (Transcrição)
              </button>
            ) : (
              <a className={styles.principalBotao} href={`/entrevista/${a.id}`}>
                Iniciar entrevista (Transcrição)
              </a>
            )}
            {motivo && <p className={styles.motivo}>{motivo}</p>}
          </div>
        </div>

        <aside className={styles.lado} aria-labelledby="antes-de-concluir">
          <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
            Antes de concluir
          </h2>
          <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.06.</p>
          <h3 className={styles.ladoSecao}>Travas e estados</h3>
          <p>Chega aqui quando a cliente já preencheu a ficha (D1.04: «Já preencheu a ficha? Sim»).</p>
          <p>Senha do gov.br no cofre antes da entrevista (G9).</p>
          <h3 className={styles.ladoSecao}>Como segue</h3>
          <p>Depois: D1.07 · Analisar a ficha. Se pode ser auxílio acidentário, a cliente preenche a segunda ficha.</p>
        </aside>
      </main>
      <AbaSuporte />
    </>
  )
}
