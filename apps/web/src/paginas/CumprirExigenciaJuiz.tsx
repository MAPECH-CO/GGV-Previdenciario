import { useEffect, useId, useState } from 'react'
import { isoParaData } from '@ggv/campos'
import { NaoVouConseguir, ROTULO_SETOR, RegistrarTentativa, type ItensDoSetor } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

type Item = ItensDoSetor['itens'][number]
const dia = (iso: string | null) => (iso ? (isoParaData(iso) ?? iso) : '—')
const CANAIS = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail', sms: 'SMS', presencial: 'Presencial' } as const
const MSG_DOCUMENTO = 'Anexe o documento do item (PDF ou imagem, até 25 MB).'

/**
 * Um item do laço (GGVP-83). O principal é enviar o documento pedido, que vira a prova do item (G21); se ainda não
 * conseguiu, registra a cobrança (G15); se não vai conseguir, avisa a Sênior com o motivo (ajuste do Mateus, 06/10).
 */
function CartaoDoItem({ casoId, item, prazoProcessual, aoMudar }: { casoId: string; item: Item; prazoProcessual: string; aoMudar: (texto: string) => void }) {
  const ids = { canal: useId(), resultado: useId(), motivo: useId(), arquivo: useId() }
  const [canal, setCanal] = useState('')
  const [resultado, setResultado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const base = `/casos/${casoId}/exigencia-juiz/itens/${item.id}`

  async function enviarDocumento() {
    if (!arquivo) return setErro(MSG_DOCUMENTO)
    const dados = new FormData()
    dados.set('arquivo', arquivo)
    const r = await chamarApi(`${base}/prova`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    aoMudar('Documento enviado. O item está cumprido.')
  }

  async function registrarCobranca() {
    const entrada = RegistrarTentativa.safeParse({ canal: canal || undefined, resultado })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi<{ tentativas: number; escalada: boolean }>(`${base}/tentativas`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoMudar(r.dados.escalada ? 'Cobrança registrada. O limite foi atingido: a Sênior foi avisada e a tarefa continua com o setor.' : 'Cobrança registrada.')
  }

  async function avisarSenior() {
    const entrada = NaoVouConseguir.safeParse({ motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const r = await chamarApi(`${base}/nao-vou-conseguir`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoMudar('A Sênior foi avisada, com o motivo.')
  }

  const contagem = item.limite ? `${item.tentativas.length} de ${item.limite}` : `${item.tentativas.length}, limite não configurado`

  return (
    <li className={styles.cartao}>
      <h2 className={styles.cartaoTitulo}>{item.descricao}</h2>
      {item.provaEsperada && <p>Documento que comprova: {item.provaEsperada}</p>}
      <p>
        Entregar até <strong>{dia(item.prazoInterno)}</strong> · prazo do processo: {dia(prazoProcessual)}
      </p>

      {item.situacao === 'cumprido' ? (
        <span className={styles.selo}>Cumprido · {item.prova}</span>
      ) : (
        <>
          <section className={styles.cartao} aria-label="Enviar o documento">
            <label className={styles.rotulo} htmlFor={ids.arquivo}>
              Documento
            </label>
            <input id={ids.arquivo} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            <div className={styles.acoes}>
              <button type="button" className={styles.botao} onClick={() => void enviarDocumento()}>
                Enviar documento e concluir
              </button>
            </div>
            <p className={styles.dica}>O documento fica como a prova do item: sem ele, a advogada não manifesta (G21).</p>
          </section>

          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}

          <details>
            <summary>
              Ainda não conseguiu? Registrar cobrança ao cliente ({contagem}
              {item.proximoLembrete ? ` · próximo lembrete ${dia(item.proximoLembrete)}` : ''})
            </summary>
            {item.tentativas.length > 0 && (
              <ol className={styles.lista} aria-label="Cobranças">
                {item.tentativas.map((t) => (
                  <li key={t.quando}>
                    {new Date(t.quando).toLocaleDateString('pt-BR')} · {CANAIS[t.canal as keyof typeof CANAIS] ?? t.canal} · {t.resultado} · {t.quem}
                  </li>
                ))}
              </ol>
            )}
            <label className={styles.rotulo} htmlFor={ids.canal}>
              Canal
            </label>
            <select id={ids.canal} className={styles.campo} value={canal} onChange={(e) => setCanal(e.target.value)}>
              <option value="">Escolha</option>
              {Object.entries(CANAIS).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
            <label className={styles.rotulo} htmlFor={ids.resultado}>
              O que o cliente respondeu
            </label>
            <input id={ids.resultado} className={styles.campo} value={resultado} onChange={(e) => setResultado(e.target.value)} />
            <div className={styles.acoes}>
              <button type="button" className={styles.botaoSecundario} onClick={() => void registrarCobranca()}>
                Registrar cobrança
              </button>
            </div>
          </details>

          {item.escalada ? (
            <p className={styles.dica}>A Sênior já foi avisada; a tarefa continua com o setor.</p>
          ) : (
            <details>
              <summary>Não vai conseguir? Avisar a Sênior</summary>
              <label className={styles.rotulo} htmlFor={ids.motivo}>
                Por que não vai conseguir
              </label>
              <input id={ids.motivo} className={styles.campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className={styles.acoes}>
                <button type="button" className={styles.botaoSecundario} onClick={() => void avisarSenior()}>
                  Avisar a Sênior
                </button>
              </div>
            </details>
          )}
        </>
      )}
    </li>
  )
}

/** Cumprir a exigência do juiz (GGVP-83): o setor do perfil ativo vê e cumpre só os seus itens. */
export function CumprirExigenciaJuiz({ casoId }: { casoId: string }) {
  const [d, setD] = useState<ItensDoSetor | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<ItensDoSetor>(`/casos/${casoId}/exigencia-juiz/setor`).then((r) => (r.ok ? setD(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  if (!d)
    return (
      <main className={styles.pagina}>
        <title>Cumprir exigência do juiz · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const pendentes = d.itens.filter((i) => i.situacao !== 'cumprido').length

  return (
    <main className={styles.pagina}>
      <title>Cumprir exigência do juiz · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Cumprir exigência do juiz</h1>
      <p className={styles.subtitulo}>
        {d.cliente} · {ROTULO_SETOR[d.setor]}
        {d.pedidoPor ? ` · pedido por ${d.pedidoPor}` : ''}
      </p>
      <p className={styles.dica}>
        {pendentes === 0 ? 'Tudo entregue. A advogada já pode manifestar.' : `O juiz pediu ${pendentes === 1 ? 'um documento' : `${pendentes} documentos`} ao seu setor. Envie cada um quando conseguir.`}
      </p>
      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}
      <ul className={styles.lista}>
        {d.itens.map((i) => (
          <CartaoDoItem
            key={`${i.id}-${i.situacao}-${i.tentativas.length}-${i.escalada}`}
            casoId={casoId}
            item={i}
            prazoProcessual={d.prazoProcessual}
            aoMudar={(texto) => {
              setFeito(texto)
              setVersao((v) => v + 1)
            }}
          />
        ))}
      </ul>
      {d.itens.length === 0 && <p className={styles.dica}>Nada para o seu setor nesta exigência.</p>}
    </main>
  )
}
