import { useEffect, useRef, useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { TopoPasso } from '../componentes/TopoPasso.tsx'
import { obterPreparacao } from '../dados/preparacao.ts'
import { registrarAnalise } from '../dados/segundaFicha.ts'
import { agora } from '../dados/servidor.ts'
import type { Preparacao, TarefaEncaminhada } from '../dados/tipos.ts'
import { dataHora, hojeIso, hora } from '../regras/datas.ts'
import { situacaoDaSenha } from '../regras/fichaAtendimento.ts'
import styles from './Balcao.module.css'
import proprio from './PrepararEntrevista.module.css'

// Figma: step_D1.07 "Analisar ficha" (14:36). Tela do Jurídico, aberta pela preparação da conversa: a advogada decide se
// pode ser auxílio acidentário. Uma coluna só, sem painel, como no desenho.

export function AnalisarFicha({ agendamentoId }: { agendamentoId: string }) {
  const [dados, setDados] = useState<Preparacao | null | undefined>(undefined)
  const [acidentario, setAcidentario] = useState<boolean | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const [feito, setFeito] = useState<{ quando: string; tarefas: TarefaEncaminhada[] } | null>(null)
  const [erro, setErro] = useState('')
  const travado = useRef(false)
  const hoje = hojeIso(agora())

  useEffect(() => {
    let valendo = true
    obterPreparacao(agendamentoId).then((d) => {
      if (!valendo) return
      setDados(d)
      if (d?.ficha.analise) setAcidentario(d.ficha.analise.acidentario)
    })
    return () => {
      valendo = false
    }
  }, [agendamentoId])

  if (!dados) {
    return (
      <main className={proprio.vazia}>
        <title>Analisar ficha · GGV Previdenciário</title>
        <h1 className={styles.titulo}>{dados === null ? 'Entrevista não encontrada' : 'Abrindo a ficha…'}</h1>
        {dados === null && <a href="/advogada">Voltar ao início</a>}
      </main>
    )
  }

  const { ficha } = dados
  const anterior = ficha.analise

  async function confirmar() {
    if (travado.current || acidentario === null) return
    travado.current = true
    setRegistrando(true)
    setErro('')
    try {
      const { tarefas } = await registrarAnalise(agendamentoId, { acidentario })
      setFeito({ quando: agora().toISOString(), tarefas })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para registrar.')
    } finally {
      travado.current = false
      setRegistrando(false)
    }
  }

  return (
    <>
      <title>{`${ficha.nome} · Analisar ficha · GGV Previdenciário`}</title>
      <TopoPasso contexto="Você · Advogada responsável" inicio="/advogada" />
      <main className={styles.pagina}>
        <div className={styles.principal}>
          <div className={styles.cabecalho}>
            <div className={styles.chips}>
              <span className={styles.codigo} title="D1.07 · Analisar a ficha (passo do BPMN)">
                D1.07
              </span>
              <span className={proprio.advogada}>Advogada</span>
            </div>
            <h1 className={styles.titulo}>
              <strong>{ficha.nome}</strong> · Analisar ficha
            </h1>
            <p className={styles.subtitulo}>acidentário e senha do gov.br</p>
          </div>

          <section className={styles.cartao} aria-labelledby="acidentario">
            <h2 id="acidentario" className={styles.cartaoTitulo}>
              Pode ser auxílio acidentário?
            </h2>
            <div className={styles.opcoes} role="radiogroup" aria-labelledby="acidentario">
              <button type="button" role="radio" className={styles.opcao} aria-checked={acidentario === true} disabled={feito !== null} onClick={() => setAcidentario(true)}>
                Sim — abrir 2ª ficha
              </button>
              <button type="button" role="radio" className={styles.opcao} aria-checked={acidentario === false} disabled={feito !== null} onClick={() => setAcidentario(false)}>
                Não
              </button>
            </div>
            {anterior && !feito && (
              <p className={styles.nota}>
                Decidido antes: {anterior.acidentario ? 'sim' : 'não'}, por {anterior.quem} em {dataHora(anterior.quando)}.
              </p>
            )}
            <p className={proprio.contato}>gov.br: {situacaoDaSenha(ficha.senhaGov, hoje)}</p>
          </section>

          <p className={styles.trava}>A senha do gov.br vai para o cofre, nunca em texto (G9).</p>

          {feito ? (
            <section className={styles.feito} aria-labelledby="analise-registrada">
              <h2 id="analise-registrada" className={styles.feitoTitulo}>
                ✓ Análise registrada às {hora(feito.quando)}
              </h2>
              <p>
                {feito.tarefas.length > 0
                  ? `O Atendimento recebeu: ${feito.tarefas.map((t) => `"${t.acao}" ${t.prazo ?? ''}`.trim()).join('; ')}.`
                  : 'Nada mais a pedir ao Atendimento antes da entrevista.'}
              </p>
              <div className={styles.atalhos}>
                <a className={styles.atalho} href={`/entrevista/${agendamentoId}/preparar`}>
                  Voltar à preparação
                </a>
                <a className={styles.atalho} href="/advogada">
                  Voltar ao início
                </a>
              </div>
            </section>
          ) : (
            <div className={styles.rodape}>
              <button type="button" className={styles.principalBotao} disabled={acidentario === null || registrando} onClick={confirmar}>
                {registrando ? 'registrando…' : 'Confirmar'}
              </button>
              {acidentario === null && <p className={styles.motivo}>Responda se pode ser auxílio acidentário.</p>}
              {erro && (
                <p role="alert" className={styles.motivo}>
                  {erro}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
