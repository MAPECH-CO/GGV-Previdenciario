import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { AprovarRecomendacao, type PericiasDoCaso, type RecomendacaoDaPericia } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { ChanceDoCaso } from '../componentes/ChanceDoCaso.tsx'
import styles from './Passo.module.css'

type Pericia = PericiasDoCaso['pericias'][number]
const NOME = { medica: 'Perícia médica', social: 'Avaliação social' } as const
const RESULTADO: Record<string, string> = { favoravel: 'favorável', desfavoravel: 'desfavorável' }
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const linhas = (texto: string) =>
  texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** A recomendação de uma perícia (GGVP-38): chega pronta (sugestão pronta, 07/10), entra no formulário, a advogada aprova. */
function Recomendacao({ p, podeAprovar, aoAprovar }: { p: Pericia; podeAprovar: boolean; aoAprovar: (aviso: string) => void }) {
  const ids = { levar: useId(), quesitos: useId() }
  const [ia, setIa] = useState<RecomendacaoDaPericia | null>(null)
  const [oQueLevar, setOQueLevar] = useState('')
  const [quesitos, setQuesitos] = useState('')
  const [assistente, setAssistente] = useState<boolean | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    void chamarApi<RecomendacaoDaPericia>(`/pericias/${p.id}/recomendacao/sugestao`, { method: 'POST' }).then((r) => {
      if (!r.ok) return setIa({ sugestao: null, recomendacao: null, motivo: r.erro })
      setIa(r.dados)
      const rec = r.dados.recomendacao
      if (!rec) return
      setOQueLevar((t) => t || rec.oQueLevar.join('\n'))
      setQuesitos((t) => t || rec.quesitos.join('\n'))
      setAssistente((a) => a ?? rec.assistenteTecnico?.indicar ?? null)
    })
  }, [p.id])

  async function aprovar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const chamadaIaId = ia?.sugestao?.chamadaId
    const corpo = { oQueLevar: linhas(oQueLevar), quesitos: p.judicial ? linhas(quesitos) : [], assistenteTecnico: p.judicial ? assistente : null, ...(chamadaIaId && { chamadaIaId }) }
    const entrada = AprovarRecomendacao.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a recomendação.')
    const r = await chamarApi(`/pericias/${p.id}/recomendacao`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    aoAprovar(`Recomendação aprovada: ${NOME[p.tipo].toLowerCase()}.`)
  }

  const rec = ia?.recomendacao
  return (
    <form className={styles.cartao} onSubmit={aprovar} noValidate aria-label={`Recomendação: ${NOME[p.tipo]}`}>
      {!ia && <p className={styles.dica}>A IA está preparando a recomendação…</p>}
      {ia?.motivo && <p className={styles.dica}>{ia.motivo}</p>}
      {rec && (
        <>
          <span className={`${styles.selo} ${styles.seloAlerta}`}>Recomendação da IA · confira, mude o que quiser e aprove</span>
          {ia?.sugestao?.alerta && (
            <p className={styles.erroCampo} role="alert">
              Atenção: {ia.sugestao.alerta}.
            </p>
          )}
          {rec.pontosFortes.length > 0 && <p>Pontos fortes: {rec.pontosFortes.join(' · ')}</p>}
          {rec.pontosFracos.length > 0 && <p>Pontos fracos: {rec.pontosFracos.join(' · ')}</p>}
        </>
      )}
      <label className={styles.rotulo} htmlFor={ids.levar}>
        O que levar (um por linha)
      </label>
      <textarea id={ids.levar} className={styles.campo} rows={5} value={oQueLevar} readOnly={!podeAprovar} onChange={(e) => setOQueLevar(e.target.value)} />
      <p className={styles.dica}>Vai para a orientação do cliente: sem CID nem diagnóstico.</p>
      {p.judicial && (
        <>
          <label className={styles.rotulo} htmlFor={ids.quesitos}>
            Quesitos ao perito (um por linha; apague o que não quiser)
          </label>
          <textarea id={ids.quesitos} className={styles.campo} rows={5} value={quesitos} readOnly={!podeAprovar} onChange={(e) => setQuesitos(e.target.value)} />
          <fieldset className={styles.cartao} disabled={!podeAprovar}>
            <legend className={styles.rotulo}>Indicar assistente técnico?</legend>
            <label className={styles.escolha}>
              <input type="radio" checked={assistente === true} onChange={() => setAssistente(true)} />
              Sim
            </label>
            <label className={styles.escolha}>
              <input type="radio" checked={assistente === false} onChange={() => setAssistente(false)} />
              Não
            </label>
            {rec?.assistenteTecnico && <p className={styles.dica}>A IA: {rec.assistenteTecnico.porque}</p>}
          </fieldset>
        </>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {podeAprovar && (
        <div className={styles.acoes}>
          <button type="submit" className={styles.botao}>
            Aprovar a recomendação
          </button>
        </div>
      )}
      <p className={styles.dica}>Quem aprova é a advogada; a IA não marca nada. A marcação continua com o Jurídico administrativo.</p>
    </form>
  )
}

/**
 * Perícias do caso (GGVP-38): para cada perícia pedida, a recomendação da IA antes de marcar (o que levar, pontos fortes
 * e fracos; na do juiz, quesitos e assistente técnico). A advogada aprova; o Jurídico vê a aprovada para orientar.
 */
export function Pericias({ casoId }: { casoId: string }) {
  const [x, setX] = useState<PericiasDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<PericiasDoCaso>(`/casos/${casoId}/pericias`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  return (
    <main className={styles.pagina}>
      <title>Perícias do caso · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Perícias do caso</h1>
      {x && <p className={styles.subtitulo}>{x.cliente}</p>}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {x && x.pericias.length === 0 && <p className={styles.dica}>Nenhuma perícia pedida neste caso.</p>}
      {/* GGVP-151 CA2: com a recomendação aberta (perícia ainda sem resultado), a chance do caso, antes de marcar. */}
      {x?.pericias.some((p) => !p.resultado) && <ChanceDoCaso casoId={casoId} />}
      {x?.pericias.map((p) => (
        <section key={p.id} className={styles.cartao} aria-label={`${NOME[p.tipo]} · ${p.origem}`}>
          <h2 className={styles.cartaoTitulo}>
            {NOME[p.tipo]} · {p.origem}
          </h2>
          {p.resultado ? (
            <p>Resultado: {RESULTADO[p.resultado] ?? p.resultado}.</p>
          ) : p.aprovada ? (
            <>
              <p className={styles.dica}>
                Recomendação aprovada por {p.aprovada.por} em {dia(p.aprovada.em)}.
              </p>
              <p className={styles.rotulo}>O que levar</p>
              <ul className={styles.lista}>
                {p.aprovada.oQueLevar.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              {p.judicial && p.aprovada.quesitos.length > 0 && (
                <>
                  <p className={styles.rotulo}>Quesitos</p>
                  <ol className={styles.lista}>
                    {p.aprovada.quesitos.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ol>
                </>
              )}
              {p.judicial && p.aprovada.assistenteTecnico !== null && <p>Assistente técnico: {p.aprovada.assistenteTecnico ? 'indicar' : 'não indicar'}.</p>}
            </>
          ) : (
            <Recomendacao
              p={p}
              podeAprovar={x.podeAprovar}
              aoAprovar={(aviso) => {
                setFeito(aviso)
                setVersao((v) => v + 1)
              }}
            />
          )}
        </section>
      ))}
    </main>
  )
}
