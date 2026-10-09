import { useEffect, useId, useState } from 'react'
import { DecisaoDoLaco, HistoricoDoLaco } from '../componentes/Laco.tsx'
import { dataDe, ultimaDoLaco } from '../componentes/rotulosDoLaco.ts'
import type { FormEvent } from 'react'
import { diaLocal, hojeIso, isoParaData } from '@ggv/campos'
import { Despachar as Contrato, ROTULO_SETOR, SETORES_DO_DESPACHO, TIPOS_DE_PERICIA, type AnaliseDoDespacho, type Despacho } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'
import { EncerrarSemJudicializar } from './Vigilia.tsx'

type Setor = (typeof SETORES_DO_DESPACHO)[number]
type TipoPericia = (typeof TIPOS_DE_PERICIA)[number]
type PedidoNaTela = { descricao: string; temPrazo: boolean | null; prazo: string }
const ROTULO_PERICIA = { medica: 'Perícia médica', social: 'Avaliação social' } as const
const ROTULO_ITEM = { pendente: 'aberto', cumprido: 'concluído', nao_cumprido: 'encerrado sem a prova' } as const
const DO_SETOR: Record<Setor, string> = { atendimento: 'o Atendimento', documentacao: 'a Documentação' }
const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')
const dia = (iso: string | null) => (iso ? (isoParaData(diaLocal(iso)) ?? iso) : '—')

/** O pedido a um setor marcado (GGVP-54 CA6): o que obter e "Essa tarefa tem prazo?"; com "Sim", a data de entrega. */
function PedidoDoSetor({ setor, pedido, mudar }: { setor: Setor; pedido: PedidoNaTela; mudar: (p: PedidoNaTela) => void }) {
  const ids = { descricao: useId(), prazo: useId() }
  return (
    <section className={styles.cartao} aria-label={`Pedido para ${ROTULO_SETOR[setor]}`}>
      <label className={styles.rotulo} htmlFor={ids.descricao}>
        O que {DO_SETOR[setor]} deve obter
      </label>
      <input id={ids.descricao} className={styles.campo} value={pedido.descricao} onChange={(e) => mudar({ ...pedido, descricao: e.target.value })} />
      <fieldset className={styles.cartao}>
        <legend className={styles.rotulo}>Essa tarefa tem prazo?</legend>
        <label className={styles.escolha}>
          <input type="radio" checked={pedido.temPrazo === true} onChange={() => mudar({ ...pedido, temPrazo: true })} />
          Sim
        </label>
        <label className={styles.escolha}>
          <input type="radio" checked={pedido.temPrazo === false} onChange={() => mudar({ ...pedido, temPrazo: false, prazo: '' })} />
          Não
        </label>
      </fieldset>
      {pedido.temPrazo && (
        <>
          <label className={styles.rotulo} htmlFor={ids.prazo}>
            Data de entrega
          </label>
          <input id={ids.prazo} className={styles.campo} type="date" min={hojeIso()} value={pedido.prazo} onChange={(e) => mudar({ ...pedido, prazo: e.target.value })} />
        </>
      )}
    </section>
  )
}

/**
 * Despachar caso (GGVP-54): a Sênior vê o histórico do indeferido e decide se falta algo para a petição. Cada setor
 * marcado, uma vez só, recebe "Cumprir pendência" com o que obter (ajuste do Mateus, 06/10); a perícia vai para o
 * Jurídico administrativo; "nada falta" segue para pedir a petição. Quem despacha é a Sênior (G4); a advogada vê só a
 * leitura. O servidor confere de novo.
 */
export function DespacharCaso({ casoId }: { casoId: string }) {
  const [x, setX] = useState<Despacho | null>(null)
  const [versao, setVersao] = useState(0)
  const [decisao, setDecisao] = useState<'nada_falta' | 'acionar' | null>(null)
  const [marcados, setMarcados] = useState<Partial<Record<Setor, PedidoNaTela>>>({})
  const [tipos, setTipos] = useState<TipoPericia[]>([])
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const [analise, setAnalise] = useState<AnaliseDoDespacho | null>(null)

  useEffect(() => {
    void chamarApi<Despacho>(`/casos/${casoId}/despacho`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  const alternar = (s: Setor) =>
    setMarcados((m) => {
      const { [s]: marcado, ...resto } = m
      return marcado ? resto : { ...m, [s]: { descricao: '', temPrazo: null, prazo: '' } }
    })

  // Épico IA (GGVP-54 CA1) e sugestão pronta (07/10): a análise chega sozinha ao abrir (preparada em segundo plano) e
  // preenche o que a Sênior ainda não escolheu (CA4, G4); o prazo continua pergunta dela. Nada é gravado.
  useEffect(() => {
    if (!x?.podeDespachar) return
    void chamarApi<AnaliseDoDespacho>(`/casos/${casoId}/despacho/analise`, { method: 'POST' }).then((r) => {
      if (!r.ok) return setAnalise({ sugestao: null, leitura: null, motivo: r.erro, aviso: null })
      setAnalise(r.dados)
      const l = r.dados.leitura
      if (!l) return
      setDecisao((d) => d ?? (l.nadaFalta ? 'nada_falta' : 'acionar'))
      setMarcados((m) => (Object.keys(m).length ? m : Object.fromEntries(l.itens.map((i) => [i.setor, { descricao: i.descricao, temPrazo: null, prazo: '' }]))))
      setTipos((t) => (t.length ? t : l.pericias))
    })
  }, [casoId, x?.podeDespachar])

  async function despachar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const chamadaIaId = analise?.sugestao?.chamadaId
    const corpo =
      decisao === 'acionar'
        ? {
            decisao,
            itens: SETORES_DO_DESPACHO.flatMap((s) => {
              const p = marcados[s]
              return p ? [{ setor: s, descricao: p.descricao, temPrazo: p.temPrazo ?? undefined, prazo: p.temPrazo ? (isoParaData(p.prazo) ?? '') : undefined }] : []
            }),
            tiposPericia: tipos,
            ...(chamadaIaId && { chamadaIaId }),
          }
        : { decisao: decisao ?? undefined, ...(chamadaIaId && { chamadaIaId }) }
    const entrada = Contrato.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o despacho.')
    const r = await chamarApi(`/casos/${casoId}/despacho`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(decisao === 'nada_falta' ? 'Despacho registrado. "Pedir a petição" foi para a fila das advogadas.' : 'Despacho registrado. Cada setor recebeu "Cumprir pendência".')
    setVersao((v) => v + 1)
  }

  if (!x)
    return (
      <main className={styles.pagina}>
        <title>Despachar caso · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const ind = x.indeferimento
  return (
    <main className={styles.pagina}>
      <title>Despachar caso · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Despachar caso</h1>
      <p className={styles.subtitulo}>
        {x.cliente} · {rotuloBeneficio(x.beneficio)}
      </p>

      <section className={styles.cartao} aria-label="Histórico do caso">
        <h2 className={styles.cartaoTitulo}>Indeferido pelo INSS em {dia(ind.dataDecisao)}</h2>
        <p>Motivo no sistema do INSS: {ind.motivoInss ?? 'não informado'}</p>
        {ind.carta && (
          <a href={`/api/casos/${casoId}/documentos/${ind.carta.id}`} target="_blank" rel="noreferrer">
            Abrir a carta de indeferimento ({ind.carta.nome})
          </a>
        )}
        {ind.motivoEscrito && (
          <p>
            Motivo com as palavras de quem viu: {ind.motivoEscrito.texto} ({ind.motivoEscrito.por} em {dia(ind.motivoEscrito.em)})
          </p>
        )}
      </section>

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {x.despacho ? (
        <section className={styles.cartao} aria-label="Despacho">
          <h2 className={styles.cartaoTitulo}>
            Despachado por {x.despacho.por} em {dia(x.despacho.em)}: {x.despacho.decisao === 'nada_falta' ? 'nada falta' : 'setores acionados'}
          </h2>
          {(x.setores.length > 0 || x.pericias.length > 0) && (
            <>
              {x.faltam.length > 0 ? <p className={styles.dica}>Falta: {x.faltam.join(', ')}.</p> : <p className={styles.dica}>Todos os setores subiram o card.</p>}
              <ul className={styles.lista} aria-label="Setores acionados">
                {x.setores.map((s) => (
                  <li key={s.id}>
                    {ROTULO_SETOR[s.setor]} · {s.descricao} · {s.prazo ? `até ${dia(s.prazo)}` : 'sem prazo'} · {ROTULO_ITEM[s.situacao]}
                    {s.acionadoEm ? ` · acionado em ${dataDe(s.acionadoEm)}` : ''}
                    {s.situacao === 'pendente' ? ` · ${ultimaDoLaco(s.historicoDoLaco)}` : ''}
                    {s.escalada ? ' · com a Sênior' : ''}
                    {s.podeDecidir && (
                      <div className={styles.cartao} aria-label={`Laço de ${ROTULO_SETOR[s.setor]}`}>
                        <HistoricoDoLaco historico={s.historicoDoLaco} />
                        <DecisaoDoLaco
                          url={`/casos/${casoId}/pendencias/itens/${s.id}/decisao`}
                          aoDecidir={(aviso) => {
                            setFeito(aviso)
                            setVersao((v) => v + 1)
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
                {x.pericias.map((p) => (
                  <li key={p.tipo}>
                    Jurídico administrativo · marcar a {ROTULO_PERICIA[p.tipo].toLowerCase()} · {p.resultado ? `resultado: ${p.resultado}` : 'aguardando o resultado'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        !x.podeDespachar && <p className={styles.dica}>Esperando o despacho da Sênior.</p>
      )}

      {x.podeDespachar && (
        <section className={styles.cartao} aria-label="Análise da IA">
          <h2 className={styles.cartaoTitulo}>Análise da IA</h2>
          {!analise && <p className={styles.dica}>A IA está lendo o caso…</p>}
          {analise?.motivo && <p className={styles.dica}>{analise.motivo}</p>}
          {analise?.aviso && <p className={styles.dica}>{analise.aviso}</p>}
          {analise?.sugestao && analise.leitura && (
            <>
              <span className={`${styles.selo} ${styles.seloAlerta}`}>Sugestão da IA · quem despacha é você (G4)</span>
              {analise.sugestao.alerta && (
                <p className={styles.erroCampo} role="alert">
                  Atenção: {analise.sugestao.alerta}.
                </p>
              )}
              <p>{analise.sugestao.texto}</p>
              <p className={styles.dica}>
                Sugere:{' '}
                {analise.leitura.nadaFalta
                  ? 'nada falta.'
                  : [...analise.leitura.itens.map((i) => `${ROTULO_SETOR[i.setor]}: ${i.descricao}`), ...analise.leitura.pericias.map((t) => ROTULO_PERICIA[t])].join(' · ')}
              </p>
              <p className={styles.dica}>
                Fontes: {analise.sugestao.fontes.map((f) => f.trecho ?? f.referencia).join(' · ')} ({analise.sugestao.modelo})
              </p>
              <p className={styles.dica}>O formulário abaixo já veio com a sugestão: confira, responda o prazo e mude o que quiser.</p>
            </>
          )}
        </section>
      )}

      {x.podeDespachar && (
        <form className={styles.cartao} onSubmit={despachar} noValidate>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Falta algo para a petição?</legend>
            <label className={styles.escolha}>
              <input type="radio" name="decisao" checked={decisao === 'nada_falta'} onChange={() => setDecisao('nada_falta')} />
              Não, nada falta
            </label>
            <label className={styles.escolha}>
              <input type="radio" name="decisao" checked={decisao === 'acionar'} onChange={() => setDecisao('acionar')} />
              Sim, falta
            </label>
          </fieldset>
          {decisao === 'acionar' && (
            <fieldset className={styles.cartao}>
              <legend className={styles.rotulo}>O que falta</legend>
              <p className={styles.dica}>Marque cada setor uma vez e escreva tudo o que ele deve obter.</p>
              {SETORES_DO_DESPACHO.map((s) => (
                <div key={s}>
                  <label className={styles.escolha}>
                    <input type="checkbox" checked={Boolean(marcados[s])} onChange={() => alternar(s)} />
                    {ROTULO_SETOR[s]}
                  </label>
                  {marcados[s] && <PedidoDoSetor setor={s} pedido={marcados[s]} mudar={(p) => setMarcados((m) => ({ ...m, [s]: p }))} />}
                </div>
              ))}
              {TIPOS_DE_PERICIA.map((t) => (
                <label key={t} className={styles.escolha}>
                  <input type="checkbox" checked={tipos.includes(t)} onChange={() => setTipos((a) => (a.includes(t) ? a.filter((y) => y !== t) : [...a, t]))} />
                  {ROTULO_PERICIA[t]}
                </label>
              ))}
              <p className={styles.dica}>A perícia vai para o Jurídico administrativo, que marca: a tarefa vai para a Central dele.</p>
            </fieldset>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!decisao}>
              Despachar
            </button>
          </div>
          <p className={styles.dica}>Quem despacha é você; nenhuma tarefa nasce sem a sua confirmação (G4).</p>
        </form>
      )}

      {x.podeEncerrar && (
        <EncerrarSemJudicializar
          casoId={casoId}
          aoEncerrar={() => {
            setFeito('Caso encerrado sem judicializar.')
            setVersao((v) => v + 1)
          }}
        />
      )}
    </main>
  )
}
