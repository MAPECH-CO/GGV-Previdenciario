import { useEffect, useId, useState } from 'react'
import { isoParaData } from '@ggv/campos'
import { NaoVouConseguir, ROTULO_SETOR, RegistrarTentativa, SubirInformacao, type ItensDoSetor } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { TextoDoLembrete } from '../componentes/Laco.tsx'
import { ROTULO_DO_CANAL } from '../componentes/rotulosDoLaco.ts'
import styles from './Passo.module.css'

type Item = ItensDoSetor['itens'][number]
type Origem = ItensDoSetor['origem']
const dia = (iso: string | null) => (iso ? (isoParaData(iso) ?? iso) : '—')
const CANAIS = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail', sms: 'SMS', presencial: 'Presencial' } as const
const MSG_DOCUMENTO = 'Anexe o documento do item (PDF ou imagem, até 25 MB).'
const MSG_INFORMACAO = 'Escreva a informação que conseguiu com o cliente ou anexe um documento (PDF ou imagem, até 25 MB).'
/** A exigência do juiz (GGVP-83) e a pendência do despacho da Sênior (GGVP-58) usam o mesmo laço, em endereços próprios. */
const DA_ORIGEM = {
  juizo: { rota: 'exigencia-juiz', titulo: 'Cumprir exigência do juiz', dica: 'O documento fica como a prova do item: sem ele, a advogada não manifesta (G21).' },
  despacho: { rota: 'pendencias', titulo: 'Cumprir pendência', dica: 'Sem o card de todos os setores, a advogada não pede a petição.' },
} as const

/**
 * Um item do laço (GGVP-83, GGVP-58). O principal é subir a prova: o documento pedido ou, na pendência do despacho, a
 * informação que o Atendimento conseguiu com o cliente (G21); se ainda não conseguiu, registra a cobrança (G15); se não
 * vai conseguir, avisa a Sênior com o motivo (ajuste do Mateus, 06/10).
 */
function CartaoDoItem({
  casoId,
  origem,
  escrever,
  item,
  prazoProcessual,
  aoMudar,
}: {
  casoId: string
  origem: Origem
  escrever: boolean
  item: Item
  prazoProcessual: string | null
  aoMudar: (texto: string) => void
}) {
  const ids = { canal: useId(), resultado: useId(), motivo: useId(), arquivo: useId(), informacao: useId() }
  const [canal, setCanal] = useState('')
  const [resultado, setResultado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [informacao, setInformacao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  // GGVP-83 CA15: laudo, atestado ou exame sobe como sensível.
  const [medico, setMedico] = useState(false)
  const [erro, setErro] = useState('')
  const base = `/casos/${casoId}/${DA_ORIGEM[origem].rota}/itens/${item.id}`

  async function enviarDocumento() {
    const escrita = escrever ? SubirInformacao.safeParse({ informacao }) : null
    if (!arquivo && !escrita?.success) return setErro(escrever ? MSG_INFORMACAO : MSG_DOCUMENTO)
    const dados = new FormData()
    if (arquivo) dados.set('arquivo', arquivo)
    if (arquivo && medico) dados.set('medico', 'true')
    if (escrita?.success) dados.set('informacao', escrita.data.informacao)
    const r = await chamarApi(`${base}/prova`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    aoMudar(escrever ? 'Subiu no card. O item está concluído.' : 'Documento enviado. O item está cumprido.')
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
        {item.prazoInterno ? (
          <>
            Entregar até <strong>{dia(item.prazoInterno)}</strong>
          </>
        ) : (
          'Sem prazo de entrega'
        )}
        {prazoProcessual ? ` · prazo do processo: ${dia(prazoProcessual)}` : ''}
      </p>

      {item.situacao === 'cumprido' ? (
        <span className={styles.selo}>Cumprido · {[item.informacao, item.prova].filter(Boolean).join(' · ')}</span>
      ) : item.situacao === 'nao_cumprido' ? (
        <span className={styles.selo}>Encerrado pela advogada, sem o documento{item.motivo ? `: ${item.motivo}` : ''}. Não precisa mais cobrar.</span>
      ) : (
        <>
          <section className={styles.cartao} aria-label={escrever ? 'Subir no card' : 'Enviar o documento'}>
            {escrever && (
              <>
                <label className={styles.rotulo} htmlFor={ids.informacao}>
                  O que conseguiu com o cliente
                </label>
                <textarea id={ids.informacao} className={styles.campo} rows={3} value={informacao} onChange={(e) => setInformacao(e.target.value)} />
              </>
            )}
            <label className={styles.rotulo} htmlFor={ids.arquivo}>
              {escrever ? 'Documento (opcional)' : 'Documento'}
            </label>
            <input id={ids.arquivo} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            <label className={styles.escolha}>
              <input type="checkbox" checked={medico} onChange={(e) => setMedico(e.target.checked)} />
              É laudo, atestado ou exame (dado de saúde: só o Jurídico vê)
            </label>
            <div className={styles.acoes}>
              <button type="button" className={styles.botao} onClick={() => void enviarDocumento()}>
                {escrever ? 'Consegui, subir no card' : 'Enviar documento e concluir'}
              </button>
            </div>
            <p className={styles.dica}>{DA_ORIGEM[origem].dica}</p>
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
            {item.lembrete && (
              <p className={styles.dica}>
                <TextoDoLembrete data={item.proximoLembrete} lembrete={item.lembrete} />
              </p>
            )}
            {item.tentativas.length > 0 && (
              <ol className={styles.lista} aria-label="Cobranças">
                {item.tentativas.map((t) => (
                  <li key={t.quando}>
                    {new Date(t.quando).toLocaleDateString('pt-BR')} · {ROTULO_DO_CANAL[t.canal] ?? t.canal} · {t.resultado} · {t.quem}
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

/**
 * Cumprir a exigência do juiz (GGVP-83) ou a pendência do despacho da Sênior (GGVP-58): o setor do perfil ativo vê e
 * cumpre só os seus itens. Na pendência, antes da ação, não há prazo do processo, e o Atendimento sobe a informação escrita.
 */
export function CumprirExigenciaJuiz({ casoId, origem = 'juizo' }: { casoId: string; origem?: Origem }) {
  const [d, setD] = useState<ItensDoSetor | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const { rota, titulo } = DA_ORIGEM[origem]

  useEffect(() => {
    void chamarApi<ItensDoSetor>(`/casos/${casoId}/${rota}/setor`).then((r) => (r.ok ? setD(r.dados) : setErro(r.erro)))
  }, [casoId, rota, versao])

  if (!d)
    return (
      <main className={styles.pagina}>
        <title>{`${titulo} · GGV Previdenciário`}</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const pendentes = d.itens.filter((i) => i.situacao === 'pendente').length
  const escrever = origem === 'despacho' && d.setor === 'atendimento'
  const resumo =
    origem === 'juizo'
      ? pendentes === 0
        ? 'Tudo entregue. A advogada já pode manifestar.'
        : `O juiz pediu ${pendentes === 1 ? 'um documento' : `${pendentes} documentos`} ao seu setor. Envie cada um quando conseguir.`
      : pendentes === 0
        ? 'Tudo entregue pelo seu setor.'
        : `A Sênior pediu ${pendentes === 1 ? 'um item' : `${pendentes} itens`} ao seu setor. Suba cada um no card quando conseguir.`

  return (
    <main className={styles.pagina}>
      <title>{`${titulo} · GGV Previdenciário`}</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>{titulo}</h1>
      <p className={styles.subtitulo}>
        {d.cliente} · {ROTULO_SETOR[d.setor]}
        {d.pedidoPor ? ` · pedido por ${d.pedidoPor}` : ''}
      </p>
      <p className={styles.dica}>{resumo}</p>
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
            origem={origem}
            escrever={escrever}
            item={i}
            prazoProcessual={d.prazoProcessual}
            aoMudar={(texto) => {
              setFeito(texto)
              setVersao((v) => v + 1)
            }}
          />
        ))}
      </ul>
      {d.itens.length === 0 && <p className={styles.dica}>{origem === 'juizo' ? 'Nada para o seu setor nesta exigência.' : 'Nada para o seu setor neste despacho.'}</p>}
    </main>
  )
}
