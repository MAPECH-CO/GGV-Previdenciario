import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { hojeIso, isoParaData } from '@ggv/campos'
import { CANAIS_DE_COBRANCA, RESULTADOS_DE_COBRANCA, RegistrarCobranca, ResponderExigencia, type ExigenciaDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'
import { ResumoDaExigencia } from './TratarExigencia.tsx'

const br = (iso: string | null) => (iso ? (isoParaData(iso) ?? iso) : '—')
const ROTULO_ITEM = { pendente: 'Pendente', cumprido: 'Cumprido', nao_cumprido: 'Não cumprido' } as const
const ROTULO_CANAL = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail', sms: 'SMS', presencial: 'Presencial' } as const
const ROTULO_RESULTADO = { entregou: 'Entregou', sem_resposta: 'Sem resposta', vai_entregar: 'Vai entregar' } as const
const MSG_ARQUIVO = 'Anexe o documento (PDF ou imagem, até 25 MB).'

type Item = ExigenciaDoCaso['itens'][number]

/** Um item do card (CA11): anexar a prova marca cumprido; "não cumprido" pede o motivo. */
function LinhaDoItem({ casoId, item, aoMudar }: { casoId: string; item: Item; aoMudar: () => void }) {
  const ids = { arquivo: useId(), motivo: useId() }
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [naoCumprido, setNaoCumprido] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')

  async function enviar(campos: Record<string, string>, comArquivo: boolean) {
    if (comArquivo && !arquivo) return setErro(MSG_ARQUIVO)
    const dados = new FormData()
    for (const [k, v] of Object.entries(campos)) dados.set(k, v)
    if (comArquivo && arquivo) dados.set('arquivo', arquivo)
    const r = await chamarApi(`/casos/${casoId}/exigencia/itens/${item.id}`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    aoMudar()
  }

  return (
    <li className={styles.cartao}>
      <strong>{item.descricao}</strong> · {ROTULO_ITEM[item.situacao]}
      {item.prova && <span className={styles.dica}> · {item.prova}</span>}
      {item.motivo && <span className={styles.dica}> · {item.motivo}</span>}
      {item.situacao !== 'cumprido' && (
        <>
          <label className={styles.rotulo} htmlFor={ids.arquivo}>
            Documento de “{item.descricao}”
          </label>
          <input id={ids.arquivo} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {naoCumprido && (
            <>
              <label className={styles.rotulo} htmlFor={ids.motivo}>
                Por que não foi cumprido
              </label>
              <input id={ids.motivo} className={styles.campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={() => void enviar({ acao: 'cumprido' }, true)}>
              Anexar
            </button>
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() => (naoCumprido ? void enviar({ acao: 'nao_cumprido', motivo }, false) : setNaoCumprido(true))}
            >
              {naoCumprido ? 'Confirmar não cumprido' : 'Não cumprido'}
            </button>
          </div>
        </>
      )}
    </li>
  )
}

/**
 * Cumprir exigência do INSS (GGVP-39, Documentação): cobra o cliente (G15), junta a prova de cada item e responde no
 * portal do INSS. "Anexar e responder" só libera com documento em todos os itens (G21); o servidor confere de novo.
 */
export function CumprirExigencia({ casoId }: { casoId: string }) {
  const ids = { canal: useId(), resultado: useId(), data: useId(), comprovante: useId() }
  const [x, setX] = useState<ExigenciaDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [canal, setCanal] = useState('')
  const [resultado, setResultado] = useState('')
  const [dataResposta, setDataResposta] = useState(() => hojeIso())
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const recarregar = () => setVersao((v) => v + 1)

  useEffect(() => {
    void chamarApi<ExigenciaDoCaso>(`/casos/${casoId}/exigencia`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  async function cobrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = RegistrarCobranca.safeParse({ canal: canal || undefined, resultado: resultado || undefined })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi<{ escalada: boolean }>(`/casos/${casoId}/exigencia/cobrancas`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito(r.dados.escalada ? 'Cobrança registrada. O limite foi atingido e a tarefa subiu para a Sênior.' : 'Cobrança registrada.')
    recarregar()
  }

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
    setErro('')
    setFeito(
      r.dados.aberto === 'pericia'
        ? 'Resposta registrada. A exigência também pede perícia: o Jurídico administrativo recebeu a tarefa.'
        : 'Resposta registrada. O caso voltou para a vigília e espera o INSS analisar.',
    )
    recarregar()
  }

  if (!x)
    return (
      <main className={styles.pagina}>
        <title>Cumprir exigência do INSS · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const tudoComProva = x.itens.length > 0 && x.itens.every((i) => i.situacao === 'cumprido')

  return (
    <main className={styles.pagina}>
      <title>Cumprir exigência do INSS · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Cumprir exigência do INSS</h1>
      <p className={styles.subtitulo}>{x.cliente}</p>
      <ResumoDaExigencia x={x} />

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

      {x.card && (
        <section className={styles.cartao} aria-label="Itens pedidos">
          <h2 className={styles.cartaoTitulo}>Itens · entregar até {br(x.card.prazoEntrega)}</h2>
          <ul className={styles.lista}>
            {x.itens.map((i) => (
              <LinhaDoItem key={`${i.id}-${i.situacao}`} casoId={casoId} item={i} aoMudar={recarregar} />
            ))}
          </ul>
        </section>
      )}

      {x.podeCumprir && x.card && (
        <>
          <form className={styles.cartao} onSubmit={cobrar} noValidate>
            <h2 className={styles.cartaoTitulo}>Cobrar o cliente</h2>
            <p className={styles.dica}>
              {x.card.limite ? `Cobranças: ${x.card.tentativas} de ${x.card.limite}.` : `Cobranças: ${x.card.tentativas}. Limite de cobranças não configurado.`}
              {x.card.proximoLembrete ? ` Próximo lembrete: ${br(x.card.proximoLembrete)}.` : ''}
              {x.card.escalada ? ' Limite atingido: a Sênior já foi avisada.' : ''}
            </p>
            {x.card.cobrancas.length > 0 && (
              <ol className={styles.lista} aria-label="Cobranças">
                {x.card.cobrancas.map((c) => (
                  <li key={c.quando}>
                    {new Date(c.quando).toLocaleDateString('pt-BR')} · {ROTULO_CANAL[c.canal as keyof typeof ROTULO_CANAL] ?? c.canal} ·{' '}
                    {ROTULO_RESULTADO[c.resultado as keyof typeof ROTULO_RESULTADO] ?? c.resultado} · {c.quem}
                  </li>
                ))}
              </ol>
            )}
            <label className={styles.rotulo} htmlFor={ids.canal}>
              Canal
            </label>
            <select id={ids.canal} className={styles.campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="">Escolha</option>
              {CANAIS_DE_COBRANCA.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_CANAL[c]}
                </option>
              ))}
            </select>
            <label className={styles.rotulo} htmlFor={ids.resultado}>
              Resultado
            </label>
            <select id={ids.resultado} className={styles.campo} value={resultado} onChange={(e) => setResultado(e.target.value)}>
              <option value="">Escolha</option>
              {RESULTADOS_DE_COBRANCA.map((r) => (
                <option key={r} value={r}>
                  {ROTULO_RESULTADO[r]}
                </option>
              ))}
            </select>
            <div className={styles.acoes}>
              <button type="submit" className={styles.botaoSecundario}>
                Registrar cobrança
              </button>
            </div>
          </form>

          <form className={styles.cartao} onSubmit={responder} noValidate>
            <h2 className={styles.cartaoTitulo}>Responder no portal do INSS</h2>
            {!tudoComProva && <p className={styles.dica}>Só libera com documento anexado em todos os itens (G21).</p>}
            <label className={styles.rotulo} htmlFor={ids.data}>
              Data da resposta no portal
            </label>
            <input id={ids.data} className={styles.campo} type="date" max={hojeIso()} value={dataResposta} onChange={(e) => setDataResposta(e.target.value)} />
            <label className={styles.rotulo} htmlFor={ids.comprovante}>
              Comprovante da resposta
            </label>
            <input id={ids.comprovante} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
            <div className={styles.acoes}>
              <button type="submit" className={styles.botao} disabled={!tudoComProva}>
                Anexar e responder
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  )
}
