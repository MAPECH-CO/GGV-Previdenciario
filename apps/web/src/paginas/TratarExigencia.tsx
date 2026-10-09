import { useEffect, useId, useState } from 'react'
import { DecisaoDoLaco, HistoricoDoLaco } from '../componentes/Laco.tsx'
import { ROTULO_RESULTADO_DA_COBRANCA } from '../componentes/rotulosDoLaco.ts'
import type { FormEvent } from 'react'
import { hojeIso, isoParaData, normalizarInteiro, somenteDigitos } from '@ggv/campos'
import { DecidirExigencia, DecidirVencida, ResponderExigencia, TIPOS_DE_PERICIA, type ExigenciaDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { Moldura } from './Moldura.tsx'
import { SenhaDoGov } from './Protocolar.tsx'
import styles from './Passo.module.css'

const ROTULO_PEDE = { documentos: 'Documentos', pericia: 'Perícia', pericia_e_documentos: 'Perícia e documentos' } as const
const ROTULO_PERICIA = { medica: 'Perícia médica', social: 'Avaliação social' } as const
const ROTULO_ITEM = { pendente: 'Pendente', cumprido: 'Cumprido', nao_cumprido: 'Não cumprido' } as const
type Pede = keyof typeof ROTULO_PEDE
type TipoPericia = (typeof TIPOS_DE_PERICIA)[number]
const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')
const br = (iso: string | null) => (iso ? (isoParaData(iso) ?? iso) : '—')

/** A exigência como o INSS mandou, com o prazo contado pelo sistema (CA7, G12). */
export function ResumoDaExigencia({ x }: { x: ExigenciaDoCaso }) {
  return (
    <section className={styles.cartao} aria-label="Exigência do INSS">
      <h2 className={styles.cartaoTitulo}>Exigência de {br(x.data)}</h2>
      <p style={{ whiteSpace: 'pre-wrap' }}>{x.texto}</p>
      {x.prazo ? (
        <span className={x.vencida ? `${styles.selo} ${styles.seloAlerta}` : styles.selo}>
          Prazo do INSS: {br(x.prazo)} ({x.diasInss} dias){x.vencida ? ' · vencido' : ''}
        </span>
      ) : (
        <span className={styles.selo}>Prazo: informe os dias que o INSS deu</span>
      )}
      {x.regraPrazo && <p className={styles.dica}>Contado pelo sistema, pelo lado seguro (G12): {x.regraPrazo}.</p>}
      {!x.feriadosCadastrados && <p className={styles.dica}>Feriados não cadastrados: por enquanto o prazo só pula sábado e domingo.</p>}
    </section>
  )
}

/** CA3, CA4: a advogada responde no portal do INSS com as provas que a Documentação entregou e registra aqui. */
function ResponderNoPortal({ casoId, aoResponder }: { casoId: string; aoResponder: (texto: string) => void }) {
  const ids = { data: useId(), comprovante: useId() }
  const [dataResposta, setDataResposta] = useState(() => hojeIso())
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [erro, setErro] = useState('')

  async function responder(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const data = isoParaData(dataResposta) ?? ''
    const entrada = ResponderExigencia.safeParse({ dataResposta: data })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    if (!comprovante) return setErro('Anexe o comprovante da resposta no portal (PDF ou imagem, até 25 MB).')
    const dados = new FormData()
    dados.set('dataResposta', data)
    dados.set('arquivo', comprovante)
    const r = await chamarApi<{ aberto: string }>(`/casos/${casoId}/exigencia/resposta`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    aoResponder(
      r.dados.aberto === 'pericia'
        ? 'Resposta registrada. A exigência também pede perícia: o Jurídico administrativo recebeu a tarefa.'
        : 'Resposta registrada. O caso voltou para a vigília e espera o INSS analisar.',
    )
  }

  return (
    <form className={styles.cartao} onSubmit={responder} noValidate>
      <h2 className={styles.cartaoTitulo}>Responder no portal do INSS</h2>
      <p className={styles.dica}>A Documentação já entregou o documento de cada item. Responda no portal e registre aqui.</p>
      <label className={styles.rotulo} htmlFor={ids.data}>
        Data da resposta no portal
      </label>
      <input id={ids.data} className={styles.campo} type="date" max={hojeIso()} value={dataResposta} onChange={(e) => setDataResposta(e.target.value)} />
      <label className={styles.rotulo} htmlFor={ids.comprovante}>
        Comprovante da resposta
      </label>
      <input id={ids.comprovante} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao}>
          Registrar a resposta
        </button>
      </div>
    </form>
  )
}

/** A Sênior decide a exigência vencida com item pendente (CA14): pedir dilação ou registrar a perda. */
export function DecidirVencidaForm({ casoId, aoDecidir, rota = 'exigencia' }: { casoId: string; aoDecidir: (texto: string) => void; rota?: string }) {
  const ids = { prazo: useId(), motivo: useId() }
  const [decisao, setDecisao] = useState<'dilacao' | 'perda' | null>(null)
  const [novoPrazo, setNovoPrazo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = DecidirVencida.safeParse(decisao === 'dilacao' ? { decisao, novoPrazo: isoParaData(novoPrazo) ?? '' } : { decisao, motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/casos/${casoId}/${rota}/vencida`, { method: 'POST', corpo: decisao === 'dilacao' ? { decisao, novoPrazo: isoParaData(novoPrazo) } : { decisao, motivo } })
    if (!r.ok) return setErro(r.erro)
    aoDecidir(decisao === 'dilacao' ? 'Dilação registrada com o novo prazo.' : 'Perda registrada no histórico.')
  }

  return (
    <form className={styles.cartao} onSubmit={enviar} noValidate>
      <h2 className={styles.cartaoTitulo}>Prazo vencido com item pendente</h2>
      <fieldset className={styles.cartao}>
        <legend className={styles.rotulo}>O que foi feito</legend>
        <label className={styles.escolha}>
          <input type="radio" name="vencida" checked={decisao === 'dilacao'} onChange={() => setDecisao('dilacao')} />
          Pedi dilação ao INSS
        </label>
        <label className={styles.escolha}>
          <input type="radio" name="vencida" checked={decisao === 'perda'} onChange={() => setDecisao('perda')} />
          Registrar a perda
        </label>
      </fieldset>
      {decisao === 'dilacao' && (
        <>
          <label className={styles.rotulo} htmlFor={ids.prazo}>
            Novo prazo
          </label>
          <input id={ids.prazo} className={styles.campo} type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} />
        </>
      )}
      {decisao === 'perda' && (
        <>
          <label className={styles.rotulo} htmlFor={ids.motivo}>
            O que aconteceu
          </label>
          <textarea id={ids.motivo} className={styles.campo} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao} disabled={!decisao}>
          Registrar
        </button>
      </div>
    </form>
  )
}

/**
 * Tratar exigência do INSS (GGVP-39). A advogada decide o que a exigência pede (G5): documentos (card da Documentação
 * com os itens e o prazo de entrega), perícia (tarefa do Jurídico administrativo) ou os dois (primeiro os documentos).
 */
export function TratarExigencia({ casoId, embutida = false }: { casoId: string; embutida?: boolean }) {
  const ids = { dias: useId(), itens: useId(), entrega: useId() }
  const [x, setX] = useState<ExigenciaDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [pede, setPede] = useState<Pede | null>(null)
  const [dias, setDias] = useState('')
  const [itens, setItens] = useState('')
  const [entrega, setEntrega] = useState('')
  const [tipos, setTipos] = useState<TipoPericia[]>([])
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const diasValidos = normalizarInteiro(dias)

  // A prévia do prazo vem do servidor (?dias=): a conta é uma só, em código.
  useEffect(() => {
    const q = diasValidos && diasValidos >= 1 && diasValidos <= 120 ? `?dias=${diasValidos}` : ''
    void chamarApi<ExigenciaDoCaso>(`/casos/${casoId}/exigencia${q}`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao, diasValidos])

  const comDocumentos = pede === 'documentos' || pede === 'pericia_e_documentos'
  const comPericia = pede === 'pericia' || pede === 'pericia_e_documentos'

  async function decidir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const corpo = {
      pede: pede ?? undefined,
      itens: comDocumentos ? itens.split('\n') : [],
      tiposPericia: comPericia ? tipos : [],
      diasInss: dias,
      prazoEntrega: comDocumentos ? (isoParaData(entrega) ?? undefined) : undefined,
    }
    const entrada = DecidirExigencia.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi(`/casos/${casoId}/exigencia`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(
      pede === 'pericia'
        ? 'Decidido. O sistema abriu a tarefa de perícia para o Jurídico administrativo.'
        : 'Decidido. A Documentação recebeu o card com os itens e o prazo de entrega.',
    )
    setVersao((v) => v + 1)
  }

  if (!x)
    return (
      <Moldura titulo="Tratar exigência do INSS" embutida={embutida}>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </Moldura>
    )

  return (
    <Moldura
      titulo="Tratar exigência do INSS"
      embutida={embutida}
      cabecalho={
        <>
          <a className={styles.voltar} href="/">
            ← Voltar ao início
          </a>
          <h1 className={styles.titulo}>Tratar exigência do INSS</h1>
          <p className={styles.subtitulo}>
            {x.cliente} · {rotuloBeneficio(x.beneficio)}
          </p>
        </>
      }
    >
      <ResumoDaExigencia x={x} />

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {x.podeDecidir ? (
        <form className={styles.cartao} onSubmit={decidir} noValidate>
          <h2 className={styles.cartaoTitulo}>O que a exigência pede?</h2>
          <p className={styles.dica}>Quem decide é você, não o sistema (G5).</p>
          <fieldset className={styles.cartao}>
            <legend className={styles.rotulo}>Pedido</legend>
            {(Object.keys(ROTULO_PEDE) as Pede[]).map((p) => (
              <label key={p} className={styles.escolha}>
                <input type="radio" name="pede" checked={pede === p} onChange={() => setPede(p)} />
                {ROTULO_PEDE[p]}
              </label>
            ))}
          </fieldset>
          <label className={styles.rotulo} htmlFor={ids.dias}>
            Prazo que o INSS deu (dias)
          </label>
          <input id={ids.dias} className={styles.campo} inputMode="numeric" value={dias} onChange={(e) => setDias(somenteDigitos(e.target.value))} />
          {comDocumentos && (
            <>
              <label className={styles.rotulo} htmlFor={ids.itens}>
                Documentos pedidos (um por linha)
              </label>
              <textarea id={ids.itens} className={styles.campo} rows={4} value={itens} onChange={(e) => setItens(e.target.value)} />
              <label className={styles.rotulo} htmlFor={ids.entrega}>
                Prazo de entrega da Documentação
              </label>
              <input id={ids.entrega} className={styles.campo} type="date" min={hojeIso()} max={x.prazo ?? undefined} value={entrega} onChange={(e) => setEntrega(e.target.value)} />
              <p className={styles.dica}>Até o prazo do INSS. A Documentação cobra o cliente e é lembrada no intervalo do escritório.</p>
            </>
          )}
          {comPericia && (
            <fieldset className={styles.cartao}>
              <legend className={styles.rotulo}>Tipo</legend>
              {TIPOS_DE_PERICIA.map((t) => (
                <label key={t} className={styles.escolha}>
                  <input
                    type="checkbox"
                    checked={tipos.includes(t)}
                    onChange={() => setTipos((atual) => (atual.includes(t) ? atual.filter((y) => y !== t) : [...atual, t]))}
                  />
                  {ROTULO_PERICIA[t]}
                </label>
              ))}
            </fieldset>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="submit" className={styles.botao} disabled={!pede}>
              Criar a tarefa
            </button>
          </div>
        </form>
      ) : (
        x.pede && (
          <section className={styles.cartao} aria-label="Andamento">
            <h2 className={styles.cartaoTitulo}>Decidido: {ROTULO_PEDE[x.pede]}</h2>
            {x.itens.length > 0 && (
              <ul className={styles.lista} aria-label="Itens">
                {x.itens.map((i) => (
                  <li key={i.id}>
                    {i.descricao} · {ROTULO_ITEM[i.situacao]}
                    {i.prova ? ` · ${i.prova}` : ''}
                    {i.motivo ? ` (${i.motivo})` : ''}
                  </li>
                ))}
              </ul>
            )}
            {x.pericias.map((p) => (
              <p key={p.tipo}>
                {ROTULO_PERICIA[p.tipo]}: {p.resultado ?? 'aguardando o resultado'}
              </p>
            ))}
            {x.card && (
              <p className={styles.dica}>
                Cobranças ao cliente: {x.card.tentativas}
                {x.card.limite ? ` de ${x.card.limite}` : ''}
                {x.card.escalada ? ' · limite atingido, com a Sênior' : ''}
              </p>
            )}
          </section>
        )
      )}

      {/* GGVP-103 CA12: a senha do gov.br do cliente, pelo cofre, para entrar no portal e responder. */}
      {x.podeResponder && <SenhaDoGov casoId={casoId} />}
      {x.podeResponder && (
        <ResponderNoPortal
          casoId={casoId}
          aoResponder={(texto) => {
            setFeito(texto)
            setVersao((v) => v + 1)
          }}
        />
      )}

      {/* GGVP-94 CA8 a CA10: a cobrança passou do limite; a Sênior vê o laço e diz o que a Documentação deve fazer. */}
      {x.podeDecidirLaco && x.card && (
        <section className={styles.cartao} aria-label="Cobrança sem retorno">
          <h2 className={styles.cartaoTitulo}>Cobrança sem retorno: o limite de tentativas passou</h2>
          <HistoricoDoLaco historico={x.card.cobrancas} rotuloResultado={ROTULO_RESULTADO_DA_COBRANCA} />
          <DecisaoDoLaco
            url={`/casos/${casoId}/exigencia/cobrancas/decisao`}
            aoDecidir={(aviso) => {
              setFeito(aviso)
              setVersao((v) => v + 1)
            }}
          />
        </section>
      )}

      {x.podeDecidirVencida && (
        <DecidirVencidaForm
          casoId={casoId}
          aoDecidir={(texto) => {
            setFeito(texto)
            setVersao((v) => v + 1)
          }}
        />
      )}
    </Moldura>
  )
}
