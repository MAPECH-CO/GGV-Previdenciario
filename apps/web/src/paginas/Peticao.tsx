import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { isoParaData } from '@ggv/campos'
import { AprovarPeticao, NovaVersao, PedirPeticao, type OpcoesDoPedido, type PeticaoInicial } from '@ggv/contratos'
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

/** "Editar eu mesma" (GGVP-67 CA1, CA10): a advogada muda o texto e diz o que mudou; sai a versão seguinte, numerada. */
function EditarEuMesma({ casoId, texto, aoSalvar }: { casoId: string; texto: string; aoSalvar: (t: string) => void }) {
  const ids = { texto: useId(), oQueMudou: useId() }
  const [novo, setNovo] = useState(texto)
  const [oQueMudou, setOQueMudou] = useState('')
  const [erro, setErro] = useState('')

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = NovaVersao.safeParse({ texto: novo, oQueMudou })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a versão.')
    const r = await chamarApi<{ numero: number }>(`/casos/${casoId}/peticao/versoes`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoSalvar(`Versão ${r.dados.numero} salva. Ela precisa de nova conferência.`)
  }

  return (
    <details>
      <summary>Não está boa? Editar eu mesma</summary>
      <form className={styles.cartao} onSubmit={salvar} noValidate>
        <label className={styles.rotulo} htmlFor={ids.texto}>
          Texto da nova versão
        </label>
        <textarea id={ids.texto} className={styles.campo} rows={14} value={novo} onChange={(e) => setNovo(e.target.value)} />
        <label className={styles.rotulo} htmlFor={ids.oQueMudou}>
          O que mudou nesta versão
        </label>
        <input id={ids.oQueMudou} className={styles.campo} value={oQueMudou} onChange={(e) => setOQueMudou(e.target.value)} />
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
        <div className={styles.acoes}>
          <button type="submit" className={styles.botaoSecundario}>
            Salvar nova versão
          </button>
        </div>
        <p className={styles.dica}>As versões anteriores ficam guardadas. Pedir outra versão à IA entra com o épico IA.</p>
      </form>
    </details>
  )
}

/** Aprovar (GGVP-67 CA2, CA5, CA9; G6, G18): só com as três marcações; aprovada, o pacote vai para o protocolo. */
function AprovarForm({ casoId, numero, aoAprovar }: { casoId: string; numero: number; aoAprovar: (t: string) => void }) {
  const [marcas, setMarcas] = useState({ liNaIntegra: false, conferem: false, nadaContradiz: false })
  const [erro, setErro] = useState('')
  const rotulos: Record<keyof typeof marcas, string> = {
    liNaIntegra: 'Li a petição na íntegra',
    conferem: 'Fundamentos, pedidos e valores conferem com o caso',
    nadaContradiz: 'Nada contradiz o requisito do benefício (G18)',
  }

  async function aprovar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const entrada = AprovarPeticao.safeParse(marcas)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira as marcações.')
    const r = await chamarApi(`/casos/${casoId}/peticao/versoes/${numero}/aprovacao`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoAprovar(`Versão ${numero} aprovada. O pacote foi para o protocolo.`)
  }

  return (
    <form className={styles.cartao} onSubmit={aprovar} noValidate aria-label="Aprovar a versão">
      <h2 className={styles.cartaoTitulo}>Conferir a versão {numero}</h2>
      {(Object.keys(rotulos) as (keyof typeof marcas)[]).map((m) => (
        <label key={m} className={styles.escolha}>
          <input type="checkbox" checked={marcas[m]} onChange={() => setMarcas((a) => ({ ...a, [m]: !a[m] }))} />
          {rotulos[m]}
        </label>
      ))}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao} disabled={!Object.values(marcas).every(Boolean)}>
          Aprovar e enviar ao protocolo
        </button>
      </div>
      <p className={styles.dica}>Ninguém assina: a petição sai com a assinatura padrão do escritório. Fica registrado quem aprovou (G6).</p>
    </form>
  )
}

/**
 * Petição inicial (GGVP-63, GGVP-67): com todos os setores do despacho fechados, a advogada pede a petição (CA1); antes
 * disso, o pedido fica bloqueado e diz quem falta. Depois, confere a versão inteira, com o que mudou desde a anterior,
 * edita ela mesma ou aprova. O protocolo (GGVP-71) segue nesta mesma tela.
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

      {x.versoes.length > 0 && (
        <section className={styles.cartao} aria-label="Versões">
          <h2 className={styles.cartaoTitulo}>Versões</h2>
          <ol className={styles.lista}>
            {x.versoes.map((v) => (
              <li key={v.numero}>
                Versão {v.numero} · {v.por} em {dia(v.em)}
                {v.oQueMudou ? ` · ${v.oQueMudou}` : ''}
                {v.aprovadaPor ? ` · aprovada por ${v.aprovadaPor} em ${dia(v.aprovadaEm)} · identificador ${v.hash.slice(0, 12)}` : ''}
              </li>
            ))}
          </ol>
        </section>
      )}

      {x.atual && (
        <section className={styles.cartao} aria-label="Versão atual">
          <h2 className={styles.cartaoTitulo}>Versão {x.atual.numero}, inteira</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{x.atual.texto}</p>
        </section>
      )}

      {x.atual?.diferenca && (
        <section className={styles.cartao} aria-label="O que mudou">
          <h2 className={styles.cartaoTitulo}>O que mudou desde a versão {x.atual.numero - 1}</h2>
          <ul className={styles.lista}>
            {x.atual.diferenca.map((t, i) => (
              <li key={i}>{t.tipo === 'incluido' ? <ins>{t.texto}</ins> : t.tipo === 'removido' ? <del>{t.texto}</del> : t.texto}</li>
            ))}
          </ul>
        </section>
      )}

      {x.podeAprovar && x.atual && <AprovarForm key={x.atual.numero} casoId={casoId} numero={x.atual.numero} aoAprovar={aoMudar} />}
      {x.podeEditar && x.atual && <EditarEuMesma key={`e${x.atual.numero}`} casoId={casoId} texto={x.atual.texto} aoSalvar={aoMudar} />}
    </main>
  )
}
