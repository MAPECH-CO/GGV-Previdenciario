import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { formatarCnj, isoParaData, somenteDigitos } from '@ggv/campos'
import {
  CLASSES_DE_ATO,
  ClassificarPublicacao,
  PRAZO_DOS_QUESITOS,
  PRAZO_SEM_DIAS_NA_DECISAO,
  TAMANHO_DA_VARA,
  ROTULO_CLASSE,
  type PublicacaoParaLer,
  type SugestaoDePublicacao,
} from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

type Classe = (typeof CLASSES_DE_ATO)[number]
const dia = (iso: string) => isoParaData(iso) ?? iso
const DESTINO: Record<Classe, string> = {
  andamento: 'Registrada no processo, sem tarefa.',
  exigencia: 'Aberta a tarefa "Analisar exigência do juiz", com o prazo.',
  merito: 'Aberta a tarefa "Confirmar desfecho", com o prazo do recurso.',
  nomeacao_perito: 'Aberta a tarefa "Quesitos e assistente técnico" na Central da advogada, com o prazo.',
}

/**
 * Ler a publicação (GGVP-74, GGVP-34): a pessoa confirma ou corrige o tipo de ato; o sistema conta o prazo em código,
 * pelo lado seguro (G12), e encaminha (GGVP-37). A IA (épico GGVP-14) só sugere o tipo, os dias e um resumo; quem
 * classifica é a pessoa.
 */
export function LerPublicacao({ publicacaoId }: { publicacaoId: string }) {
  const ids = { dias: useId(), sem: useId(), vara: useId(), juiz: useId() }
  const [p, setP] = useState<PublicacaoParaLer | null>(null)
  const [versao, setVersao] = useState(0)
  const [classe, setClasse] = useState<Classe | null>(null)
  const [dias, setDias] = useState('')
  const [semPrazo, setSemPrazo] = useState(false)
  // GGVP-64 parte 2 (CA1): a vara e o juiz, como estão escritos; a IA sugere, a pessoa confere.
  const [vara, setVara] = useState('')
  const [juiz, setJuiz] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const [ia, setIa] = useState<SugestaoDePublicacao | null>(null)

  useEffect(() => {
    void chamarApi<PublicacaoParaLer>(`/publicacoes/${publicacaoId}`).then((r) => {
      if (!r.ok) return setErro(r.erro)
      setP(r.dados)
      setClasse((atual) => atual ?? r.dados.classe)
    })
  }, [publicacaoId, versao])

  async function classificar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const corpo = { classe: classe ?? undefined, dias, semPrazoNaDecisao: semPrazo, vara, juiz }
    const entrada = ClassificarPublicacao.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/publicacoes/${publicacaoId}/classificacao`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(`${ROTULO_CLASSE[entrada.data.classe]}. ${DESTINO[entrada.data.classe]}`)
    setVersao((v) => v + 1)
  }

  // Épico IA e sugestão pronta (07/10): a publicação ainda sem classe abre com a leitura da IA (preparada em segundo
  // plano), que preenche o tipo e os dias se a pessoa ainda não escolheu; quem classifica é ela.
  useEffect(() => {
    if (!p?.podeClassificar || p.classe) return
    void chamarApi<SugestaoDePublicacao>(`/publicacoes/${publicacaoId}/sugestao`, { method: 'POST', corpo: {} }).then((r) => {
      if (!r.ok) return setIa({ sugestao: null, motivo: r.erro })
      setIa(r.dados)
      const s = r.dados.sugestao
      if (!s) return
      setClasse((c) => c ?? s.classe)
      setDias((d) => d || (s.dias === null ? '' : String(s.dias)))
      setSemPrazo((x) => x || (s.classe !== 'andamento' && s.dias === null))
      setVara((v) => v || (s.vara ?? ''))
      setJuiz((j) => j || (s.juiz ?? ''))
    })
  }, [publicacaoId, p?.podeClassificar, p?.classe])

  if (!p)
    return (
      <main className={styles.pagina}>
        <title>Ler publicação · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Ler publicação · GGV Previdenciário</title>
      <a className={styles.voltar} href={p.casoId ? `/casos/${p.casoId}/publicacoes` : '/'}>
        ← Publicações do processo
      </a>
      <h1 className={styles.titulo}>Ler publicação</h1>
      <p className={styles.subtitulo}>
        {p.cliente} · {p.numeroCnj ? formatarCnj(p.numeroCnj) : 'sem número'} · {dia(p.disponibilizadaEm)} · {p.fonte.toUpperCase()}
      </p>

      <section className={styles.cartao} aria-label="Texto da publicação">
        <p style={{ whiteSpace: 'pre-wrap' }}>{p.texto}</p>
      </section>

      {p.classe && (
        <section className={styles.cartao} aria-label="Classificação">
          <span className={styles.selo}>
            {ROTULO_CLASSE[p.classe]} · por {p.classificadaPor}
          </span>
          {p.prazo && (
            <p>
              Prazo: de {dia(p.prazo.inicio)} até <strong>{dia(p.prazo.fim)}</strong>
            </p>
          )}
          {p.prazo && (
            <p className={styles.dica}>
              Contado pelo sistema, pelo lado seguro (G12): {p.prazo.regra} · regra versão {p.prazo.versao}.
            </p>
          )}
        </section>
      )}
      {!p.feriadosCadastrados && <p className={styles.dica}>Feriados do tribunal não cadastrados: por enquanto o prazo só pula sábado e domingo.</p>}

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {p.podeClassificar && !p.classe && (
        <section className={styles.cartao} aria-label="Sugestão da IA">
          <h2 className={styles.cartaoTitulo}>Sugestão da IA</h2>
          {!ia && <p className={styles.dica}>A IA está lendo…</p>}
          {ia?.motivo && <p className={styles.dica}>{ia.motivo}</p>}
          {ia?.sugestao && (
            <>
              <span className={`${styles.selo} ${styles.seloAlerta}`}>Sugestão da IA · confira antes de usar</span>
              {ia.sugestao.alerta && (
                <p className={styles.erroCampo} role="alert">
                  Atenção: {ia.sugestao.alerta}. Leia o texto original antes de decidir.
                </p>
              )}
              <p>
                {ROTULO_CLASSE[ia.sugestao.classe]}
                {ia.sugestao.dias !== null ? ` · prazo de ${ia.sugestao.dias} dias escrito na decisão` : ''}
              </p>
              <p className={styles.dica}>Resumo: {ia.sugestao.resumo}</p>
              <p className={styles.dica}>
                O formulário abaixo já veio com a sugestão: confira e classifique. A data final do prazo é contada pelo sistema; a IA só lê os dias
                escritos ({ia.sugestao.modelo}).
              </p>
            </>
          )}
        </section>
      )}

      {p.podeClassificar && (
        <form className={styles.cartao} onSubmit={classificar} noValidate>
          <h2 className={styles.cartaoTitulo}>{p.classe ? 'A classificação está certa?' : 'O que é esta publicação?'}</h2>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Tipo de ato</legend>
            {CLASSES_DE_ATO.map((c) => (
              <label key={c} className={styles.escolha}>
                <input type="radio" name="classe" checked={classe === c} onChange={() => setClasse(c)} />
                {ROTULO_CLASSE[c]}
              </label>
            ))}
          </fieldset>
          {classe && classe !== 'andamento' && (
            <>
              <label className={styles.rotulo} htmlFor={ids.dias}>
                Prazo da publicação (dias)
              </label>
              <input id={ids.dias} className={styles.campo} inputMode="numeric" value={dias} disabled={semPrazo} onChange={(e) => setDias(somenteDigitos(e.target.value))} />
              <label className={styles.escolha} htmlFor={ids.sem}>
                <input id={ids.sem} type="checkbox" checked={semPrazo} onChange={(e) => setSemPrazo(e.target.checked)} />
                Sem prazo na decisão ({classe === 'nomeacao_perito' ? PRAZO_DOS_QUESITOS : PRAZO_SEM_DIAS_NA_DECISAO} dias)
              </label>
            </>
          )}
          <label className={styles.rotulo} htmlFor={ids.vara}>
            Vara
          </label>
          <input id={ids.vara} className={styles.campo} value={vara} maxLength={TAMANHO_DA_VARA} onChange={(e) => setVara(e.target.value)} />
          <label className={styles.rotulo} htmlFor={ids.juiz}>
            Juiz
          </label>
          <input id={ids.juiz} className={styles.campo} value={juiz} maxLength={TAMANHO_DA_VARA} onChange={(e) => setJuiz(e.target.value)} />
          <p className={styles.dica}>Vara e juiz como estão escritos na publicação. Em branco, o processo fica com o que já tinha.</p>
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!classe}>
              {p.classe ? 'Reclassificar' : 'Classificar'}
            </button>
          </div>
          <p className={styles.dica}>Quem classifica é você; o sistema só conta o prazo e abre a tarefa.</p>
        </form>
      )}
    </main>
  )
}
