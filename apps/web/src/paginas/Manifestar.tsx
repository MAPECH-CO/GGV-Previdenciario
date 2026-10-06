import { useEffect, useId, useState } from 'react'
import { hojeIso, isoParaData } from '@ggv/campos'
import { AprovarVersao, AutorizarDilacao, EncerrarSemProva, ProtocolarManifestacao, RegistrarIndisponibilidade, type Manifestacao } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import styles from './Passo.module.css'

const dia = (iso: string | null) => (iso ? (isoParaData(iso.slice(0, 10)) ?? iso) : '—')
const ROTULO_TIPO = { manifestacao: 'Manifestação', dilacao: 'Pedido de dilação' } as const
type Pendente = Manifestacao['pendentes'][number]

/**
 * Um item ou perícia que falta (G21). Se o documento não existe ou a perícia não tem como ser feita, a advogada encerra
 * com o motivo, que fica como a prova em texto do item (GGVP-68 CA2; ajuste do Mateus, 06/10).
 */
function LinhaPendente({ casoId, p, podeEncerrar, aoEncerrar }: { casoId: string; p: Pendente; podeEncerrar: boolean; aoEncerrar: (texto: string) => void }) {
  const idMotivo = useId()
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')

  async function encerrar() {
    const entrada = EncerrarSemProva.safeParse({ alvo: p.alvo, id: p.id, motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const r = await chamarApi(`/casos/${casoId}/manifestacao/sem-prova`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    aoEncerrar(`${p.descricao}: encerrado sem a prova, com o motivo. Explique isso na manifestação.`)
  }

  return (
    <li>
      {p.setor} · {p.descricao}
      {p.prazoInterno ? ` · até ${dia(p.prazoInterno)}` : ''}
      {podeEncerrar && (
        <details>
          <summary>{p.alvo === 'pericia' ? 'A perícia não tem como ser feita?' : 'O documento não existe?'} Manifestar sem essa prova</summary>
          <label className={styles.rotulo} htmlFor={idMotivo}>
            Por que vai manifestar sem essa prova
          </label>
          <input id={idMotivo} className={styles.campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          {erro && (
            <p className={styles.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={styles.acoes}>
            <button type="button" className={styles.botaoSecundario} onClick={() => void encerrar()}>
              Encerrar sem a prova
            </button>
          </div>
          <p className={styles.dica}>O motivo fica registrado com o seu nome e a data, e vai junto no histórico do protocolo.</p>
        </details>
      )}
    </li>
  )
}

/**
 * Manifestar e protocolar (GGVP-87). Sem IA, a advogada redige fora do portal e anexa a versão; aprova (G6); protocola
 * só com a versão aprovada e todos os itens provados (G21), ou o pedido de dilação com o OK da Sênior (CA12).
 */
export function Manifestar({ casoId }: { casoId: string }) {
  const ids = { tipo: useId(), versao: useId(), aprovei: useId(), data: useId(), comprovante: useId(), motivo: useId(), volta: useId(), prova: useId() }
  const [m, setM] = useState<Manifestacao | null>(null)
  const [versaoDaTela, setVersaoDaTela] = useState(0)
  const [tipo, setTipo] = useState<'manifestacao' | 'dilacao'>('manifestacao')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [aprovei, setAprovei] = useState(false)
  const [dataProtocolo, setDataProtocolo] = useState(() => hojeIso())
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [motivo, setMotivo] = useState('')
  const [voltouEm, setVoltouEm] = useState('')
  const [prova, setProva] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const pronto = (texto: string) => {
    setErro('')
    setFeito(texto)
    setVersaoDaTela((v) => v + 1)
  }

  useEffect(() => {
    void chamarApi<Manifestacao>(`/casos/${casoId}/manifestacao`).then((r) => (r.ok ? setM(r.dados) : setErro(r.erro)))
  }, [casoId, versaoDaTela])

  const comArquivo = (campos: Record<string, string>, nome: string, f: File) => {
    const dados = new FormData()
    for (const [k, v] of Object.entries(campos)) dados.set(k, v)
    dados.set(nome, f)
    return dados
  }

  async function anexar() {
    if (!arquivo) return setErro('Anexe a versão da manifestação (PDF ou imagem, até 25 MB).')
    const r = await chamarApi<{ numero: number }>(`/casos/${casoId}/manifestacao/versoes`, { method: 'POST', corpo: comArquivo({ tipo }, 'arquivo', arquivo) })
    if (!r.ok) return setErro(r.erro)
    setAprovei(false)
    pronto(`Versão ${r.dados.numero} anexada. Confira e aprove.`)
  }

  async function aprovar(numero: number) {
    const entrada = AprovarVersao.safeParse({ aprovei })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Marque a aprovação.')
    const r = await chamarApi(`/casos/${casoId}/manifestacao/versoes/${numero}/aprovacao`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    pronto(`Versão ${numero} aprovada.`)
  }

  async function protocolar() {
    const data = isoParaData(dataProtocolo) ?? ''
    const entrada = ProtocolarManifestacao.safeParse({ dataProtocolo: data })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a data.')
    if (!comprovante) return setErro('Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).')
    const r = await chamarApi<{ tipo: string }>(`/casos/${casoId}/manifestacao/protocolo`, { method: 'POST', corpo: comArquivo({ dataProtocolo: data }, 'arquivo', comprovante) })
    if (!r.ok) return setErro(r.erro)
    pronto(r.dados.tipo === 'dilacao' ? 'Pedido de dilação protocolado. Os setores seguem cumprindo.' : 'Manifestação protocolada. O processo voltou para a vigília.')
  }

  async function autorizarDilacao() {
    const entrada = AutorizarDilacao.safeParse({ motivo })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const r = await chamarApi(`/casos/${casoId}/manifestacao/dilacao`, { method: 'POST', corpo: entrada.data })
    if (!r.ok) return setErro(r.erro)
    pronto('Dilação autorizada. A advogada pode protocolar o pedido.')
  }

  async function registrarIndisponibilidade() {
    const data = isoParaData(voltouEm) ?? ''
    const entrada = RegistrarIndisponibilidade.safeParse({ voltouEm: data })
    if (!entrada.success) return setErro(entrada.error.issues[0]?.message ?? 'Confira a data.')
    if (!prova) return setErro('Anexe a prova da indisponibilidade (PDF ou imagem, até 25 MB).')
    const r = await chamarApi<{ prazo: string }>(`/casos/${casoId}/manifestacao/indisponibilidade`, { method: 'POST', corpo: comArquivo({ voltouEm: data }, 'arquivo', prova) })
    if (!r.ok) return setErro(r.erro)
    pronto(`Indisponibilidade registrada. O prazo passou para ${dia(r.dados.prazo)}.`)
  }

  if (!m)
    return (
      <main className={styles.pagina}>
        <title>Manifestar no processo · GGV Previdenciário</title>
        {erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </main>
    )

  const ultima = m.versoes.at(-1)

  return (
    <main className={styles.pagina}>
      <title>Manifestar no processo · GGV Previdenciário</title>
      <a className={styles.voltar} href="/">
        ← Voltar ao início
      </a>
      <h1 className={styles.titulo}>Manifestar no processo</h1>
      <p className={styles.subtitulo}>
        {m.cliente} · prazo até {dia(m.prazo.fim)}
      </p>
      {m.prazo.regra && <p className={styles.dica}>{m.prazo.regra}</p>}

      {m.protocolo ? (
        <p className={styles.sucesso} aria-label="Protocolo">
          {ROTULO_TIPO[m.protocolo.tipo as keyof typeof ROTULO_TIPO] ?? m.protocolo.tipo} protocolada em {dia(m.protocolo.em)} · versão {m.protocolo.versao} · por {m.protocolo.por}
        </p>
      ) : m.faltam.length > 0 ? (
        <section className={styles.cartao} aria-label="Bloqueado">
          <p className={styles.erro}>Manifestar bloqueado: falta {m.faltam.join(', ')} (G21).</p>
          <ul className={styles.lista} aria-label="Pendentes">
            {m.pendentes.map((p) => (
              <LinhaPendente key={p.id} casoId={casoId} p={p} podeEncerrar={m.podeEncerrarSemProva} aoEncerrar={pronto} />
            ))}
          </ul>
        </section>
      ) : (
        <p className={styles.selo}>Todos os setores subiram a prova. Pode manifestar.</p>
      )}

      {m.semProva.length > 0 && (
        <section className={styles.cartao} aria-label="Sem a prova">
          <h2 className={styles.cartaoTitulo}>Encerrados sem a prova</h2>
          <p className={styles.dica}>Explique ao juiz, na manifestação, por que estes itens vão sem a prova.</p>
          <ul className={styles.lista}>
            {m.semProva.map((e) => (
              <li key={e.descricao + e.em}>
                {e.descricao} · {e.motivo} · {e.por} em {dia(e.em)}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {m.versoes.length > 0 && (
        <section className={styles.cartao} aria-label="Versões">
          <h2 className={styles.cartaoTitulo}>Versões</h2>
          <ol className={styles.lista}>
            {m.versoes.map((v) => (
              <li key={v.numero}>
                {ROTULO_TIPO[v.tipo]} · versão {v.numero} · {v.arquivo} · {v.por} em {dia(v.em)}
                {v.aprovadaPor ? ` · aprovada por ${v.aprovadaPor}` : ' · não aprovada'}
              </li>
            ))}
          </ol>
          {m.podeAnexar && ultima && !ultima.aprovadaEm && (
            <>
              <label className={styles.escolha} htmlFor={ids.aprovei}>
                <input id={ids.aprovei} type="checkbox" checked={aprovei} onChange={(e) => setAprovei(e.target.checked)} />
                Aprovei a versão da manifestação (G6)
              </label>
              <div className={styles.acoes}>
                <button type="button" className={styles.botao} disabled={!aprovei} onClick={() => void aprovar(ultima.numero)}>
                  Aprovar a versão {ultima.numero}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {m.podeAnexar && (
        <section className={styles.cartao} aria-label="Anexar versão">
          <h2 className={styles.cartaoTitulo}>Anexar versão</h2>
          <label className={styles.rotulo} htmlFor={ids.tipo}>
            Peça
          </label>
          <select id={ids.tipo} className={styles.campo} value={tipo} onChange={(e) => setTipo(e.target.value as 'manifestacao' | 'dilacao')}>
            <option value="manifestacao">Manifestação</option>
            <option value="dilacao">Pedido de dilação (com o OK da Sênior)</option>
          </select>
          <label className={styles.rotulo} htmlFor={ids.versao}>
            Arquivo da versão
          </label>
          <input id={ids.versao} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          <div className={styles.acoes}>
            <button type="button" className={styles.botaoSecundario} onClick={() => void anexar()}>
              Anexar versão
            </button>
          </div>
          <p className={styles.dica}>Versão nova depois da aprovação precisa de nova aprovação antes do protocolo.</p>
        </section>
      )}

      {m.podeAnexar && (
        <section className={styles.cartao} aria-label="Protocolar">
          <h2 className={styles.cartaoTitulo}>Manifestar e protocolar</h2>
          <label className={styles.rotulo} htmlFor={ids.data}>
            Data do protocolo
          </label>
          <input id={ids.data} className={styles.campo} type="date" max={hojeIso()} value={dataProtocolo} onChange={(e) => setDataProtocolo(e.target.value)} />
          <label className={styles.rotulo} htmlFor={ids.comprovante}>
            Comprovante do protocolo
          </label>
          <input id={ids.comprovante} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setComprovante(e.target.files?.[0] ?? null)} />
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} disabled={!m.podeProtocolar} onClick={() => void protocolar()}>
              Manifestar e protocolar
            </button>
          </div>
          <details>
            <summary>O sistema do tribunal ficou fora do ar no último dia?</summary>
            <label className={styles.rotulo} htmlFor={ids.volta}>
              Voltou em
            </label>
            <input id={ids.volta} className={styles.campo} type="date" value={voltouEm} onChange={(e) => setVoltouEm(e.target.value)} />
            <label className={styles.rotulo} htmlFor={ids.prova}>
              Prova da indisponibilidade
            </label>
            <input id={ids.prova} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setProva(e.target.files?.[0] ?? null)} />
            <div className={styles.acoes}>
              <button type="button" className={styles.botaoSecundario} onClick={() => void registrarIndisponibilidade()}>
                Registrar e recontar o prazo
              </button>
            </div>
          </details>
        </section>
      )}

      {m.podeAutorizarDilacao && (
        <section className={styles.cartao} aria-label="Dilação">
          <h2 className={styles.cartaoTitulo}>Autorizar o pedido de dilação</h2>
          <label className={styles.rotulo} htmlFor={ids.motivo}>
            Motivo
          </label>
          <input id={ids.motivo} className={styles.campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className={styles.acoes}>
            <button type="button" className={styles.botao} onClick={() => void autorizarDilacao()}>
              Autorizar a dilação
            </button>
          </div>
        </section>
      )}
    </main>
  )
}
