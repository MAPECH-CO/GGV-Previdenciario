import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { isoParaData } from '@ggv/campos'
import { PedirPeticao, type OpcoesDoPedido, type PeticaoInicial } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const rotuloBeneficio = (b: string | null) => (b ? b.replaceAll('_', ' ') : 'a definir')
const dia = (iso: string | null) => (iso ? (isoParaData(iso.slice(0, 10)) ?? iso) : '—')
const ROTULO_OPCAO: Record<keyof OpcoesDoPedido, string> = {
  tutelaUrgencia: 'Pedir tutela de urgência',
  precedentes: 'Usar precedentes do acervo',
  anexarCitados: 'Anexar os documentos citados',
}

/**
 * O pedido da petição inicial (GGVP-63 CA6, CA9): instruções, opções, os documentos citados na ordem (com o nome do que
 * ainda falta) e o texto da versão 1, que a advogada escreve ou cola até a minuta da IA (épico IA jurídica).
 */
function PedirForm({ casoId, x, aoPedir }: { casoId: string; x: PeticaoInicial; aoPedir: (texto: string) => void }) {
  const ids = { instrucoes: useId(), falta: useId(), texto: useId() }
  const [instrucoes, setInstrucoes] = useState('')
  const [opcoes, setOpcoes] = useState<OpcoesDoPedido>({ tutelaUrgencia: false, precedentes: false, anexarCitados: true })
  const [marcados, setMarcados] = useState<string[]>([])
  const [faltando, setFaltando] = useState<string[]>([])
  const [nomeQueFalta, setNomeQueFalta] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const nomeDo = (id: string) => x.documentos.find((d) => d.id === id)?.nome ?? id

  async function pedir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const corpo = { instrucoes, opcoes, citados: [...marcados.map((documentoId) => ({ documentoId })), ...faltando.map((nome) => ({ nome }))], texto }
    const entrada = PedirPeticao.safeParse(corpo)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o pedido.')
    const r = await chamarApi(`/casos/${casoId}/peticao/pedido`, { method: 'POST', corpo })
    if (!r.ok) return setErro(r.erro)
    aoPedir('Petição pedida. A versão 1 foi para a conferência.')
  }

  return (
    <form className={styles.cartao} onSubmit={pedir} noValidate aria-label="Pedir a petição">
      <h2 className={styles.cartaoTitulo}>Pedir a petição</h2>
      <label className={styles.rotulo} htmlFor={ids.instrucoes}>
        Instruções (opcional)
      </label>
      <textarea id={ids.instrucoes} className={styles.campo} rows={3} value={instrucoes} onChange={(e) => setInstrucoes(e.target.value)} />
      <fieldset className={styles.cartao}>
        <legend className={styles.rotulo}>Opções</legend>
        {(Object.keys(ROTULO_OPCAO) as (keyof OpcoesDoPedido)[]).map((o) => (
          <label key={o} className={styles.escolha}>
            <input type="checkbox" checked={opcoes[o]} onChange={() => setOpcoes((a) => ({ ...a, [o]: !a[o] }))} />
            {ROTULO_OPCAO[o]}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.cartao}>
        <legend className={styles.rotulo}>Documentos citados</legend>
        <p className={styles.dica}>A carta de indeferimento entra sempre (Tema 350). Marque os outros na ordem em que vão no pacote.</p>
        {x.documentos.map((d) => (
          <label key={d.id} className={styles.escolha}>
            <input type="checkbox" checked={marcados.includes(d.id)} onChange={() => setMarcados((a) => (a.includes(d.id) ? a.filter((y) => y !== d.id) : [...a, d.id]))} />
            {d.nome}
          </label>
        ))}
        <label className={styles.rotulo} htmlFor={ids.falta}>
          Falta algum documento? Escreva o nome
        </label>
        <input id={ids.falta} className={styles.campo} value={nomeQueFalta} onChange={(e) => setNomeQueFalta(e.target.value)} />
        <div className={styles.acoes}>
          <button
            type="button"
            className={styles.botaoSecundario}
            onClick={() => {
              if (nomeQueFalta.trim()) setFaltando((a) => [...a, nomeQueFalta.trim()])
              setNomeQueFalta('')
            }}
          >
            Incluir o que falta
          </button>
        </div>
        {(marcados.length > 0 || faltando.length > 0) && (
          <ol className={styles.lista} aria-label="Ordem no pacote">
            {marcados.map((id) => (
              <li key={id}>{nomeDo(id)}</li>
            ))}
            {faltando.map((nome) => (
              <li key={nome}>{nome} · falta</li>
            ))}
          </ol>
        )}
      </fieldset>
      <label className={styles.rotulo} htmlFor={ids.texto}>
        Texto da petição (versão 1)
      </label>
      <textarea id={ids.texto} className={styles.campo} rows={14} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <p className={styles.dica}>Escreva ou cole o texto. Ele vai para a conferência; a minuta pela IA entra com o épico IA.</p>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao}>
          Pedir a petição
        </button>
      </div>
    </form>
  )
}

/**
 * Petição inicial (GGVP-63): com todos os setores do despacho fechados, a advogada pede a petição (CA1); antes disso, o
 * pedido fica bloqueado e diz quem falta. A conferência (GGVP-67) e o protocolo (GGVP-71) seguem nesta mesma tela.
 */
export function Peticao({ casoId }: { casoId: string }) {
  const [x, setX] = useState<PeticaoInicial | null>(null)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')

  useEffect(() => {
    void chamarApi<PeticaoInicial>(`/casos/${casoId}/peticao`).then((r) => (r.ok ? setX(r.dados) : setErro(r.erro)))
  }, [casoId, versao])

  if (!x)
    return (
      <main className={styles.pagina}>
        <title>Petição inicial · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const aoMudar = (texto: string) => {
    setFeito(texto)
    setVersao((v) => v + 1)
  }

  return (
    <main className={styles.pagina}>
      <title>Petição inicial · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Petição inicial</h1>
      <p className={styles.subtitulo}>
        {x.cliente} · {rotuloBeneficio(x.beneficio)}
      </p>

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {!x.pedido &&
        (x.faltam.length > 0 ? (
          <section className={styles.cartao} aria-label="Pedir a petição">
            <h2 className={styles.cartaoTitulo}>Pedir a petição</h2>
            <p className={`${styles.selo} ${styles.seloAlerta}`}>Bloqueado até todos os setores subirem o card. Falta: {x.faltam.join(', ')}.</p>
            <div className={styles.acoes}>
              <button type="button" className={styles.botao} disabled>
                Pedir a petição
              </button>
            </div>
          </section>
        ) : x.podePedir ? (
          <PedirForm casoId={casoId} x={x} aoPedir={aoMudar} />
        ) : (
          <p className={styles.dica}>Esperando o pedido da petição pela advogada.</p>
        ))}

      {x.pedido && (
        <section className={styles.cartao} aria-label="Pedido">
          <h2 className={styles.cartaoTitulo}>
            Pedido por {x.pedido.por} em {dia(x.pedido.em)}
          </h2>
          {x.pedido.instrucoes && <p>Instruções: {x.pedido.instrucoes}</p>}
          <p>
            Opções:{' '}
            {(Object.keys(ROTULO_OPCAO) as (keyof OpcoesDoPedido)[])
              .filter((o) => x.pedido!.opcoes[o])
              .map((o) => ROTULO_OPCAO[o])
              .join(', ') || 'nenhuma'}
          </p>
          <ol className={styles.lista} aria-label="Citados">
            {x.carta && <li>{x.carta.nome} · carta de indeferimento, entra sempre (Tema 350)</li>}
            {x.pedido.citados.map((c) => (
              <li key={(c.documentoId ?? '') + c.nome}>{c.documentoId ? c.nome : `${c.nome} · falta`}</li>
            ))}
          </ol>
        </section>
      )}

      {x.atual && (
        <section className={styles.cartao} aria-label="Versão atual">
          <h2 className={styles.cartaoTitulo}>Versão {x.atual.numero}</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{x.atual.texto}</p>
        </section>
      )}
    </main>
  )
}
