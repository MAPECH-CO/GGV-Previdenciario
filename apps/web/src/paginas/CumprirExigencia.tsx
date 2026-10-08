import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { isoParaData } from '@ggv/campos'
import { CANAIS_DE_COBRANCA, RESULTADOS_DE_COBRANCA, RegistrarCobranca, type ExigenciaDoCaso } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { TextoDoLembrete } from '../componentes/Laco.tsx'
import { ROTULO_DO_CANAL } from '../componentes/rotulosDoLaco.ts'
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
 * Cumprir exigência do INSS (GGVP-39, Documentação): cobra o cliente (G15), junta a prova de cada item e entrega ao
 * Jurídico, que responde no portal do INSS. "Entregar ao Jurídico" só libera com documento em todos os itens (G21).
 */
export function CumprirExigencia({ casoId }: { casoId: string }) {
  const ids = { canal: useId(), resultado: useId() }
  const [x, setX] = useState<ExigenciaDoCaso | null>(null)
  const [versao, setVersao] = useState(0)
  const [canal, setCanal] = useState('')
  const [resultado, setResultado] = useState('')
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

  async function entregar() {
    const r = await chamarApi(`/casos/${casoId}/exigencia/entrega`, { method: 'POST' })
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setFeito('Provas entregues. A advogada recebeu a tarefa de responder no portal do INSS.')
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
              {x.card.lembrete && (
                <>
                  {' '}
                  <TextoDoLembrete data={x.card.proximoLembrete} lembrete={x.card.lembrete} />.
                </>
              )}
              {x.card.escalada ? ' Limite atingido: a Sênior já foi avisada.' : ''}
            </p>
            {x.card.cobrancas.length > 0 && (
              <ol className={styles.lista} aria-label="Cobranças">
                {x.card.cobrancas.map((c) => (
                  <li key={c.quando}>
                    {new Date(c.quando).toLocaleDateString('pt-BR')} · {ROTULO_DO_CANAL[c.canal] ?? c.canal} ·{' '}
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

          <section className={styles.cartao} aria-label="Entregar ao Jurídico">
            <h2 className={styles.cartaoTitulo}>Entregar ao Jurídico</h2>
            <p className={styles.dica}>
              Quem responde no portal do INSS é o Jurídico. {tudoComProva ? 'Todos os itens têm documento.' : 'Só libera com documento em todos os itens (G21).'}
            </p>
            <div className={styles.acoes}>
              <button type="button" className={styles.botao} disabled={!tudoComProva} onClick={() => void entregar()}>
                Entregar ao Jurídico
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
