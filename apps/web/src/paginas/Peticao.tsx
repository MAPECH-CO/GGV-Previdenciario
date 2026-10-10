import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { formatarCnj, hojeIso, isoParaData, normalizarCnj } from '@ggv/campos'
import { AprovarPeticao, faltaCompletar, NovaVersao, PedirOutraVersao, PedirPeticao, ProtocolarPeticao, type MinutaDaIa, type OpcoesDoPedido, type PeticaoInicial } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { ChanceDoCaso } from '../componentes/ChanceDoCaso.tsx'
import styles from './Passo.module.css'
import { diaLocal } from '@ggv/campos'
import { nomeDoBeneficio } from '@ggv/contratos'

const dia = (iso: string | null) => (iso ? (isoParaData(diaLocal(iso)) ?? iso) : '—')
const ROTULO_OPCAO: Record<keyof OpcoesDoPedido, string> = {
  tutelaUrgencia: 'Pedir tutela de urgência',
  precedentes: 'Usar precedentes do acervo',
  anexarCitados: 'Anexar os documentos citados',
}

/**
 * O pedido da petição inicial (GGVP-63 CA6, CA9): instruções, opções, os documentos citados na ordem (com o nome do que
 * ainda falta) e o texto da versão 1, que a advogada escreve, cola ou parte da minuta da IA (épico IA), sempre revisando.
 */
function PedirForm({ casoId, x, aoPedir }: { casoId: string; x: PeticaoInicial; aoPedir: (texto: string) => void }) {
  const ids = { instrucoes: useId(), falta: useId(), texto: useId() }
  const [instrucoes, setInstrucoes] = useState('')
  // Sugestão pronta (07/10): o pedido abre no padrão com que a minuta foi preparada em segundo plano: todos os documentos
  // do caso marcados, na ordem em que chegaram, e o acervo ligado (GGVP-45); a advogada desmarca o que não vai.
  const [opcoes, setOpcoes] = useState<OpcoesDoPedido>({ tutelaUrgencia: false, precedentes: true, anexarCitados: true })
  const [marcados, setMarcados] = useState<string[]>(() => x.documentos.map((d) => d.id))
  const [faltando, setFaltando] = useState<string[]>([])
  const [nomeQueFalta, setNomeQueFalta] = useState('')
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [minuta, setMinuta] = useState<MinutaDaIa | null>(null)
  const [escrevendo, setEscrevendo] = useState(true)
  const nomeDo = (id: string) => x.documentos.find((d) => d.id === id)?.nome ?? id

  const citados = () => [...marcados.map((documentoId) => ({ documentoId })), ...faltando.map((nome) => ({ nome }))]

  // Ao abrir, a minuta pronta (a mesma do segundo plano, sem nova chamada) entra na caixa se ela ainda está vazia.
  useEffect(() => {
    const padrao = { instrucoes: '', opcoes: { tutelaUrgencia: false, precedentes: true, anexarCitados: true }, citados: x.documentos.map((d) => ({ documentoId: d.id })) }
    void chamarApi<MinutaDaIa>(`/casos/${casoId}/peticao/minuta`, { method: 'POST', corpo: padrao }).then((r) => {
      setEscrevendo(false)
      if (!r.ok) return setErro(r.erro)
      setMinuta(r.dados)
      const s = r.dados.sugestao
      if (s) setTexto((t) => t || s.texto)
    })
  }, [casoId, x.documentos])

  /** "Escrever de novo com a IA": outra minuta com o que está marcado agora; o texto novo substitui o da caixa. */
  async function escreverDeNovo() {
    setEscrevendo(true)
    const r = await chamarApi<MinutaDaIa>(`/casos/${casoId}/peticao/minuta`, { method: 'POST', corpo: { instrucoes, opcoes, citados: citados(), refazer: true } })
    setEscrevendo(false)
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setMinuta(r.dados)
    if (r.dados.sugestao) setTexto(r.dados.sugestao.texto)
  }

  async function pedir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const chamadaIaId = minuta?.sugestao?.chamadaId
    const corpo = { instrucoes, opcoes, citados: citados(), texto, ...(chamadaIaId && { chamadaIaId }) }
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
      <div className={styles.acoes}>
        <button type="button" className={styles.botaoSecundario} disabled={escrevendo} onClick={() => void escreverDeNovo()}>
          {escrevendo ? 'A IA está escrevendo…' : 'Escrever de novo com a IA'}
        </button>
      </div>
      <p className={styles.dica}>A minuta já veio escrita com o que está marcado. Mudou as instruções, as opções ou os documentos? Escreva de novo.</p>
      {minuta?.motivo && <p className={styles.dica}>{minuta.motivo}</p>}
      {minuta?.aviso && <p className={styles.dica}>{minuta.aviso}</p>}
      {minuta?.sugestao && (
        <section className={styles.cartao} aria-label="Minuta da IA">
          <span className={`${styles.selo} ${styles.seloAlerta}`}>Minuta da IA · revise antes de pedir; você assina o conteúdo (G6)</span>
          {minuta.sugestao.alerta && (
            <p className={styles.erroCampo} role="alert">
              Atenção: {minuta.sugestao.alerta}.
            </p>
          )}
          <p className={styles.dica}>
            Fontes usadas: {minuta.sugestao.fontes.map((f) => f.trecho ?? f.referencia).join(' · ') || 'só os dados do caso'} ({minuta.sugestao.modelo})
          </p>
        </section>
      )}
      <label className={styles.rotulo} htmlFor={ids.texto}>
        Texto da petição (versão 1)
      </label>
      <textarea id={ids.texto} className={styles.campo} rows={14} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <p className={styles.dica}>Escreva, cole ou parta da minuta da IA. O texto vai para a conferência; o que estiver em [completar] é seu.</p>
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
 * "Não está boa?" (GGVP-67 CA1, CA5, CA10): a advogada pede outra versão à IA com o que mudar (épico IA) ou edita ela
 * mesma; nos dois casos, revisa o texto e salva a versão seguinte, numerada. A IA não grava nada (G6).
 */
function EditarEuMesma({ casoId, texto, aoSalvar }: { casoId: string; texto: string; aoSalvar: (t: string) => void }) {
  const ids = { texto: useId(), oQueMudou: useId(), oQueMudar: useId() }
  const [novo, setNovo] = useState(texto)
  const [oQueMudou, setOQueMudou] = useState('')
  const [oQueMudar, setOQueMudar] = useState('')
  const [daIa, setDaIa] = useState<MinutaDaIa | null>(null)
  const [escrevendo, setEscrevendo] = useState(false)
  const [erro, setErro] = useState('')

  async function pedirAIa() {
    const entrada = PedirOutraVersao.safeParse({ oQueMudar })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o que mudar')
    setEscrevendo(true)
    const r = await chamarApi<MinutaDaIa>(`/casos/${casoId}/peticao/versoes/sugestao`, { method: 'POST', corpo: entrada.data })
    setEscrevendo(false)
    if (!r.ok) return setErro(r.erro)
    setErro('')
    setDaIa(r.dados)
    if (!r.dados.sugestao) return
    setNovo(r.dados.sugestao.texto)
    setOQueMudou(entrada.data.oQueMudar)
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const chamadaIaId = daIa?.sugestao?.chamadaId
    const entrada = NovaVersao.safeParse({ texto: novo, oQueMudou, ...(chamadaIaId && { chamadaIaId }) })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a versão.')
    const r = await chamarApi<{ numero: number }>(`/casos/${casoId}/peticao/versoes`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoSalvar(`Versão ${r.dados.numero} salva. Ela precisa de nova conferência.`)
  }

  return (
    <details>
      <summary>Não está boa? Pedir outra versão à IA ou editar eu mesma</summary>
      <section className={styles.cartao} aria-label="Outra versão pela IA">
        <label className={styles.rotulo} htmlFor={ids.oQueMudar}>
          O que mudar
        </label>
        <input id={ids.oQueMudar} className={styles.campo} value={oQueMudar} onChange={(e) => setOQueMudar(e.target.value)} />
        <div className={styles.acoes}>
          <button type="button" className={styles.botaoSecundario} disabled={escrevendo} onClick={() => void pedirAIa()}>
            {escrevendo ? 'A IA está escrevendo…' : 'Pedir outra versão à IA'}
          </button>
        </div>
        {daIa?.motivo && <p className={styles.dica}>{daIa.motivo}</p>}
        {daIa?.sugestao && (
          <>
            <span className={`${styles.selo} ${styles.seloAlerta}`}>Versão da IA · revise antes de salvar; você aprova o conteúdo (G6)</span>
            {daIa.sugestao.alerta && (
              <p className={styles.erroCampo} role="alert">
                Atenção: {daIa.sugestao.alerta}.
              </p>
            )}
          </>
        )}
      </section>
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
        <p className={styles.dica}>As versões anteriores ficam guardadas.</p>
      </form>
    </details>
  )
}

/** Aprovar (GGVP-67 CA2, CA5, CA9; G6, G18): só com as três marcações; aprovada, o pacote vai para o protocolo. */
function AprovarForm({ casoId, numero, texto, aoAprovar }: { casoId: string; numero: number; texto: string; aoAprovar: (t: string) => void }) {
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
    // CA12: a mesma regra do servidor; com [completar] no texto, não envia.
    const falta = faltaCompletar(texto)
    if (falta) return setErro(falta)
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

/** Um documento citado que falta (GGVP-71 CA13): subir o arquivo, usar um documento do caso ou pedir à Documentação. */
function DocumentoQueFalta({ casoId, x, indice, nome, pedido, aoResolver }: { casoId: string; x: PeticaoInicial; indice: number; nome: string; pedido: boolean; aoResolver: (t: string) => void }) {
  const ids = { arquivo: useId(), documento: useId() }
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [documentoId, setDocumentoId] = useState('')
  const [erro, setErro] = useState('')

  async function usar() {
    if (!arquivo && !documentoId) return setErro('Anexe o documento (PDF ou imagem, até 25 MB) ou escolha um documento do caso.')
    const dados = new FormData()
    if (arquivo) dados.set('arquivo', arquivo)
    else dados.set('documentoId', documentoId)
    const r = await chamarApi(`/casos/${casoId}/peticao/citados/${indice}/documento`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    aoResolver(`${nome}: no pacote. O pacote foi gerado de novo.`)
  }

  async function pedirADocumentacao() {
    const r = await chamarApi(`/casos/${casoId}/peticao/citados/${indice}/pedido`, { method: 'POST' })
    if (!r.ok) return setErro(r.erro)
    aoResolver(`${nome}: pedido à Documentação, que recebeu "Cumprir pendência".`)
  }

  return (
    <li>
      Falta: {nome}
      {pedido ? ' · pedido à Documentação' : ''}
      <label className={styles.rotulo} htmlFor={ids.arquivo}>
        Subir o documento
      </label>
      <input id={ids.arquivo} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      <label className={styles.rotulo} htmlFor={ids.documento}>
        Ou usar um documento do caso
      </label>
      <select id={ids.documento} className={styles.campo} value={documentoId} onChange={(e) => setDocumentoId(e.target.value)}>
        <option value="">Escolha</option>
        {x.documentos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
          </option>
        ))}
      </select>
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="button" className={styles.botaoSecundario} onClick={() => void usar()}>
          Usar no pacote
        </button>
        {!pedido && (
          <button type="button" className={styles.botaoSecundario} onClick={() => void pedirADocumentacao()}>
            Pedir à Documentação
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * Protocolar no tribunal (GGVP-71 CA3, CA5, CA6, CA11; G7): o botão do tribunal abre o site de peticionamento numa página
 * nova (o portal não envia nada); "Protocolar no tribunal" só habilita com as travas passando e confirmadas pela
 * evidência, o número do processo, a data e o comprovante.
 */
function ProtocolarForm({ casoId, x, aoProtocolar }: { casoId: string; x: PeticaoInicial; aoProtocolar: (t: string) => void }) {
  const ids = { tribunal: useId(), cnj: useId(), data: useId(), comprovante: useId() }
  const [tribunal, setTribunal] = useState(x.tribunais[0]?.nome ?? '')
  const [cnj, setCnj] = useState('')
  const [data, setData] = useState(() => hojeIso())
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [conferi, setConferi] = useState<Record<string, boolean>>({})
  const [erro, setErro] = useState('')
  const falhando = x.travas.filter((t) => !t.ok)
  const site = x.tribunais.find((t) => t.nome === tribunal)?.site
  const pronto = falhando.length === 0 && x.travas.every((t) => conferi[t.chave]) && Boolean(cnj && data && comprovante)

  async function protocolar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const campos = {
      tribunal,
      numeroCnj: cnj,
      dataProtocolo: isoParaData(data) ?? '',
      conferiTema350: Boolean(conferi.tema350),
      conferiCpf: Boolean(conferi.cpf),
      conferiPacote: Boolean(conferi.pacote),
    }
    const entrada = ProtocolarPeticao.safeParse(campos)
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira o protocolo.')
    if (!comprovante) return setErro('Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).')
    const dados = new FormData()
    for (const [k, v] of Object.entries(campos)) dados.set(k, String(v))
    dados.set('arquivo', comprovante)
    const r = await chamarApi(`/casos/${casoId}/peticao/protocolo`, { method: 'POST', corpo: dados })
    if (!r.ok) return setErro(r.erro)
    aoProtocolar('Petição protocolada. O processo entrou na vigília.')
  }

  return (
    <form className={styles.cartao} onSubmit={protocolar} noValidate aria-label="Protocolar no tribunal">
      <h2 className={styles.cartaoTitulo}>Protocolar no tribunal</h2>
      <fieldset className={styles.cartao} aria-label="Travas">
        <legend className={styles.rotulo}>Travas antes de protocolar (G7)</legend>
        {x.travas.map((t) => (
          <div key={t.chave}>
            <span className={t.ok ? styles.selo : `${styles.selo} ${styles.seloAlerta}`}>
              {t.nome}: {t.ok ? 'ok' : 'falhando'}
            </span>
            <p className={styles.dica}>{t.criterio}</p>
            <p>Evidência: {t.evidencia}</p>
            <label className={styles.escolha}>
              <input type="checkbox" disabled={!t.ok} checked={Boolean(conferi[t.chave])} onChange={() => setConferi((a) => ({ ...a, [t.chave]: !a[t.chave] }))} />
              Conferi {t.nome} pela evidência
            </label>
          </div>
        ))}
      </fieldset>
      <label className={styles.rotulo} htmlFor={ids.tribunal}>
        Tribunal
      </label>
      <select id={ids.tribunal} className={styles.campo} value={tribunal} onChange={(e) => setTribunal(e.target.value)}>
        {x.tribunais.map((t) => (
          <option key={t.nome} value={t.nome}>
            {t.nome}
          </option>
        ))}
      </select>
      {site && (
        <a href={site} target="_blank" rel="noreferrer">
          Abrir o site do tribunal
        </a>
      )}
      <p className={styles.dica}>Baixe os arquivos do pacote e anexe lá; o portal não envia nada ao tribunal.</p>
      <label className={styles.rotulo} htmlFor={ids.cnj}>
        Número do processo (CNJ)
      </label>
      <input
        id={ids.cnj}
        className={styles.campo}
        inputMode="numeric"
        value={cnj}
        onChange={(e) => setCnj(normalizarCnj(e.target.value).length === 20 ? formatarCnj(e.target.value) : e.target.value)}
      />
      <label className={styles.rotulo} htmlFor={ids.data}>
        Data do protocolo
      </label>
      <input id={ids.data} className={styles.campo} type="date" max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} />
      <label className={styles.rotulo} htmlFor={ids.comprovante}>
        Comprovante do protocolo
      </label>
      <input id={ids.comprovante} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
      {falhando.length > 0 && (
        <p className={`${styles.selo} ${styles.seloAlerta}`}>Trava falhando: {falhando.map((t) => t.nome).join(', ')}. O protocolo fica bloqueado.</p>
      )}
      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}
      <div className={styles.acoes}>
        <button type="submit" className={styles.botao} disabled={!pronto}>
          Protocolar no tribunal
        </button>
      </div>
    </form>
  )
}

/**
 * Petição inicial (GGVP-63, GGVP-67, GGVP-71): com todos os setores do despacho fechados, a advogada pede a petição (CA1);
 * antes disso, o pedido fica bloqueado e diz quem falta. Depois, confere a versão inteira, com o que mudou desde a anterior,
 * edita ela mesma ou aprova; aprovada, baixa o pacote, confere as três travas e registra o protocolo.
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
        {x.cliente} · {nomeDoBeneficio(x.beneficio)}
      </p>

      {feito && (
        <p className={styles.sucesso} role="status">
          {feito}
        </p>
      )}

      {/* GGVP-151 CA4: a chance só na tela, à parte da minuta; nenhum número vai ao texto que vai ao juiz. */}
      <ChanceDoCaso casoId={casoId} />

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

      {x.podeAprovar && x.atual && <AprovarForm key={x.atual.numero} casoId={casoId} numero={x.atual.numero} texto={x.atual.texto} aoAprovar={aoMudar} />}

      {x.protocolo && (
        <section className={styles.cartao} aria-label="Protocolo">
          <h2 className={styles.cartaoTitulo}>Protocolada</h2>
          <p>
            Em {dia(x.protocolo.em)} no tribunal {x.protocolo.tribunal} · processo {formatarCnj(x.protocolo.numero)} · versão {x.protocolo.versao} · por {x.protocolo.por}
          </p>
          <p className={styles.dica}>O processo entrou na vigília das publicações.</p>
        </section>
      )}

      {x.pacote && (
        <section className={styles.cartao} aria-label="Pacote">
          <h2 className={styles.cartaoTitulo}>Pacote do protocolo</h2>
          <ol className={styles.lista}>
            {x.pacote.map((a) => (
              <li key={a.documentoId}>
                <a href={`/api/casos/${casoId}/documentos/${a.documentoId}`} target="_blank" rel="noreferrer">
                  {a.nome}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!x.pacote && x.podeProtocolar && (
        <section className={styles.cartao} aria-label="Pacote">
          <p className={`${styles.selo} ${styles.seloAlerta}`}>O pacote ainda não foi gerado.</p>
          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.botaoSecundario}
              onClick={() =>
                void chamarApi(`/casos/${casoId}/peticao/pacote`, { method: 'POST' }).then((r) => (r.ok ? aoMudar('Pacote gerado.') : setErro(r.erro)))
              }
            >
              Gerar o pacote
            </button>
          </div>
        </section>
      )}

      {x.podeProtocolar && x.pedido && x.pedido.citados.some((c) => !c.documentoId) && (
        <section className={styles.cartao} aria-label="Documentos que faltam">
          <h2 className={styles.cartaoTitulo}>Documentos que faltam no pacote</h2>
          <ul className={styles.lista}>
            {x.pedido.citados.map((c, i) =>
              c.documentoId ? null : (
                <DocumentoQueFalta key={`${i}-${c.nome}`} casoId={casoId} x={x} indice={i} nome={c.nome} pedido={c.pedidoADocumentacao} aoResolver={aoMudar} />
              ),
            )}
          </ul>
        </section>
      )}

      {x.podeProtocolar && <ProtocolarForm casoId={casoId} x={x} aoProtocolar={aoMudar} />}
      {x.podeEditar && x.atual && <EditarEuMesma key={`e${x.atual.numero}`} casoId={casoId} texto={x.atual.texto} aoSalvar={aoMudar} />}
    </main>
  )
}
