import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { hojeIso, isoParaData } from '@ggv/campos'
import { AnalisarExigenciaJuiz as Contrato, ROTULO_SETOR, SETORES_DA_EXIGENCIA, TIPOS_DE_PERICIA, type ExigenciaDoJuiz } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'
import { DecidirVencidaForm } from './TratarExigencia.tsx'

type Setor = (typeof SETORES_DA_EXIGENCIA)[number]
type TipoPericia = (typeof TIPOS_DE_PERICIA)[number]
type ItemNaTela = { chave: number; setor: Setor | ''; descricao: string; provaEsperada: string; prazoInterno: string }
const ROTULO_PERICIA = { medica: 'Perícia médica', social: 'Avaliação social' } as const
const ROTULO_ITEM = { pendente: 'Pendente', cumprido: 'Cumprido', nao_cumprido: 'Não cumprido' } as const
const dia = (iso: string | null) => (iso ? (isoParaData(iso) ?? iso) : '—')

/** Uma linha de item (GGVP-79 CA7, CA13): setor, o que cumprir, prova esperada e prazo interno até o processual. */
function LinhaDoItem({ item, prazoFim, mudar, remover }: { item: ItemNaTela; prazoFim: string; mudar: (i: ItemNaTela) => void; remover: () => void }) {
  const ids = { setor: useId(), descricao: useId(), prova: useId(), prazo: useId() }
  return (
    <li className={styles.cartao}>
      <label className={styles.rotulo} htmlFor={ids.setor}>
        Setor
      </label>
      <select id={ids.setor} className={styles.campo} value={item.setor} onChange={(e) => mudar({ ...item, setor: e.target.value as Setor })}>
        <option value="">Escolha</option>
        {SETORES_DA_EXIGENCIA.map((s) => (
          <option key={s} value={s}>
            {ROTULO_SETOR[s]}
          </option>
        ))}
      </select>
      <label className={styles.rotulo} htmlFor={ids.descricao}>
        O que cumprir
      </label>
      <input id={ids.descricao} className={styles.campo} value={item.descricao} onChange={(e) => mudar({ ...item, descricao: e.target.value })} />
      <label className={styles.rotulo} htmlFor={ids.prova}>
        Documento que comprova (opcional)
      </label>
      <input id={ids.prova} className={styles.campo} value={item.provaEsperada} onChange={(e) => mudar({ ...item, provaEsperada: e.target.value })} />
      <label className={styles.rotulo} htmlFor={ids.prazo}>
        Prazo interno
      </label>
      <input id={ids.prazo} className={styles.campo} type="date" min={hojeIso()} max={prazoFim} value={item.prazoInterno} onChange={(e) => mudar({ ...item, prazoInterno: e.target.value })} />
      <div className={styles.acoes}>
        <button type="button" className={styles.botaoSecundario} onClick={remover}>
          Remover item
        </button>
      </div>
    </li>
  )
}

/**
 * Analisar a exigência do juiz (GGVP-79): a advogada decide "só ciência" ou "precisa cumprir" e monta os itens por
 * setor (G5, G21). A Sênior e os outros perfis do Jurídico veem o status de cada setor (GGVP-83 CA3, CA10).
 */
export function AnalisarExigenciaJuiz({ casoId }: { casoId: string }) {
  const [x, setX] = useState<ExigenciaDoJuiz | null>(null)
  const [versao, setVersao] = useState(0)
  const [decisao, setDecisao] = useState<'ciencia' | 'cumprir' | null>(null)
  const [itens, setItens] = useState<ItemNaTela[]>([])
  const [proxima, setProxima] = useState(1)
  const [tipos, setTipos] = useState<TipoPericia[]>([])
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<ExigenciaDoJuiz>(`/casos/${casoId}/exigencia-juiz`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  const incluir = () => {
    setItens((atual) => [...atual, { chave: proxima, setor: '', descricao: '', provaEsperada: '', prazoInterno: '' }])
    setProxima((n) => n + 1)
  }

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const corpo =
      decisao === 'cumprir'
        ? {
            decisao,
            itens: itens.map((i) => ({ setor: i.setor || undefined, descricao: i.descricao, provaEsperada: i.provaEsperada, prazoInterno: isoParaData(i.prazoInterno) ?? '' })),
            tiposPericia: tipos,
          }
        : { decisao: decisao ?? undefined }
    const entrada = Contrato.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/casos/${casoId}/exigencia-juiz`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(decisao === 'ciencia' ? 'Ciência registrada. O processo segue na vigília.' : 'Tarefas criadas. Cada setor recebeu "Cumprir exigência do juiz".')
    setVersao((v) => v + 1)
  }

  if (!x)
    return (
      <main className={styles.pagina}>
        <title>Exigência do juiz · GGV Previdenciário</title>
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
      </main>
    )

  return (
    <main className={styles.pagina}>
      <title>Exigência do juiz · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Exigência do juiz</h1>
      <p className={styles.subtitulo}>{x.cliente}</p>

      <section className={styles.cartao} aria-label="Publicação">
        <h2 className={styles.cartaoTitulo}>Publicação de {dia(x.disponibilizadaEm)}</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{x.texto}</p>
        <span className={styles.selo}>
          Prazo do processo: {dia(x.prazo.inicio)} a {dia(x.prazo.fim)}
        </span>
        <p className={styles.dica}>
          Contado pelo sistema, pelo lado seguro (G12): {x.prazo.regra} · regra versão {x.prazo.versao}.
        </p>
      </section>

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {(x.itens.length > 0 || x.pericias.length > 0) && (
        <section className={styles.cartao} aria-label="Setores acionados">
          <h2 className={styles.cartaoTitulo}>Setores acionados</h2>
          {x.faltam.length > 0 ? <p className={styles.dica}>Falta: {x.faltam.join(', ')}.</p> : <p className={styles.dica}>Todos os setores subiram a prova.</p>}
          <ul className={styles.lista}>
            {x.itens.map((i) => (
              <li key={i.id}>
                {ROTULO_SETOR[i.setor]} · {i.descricao} · até {dia(i.prazoInterno)} · {ROTULO_ITEM[i.situacao]}
                {i.prova ? ` · ${i.prova}` : ''}
                {i.limite ? ` · tentativas ${i.tentativas} de ${i.limite}` : ''}
                {i.escalada ? ' · com a Sênior' : ''}
              </li>
            ))}
            {/* GGVP-79 CA8: a perícia pedida pelo juiz é marcada pelo Jurídico administrativo, numa tarefa separada. */}
            {x.pericias.map((p) => (
              <li key={p.tipo}>
                Jurídico administrativo · marcar a {ROTULO_PERICIA[p.tipo].toLowerCase()} · {p.resultado ? `resultado: ${p.resultado}` : 'aguardando o resultado'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {x.podeDecidirVencida && (
        <DecidirVencidaForm
          casoId={casoId}
          rota="exigencia-juiz"
          aoDecidir={(texto) => {
            setFeito(texto)
            setVersao((v) => v + 1)
          }}
        />
      )}

      {x.podeDistribuir && (
        <form className={styles.cartao} onSubmit={confirmar} noValidate>
          <h2 className={styles.cartaoTitulo}>O que fazer com a exigência?</h2>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Decisão</legend>
            <label className={styles.escolha}>
              <input type="radio" name="decisao" checked={decisao === 'ciencia'} onChange={() => setDecisao('ciencia')} />
              Só ciência
            </label>
            <label className={styles.escolha}>
              <input
                type="radio"
                name="decisao"
                checked={decisao === 'cumprir'}
                onChange={() => {
                  setDecisao('cumprir')
                  if (itens.length === 0) incluir()
                }}
              />
              Precisa cumprir
            </label>
          </fieldset>
          {decisao === 'cumprir' && (
            <>
              <ul className={styles.lista} aria-label="Itens">
                {itens.map((i) => (
                  <LinhaDoItem
                    key={i.chave}
                    item={i}
                    prazoFim={x.prazo.fim}
                    mudar={(novo) => setItens((atual) => atual.map((a) => (a.chave === i.chave ? novo : a)))}
                    remover={() => setItens((atual) => atual.filter((a) => a.chave !== i.chave))}
                  />
                ))}
              </ul>
              <div className={styles.acoes}>
                <button type="button" className={styles.botaoSecundario} onClick={incluir}>
                  Incluir item
                </button>
              </div>
              <fieldset className={styles.cartao}>
                <legend className={styles.rotulo}>O juiz pediu perícia?</legend>
                <p className={styles.dica}>Quem marca é o Jurídico administrativo: a tarefa vai para a Central dele, separada dos documentos.</p>
                {TIPOS_DE_PERICIA.map((t) => (
                  <label key={t} className={styles.escolha}>
                    <input type="checkbox" checked={tipos.includes(t)} onChange={() => setTipos((a) => (a.includes(t) ? a.filter((y) => y !== t) : [...a, t]))} />
                    {ROTULO_PERICIA[t]}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!decisao}>
              Confirmar
            </button>
          </div>
          <p className={styles.dica}>Quem decide é você; nenhuma tarefa nasce sem a sua confirmação (G5).</p>
        </form>
      )}
    </main>
  )
}
