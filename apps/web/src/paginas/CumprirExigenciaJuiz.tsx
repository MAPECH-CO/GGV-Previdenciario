import { useEffect, useId, useState } from 'react'
import { isoParaData } from '@ggv/campos'
import { NaoVouConseguir, ROTULO_SETOR, RegistrarTentativa, type ItensDoSetor } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

type Item = ItensDoSetor['itens'][number]
const dia = (iso: string | null) => (iso ? (isoParaData(iso) ?? iso) : '—')
const CANAIS = { whatsapp: 'WhatsApp', telefone: 'Telefone', email: 'E-mail', sms: 'SMS', presencial: 'Presencial' } as const

/** Um item do laço (GGVP-83): tentar de novo (G15), subir para a Sênior com o motivo, ou subir a prova (G21). */
function CartaoDoItem({ casoId, item, prazoProcessual, aoMudar }: { casoId: string; item: Item; prazoProcessual: string; aoMudar: (texto: string) => void }) {
  const ids = { canal: useId(), resultado: useId(), motivo: useId(), arquivo: useId() }
  const [canal, setCanal] = useState('')
  const [resultado, setResultado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const base = `/casos/${casoId}/exigencia-juiz/itens/${item.id}`

  async function tentar() {
    const entrada = RegistrarTentativa.safeParse({ canal: canal || undefined, resultado })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const r = await chamarApi<{ tentativas: number; escalada: boolean }>(`${base}/tentativas`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoMudar(r.dados.escalada ? 'Tentativa registrada. O limite foi atingido: a Sênior foi avisada e a tarefa continua com o setor.' : 'Tentativa registrada.')
  }

  async function subirParaSenior() {
    const entrada = NaoVouConseguir.safeParse({ motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const r = await chamarApi(`${base}/nao-vou-conseguir`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoMudar('A Sênior foi avisada, com o motivo.')
  }

  async function subirProva() {
    if (!arquivo) return setErro('Anexe a evidência do item (PDF ou imagem, até 25 MB).')
    const dados = new FormData()
    dados.set('arquivo', arquivo)
    const r = await chamarApi(`${base}/prova`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    aoMudar('Prova enviada. O item está cumprido.')
  }

  return (
    <li className={styles.cartao}>
      <h2 className={styles.cartaoTitulo}>{item.descricao}</h2>
      {item.provaEsperada && <p className={styles.dica}>Prova esperada: {item.provaEsperada}</p>}
      <p>
        Prazo interno: <strong>{dia(item.prazoInterno)}</strong> · prazo do processo: {dia(prazoProcessual)}
        {item.proximoLembrete ? ` · próximo lembrete: ${dia(item.proximoLembrete)}` : ''}
      </p>
      {item.situacao === 'cumprido' ? (
        <span className={styles.selo}>Cumprido · {item.prova}</span>
      ) : (
        <>
          <p className={styles.dica}>
            {item.limite ? `Tentativa ${item.tentativas.length} de ${item.limite}` : `Tentativas: ${item.tentativas.length} (limite não configurado)`}
            {item.escalada ? ' · já com a Sênior; a tarefa continua com o setor' : ''}
          </p>
          {item.tentativas.length > 0 && (
            <ol className={styles.lista} aria-label="Tentativas">
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
            Resultado da tentativa
          </label>
          <input id={ids.resultado} className={styles.campo} value={resultado} onChange={(e) => setResultado(e.target.value)} />
          <div className={styles.acoes}>
            <button type="button" className={styles.botaoSecundario} onClick={() => void tentar()}>
              Ainda não, registrar tentativa
            </button>
          </div>
          <label className={styles.rotulo} htmlFor={ids.arquivo}>
            Evidência
          </label>
          <input id={ids.arquivo} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={() => void subirProva()}>
              Consegui, subir no card
            </button>
          </div>
          {!item.escalada && (
            <>
              <label className={styles.rotulo} htmlFor={ids.motivo}>
                Não vai conseguir? Por quê
              </label>
              <input id={ids.motivo} className={styles.campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className={styles.acoes}>
                <button type="button" className={styles.botaoSecundario} onClick={() => void subirParaSenior()}>
                  Subir para a Sênior
                </button>
              </div>
            </>
          )}
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
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
